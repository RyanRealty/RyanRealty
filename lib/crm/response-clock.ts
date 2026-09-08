/**
 * response-clock — the ONE definition of "a human touched this lead", the
 * five-minute clock that runs on every site submit, and the 28-day read that
 * says whether we are keeping it (SITE-09, Matt 2026-09-07).
 *
 * WHY IT EXISTS. The send rails write a crm_timeline row for every outbound
 * message, and until this file they all looked alike: a system confirmation
 * mailed by the Gmail rail lands as `email_out` with `source:'app'` and the
 * broker's slug on it, which is indistinguishable from the broker actually
 * writing back. A speed-to-lead number built on that reads "median 4 seconds"
 * and means nothing. So the predicate is written down ONCE, here, and both the
 * cron and the admin panel import it — never a second copy of the rule.
 *
 * Pure and dependency-free (no `server-only`, no Supabase, no next/*) so every
 * rule is unit-testable: lib/crm/response-clock.test.ts.
 */

// ── What counts as a human touch ─────────────────────────────────────────────

/**
 * Outbound kinds a person can perform. `email_open` / `email_click` are the
 * LEAD acting, not us; `note` is a record, not a touch; `lead_created` and
 * `system` are the pipeline talking to itself.
 */
export const HUMAN_TOUCH_KINDS = ['call', 'voicemail', 'sms_out', 'mms_out', 'email_out'] as const
export type HumanTouchKind = (typeof HUMAN_TOUCH_KINDS)[number]

/**
 * crm_timeline.source values that mark a row as MACHINE-authored even when the
 * kind is an outbound one. Observed in the live taxonomy (28-day read
 * 2026-09-08): `sequence` (drip), `automation` (the Resend rail's system
 * initiator), `smart-followup`, `lp-form`, `broker-alert`, `auto-enroll`,
 * `email-tracking`, `system`, plus this module's own rows.
 */
export const NON_HUMAN_SOURCES = [
  'automation',
  'sequence',
  'smart-followup',
  'lp-form',
  'broker-alert',
  'auto-enroll',
  'email-tracking',
  'system',
  'response-clock',
] as const

/**
 * Purpose prefixes that mark a governed send as a SYSTEM confirmation, whatever
 * source the rail stamped. The Gmail rail writes `source:'app'` and the acting
 * broker's slug even for a system initiator (sendGovernedEmail sendViaGmail) —
 * deliberately, because the inbox and the per-broker activity reports read that
 * column — so the purpose/initiator stamped into `payload` is what separates a
 * confirmation from a real reply.
 */
export const SYSTEM_PURPOSE_PREFIXES = [
  'place-page:',
  'contact:',
  'alert:',
  'expired:',
  'response-clock:',
] as const

export type TimelineRowLike = {
  kind?: string | null
  source?: string | null
  broker?: string | null
  payload?: unknown
  ts?: string | null
}

