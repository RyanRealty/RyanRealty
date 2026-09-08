/**
 * response-clock-run — the timer half of SITE-09.
 *
 * Every five minutes: take every site submit from the last 26 hours, ask
 * lib/crm/response-clock.ts whether a human has touched it, and raise a flag
 * when nobody has. The RULES live in that pure module and are unit-tested; this
 * file is the reads, the writes, and nothing else, so the cron route and the
 * admin panel can share one population and one predicate rather than drifting
 * into two definitions of "untouched".
 *
 * IDEMPOTENT BY CONSTRUCTION. Every write is keyed:
 *   crm_timeline.dedupe_key  response-clock:{5m|24h|touched}:<personId>
 *   crm_broker_alerts        via queueBrokerAlert's own alert:<kind>:<personId>
 *   crm_people.custom        response_clock.{flag5mAt,flag24hAt,touchedAt}
 * so two overlapping runs converge on the same state and the second one writes
 * nothing. That is the whole concurrency story — there is no lease.
 *
 * DAL boundary: lib/crm/ is a declared write-path prefix (check-dal-boundary.mjs),
 * the same exemption the sequence engine and the enrollment runtime use.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { BROKER_ALERT_ORIGIN, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { hasFleetTestTag } from '@/lib/crm/fleet-test-identity'
import {
  HUMAN_TOUCH_KINDS,
  classify,
  formatAge,
  hasProvenanceStamp,
  isHumanTouch,
  isSiteSubmit,
  leadCreatedAt,
  type FirstTouch,
  type LeadLike,
  type ResponseClockDecision,
} from '@/lib/crm/response-clock'

/** The flag ledger, stored on crm_people.custom so no migration is needed. */
export type ResponseClockCustom = {
  flag5mAt?: string | null
  flag24hAt?: string | null
  touchedAt?: string | null
}

export type ClockLead = LeadLike & {
  name: string | null
  assignedBroker: string | null
  ask: string
  flags: ResponseClockCustom
}

export type ClockAction = {
  personId: number
  name: string | null
  source: string | null
  ask: string
  broker: string
  state: ResponseClockDecision['state']
  reason: string
  ageMinutes: number
  dueAt: string
  /** What the run did (or, on a dry run, would do). */
  wrote: 'alert-5m' | 'alert-24h' | 'cleared' | 'none'
}

export type ResponseClockRun = {
  scanned: number
  touched: number
  waiting: number
  flagged5m: number
  flagged24h: number
  cleared: number
  actions: ClockAction[]
  windowStart: string
  now: string
  dry: boolean
}

/** How far back the timer looks. 26h > the 24h rule, so nothing ages out unflagged. */
export const RESPONSE_CLOCK_WINDOW_HOURS = 26

const PERSON_COLS = 'id,name,source,tags,created_at,fub_created_at,assigned_broker,custom'
/** PostgREST URL-length safety on the .in() clause, same bound the reports use. */
const ID_CHUNK = 200
const PAGE_SIZE = 1000
/** Ceiling on one pass. 197 people were created in the 28 days to 2026-09-08, so
 *  this is four orders of magnitude of headroom, not a real bound. */
const MAX_SCAN = 20_000

type PersonRow = {
  id: number
  name: string | null
  source: string | null
  tags: string[] | null
  created_at: string | null
  fub_created_at: string | null
  assigned_broker: string | null
  custom: Record<string, unknown> | null
}

/**
 * What this person asked us for, in the words a broker glancing at a text needs.
 * Read off the tags, the source and the address the intake stamped into custom —
 * no extra query, and it degrades to "to talk to a broker", which is true of
 * every one of these rows.
 */
export function askOf(person: {
  source?: string | null
  tags?: readonly string[] | null
  custom?: Record<string, unknown> | null
}): string {
  const tags = (person.tags ?? []).map((t) => String(t).toLowerCase())
  const source = String(person.source ?? '').toLowerCase()
  const custom = person.custom ?? {}
  const address =
    [custom.sellerPropertyAddress, custom.subjectAddress, custom.subjectPropertyAddress]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v && v.toLowerCase() !== 'unspecified') ?? ''

  if (tags.includes('intent:expired-listing') || source === 'expired-lp') {
    return address ? `help with ${address}, an expired listing` : 'help with an expired listing'
  }
  const isValuation =
    tags.includes('audience:seller') ||
    ['seller-lp', 'list-now-lp', 'place-page'].includes(source) ||
    tags.some((t) => ['source:seller-lp', 'source:list-now-lp', 'source:place-page'].includes(t))
  if (isValuation) return address ? `what ${address} is worth` : 'a valuation'
  if (source === 'website-booking' || tags.includes('source:website-booking')) return 'a time on the calendar'
  if (source === 'idx-registration' || tags.includes('source:idx-registration')) return 'listing alerts'
  if (source === 'buyer-lp' || tags.includes('source:buyer-lp')) return 'listing alerts'
  return 'to talk to a broker'
}

