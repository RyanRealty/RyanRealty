/**
 * TCPA quiet hours for SMS. No texts before 8am or at/after 9pm in the
 * recipient's local time. Ryan Realty serves Central Oregon (Pacific), so when a
 * recipient's timezone is unknown we assume America/Los_Angeles — the market
 * timezone and the strictest reasonable default for our book.
 *
 * Pure + dependency-free so both the sequence-engine cron and the manual
 * composer share ONE definition (they had drifting local copies) and it is unit
 * testable. Intl timezone math works in Node + the edge runtime.
 */

export const QUIET_START_HOUR = 8 // 8am — sends allowed from here
export const QUIET_END_HOUR = 21 // 9pm — at/after this is quiet
export const DEFAULT_SMS_TIMEZONE = 'America/Los_Angeles'

/** Hour (0–23) of `date` in the given IANA timezone. */
export function hourInTimeZone(date: Date, timeZone: string = DEFAULT_SMS_TIMEZONE): number {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(date))
  return h === 24 ? 0 : h
}

/** True when `date` falls inside the TCPA quiet window (no SMS may send). */
export function inSmsQuietHours(date: Date = new Date(), timeZone: string = DEFAULT_SMS_TIMEZONE): boolean {
  const h = hourInTimeZone(date, timeZone)
  return h < QUIET_START_HOUR || h >= QUIET_END_HOUR
}

/** The next instant SMS is allowed (next 8:05am market time), for deferring a send. */
export function nextSmsWindow(now: Date = new Date()): Date {
  const h = hourInTimeZone(now, DEFAULT_SMS_TIMEZONE)
  const next = new Date(now)
  if (h >= QUIET_END_HOUR) next.setUTCDate(next.getUTCDate() + 1)
  // Pacific is UTC-7/-8; 8am PT ≈ 15:00–16:00 UTC. Use 16:05 UTC as a safe
  // post-8am marker regardless of DST (the cron re-checks the precise hour).
  next.setUTCHours(16, 5, 0, 0)
  return next
}