function payloadOf(row: TimelineRowLike): Record<string, unknown> {
  const p = row.payload
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

/**
 * Does this row carry the SITE-09 provenance stamp? Rows written before that
 * change have no `payload.initiator`, so isHumanTouch can only judge them by
 * kind + source — good enough to exclude a drip, not good enough to exclude a
 * system confirmation the Gmail rail wrote as the broker. Reported, not hidden.
 */
export function hasProvenanceStamp(row: TimelineRowLike): boolean {
  const payload = payloadOf(row)
  return typeof payload.initiator === 'string' && payload.initiator.length > 0
}

/**
 * Did a PERSON do this? Five conditions, all required:
 *   1. an outbound kind,
 *   2. a source that is not one of the machine rails,
 *   3. a named broker (an unattributed outbound row is not a broker's work),
 *   4. `payload.initiator` is not 'system' (the rails stamp this), and
 *   5. `payload.purpose` is not one of the system-confirmation families.
 *
 * A Gmail-synced transaction email Matt actually wrote passes (kind email_out,
 * source 'gmail', broker 'matt', no system stamp). The /communities valuation
 * confirmation fails on 4 and 5. A drip email fails on 2.
 */
export function isHumanTouch(row: TimelineRowLike): boolean {
  const kind = String(row.kind ?? '')
  if (!(HUMAN_TOUCH_KINDS as readonly string[]).includes(kind)) return false
  const source = String(row.source ?? '')
  if ((NON_HUMAN_SOURCES as readonly string[]).includes(source)) return false
  const broker = String(row.broker ?? '').trim()
  if (!broker) return false
  const payload = payloadOf(row)
  if (String(payload.initiator ?? '') === 'system') return false
  const purpose = String(payload.purpose ?? '')
  if (purpose && SYSTEM_PURPOSE_PREFIXES.some((p) => purpose.startsWith(p))) return false
  return true
}

// ── Which leads the clock watches ────────────────────────────────────────────

/**
 * The literal `crm_people.source` values the site's own submit actions write.
 *
 * NOT included: the bare site domain (`ryan-realty.com`). sendEvent stamps it
 * for the contact form AND for a plain website sign-in, which asked us for
 * nothing — lib/crm/enroll.ts draws the same distinction (isSiteSignin). A
 * contact-form submit still qualifies through its `source:contact-form` tag.
 *
 * Pinned against the action files by response-clock.test.ts: rename a source in
 * an action without editing this list and the test fails.
 */
export const SITE_SUBMIT_SOURCES = [
  'contact-form',
  'seller-lp',
  'list-now-lp',
  'buyer-lp',
  'expired-lp',
  'place-page',
  'idx-registration',
  'website-booking',
] as const

/** The `source:*` tags the same actions apply through canonicallyTagLead. */
export const SITE_SUBMIT_TAGS = SITE_SUBMIT_SOURCES.map((s) => `source:${s}`)

export type LeadLike = {
  personId: number
  source?: string | null
  tags?: readonly string[] | null
  createdAt?: string | null
  fubCreatedAt?: string | null
}

/** Did this person reach us through a form on the site? */
export function isSiteSubmit(lead: LeadLike): boolean {
  const source = String(lead.source ?? '').trim().toLowerCase()
  if ((SITE_SUBMIT_SOURCES as readonly string[]).includes(source)) return true
  const tags = (lead.tags ?? []).map((t) => String(t).trim().toLowerCase())
  return tags.some((t) => SITE_SUBMIT_TAGS.includes(t))
}

/** created_at, falling back to fub_created_at. Null when neither parses. */
export function leadCreatedAt(lead: LeadLike): Date | null {
  for (const raw of [lead.createdAt, lead.fubCreatedAt]) {
    if (typeof raw !== 'string' || !raw) continue
    const d = new Date(raw)
    if (Number.isFinite(d.getTime())) return d
  }
  return null
}

// ── Business hours, in the market's own clock ────────────────────────────────

export const BUSINESS_TZ = 'America/Los_Angeles'
/** 8am inclusive. */
export const BUSINESS_START_HOUR = 8
/** 8pm exclusive — the accept test's "during 8am to 8pm". */
export const BUSINESS_END_HOUR = 20
/** The grace the node names: five minutes from the submit. */
export const RESPONSE_GRACE_MINUTES = 5
/** Wall-clock, regardless of business hours: nothing sits a whole day. */
export const STALE_HOURS = 24

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

type WallParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

// date-format-ok: timezone ARITHMETIC, not display. formatToParts is the only
// correct way to read a Pacific wall-clock reading off a UTC instant and to
// build the instant for "next 8am Pacific"; nothing here becomes a string a
// human reads (the panel formats its own dates through lib/format/date.ts).
const PART_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** The wall-clock reading in Pacific for an instant. No dependency, no drift. */
export function wallPartsInMarket(instant: Date): WallParts {
  const out: Record<string, number> = {}
  for (const p of PART_FORMATTER.formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  // hourCycle h23 vs h24: some engines print midnight as '24'.
  const hour = out.hour === 24 ? 0 : out.hour
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour,
    minute: out.minute,
    second: out.second ?? 0,
  }
}

/** Milliseconds to add to a UTC instant to read it as Pacific wall time. */
function marketOffsetMs(instant: Date): number {
  const p = wallPartsInMarket(instant)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime()
}

/**
 * The instant at which the market clock reads this wall time. Two passes so a
 * DST boundary (the offset at the guess differs from the offset at the answer)
 * resolves; a nonexistent spring-forward hour lands on the next real minute.
 */
export function marketWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  let ts = guess - marketOffsetMs(new Date(guess))
  ts = guess - marketOffsetMs(new Date(ts))
  return new Date(ts)
}

