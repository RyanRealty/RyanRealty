/**
 * Which geo grains have a CLOSED-SALE attribution we are allowed to publish.
 *
 * Months of supply is `active / (closed_6mo / 6)`. It is only a fact when the
 * numerator and the denominator describe the SAME set of homes. Two different
 * writers fill market_pulse_live, and only one of them holds that property:
 *
 *   city + region — refresh_market_pulse() (migration 20260526140535).
 *     Actives and closes both come from `public.listings` under one identical
 *     predicate (canonical city + optional city polygon). Same population on
 *     both sides of the ratio.
 *
 *   neighborhood — refresh_community_market_pulse() (migration 20260727180000).
 *     Actives come from `listing_boundary_xref_mv`, a point-in-polygon join.
 *     Closes come from a TEXT join, `neighborhood_subdivisions.subdivision_label
 *     = listings."SubdivisionName"`. listing_boundary_xref_mv carries on-market
 *     statuses only, so the closed side could not use it. The numerator is
 *     spatial and the denominator is a string match, and they do not describe
 *     the same homes.
 *
 * What that cost, measured against the live DB on 2026-08-19 (180-day SFR
 * closes, PropertyType='A', ClosePrice >= 10000, same window the writer uses):
 *
 *   geo_slug                closes via alias   closes in polygon   published MoS
 *   bend-century-west                      2                  42           48.00
 *   broken-top                            24                 291           53.00
 *   vandevert-ranch                        1                  17           60.00
 *   bend-old-farm-district                34                 111           10.41
 *   bend-mountain-view                    25                  77           11.76
 *
 * /cities/bend/century-west published "48.0 MONTHS" and a Dataset variable
 * "Months of Supply": 48 — a buyer's-market verdict on a district whose homes
 * turn over in about ten weeks. Across all 28 neighborhood rows: 22 read >= 6
 * months, 13 read > 12, and the grain reported 1,192 actives against 79 sales
 * in 30 days while every city combined reported 1,164 actives against 272. Bend
 * neighborhoods sit INSIDE Bend, so that is arithmetically impossible and the
 * defect is attribution, not the market.
 *
 * WHY THE POLYGON IS NOT THE FIX. Swapping the denominator to the same polygon
 * that feeds the numerator looks like the repair, and it is not verifiable
 * either: the `broken-top` boundary measures 17.96 sq mi against the City of
 * Bend's own 35.45 sq mi. A golf community holding half of Bend is a boundary
 * defect, so its 291 "in-polygon" closes are as unpublishable as its 24 alias
 * closes. Neither attribution is provable at this grain today, so under
 * CLAUDE.md section 0 rule 7 the figure is CUT, not estimated.
 *
 * market_stats_cache.sold_count carries the same alias attribution at this
 * grain and is withheld with it: bend-century-west stores 3 sold in the
 * rolling 365d window against 72 in the polygon over the same year. That count
 * published as "Homes Sold (12 months)" in the Dataset JSON-LD.
 *
 * DEFAULT-DENY. A grain earns publication by being listed here after its writer
 * is shown to attribute actives and closes from one source. A grain nobody has
 * checked is untrusted, which is the safe direction: a new grain added to
 * market_pulse_live publishes no absorption figure until someone proves it.
 *
 * When the neighborhood writer is repaired, add 'neighborhood' here in the same
 * commit that lands the migration, with the counts that prove it.
 */

import type { GeoType } from '@/lib/data/types/shared'

/** The grain a market figure is being published at. */
export type MarketGrain = GeoType

/**
 * Grains whose closed-sale count is attributed by the same query that
 * attributes the active count. ONLY these may publish months of supply or a
 * sold count. Adding a grain requires the writer proof described above.
 */
export const SOLD_ATTRIBUTION_TRUSTED_GRAINS: readonly MarketGrain[] = ['city', 'region']

/** Grains that reach market_pulse_live but whose closed side is not verifiable. */
export const SOLD_ATTRIBUTION_UNTRUSTED_GRAINS: readonly MarketGrain[] = [
  'neighborhood',
  'community',
  'subdivision',
  'zip',
]

/**
 * Whether closed-sale counts at this grain are attributed the same way the
 * active count is. False means: publish no months of supply, no sold count, and
 * no verdict derived from either.
 */
export function isSoldAttributionTrusted(grain: MarketGrain | null | undefined): boolean {
  if (!grain) return false
  return SOLD_ATTRIBUTION_TRUSTED_GRAINS.includes(grain)
}

/**
 * A closed-sale count that is honest to print at this grain, or null.
 *
 * Withhold — do not swap in a different sold figure under the same label. A
 * page with no sold count is the correct outcome (section 0 rule 7).
 */
export function publishSoldCount(input: {
  value: number | null | undefined
  grain: MarketGrain
  /**
   * Pulse/cache neighborhood sold counts are mixed-method (alias join).
   * Market Truth leftover closed_count uses place_membership is_primary
   * on the same population as actives.
   */
  source?: 'pulse' | 'market-truth'
}): number | null {
  const { value } = input
  if (value == null || !Number.isFinite(value) || value < 0) return null
  if (input.source === 'market-truth') return value
  if (!isSoldAttributionTrusted(input.grain)) return null
  return value
}
