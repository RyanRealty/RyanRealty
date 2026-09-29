/**
 * Prospecting first-touch drip schedule (approve → queue → weekday drain).
 *
 * Lock (process): weekdays, window opens 08:00 America/Los_Angeles, then send
 * ONE approved Expired OR FSBO first-touch email per spacing interval until the
 * queue is empty. Spacing is intentionally a single constant — Matt has not
 * locked the gap yet (CoS: TBD). Change DRIP_SPACING_MINUTES in one place.
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
 * LOCKED at 5 by Matt 2026-09-04 (~96 cold sends per weekday). Keep this the
 * only knob — the cron ticks every minute and this constant is the real cadence.
 */
export const DRIP_SPACING_MINUTES = 5

/**
 * The drip route's Vercel function limit, in seconds.
 *
 * One drip send is a whole CMA send: the live MLS relist check, the CRM lead,
 * the suppression checks, the claim, a Chromium PDF render and a ~7 MB Gmail
 * message. It does not fit in 60 seconds (2026-09-29 22:54 UTC: the first real
 * run hit "Task timed out after 60 seconds" and left its owner stuck in
 * 'sending'). 300 is what every other CMA send already runs under: the prospect
 * page that hosts the manual send dialog and the prospecting worklist export
 * `maxDuration = 300`, and the CMA review page's Send now runs at the project's
 * Fluid default, also 300.
 *
 * Next reads `maxDuration` from the route file statically, so the route keeps
 * its own literal. route.test.ts pins that literal to this constant.
 *
 * Every function that can take an owner's email claim must run at or under this
 * limit, or the two windows below stop meaning "the claimer is dead": this
 * route and the prospect page (sendProspectingEmailIntro), and every page or
 * route that reaches sendCmaToLead, whose rail claims the owner's row itself
 * (lib/cma/prospect-send-claim.ts). route.test.ts pins all of them against
 * next.config.ts PDF_SEND_TRACE_ROUTES.
 */
export const DRIP_ROUTE_MAX_DURATION_S = 300

/**
 * B. A 'sending' claim younger than this may belong to a drain (or a manual
 * send) that is still running, so a new drain stands down. maxDuration plus one
 * cron tick: the platform stops the claimer by claim_at + maxDuration (the
 * claim is taken after the function starts), and the extra minute covers cron
 * jitter and clock skew between Vercel and Postgres.
 */
export const DRIP_BUSY_WINDOW_MS = (DRIP_ROUTE_MAX_DURATION_S + 60) * 1000

/**
 * D. A 'sending' claim older than this, with no message id, belongs to a
 * function that died mid-send, and the drain works out whether its email left.
 * maxDuration so the claimer is certainly gone, plus five minutes so anything
 * it did in its last second has landed where the check looks: Gmail indexes a
 * sent message for search, and the rail's email_events 'sent' row is written.
 * A check run earlier could read "absent" for an email that did leave, and
 * absent means the drain sends it again.
 */
export const DRIP_STUCK_SEND_STALE_MS = (DRIP_ROUTE_MAX_DURATION_S + 5 * 60) * 1000

/** Age of a claim in ms at `now`, or null when the stamp is missing or unreadable. */
export function firstTouchClaimAgeMs(claimAt: string | null | undefined, now: Date): number | null {
  if (!claimAt) return null
  const t = Date.parse(claimAt)
  if (!Number.isFinite(t)) return null
  return now.getTime() - t
}

/** True while a claim is young enough that its owner may still be running (busy guard). */
export function isFirstTouchClaimInFlight(claimAt: string | null | undefined, now: Date): boolean {
  const age = firstTouchClaimAgeMs(claimAt, now)
  return age != null && age < DRIP_BUSY_WINDOW_MS
}

/** True once a claim is strictly older than the stale threshold (stuck-send recovery). */
export function isFirstTouchClaimStale(claimAt: string | null | undefined, now: Date): boolean {
  const age = firstTouchClaimAgeMs(claimAt, now)
  return age != null && age > DRIP_STUCK_SEND_STALE_MS
}

/** Claims stamped AFTER this instant are in flight (the busy guard's cutoff). */
export function dripBusyCutoff(now: Date): Date {
  return new Date(now.getTime() - DRIP_BUSY_WINDOW_MS)
}

/** Claims stamped BEFORE this instant are stale (the recovery's cutoff). */
export function dripStaleCutoff(now: Date): Date {
  return new Date(now.getTime() - DRIP_STUCK_SEND_STALE_MS)
}

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
