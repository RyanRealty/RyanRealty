/**
 * Bookable-slot generation for the public appointment surface.
 *
 * Pure and clock-free: everything that decides whether a time is offerable is
 * an argument, so the rules are unit-testable without a database, a calendar,
 * or a real "now". The server action does the I/O and calls this.
 *
 * Availability reuses the office-hours vocabulary the CRM already stores on
 * `crm_company_settings.office_hours` (OfficeHoursBlock[]) rather than adding a
 * second, drifting definition of when Ryan Realty is open.
 *
 * WHY THE LEAD TIME AND THE HORIZON. A slot ten minutes out is not really
 * bookable by a broker who is driving; a slot four months out is not a
 * commitment anyone can keep. Both bounds are explicit arguments so the caller
 * owns the policy and the tests can pin it.
 */

import { parseHm, OFFICE_DAYS, type OfficeDay } from '@/lib/crm/office-hours'
import { zonedDateKey, zonedDayMinutes, zonedMinutes } from '@/lib/format/date'
import { time12 } from '@/lib/crm/calendar'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'

/** A half-open busy interval [start, end) in epoch ms. */
export type BusyInterval = { startMs: number; endMs: number }

export type SlotPolicy = {
  /** Length of each offered appointment, minutes. */
  slotMinutes: number
  /** Nothing sooner than this many minutes from now. */
  minLeadMinutes: number
  /** Gap required on either side of an existing appointment, minutes. */
  bufferMinutes: number
}

export const DEFAULT_SLOT_POLICY: SlotPolicy = {
  slotMinutes: 30,
  minLeadMinutes: 120,
  bufferMinutes: 15,
}

/** Day key (YYYY-MM-DD) -> the OfficeDay label the blocks are keyed by. */
export function officeDayForDateKey(dateKey: string, timeZone: string): OfficeDay | null {
  const at = zonedNoon(dateKey, timeZone)
  if (!at) return null
  const { day } = zonedDayMinutes(at, timeZone)
  return (OFFICE_DAYS as readonly string[]).includes(day) ? (day as OfficeDay) : null
}

/**
 * The instant of local noon on `dateKey` in `timeZone`. Noon, not midnight, so
 * a DST transition can never push the probe onto the previous or next day.
 */
function zonedNoon(dateKey: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return null
  const [, y, mo, d] = m
  const guess = new Date(`${y}-${mo}-${d}T12:00:00Z`)
  const local = new Date(guess.toLocaleString('en-US', { timeZone }))
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(guess.getTime() + (utc.getTime() - local.getTime()))
}

/** The instant of local `minutes`-past-midnight on `dateKey` in `timeZone`. */
export function zonedInstant(dateKey: string, minutes: number, timeZone: string): Date | null {
  const noon = zonedNoon(dateKey, timeZone)
  if (!noon) return null
  return new Date(noon.getTime() + (minutes - 12 * 60) * 60_000)
}

/** Do [aStart,aEnd) and [bStart,bEnd) overlap at all? */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export type Slot = {
  /** ISO 8601 start instant. */
  startIso: string
  /** ISO 8601 end instant. */
  endIso: string
  /** Local "9:30 AM" label in the brokerage timezone. */
  label: string
}

/**
 * Every slot offerable on one local day.
 *
 * A slot is offered when it sits wholly inside an office-hours block for that
 * weekday, starts at least `minLeadMinutes` after `now`, is not past the
 * horizon, and does not collide with a busy interval once `bufferMinutes` is
 * applied on both sides.
 *
 * An EMPTY block list means "no bookable hours configured" and yields NO slots.
 * That is deliberately the opposite of isWithinOfficeHours, where empty means
 * always open: failing open on inbound calls only routes a ringing phone, but
 * failing open here would publish a bookable calendar nobody agreed to.
 */
export function generateDaySlots(args: {
  dateKey: string
  blocks: OfficeHoursBlock[] | null | undefined
  timeZone: string
  busy: BusyInterval[]
  now: Date
  policy?: SlotPolicy
  /** Latest bookable instant. Slots at or after this are dropped. */
  horizon?: Date
}): Slot[] {
  const policy = args.policy ?? DEFAULT_SLOT_POLICY
  const blocks = args.blocks ?? []
  if (blocks.length === 0) return []

  const day = officeDayForDateKey(args.dateKey, args.timeZone)
  if (!day) return []

  const earliestMs = args.now.getTime() + policy.minLeadMinutes * 60_000
  const horizonMs = args.horizon ? args.horizon.getTime() : Number.POSITIVE_INFINITY
  const slotMs = policy.slotMinutes * 60_000
  const bufferMs = policy.bufferMinutes * 60_000

  const out: Slot[] = []
  const seen = new Set<number>()

  for (const block of blocks) {
    if (!block || !Array.isArray(block.days) || !block.days.includes(day)) continue
    const startMin = parseHm(block.start_time)
    const endMin = parseHm(block.end_time)
    // A malformed or inverted block is skipped rather than trusted — one bad
    // row must not publish slots at 3am.
    if (startMin == null || endMin == null || endMin <= startMin) continue

    for (let m = startMin; m + policy.slotMinutes <= endMin; m += policy.slotMinutes) {
      const start = zonedInstant(args.dateKey, m, args.timeZone)
      if (!start) continue
      const startMs = start.getTime()
      const endMs = startMs + slotMs
      if (startMs < earliestMs || startMs >= horizonMs) continue
      if (seen.has(startMs)) continue

      const collides = args.busy.some((b) =>
        overlaps(startMs - bufferMs, endMs + bufferMs, b.startMs, b.endMs),
      )
      if (collides) continue

      seen.add(startMs)
      out.push({
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
        // time12 + zonedMinutes is the repo's own pairing for a wall-clock
        // label (lib/crm/appointment-invites uses it too), so a slot reads the
        // same as the admin calendar rather than inventing a second style.
        label: time12(zonedMinutes(start, args.timeZone)),
      })
    }
  }

  return out.sort((a, b) => a.startIso.localeCompare(b.startIso))
}

/** Local YYYY-MM-DD keys for `count` days starting at `from`, in `timeZone`. */
export function upcomingDateKeys(from: Date, count: number, timeZone: string): string[] {
  const keys: string[] = []
  for (let i = 0; i < count; i += 1) {
    const at = new Date(from.getTime() + i * 24 * 60 * 60_000)
    keys.push(zonedDateKey(at, timeZone))
  }
  return keys
}
