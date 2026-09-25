/**
 * Quiet hours for SMS. No text may reach a phone before 8am or at/after 8pm
 * local time, so sends pause at 7:55pm (QUIET_END_GUARD_MINUTES) and every
 * enforced 1:1 text expires in Twilio's queue at 8:00pm (smsWindowCloseAt).
 * Every caller times sends on America/Los_Angeles, the market timezone.
 *
 * WHY 8PM AND NOT 9PM. Federal TCPA/TSR allows until 9pm, and this file used
 * to. Oregon is stricter and Oregon is the only market we text: HB 3865
 * (Oregon Laws 2025 ch. 580), signed 2025-07-24, EFFECTIVE 2026-01-01,
 * rewrote ORS 646.561 so "telephone solicitation" now expressly includes a
 * TEXT MESSAGE, and ORS 646.563(1)(b) makes it an unlawful practice to
 * "initiate a telephone solicitation outside the hours of 8 a.m. to 8 p.m. or
 * ... more than three separate times to a party within a 24-hour period,
 * unless the person has an established business relationship with the party"
 * (a transaction within the preceding 18 months). The same act moved
 * ORS 646A.372(5)(a) from 9am-9pm to 8am-8pm for automatic dialing devices,
 * whose definition also covers text messages.
 *
 * The real-estate-licensee exemption in ORS 646.551(3)(b) does NOT rescue us:
 * it exempts licensees from the telephonic-SELLER REGISTRATION regime
 * (646.551-646.557), not from 646.563. The only carve-outs in the amended
 * definition are charitable, polling, business-to-business, and a text that
 * "responds directly to a message received from a party" — a reply, not a
 * campaign. So the strict window is the one that applies to us.
 *
 * Pure + dependency-free so both the sequence-engine cron and the manual
 * composer share ONE definition (they had drifting local copies) and it is unit
 * testable. Intl timezone math works in Node + the edge runtime.
 */

export const QUIET_START_HOUR = 8 // 8am — sends allowed from here
export const QUIET_END_HOUR = 20 // 8pm — at/after this is quiet (ORS 646.563(1)(b))
export const DEFAULT_SMS_TIMEZONE = 'America/Los_Angeles'

/**
 * Seconds after local midnight of `date` in the given IANA timezone. The one
 * clock reader here: the hour, the minute and the window close all come from it.
 */
function secondOfDayInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (part('hour') % 24) * 3600 + part('minute') * 60 + part('second')
}

/** Minutes after local midnight of `date` in the given IANA timezone. */
function minuteOfDayInTimeZone(date: Date, timeZone: string): number {
  return Math.floor(secondOfDayInTimeZone(date, timeZone) / 60)
}

/** Hour (0–23) of `date` in the given IANA timezone. */
export function hourInTimeZone(date: Date, timeZone: string = DEFAULT_SMS_TIMEZONE): number {
  return Math.floor(minuteOfDayInTimeZone(date, timeZone) / 60)
}

/**
 * Sends pause this many minutes before 8pm. Every path asks the quiet-hours
 * question again right before its Twilio call (76f3a5d09), but a text handed to
 * Twilio at 7:59:59pm could still reach the phone after 8pm, and Oregon counts
 * the text, not our API call. Five minutes is a chosen margin, not a measured
 * delivery time. The hard bound is smsWindowCloseAt(): each enforced 1:1 text
 * hands Twilio that instant as its ValidityPeriod (ci:crm-sms-safety holds every
 * send site to it), so a text still in Twilio's queue at 8:00pm is dropped, not
 * delivered late. The margin keeps a text sent at the end of the window from
 * being the one that expires. Group threads use the Conversations API, which
 * has no ValidityPeriod, and Twilio cannot recall a text the carrier has
 * already accepted, so neither of those is covered by the bound.
 */
export const QUIET_END_GUARD_MINUTES = 5

/** Minutes after midnight, local, at which texts pause (7:55pm). */
export const SMS_PAUSE_START_MINUTE = QUIET_END_HOUR * 60 - QUIET_END_GUARD_MINUTES

/**
 * "7:55pm" for a minute after local midnight; pass sep ' ' for "7:55 pm". The
 * one 12-hour formatter for copy that names the SMS window.
 */
export function formatMinuteOfDay(minuteOfDay: number, sep = ''): string {
  const h = Math.floor(minuteOfDay / 60) % 24
  const m = minuteOfDay % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${sep}${h < 12 ? 'am' : 'pm'}`
}

/** "7:55pm": when texts pause, for copy that names the window. */
export function smsPauseStartLabel(): string {
  return formatMinuteOfDay(SMS_PAUSE_START_MINUTE)
}

/** True when `date` falls inside the quiet window (no SMS may send). */
export function inSmsQuietHours(date: Date = new Date(), timeZone: string = DEFAULT_SMS_TIMEZONE): boolean {
  const minute = minuteOfDayInTimeZone(date, timeZone)
  return minute < QUIET_START_HOUR * 60 || minute >= SMS_PAUSE_START_MINUTE
}

/**
 * The instant the SMS window closes, 8:00pm local on `date`'s local day: the
 * ValidityPeriod bound every quiet-hours-enforced send hands Twilio. Meaningful
 * while the window is open (8am to the pause). Clocks change at 2am, so no DST
 * shift falls between an open-window instant and 8pm.
 */
export function smsWindowCloseAt(date: Date = new Date(), timeZone: string = DEFAULT_SMS_TIMEZONE): Date {
  const intoSecondMs = ((date.getTime() % 1000) + 1000) % 1000
  const secondsLeft = QUIET_END_HOUR * 3600 - secondOfDayInTimeZone(date, timeZone)
  return new Date(date.getTime() - intoSecondMs + secondsLeft * 1000)
}

/** The next instant SMS is allowed (next 8:05am market time), for deferring a send. */
export function nextSmsWindow(now: Date = new Date()): Date {
  const next = new Date(now)
  // Pacific is UTC-7/-8; 8am PT ≈ 15:00–16:00 UTC. Use 16:05 UTC as a safe
  // post-8am marker regardless of DST (the cron re-checks the precise hour).
  next.setUTCHours(16, 5, 0, 0)
  // Tomorrow's marker only when today's has passed. Never add a day for "after
  // 8pm Pacific": by then the UTC date has already rolled over (9pm PDT is
  // 04:00Z tomorrow), so that +1 held the text a full extra day.
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next
}
