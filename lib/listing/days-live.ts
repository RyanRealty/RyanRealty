/**
 * How long a home has been on the market, counted ONE way.
 *
 * CLAUDE.md §7 is explicit: never publish `"DaysOnMarket"` as DOM — the MLS
 * field is list-to-close, not "days this listing has been live". The listing
 * page published both on one scroll: the header pill printed `listing.dom`
 * (the banned field, straight off `row.DaysOnMarket`) while the close section
 * counted days from `OnMarketDate`. They agreed for some rows and disagreed for
 * others; a separate evaluator caught the page saying 106 in the pill and 110
 * in the close section on 2026-09-08, which is the §0 failure "reconcile
 * narrative to data" names.
 *
 * So there is one function, both surfaces call it, and the number cannot drift
 * from itself again. A listing with no on-market date returns null and the
 * caller prints nothing — never a fallback to the banned field.
 *
 * ─── WHY CALENDAR DAYS, NOT ELAPSED HOURS ──────────────────────────────────
 *
 * The first version of this divided elapsed milliseconds by 86,400,000. That
 * is wrong for a figure a person reads, and the live page proved it on
 * 2026-09-08: 17636 Tennis Village Court came on the market at
 * 2026-08-12 20:11:48+00 and the page published "26 days on market" when the
 * count from August 12 to September 8 is 27. `OnMarketDate` is a timestamptz,
 * so the elapsed count is short by one for every hour of the day earlier than
 * the listing's own time of day — most of the day, for an afternoon listing.
 *
 * It also could not be checked. The citation beside it prints the DATE
 * ("OnMarketDate 2026-08-12"), and a reader who counts from that date gets a
 * different number than the one on screen — the §0 failure where a published
 * figure cannot be reproduced from its own trace.
 *
 * Days on market is a count of calendar days, the way the MLS counts them and
 * the way a seller counts them. The zone is Central Oregon's, because the day
 * a home came on the market is a fact about Oregon, not about UTC.
 */
import { zonedDateKey } from '@/lib/format/date'

/** Days between two YYYY-MM-DD keys. Both are civil dates, so this is exact. */
function daysBetweenKeys(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** `YYYY-MM-DD`, with nothing after it. */
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The civil day a value names, in Central Oregon.
 *
 * A bare `2026-08-12` is already a civil date and is taken as written. Zoning
 * it would be the trap `formatCalendarDay` documents: it parses as UTC
 * midnight, which is 5pm the PREVIOUS day in Oregon, and the count comes out a
 * day long. Anything with a time in it is a real instant and gets zoned.
 */
function civilDay(value: string): string | null {
  if (CIVIL_DATE.test(value)) return value
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return zonedDateKey(parsed)
}

/**
 * Calendar days from the day the home reached the market to today, in Central
 * Oregon. A home listed yesterday reads 1; a home listed this morning reads 0.
 */
export function daysLiveOnMarket(
  onMarketDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!onMarketDate) return null
  const started = civilDay(onMarketDate)
  if (!started) return null
  const days = daysBetweenKeys(started, zonedDateKey(now))
  // A negative count is a record entered before its own on-market date, and
  // 4000 days is eleven years: both are data faults, not listings.
  if (days < 0 || days >= 4000) return null
  return days
}

/**
 * The civil day an MLS CloseDate names.
 *
 * A close date is a DATE in the MLS and arrives here as a timestamptz pinned to
 * midnight UTC (`2026-09-08T00:00:00+00:00`). Zoning that instant into Central
 * Oregon lands on 5pm the previous day, so `civilDay` — right for OnMarketDate,
 * which is a real instant — moves every close date back one day. Measured
 * 2026-09-09 while building the sold instrument: a home that came on the market
 * on 2026-09-07 and closed on 2026-09-08 counted 0 days.
 *
 * So the date part is taken verbatim. It is what the MLS recorded and what a
 * reader can reproduce from the record beside it.
 */
export function closeCivilDay(closeDate: string | null | undefined): string | null {
  if (!closeDate) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(closeDate).trim())
  return match ? match[1]! : null
}

/**
 * How long the home was on the market before it closed: on-market date to
 * CLOSE date, in Central Oregon calendar days.
 *
 * SITE-21. daysLiveOnMarket counts to TODAY, which is the right count for a
 * home that is still for sale and a false one for a home that is not. The
 * listing page ran it on every status: a listing that came on the market on
 * 2022-07-14 and expired that October published "1,153 days on market" beside
 * a closed pill, a figure describing nothing that happened — the §0 failure of
 * a number whose stated basis does not produce it.
 *
 * It stays in this file, beside the live count, because CLAUDE.md §7's rule is
 * that days on market has ONE definition per surface and both surfaces read it
 * from here. Same calendar-day arithmetic, same zone, same fault guards; the
 * only difference is which day ends the count.
 *
 * Null when either date is missing or the pair is incoherent (a close date
 * before the on-market date is a data fault, not a zero-day sale) — an
 * off-market listing with no close date, which is most Expired, Canceled and
 * Withdrawn rows, publishes no day count at all rather than a count to today.
 */
export function daysOnMarketToClose(
  onMarketDate: string | null | undefined,
  closeDate: string | null | undefined,
): number | null {
  if (!onMarketDate || !closeDate) return null
  const started = civilDay(onMarketDate)
  const ended = closeCivilDay(closeDate)
  if (!started || !ended) return null
  const days = daysBetweenKeys(started, ended)
  if (days < 0 || days >= 4000) return null
  return days
}
