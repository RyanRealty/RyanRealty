/**
 * getWestsideCohortActivity — the West Side cohort activity reader.
 *
 * westside_parcels is the parcel-to-person ledger for the Bend west side farm
 * (person_id links a parcel owner to a crm_people row). Nothing previously
 * reported on that cohort as a group: "which parcel-linked people visited the
 * site, opened an email, clicked, or messaged us this week" had no surface.
 * This DAL powers both the /admin/crm/reporting/westside page and the weekly
 * /api/cron/westside-cohort-digest email.
 *
 * QUERY SHAPE (4 window-scoped reads + 1 chunked name lookup — never per-person
 * N+1; all paged through fetchPagedRows with a stable order so PostgREST's
 * 1,000-row response cap cannot silently truncate):
 *
 *   Q1 westside_parcels   .not(person_id is null)                — the cohort
 *   Q2 visitor_sessions   .not(crm_person_id is null)            — site visits
 *                         .gte(last_seen_at, windowStart)          (native
 *                         identity column crm_person_id; the legacy
 *                         fub_person_id column is ignored)
 *   Q3 email_events       .in(event, [open, click])              — engagement
 *                         .not(person_id is null)
 *                         .gte(occurred_at, windowStart)
 *   Q4 crm_timeline       .in(kind, INBOUND_TIMELINE_KINDS)      — inbound
 *                         .gte(ts, windowStart)                    messages
 *   Q5 crm_people         .in(id, top-ranked active ids)         — display
 *                         chunked at 150 ids per request           names only
 *
 * Q2–Q4 are window-first (small sets for a 7–30 day window) and intersected
 * with the Q1 cohort in memory — cheaper and simpler than pushing thousands of
 * cohort person ids into .in() filters. The fold/rank step is pure
 * (rankCohortActivity) and unit-tested in getWestsideCohortActivity.test.ts.
 *
 * DAL boundary (G1): every raw .from() read lives here in lib/data/.
 * createServiceClient bypasses RLS (callers are the admin page, which guards
 * with getCrmAccess, and the cron, which guards with requireCronAuth).
 */
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { INBOUND_TIMELINE_KINDS } from './getBrokerDigest'

// ── Row types (exactly the columns each query selects) ──────────────────────

export type WestsideParcelRow = {
  apn: string
  site_street: string | null
  site_city: string | null
  person_id: number
}

export type CohortSessionRow = {
  crm_person_id: number
  session_id: string
  last_seen_at: string
  engagement_score: number | null
}

export type CohortEmailEventRow = {
  person_id: number
  event: string
  occurred_at: string
}

export type CohortInboundRow = {
  person_id: number
  kind: string
  ts: string
}

// ── Output types ─────────────────────────────────────────────────────────────

export type CohortParcelRef = {
  apn: string
  siteStreet: string | null
  siteCity: string | null
}

export type RankedCohortPerson = {
  personId: number
  /** Parcels this person is linked to (multi-property owners carry several). */
  parcels: CohortParcelRef[]
  /** Distinct visitor sessions active in the window. */
  visits: number
  opens: number
  clicks: number
  /** Inbound messages (sms_in / email_in / form_submit / voicemail). */
  inbound: number
  /** Weighted activity score — see ACTIVITY_WEIGHTS. */
  score: number
  /** Most recent signal timestamp across all sources, ISO. */
  lastSeenIso: string
  // Filled by the name lookup (Q5); null when the crm_people row is missing.
  name: string | null
  stage: string | null
  assignedBroker: string | null
}

export type WestsideCohortRollup = {
  /** Distinct people linked to at least one parcel. */
  identifiedPeople: number
  /** Parcels carrying a person_id link. */
  linkedParcels: number
  /** Cohort members with at least one signal in the window. */
  activePeople: number
  /** Distinct cohort visitor sessions active in the window. */
  siteVisits: number
  opens: number
  clicks: number
  inboundMessages: number
}

export type WestsideCohortActivity = {
  sinceDays: number
  windowStartIso: string
  fetchedAtIso: string
  rollup: WestsideCohortRollup
  /** Active people ranked by score desc (lastSeen desc, personId asc tiebreak). */
  people: RankedCohortPerson[]
}