/** Every site submit inside the window that the clock is allowed to flag. */
export async function loadClockPopulation(
  sb: ReturnType<typeof createServiceClient>,
  opts: { windowHours?: number; now?: Date } = {},
): Promise<{ leads: ClockLead[]; windowStart: string }> {
  const now = opts.now ?? new Date()
  const windowStart = new Date(
    now.getTime() - (opts.windowHours ?? RESPONSE_CLOCK_WINDOW_HOURS) * 3600_000,
  ).toISOString()

  // Paginated: rows.length is never a count (the 1000-row PostgREST cap is the
  // defect that silently truncates every un-ranged read in this repo).
  const rows: PersonRow[] = []
  for (let offset = 0; offset < MAX_SCAN; offset += PAGE_SIZE) {
    const { data, error } = await sb
      .from('crm_people')
      .select(PERSON_COLS)
      .gte('created_at', windowStart)
      // Stable order on the unique id: .range() without a deterministic sort can
      // drop or repeat rows across page boundaries.
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('[response-clock] population read failed:', error.message)
      break
    }
    const page = (data ?? []) as PersonRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const leads: ClockLead[] = []
  for (const row of rows) {
    const tags = row.tags ?? []
    // The fleet's test identity submits the real forms on purpose; it must never
    // wake a broker. Hard-stopped people are not contacted at all.
    if (hasFleetTestTag(tags) || tags.includes('compliance:hard-stop')) continue
    const lead: LeadLike = {
      personId: row.id,
      source: row.source,
      tags,
      createdAt: row.created_at,
      fubCreatedAt: row.fub_created_at,
    }
    if (!isSiteSubmit(lead)) continue
    if (!leadCreatedAt(lead)) continue
    const custom = (row.custom ?? {}) as Record<string, unknown>
    const flags = (custom.response_clock ?? {}) as ResponseClockCustom
    leads.push({
      ...lead,
      name: row.name,
      assignedBroker: row.assigned_broker,
      ask: askOf({ source: row.source, tags, custom }),
      flags,
    })
  }
  return { leads, windowStart }
}

/**
 * First HUMAN touch per person. Reads only the outbound kinds, then applies
 * isHumanTouch — a system confirmation is on the same kind and the same source
 * as a broker's reply, so the filter cannot live in the query.
 */
export async function loadFirstHumanTouches(
  sb: ReturnType<typeof createServiceClient>,
  personIds: readonly number[],
  since: string,
): Promise<Map<number, FirstTouch>> {
  const out = new Map<number, FirstTouch>()
  if (personIds.length === 0) return out
  const chunks: number[][] = []
  for (let i = 0; i < personIds.length; i += ID_CHUNK) chunks.push(personIds.slice(i, i + ID_CHUNK))

  await Promise.all(
    chunks.map(async (chunk) => {
      for (let offset = 0; offset < MAX_SCAN; offset += PAGE_SIZE) {
        const { data, error } = await sb
          .from('crm_timeline')
          .select('person_id,ts,kind,source,broker,payload')
          .in('person_id', chunk)
          .in('kind', [...HUMAN_TOUCH_KINDS])
          .gte('ts', since)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) {
          console.error('[response-clock] touch read failed:', error.message)
          return
        }
        const page = data ?? []
        for (const row of page) {
          if (!isHumanTouch(row)) continue
          const pid = Number(row.person_id)
          const ts = String(row.ts)
          const seen = out.get(pid)
          if (!seen || ts < seen.ts) out.set(pid, { ts, stamped: hasProvenanceStamp(row) })
        }
        if (page.length < PAGE_SIZE) break
      }
    }),
  )
  return out
}

/** Two lines: what happened, then the labelled link (Matt 2026-08-25). */
export function untouchedAlertBody(lead: {
  name: string | null
  ask: string
  personId: number
  ageMinutes: number
}): string {
  return [
    `Untouched ${formatAge(lead.ageMinutes)}: ${lead.name ?? 'Someone'} asked for ${lead.ask}`,
    `View lead: ${BROKER_ALERT_ORIGIN}/admin/people/${lead.personId}`,
  ].join('\n')
}

async function writeFlag(
  sb: ReturnType<typeof createServiceClient>,
  lead: ClockLead,
  patch: ResponseClockCustom,
  tagOp: 'add' | 'remove',
): Promise<void> {
  const { data } = await sb.from('crm_people').select('custom,tags').eq('id', lead.personId).maybeSingle()
  const custom = { ...((data?.custom as Record<string, unknown> | null) ?? {}) }
  custom.response_clock = { ...((custom.response_clock as ResponseClockCustom | undefined) ?? {}), ...patch }
  const current = ((data?.tags as string[] | null) ?? []).filter((t) => t !== 'response-clock:untouched')
  const tags = tagOp === 'add' ? [...current, 'response-clock:untouched'] : current
  await sb
    .from('crm_people')
    .update({ custom, tags, updated_at: new Date().toISOString() })
    .eq('id', lead.personId)
}

