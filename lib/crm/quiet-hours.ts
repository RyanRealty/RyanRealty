/**
 * Quiet hours for SMS. No texts before 8am or at/after 8pm in the recipient's
 * local time. Ryan Realty serves Central Oregon (Pacific), so when a
 * recipient's timezone is unknown we assume America/Los_Angeles — the market
 * timezone and the strictest reasonable default for our book.
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

/** Hour (0–23) of `date` in the given IANA timezone. */
export function hourInTimeZone(date: Date, timeZone: string = DEFAULT_SMS_TIMEZONE): number {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(date))
  return h === 24 ? 0 : h
}

/** True when `date` falls inside the quiet window (no SMS may send). */
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