// ── Pure fold/rank (exported for the unit test) ──────────────────────────────

/**
 * Signal weights. An inbound message is the strongest signal (the person
 * reached out), a live site session beats a click, a click beats an open.
 */
export const ACTIVITY_WEIGHTS = { visit: 4, click: 3, open: 1, inbound: 6 } as const

/** Clamp the window to something sane; the weekly digest uses 7. */
export function clampSinceDays(n: number | undefined): number {
  if (!Number.isFinite(n) || !n) return 7
  return Math.min(90, Math.max(1, Math.floor(n as number)))
}

type Tally = {
  parcels: CohortParcelRef[]
  visits: number
  opens: number
  clicks: number
  inbound: number
  lastSeenIso: string | null
}

/**
 * Intersect the window-scoped activity rows with the parcel-linked cohort and
 * rank. Pure: no I/O, deterministic ordering (score desc, lastSeen desc,
 * personId asc). Activity from people NOT in the cohort is dropped — this
 * report is only about parcel-linked owners.
 */
export function rankCohortActivity(input: {
  parcels: WestsideParcelRow[]
  sessions: CohortSessionRow[]
  emailEvents: CohortEmailEventRow[]
  inbound: CohortInboundRow[]
}): { people: Array<Omit<RankedCohortPerson, 'name' | 'stage' | 'assignedBroker'>>; rollup: WestsideCohortRollup } {
  const byPerson = new Map<number, Tally>()
  for (const p of input.parcels) {
    if (!Number.isFinite(p.person_id)) continue
    const t = byPerson.get(p.person_id) ?? {
      parcels: [], visits: 0, opens: 0, clicks: 0, inbound: 0, lastSeenIso: null,
    }
    t.parcels.push({ apn: p.apn, siteStreet: p.site_street, siteCity: p.site_city })
    byPerson.set(p.person_id, t)
  }

  const bump = (t: Tally, iso: string | null) => {
    if (iso && (!t.lastSeenIso || iso > t.lastSeenIso)) t.lastSeenIso = iso
  }

  let siteVisits = 0
  const seenSessions = new Set<string>()
  for (const s of input.sessions) {
    const t = byPerson.get(s.crm_person_id)
    if (!t) continue
    if (seenSessions.has(s.session_id)) continue
    seenSessions.add(s.session_id)
    t.visits += 1
    siteVisits += 1
    bump(t, s.last_seen_at)
  }

  let opens = 0
  let clicks = 0
  for (const e of input.emailEvents) {
    const t = byPerson.get(e.person_id)
    if (!t) continue
    if (e.event === 'open') { t.opens += 1; opens += 1 }
    else if (e.event === 'click') { t.clicks += 1; clicks += 1 }
    else continue
    bump(t, e.occurred_at)
  }

  let inboundMessages = 0
  for (const m of input.inbound) {
    const t = byPerson.get(m.person_id)
    if (!t) continue
    t.inbound += 1
    inboundMessages += 1
    bump(t, m.ts)
  }

  const active: Array<Omit<RankedCohortPerson, 'name' | 'stage' | 'assignedBroker'>> = []
  for (const [personId, t] of byPerson) {
    const score =
      t.visits * ACTIVITY_WEIGHTS.visit +
      t.clicks * ACTIVITY_WEIGHTS.click +
      t.opens * ACTIVITY_WEIGHTS.open +
      t.inbound * ACTIVITY_WEIGHTS.inbound
    if (score <= 0 || !t.lastSeenIso) continue
    active.push({
      personId,
      parcels: t.parcels,
      visits: t.visits,
      opens: t.opens,
      clicks: t.clicks,
      inbound: t.inbound,
      score,
      lastSeenIso: t.lastSeenIso,
    })
  }
  active.sort((a, b) =>
    b.score - a.score ||
    (a.lastSeenIso < b.lastSeenIso ? 1 : a.lastSeenIso > b.lastSeenIso ? -1 : 0) ||
    a.personId - b.personId,
  )

  return {
    people: active,
    rollup: {
      identifiedPeople: byPerson.size,
      linkedParcels: input.parcels.length,
      activePeople: active.length,
      siteVisits,
      opens,
      clicks,
      inboundMessages,
    },
  }
}