/** Is this instant inside 8am–8pm Pacific? */
export function inBusinessHours(instant: Date): boolean {
  const { hour } = wallPartsInMarket(instant)
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR
}

/**
 * When a human touch is due. Inside business hours: five minutes. Outside:
 * five minutes past the next 8am Pacific — nobody is on the floor at 2am and a
 * flag then is noise, not a signal.
 */
export function responseDueAt(createdAt: Date | string): Date {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const grace = RESPONSE_GRACE_MINUTES * MINUTE_MS
  if (inBusinessHours(created)) return new Date(created.getTime() + grace)

  const parts = wallPartsInMarket(created)
  let { year, month, day } = parts
  if (parts.hour >= BUSINESS_END_HOUR) {
    // Tomorrow's 8am. Step a day from local NOON so a DST shift cannot land the
    // arithmetic on the previous or next calendar date.
    const noon = marketWallTimeToInstant(year, month, day, 12)
    const next = wallPartsInMarket(new Date(noon.getTime() + 24 * HOUR_MS))
    year = next.year
    month = next.month
    day = next.day
  }
  return new Date(marketWallTimeToInstant(year, month, day, BUSINESS_START_HOUR).getTime() + grace)
}

// ── The decision ─────────────────────────────────────────────────────────────

export type ResponseClockFlags = {
  flag5mAt?: string | null
  flag24hAt?: string | null
  touchedAt?: string | null
}

export type ResponseClockState = 'touched' | 'waiting' | 'flag5m' | 'flag24h' | 'already-flagged'

export type ResponseClockDecision = {
  state: ResponseClockState
  reason: string
  dueAt: string
  ageMinutes: number
}

/**
 * One lead, one verdict. Every state is derived — nothing here writes, so an
 * overlapping cron run reaches the same answer and the runner's dedupe keys
 * make the WRITE idempotent.
 */
export function classify(input: {
  createdAt: Date | string
  now: Date | string
  firstHumanTouchAt?: string | null
  flags?: ResponseClockFlags
}): ResponseClockDecision {
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt)
  const now = input.now instanceof Date ? input.now : new Date(input.now)
  const flags = input.flags ?? {}
  const due = responseDueAt(created)
  const ageMinutes = Math.max(0, Math.round((now.getTime() - created.getTime()) / MINUTE_MS))
  const base = { dueAt: due.toISOString(), ageMinutes }

  if (input.firstHumanTouchAt) {
    return { ...base, state: 'touched', reason: `human touch at ${input.firstHumanTouchAt}` }
  }

  // 24h is wall clock from creation, business hours or not: a lead that sat
  // overnight and all morning is a failure whichever hour it arrived in.
  if (now.getTime() - created.getTime() >= STALE_HOURS * HOUR_MS) {
    return flags.flag24hAt
      ? { ...base, state: 'already-flagged', reason: `24h flag already raised at ${flags.flag24hAt}` }
      : { ...base, state: 'flag24h', reason: `${ageMinutes} minutes old with no human touch` }
  }

  if (now.getTime() >= due.getTime()) {
    return flags.flag5mAt
      ? { ...base, state: 'already-flagged', reason: `5m flag already raised at ${flags.flag5mAt}` }
      : { ...base, state: 'flag5m', reason: `past the ${due.toISOString()} response mark` }
  }

  return { ...base, state: 'waiting', reason: `inside the response window until ${due.toISOString()}` }
}