/**
 * One pass. `dry` computes every decision and writes nothing, which is how the
 * route is verified against live data without waking a broker.
 */
export async function runResponseClock(opts: { dry?: boolean; now?: Date } = {}): Promise<ResponseClockRun> {
  const sb = createServiceClient()
  const now = opts.now ?? new Date()
  const dry = opts.dry === true
  const { leads, windowStart } = await loadClockPopulation(sb, { now })
  const touches = await loadFirstHumanTouches(sb, leads.map((l) => l.personId), windowStart)

  const run: ResponseClockRun = {
    scanned: leads.length,
    touched: 0,
    waiting: 0,
    flagged5m: 0,
    flagged24h: 0,
    cleared: 0,
    actions: [],
    windowStart,
    now: now.toISOString(),
    dry,
  }

  for (const lead of leads) {
    const created = leadCreatedAt(lead)
    if (!created) continue
    const firstHumanTouchAt = touches.get(lead.personId)?.ts ?? null
    const decision = classify({ createdAt: created, now, firstHumanTouchAt, flags: lead.flags })
    // Unassigned routes to Matt, the principal broker — same rule queueBrokerAlert
    // applies internally, named here so the record says who was paged.
    const broker = lead.assignedBroker ?? 'matt'
    let wrote: ClockAction['wrote'] = 'none'

    if (decision.state === 'touched') {
      run.touched++
      // Only worth a write when a flag is standing: clear the tag so the panel
      // and the broker's list stop showing a lead somebody already answered.
      if ((lead.flags.flag5mAt || lead.flags.flag24hAt) && !lead.flags.touchedAt) {
        wrote = 'cleared'
        run.cleared++
        if (!dry) {
          await sb.from('crm_timeline').insert({
            person_id: lead.personId,
            kind: 'system',
            title: 'Response clock: answered',
            body: `First human touch at ${firstHumanTouchAt}.`,
            payload: { firstHumanTouchAt, ageMinutes: decision.ageMinutes },
            source: 'response-clock',
            dedupe_key: `response-clock:touched:${lead.personId}`,
          })
          await writeFlag(sb, lead, { touchedAt: firstHumanTouchAt }, 'remove')
        }
      }
    } else if (decision.state === 'flag5m') {
      wrote = 'alert-5m'
      run.flagged5m++
      if (!dry) {
        await sb.from('crm_timeline').insert({
          person_id: lead.personId,
          kind: 'system',
          title: 'Response clock: untouched after 5 minutes',
          body: `${lead.name ?? 'Someone'} asked for ${lead.ask}. No human touch ${formatAge(decision.ageMinutes)} after the submit.`,
          payload: { ask: lead.ask, dueAt: decision.dueAt, ageMinutes: decision.ageMinutes, broker },
          broker,
          source: 'response-clock',
          dedupe_key: `response-clock:5m:${lead.personId}`,
        })
        await queueBrokerAlert({
          broker,
          personId: lead.personId,
          kind: 'untouched-5m',
          body: untouchedAlertBody({ ...lead, ageMinutes: decision.ageMinutes }),
        })
        await writeFlag(sb, lead, { flag5mAt: now.toISOString() }, 'add')
      }
    } else if (decision.state === 'flag24h') {
      wrote = 'alert-24h'
      run.flagged24h++
      if (!dry) {
        await sb.from('crm_timeline').insert({
          person_id: lead.personId,
          kind: 'system',
          title: 'Response clock: untouched after 24 hours',
          body: `${lead.name ?? 'Someone'} asked for ${lead.ask}. Still no human touch after a full day.`,
          payload: { ask: lead.ask, dueAt: decision.dueAt, ageMinutes: decision.ageMinutes, broker: 'matt' },
          broker: 'matt',
          source: 'response-clock',
          dedupe_key: `response-clock:24h:${lead.personId}`,
        })
        // 24 hours is a shop problem, not a broker's: it goes to the principal
        // broker whoever the lead was assigned to.
        await queueBrokerAlert({
          broker: 'matt',
          personId: lead.personId,
          kind: 'untouched-24h',
          body: untouchedAlertBody({ ...lead, ageMinutes: decision.ageMinutes }),
        })
        await writeFlag(sb, lead, { flag24hAt: now.toISOString() }, 'add')
      }
    } else if (decision.state === 'waiting') {
      run.waiting++
    }

    if (wrote !== 'none' || decision.state === 'flag5m' || decision.state === 'flag24h') {
      run.actions.push({
        personId: lead.personId,
        name: lead.name,
        source: lead.source ?? null,
        ask: lead.ask,
        broker,
        state: decision.state,
        reason: decision.reason,
        ageMinutes: decision.ageMinutes,
        dueAt: decision.dueAt,
        wrote,
      })
    }
  }

  return run
}