// ── The DAL read ─────────────────────────────────────────────────────────────

/** Cap on ranked people we hydrate names for / return (digest + table both cap lower). */
const MAX_RANKED_PEOPLE = 100
/** .in() id-list chunk size — keeps the PostgREST URL comfortably short. */
const IN_CHUNK = 150

export async function getWestsideCohortActivity(
  { sinceDays }: { sinceDays?: number } = {},
): Promise<WestsideCohortActivity> {
  const days = clampSinceDays(sinceDays)
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const windowStartIso = windowStart.toISOString()
  const supabase = createServiceClient()

  const [parcelsRes, sessionsRes, emailRes, inboundRes] = await Promise.all([
    fetchPagedRows<WestsideParcelRow>(
      (from, to) =>
        supabase
          .from('westside_parcels')
          .select('apn, site_street, site_city, person_id')
          .not('person_id', 'is', null)
          .order('apn', { ascending: true })
          .range(from, to),
      20000,
    ),
    fetchPagedRows<CohortSessionRow>(
      (from, to) =>
        supabase
          .from('visitor_sessions')
          .select('crm_person_id, session_id, last_seen_at, engagement_score')
          .not('crm_person_id', 'is', null)
          .gte('last_seen_at', windowStartIso)
          .order('session_id', { ascending: true })
          .range(from, to),
      20000,
    ),
    fetchPagedRows<CohortEmailEventRow>(
      (from, to) =>
        supabase
          .from('email_events')
          .select('person_id, event, occurred_at')
          .in('event', ['open', 'click'])
          .not('person_id', 'is', null)
          .gte('occurred_at', windowStartIso)
          .order('id', { ascending: true })
          .range(from, to),
      50000,
    ),
    fetchPagedRows<CohortInboundRow>(
      (from, to) =>
        supabase
          .from('crm_timeline')
          .select('person_id, kind, ts')
          .in('kind', [...INBOUND_TIMELINE_KINDS])
          .gte('ts', windowStartIso)
          .order('id', { ascending: true })
          .range(from, to),
      20000,
    ),
  ])

  const firstError =
    parcelsRes.error ?? sessionsRes.error ?? emailRes.error ?? inboundRes.error
  if (firstError) {
    throw new Error(`getWestsideCohortActivity read failed: ${firstError.message}`)
  }

  const { people: ranked, rollup } = rankCohortActivity({
    parcels: parcelsRes.rows,
    sessions: sessionsRes.rows,
    emailEvents: emailRes.rows,
    inbound: inboundRes.rows,
  })

  const top = ranked.slice(0, MAX_RANKED_PEOPLE)

  // Q5 — hydrate display names for the ranked people only, chunked .in().
  const nameById = new Map<number, { name: string | null; stage: string | null; assignedBroker: string | null }>()
  for (let i = 0; i < top.length; i += IN_CHUNK) {
    const ids = top.slice(i, i + IN_CHUNK).map((p) => p.personId)
    const { data, error } = await supabase
      .from('crm_people')
      .select('id, name, first_name, last_name, stage, assigned_broker')
      .in('id', ids)
    if (error) throw new Error(`getWestsideCohortActivity name lookup failed: ${error.message}`)
    for (const r of (data ?? []) as Array<{
      id: number
      name: string | null
      first_name: string | null
      last_name: string | null
      stage: string | null
      assigned_broker: string | null
    }>) {
      const display =
        r.name?.trim() ||
        [r.first_name, r.last_name].filter(Boolean).join(' ').trim() ||
        null
      nameById.set(r.id, { name: display, stage: r.stage, assignedBroker: r.assigned_broker })
    }
  }

  return {
    sinceDays: days,
    windowStartIso,
    fetchedAtIso: new Date().toISOString(),
    rollup,
    people: top.map((p) => ({
      ...p,
      name: nameById.get(p.personId)?.name ?? null,
      stage: nameById.get(p.personId)?.stage ?? null,
      assignedBroker: nameById.get(p.personId)?.assignedBroker ?? null,
    })),
  }
}
