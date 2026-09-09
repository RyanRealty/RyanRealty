/**
 * The price cut as TWO POINTS, not a sentence (site queue SITE-45).
 *
 * The taste evaluator's finding on the listing fold (2026-09-08): a 3.4% price
 * cut, a real data point, "rendered as one sentence of plain text with nothing
 * to hover". DATA_GRAPHICS.md's house order for a change between two values is
 * a two-point mark the reader can hover for the date and the percent. This
 * publisher hands the mark its two prices, its date and its percent, and
 * nothing else: no rounding that could disagree with the history rail under it.
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
    if (change == null || !Number.isFinite(change) || change >= 0) continue
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
