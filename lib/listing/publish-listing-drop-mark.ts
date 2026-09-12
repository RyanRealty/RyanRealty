/**
 * The price cut as two prices the reader can see at rest (Matt 2026-09-10).
 *
 * SITE-45 drew a 22px slope and hid the reading behind hover. Two values are
 * not a chart. This publisher still hands from / to / drop / pct / date so the
 * mark and the history rail cannot name different cuts.
 *
 * Which cut: the NEWEST dated price drop on the published timeline since the
 * home was last listed, the same row publishListingLastDrop reads, so the mark
 * and the "Price drop $76K" label cannot name different cuts. `from` is the
 * price before that row (`price - price_change`, the change being negative),
 * `to` the price the row set. A row with no `price` cannot place both points
 * and is not drawn; a cut with no date is not drawn either, because the date
 * is half of what the hover promises.
 *
 * Section 0: every number here is on the history row already rendered on the
 * page; `pct` is derived from the two of them and printed to one tenth.
 */

export type PublishedListingDropMark = {
  /** The price before the cut. */
  from: number
  /** The price the cut set. */
  to: number
  /** from - to, in dollars. */
  drop: number
  /** The cut as a share of `from`, in percent, one tenth. */
  pct: number
  /** The row's event_date, YYYY-MM-DD (or the source's ISO), unformatted. */
  date: string
}

type Row = {
  event?: string | null
  event_date?: string | null
  price?: number | null
  price_change?: number | null
}

function normalizeEvent(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
}

function positive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

export function publishListingDropMark(
  rows: ReadonlyArray<Row> | null | undefined,
): PublishedListingDropMark | null {
  if (!rows || rows.length === 0) return null
  const dated = rows.filter(
    (row): row is Row & { event: string; event_date: string } => Boolean(row.event && row.event_date),
  )
  const listedCutoff =
    dated
      .filter((row) => {
        const key = normalizeEvent(row.event)
        return key === 'listed' || key === 'newlisting'
      })
      .map((row) => row.event_date)
      .sort()
      .at(-1) ?? null
  const newestFirst = dated
    .filter((row) => !listedCutoff || row.event_date >= listedCutoff)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
  for (const row of newestFirst) {
    const key = normalizeEvent(row.event)
    if (key !== 'pricechange' && key !== 'pricedrop') continue
    const change = row.price_change
    if (change == null || !Number.isFinite(change)) continue
    // A RISE NEWER THAN THE CUT ENDS THE SEARCH (2026-09-11).
    //
    // This loop used to `continue` past an increase and keep hunting for an
    // older decrease, so a cut stayed on the page after the seller put the
    // price back up. /homes-for-sale/bend/21357-kilimanjaro-220222798 asked
    // $614,995 while this mark printed a struck-through $609,995 labelled
    // "Cut $1,000" beside it — a LOWER number presented as the old price, so
    // the page read as a discount on a home whose price had just gone UP
    // $6,000 (history: -$1K Aug 19, +$6K Sep 2). Publishing a rise as a cut is
    // a §0 failure and a misrepresentation on a licensed broker's listing.
    //
    // Newest-first, the first price ACTION decides: a rise means there is no
    // cut to publish today, so stop rather than reach past it. `=== 0` is not
    // an action and is skipped; a null/NaN change cannot be classified either
    // way and is skipped rather than treated as a rise.
    if (change > 0) return null
    if (change === 0) continue
    const to = positive(row.price)
    if (to == null) return null
    const from = to + Math.round(Math.abs(change))
    const drop = from - to
    if (drop <= 0) return null
    const pct = Math.round((drop / from) * 1000) / 10
    return { from, to, drop, pct, date: row.event_date }
  }
  return null
}
