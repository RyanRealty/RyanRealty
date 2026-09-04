/**
 * Prospecting first-touch drip schedule (approve → queue → weekday drain).
 *
 * LOCKED HARDCODE by Matt (via CoS): weekdays, window opens 08:00
 * America/Los_Angeles, then send ONE approved Expired OR FSBO first-touch
 * email per spacing interval until the queue is empty. Spacing is intentionally
 * a single constant — DRIP_SPACING_MINUTES = 5. Change it in one place only.
 *
 * Pure helpers only — no DB, no clock. The drain cron supplies `now` + last send.
 */

import { zonedDayMinutes } from '@/lib/format/date'

export const DRIP_TIMEZONE = 'America/Los_Angeles'

/** Local weekday minutes when the drip window opens (08:00). */
export const DRIP_WEEKDAY_START_MINUTES = 8 * 60

/**
 * Minutes between drip sends (one-at-a-time cadence).
 *
 * LOCKED HARDCODE by Matt (via CoS) = 5; weekdays; window 08:00 America/Los_Angeles;
 * one-at-a-time. Keep this the only cadence knob.
 */
export const DRIP_SPACING_MINUTES = 5

const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

export type DripScheduleDecision =
  | { ok: true }
  | { ok: false; reason: 'weekend' | 'before-window' | 'spacing' }

/** True when `now` is Mon–Fri in the drip timezone. */
export function isDripWeekday(now: Date, timeZone: string = DRIP_TIMEZONE): boolean {
  return WEEKDAYS.has(zonedDayMinutes(now, timeZone).day)
}

/** True when local time is at/after the weekday start (08:00). Weekends always false. */
export function isDripWindowOpen(now: Date, timeZone: string = DRIP_TIMEZONE): boolean {
  const { day, minutes } = zonedDayMinutes(now, timeZone)
  if (!WEEKDAYS.has(day)) return false
  return minutes >= DRIP_WEEKDAY_START_MINUTES
}

/**
 * Whether the drip may send exactly one email at `now`, given the last drip send.
 * Enforces weekday + 08:00 open + spacing since last send (null = never sent → ok).
 */
export function canSendDripNow(args: {
  now: Date
  lastDripSentAt: Date | null
  spacingMinutes?: number
  timeZone?: string
}): DripScheduleDecision {
  const timeZone = args.timeZone ?? DRIP_TIMEZONE
  const spacing = args.spacingMinutes ?? DRIP_SPACING_MINUTES
  if (!isDripWeekday(args.now, timeZone)) return { ok: false, reason: 'weekend' }
  if (!isDripWindowOpen(args.now, timeZone)) return { ok: false, reason: 'before-window' }
  if (args.lastDripSentAt) {
    const elapsedMs = args.now.getTime() - args.lastDripSentAt.getTime()
    if (elapsedMs < spacing * 60_000) return { ok: false, reason: 'spacing' }
  }
  return { ok: true }
}
