/**
 * tile-medians — the median LIST price of a set of ACTIVE listing tiles. PURE.
 *
 * WHY THIS EXISTS (§0). A "median list price" is a census of what is currently
 * for sale, so it is only honest beside the active count computed from the SAME
 * set of homes. Three surfaces already computed it that way inline, by hand
 * (`_getNeighborhoodBySlugUncached`, `_getCommunitiesForIndexUncached`, and the
 * city snapshot), and a fourth — the community page — did not: its fallback
 * chain ended at `community.medianPrice`, which carries a median CLOSED SALE
 * price whenever `market_pulse_live` has no row for the geo. It has no
 * neighborhood or subdivision rows AT ALL (verified live 2026-07-24: 17 rows,
 * every one geo_type city or region), so that branch was the normal case for a
 * resort community, and /communities/widgi-creek published a $1,169,500 closed
 * median under the label "Median list".
 *
 * No minimum-sample gate here, deliberately, and the distinction matters. The
 * n>=3 gate on `market_stats_cache.median_sale_price` exists because a median
 * SALE price is a SAMPLE of a market — one closing does not describe a trend,
 * and publishing it beside a YoY delta invents one. A median LIST price over
 * the active set is not a sample: it is the complete inventory on the market at
 * that moment. With one active listing, "median list = that listing's price" is
 * literally true. What is NOT honest is publishing a median list price beside a
 * zero active count — the caller enforces that by pairing the two.
 */

/** The only tile field this needs. Structural, so any tile shape satisfies it. */
export type ListPricedTile = { listPrice?: number | string | null }

/**
 * Median of the positive, finite list prices in `tiles`. Returns null when no
 * tile carries a usable price — never 0, never a guess.
 *
 * Even sample sizes average the two middle values and round to the dollar, the
 * same convention as the neighborhood/city/community medians this replaces, so
 * a page that renders more than one of them cannot disagree with itself over
 * rounding.
 */
export function medianListPriceOfTiles(tiles: readonly ListPricedTile[]): number | null {
  const prices = tiles
    .map((t) => Number(t.listPrice))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  return prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
}