// ── The 28-day read ──────────────────────────────────────────────────────────

/** Median of an unsorted array. Null when empty. Same rule as getSpeedToLeadReport. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export type ResponseClockSourceRow = {
  source: string
  leads: number
  contacted: number
  medianSeconds: number | null
}

export type ResponseClockStats = {
  /** Leads created INSIDE business hours in the window — the accept's universe. */
  leads: number
  contacted: number
  medianSeconds: number | null
  /** Leads (any hour) with no human touch and older than 24 hours. */
  untouchedOver24h: number
  /** Every lead in the window, business hours or not — the denominator context. */
  leadsAllHours: number
  /**
   * Counted touches whose crm_timeline row carries NO provenance stamp.
   *
   * The rails only started writing payload.initiator with SITE-09, so a row
   * older than that deploy cannot be told apart from a broker's own reply by
   * anything but its kind and source. A /book appointment invite is the known
   * case: it is a system confirmation on kind email_out, source 'app', broker
   * 'matt', and on 2026-08-26 it produced a 2-second "human touch". This count
   * is how much of the median is still resting on that guess — it goes to zero
   * as stamped rows replace the window, and until it does the figure reads
   * FASTER than the truth, never slower.
   */
  unstampedTouches: number
  bySource: ResponseClockSourceRow[]
}

/** What the first-touch lookup hands back per person. */
export type FirstTouch = { ts: string; stamped: boolean }

/**
 * Seconds from row creation to first human touch, for leads created inside
 * business hours. Out-of-hours leads are excluded from the median because the
 * accept measures "during 8am to 8pm"; they still count toward the 24-hour rule,
 * which has no such window.
 */
export function responseClockStats(
  leads: readonly LeadLike[],
  firstTouchByPerson: ReadonlyMap<number, string | FirstTouch | null>,
  now: Date | string,
): ResponseClockStats {
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime()
  const inHours: number[] = []
  const bySource = new Map<string, { leads: number; contacted: number; seconds: number[] }>()
  let leadsInHours = 0
  let contacted = 0
  let untouchedOver24h = 0
  let leadsAllHours = 0
  let unstampedTouches = 0

  for (const lead of leads) {
    const created = leadCreatedAt(lead)
    if (!created) continue
    leadsAllHours++
    const raw = firstTouchByPerson.get(lead.personId) ?? null
    const touch: FirstTouch | null =
      raw == null ? null : typeof raw === 'string' ? { ts: raw, stamped: false } : raw

    if (!touch && nowMs - created.getTime() >= STALE_HOURS * HOUR_MS) untouchedOver24h++

    if (!inBusinessHours(created)) continue
    leadsInHours++
    const key = (lead.source ?? '').trim() || 'unspecified'
    const agg = bySource.get(key) ?? { leads: 0, contacted: 0, seconds: [] }
    agg.leads++

    if (touch) {
      const elapsed = Math.round((new Date(touch.ts).getTime() - created.getTime()) / 1000)
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        contacted++
        agg.contacted++
        agg.seconds.push(elapsed)
        inHours.push(elapsed)
        if (!touch.stamped) unstampedTouches++
      }
    }
    bySource.set(key, agg)
  }

  return {
    leads: leadsInHours,
    contacted,
    medianSeconds: medianOf(inHours),
    untouchedOver24h,
    leadsAllHours,
    unstampedTouches,
    bySource: [...bySource.entries()]
      .map(([source, a]) => ({
        source,
        leads: a.leads,
        contacted: a.contacted,
        medianSeconds: medianOf(a.seconds),
      }))
      .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source)),
  }
}

/** "12 min" / "1 hr 4 min" / "2 days". For the panel and the alert body. */
export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} hr ${m} min` : `${h} hr`
  }
  const d = Math.floor(minutes / (24 * 60))
  return `${d} ${d === 1 ? 'day' : 'days'}`
}
