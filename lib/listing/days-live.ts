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
 */

/** Whole days from the day the home reached the market to `now`. */
export function daysLiveOnMarket(
  onMarketDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!onMarketDate) return null
  const started = Date.parse(onMarketDate)
  if (!Number.isFinite(started)) return null
  const days = Math.floor((now.getTime() - started) / 86_400_000)
  // A negative count is a record entered before its own on-market date, and
  // 4000 days is eleven years: both are data faults, not listings.
  if (days < 0 || days >= 4000) return null
  return days
}
