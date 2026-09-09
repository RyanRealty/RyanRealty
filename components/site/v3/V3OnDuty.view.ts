/**
 * V3OnDuty — the pure half. Is a broker on now, and if not, when next?
 *
 * WHY THIS AND NOT A REPLY-TIME FIGURE (SITE-48, 2026-09-09)
 *
 * The taste table asked /contact for "a live state (on-duty broker, response
 * time, calendar availability)" because four static links is a card grid. The
 * obvious answer — a response-time figure from SITE-09's CRM response clock —
 * is refused by section 0 and by SITE-09's own finding. Read on 2026-09-09,
 * `getResponseClockReport()` returned `medianSeconds` over a 28-day window in
 * which every counted touch predated the provenance stamp, which is exactly
 * the condition the admin panel prints "unproven" for; the same read returned
 * 8 in-hours site submits against 2 answered by a person. Neither number is
 * publishable: the first is not proven, and the second is a backlog, not a
 * promise. SITE-09 deliberately DELETED the "one business day" claim from this
 * page and nothing has earned the right to replace it.
 *
 * So the live state is the one thing about our availability that IS recorded
 * and checkable: `crm_company_settings.booking_hours` — the same rows the /book
 * slot engine offers time from (`lib/booking/slots.ts`) — against the clock in
 * the company's own timezone. If the page says a broker is on, /book has slots
 * on the calendar at that moment, and a reader can check it in one tap.
 *
 * The block vocabulary is `OfficeHoursBlock`, shared with the inbound-call
 * evaluator, and so is the matching (`parseHm`, `localDayMinutes`, overnight
 * spill). What is NOT shared is the empty case: an empty list here means
 * "nothing is published", so this returns `null` and the caller renders no
 * state at all. Empty means always-open only for a ringing phone, never for a
 * claim on a page (migration 20260825200000).
 */

import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { localDayMinutes, OFFICE_DAYS, parseHm, type OfficeDay } from '@/lib/crm/office-hours'

export type V3OnDutyState = {
  open: boolean
  /** "5:00 pm" — when the current block ends. Only set when open. */
  until: string | null
  /** "Monday" / "tomorrow" / "today" — when the next block starts. Only when closed. */
  nextDay: string | null
  /** "9:00 am" — when the next block starts. Only when closed. */
  nextAt: string | null
}

const DAY_NAME: Record<OfficeDay, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}

/**
 * "09:00" -> "9:00 am". Not a date format: these are wall-clock strings the
 * company typed into a settings row, so there is no instant to hand to the
 * canonical formatter and no timezone conversion to do.
 */
export function hmLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const suffix = h24 < 12 ? 'am' : 'pm'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

type Parsed = { days: Set<OfficeDay>; start: number; end: number }

function parseBlocks(blocks: readonly OfficeHoursBlock[] | null | undefined): Parsed[] {
  const out: Parsed[] = []
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const start = parseHm(block?.start_time)
    const end = parseHm(block?.end_time)
    if (start == null || end == null || !Array.isArray(block?.days)) continue
    const days = new Set<OfficeDay>(
      (block.days as readonly string[]).filter((d): d is OfficeDay => (OFFICE_DAYS as readonly string[]).includes(d)),
    )
    if (days.size === 0) continue
    out.push({ days, start, end })
  }
  return out
}

/** The weekday `offset` days after `day`, wrapping the week. */
function dayAfter(day: OfficeDay, offset: number): OfficeDay {
  const i = OFFICE_DAYS.indexOf(day)
  return OFFICE_DAYS[(i + offset) % OFFICE_DAYS.length]!
}

/**
 * The state, or null when nothing is published (no blocks, or none parseable).
 * Null is the honest answer: a page that cannot read the hours says nothing
 * about them rather than guessing that we are open.
 */
export function onDutyState(input: {
  blocks: readonly OfficeHoursBlock[] | null | undefined
  timeZone: string
  now: Date
}): V3OnDutyState | null {
  const parsed = parseBlocks(input.blocks)
  if (parsed.length === 0) return null
  const tz = input.timeZone || 'America/Los_Angeles'
  const { day, minutes } = localDayMinutes(input.now, tz)

  for (const b of parsed) {
    if (!b.days.has(day)) continue
    if (b.start <= b.end) {
      if (minutes >= b.start && minutes < b.end) return { open: true, until: hmLabel(b.end), nextDay: null, nextAt: null }
    } else if (minutes >= b.start || minutes < b.end) {
      // Overnight block: it is open, and it ends on the far side of midnight.
      return { open: true, until: hmLabel(b.end), nextDay: null, nextAt: null }
    }
  }

  // Closed. The next opening is the earliest start still ahead today, else the
  // earliest start on the next day that has one, out to a full week.
  const todayAhead = parsed.filter((b) => b.days.has(day) && b.start > minutes).map((b) => b.start)
  if (todayAhead.length > 0) {
    return { open: false, until: null, nextDay: 'today', nextAt: hmLabel(Math.min(...todayAhead)) }
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const d = dayAfter(day, offset)
    const starts = parsed.filter((b) => b.days.has(d)).map((b) => b.start)
    if (starts.length === 0) continue
    return {
      open: false,
      until: null,
      nextDay: offset === 1 ? 'tomorrow' : DAY_NAME[d],
      nextAt: hmLabel(Math.min(...starts)),
    }
  }
  return { open: false, until: null, nextDay: null, nextAt: null }
}

/**
 * The clause the reader sees. It states our PUBLISHED HOURS against the clock
 * and nothing else — not who is at a desk, not how fast anyone replies. A
 * reader can check it in one tap, because the same rows fill /book's calendar.
 */
export function onDutyLabel(state: V3OnDutyState): string {
  if (state.open) return state.until ? `Open now, until ${state.until}` : 'Open now'
  if (state.nextDay && state.nextAt) return `Closed now, open ${state.nextDay} at ${state.nextAt}`
  return 'Closed now'
}
