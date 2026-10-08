/**
 * THE SALE ON THE SUBJECT'S STREET THAT HOLDS THE PRICE, as the letter reads
 * it (reader review, 915 Saginaw, 2026-10-08).
 *
 * When a sale on the subject's own street, close to its size, adjusts well
 * under the weighted price of the set, the pricer holds the recommendation to
 * at most SAME_STREET_PREMIUM_MAX above that sale, rounded to $5,000
 * (lib/cma/pricing.ts applyStreetAnchor), and that sale is never set aside
 * (lib/pricing/estimate.ts releaseStreetAnchorFromSetAside). 915 Saginaw's
 * cover is $800,000: 536 Saginaw's adjusted $727,148, plus 10 percent,
 * rounded. The letter printed weights that blend to about $960,000 and never
 * said the price was held to the street sale, and its cover note said a sale
 * was set aside "at the end of the prices so a single sale cannot set the
 * range" while 536 Saginaw alone set the low end.
 *
 * This reads the stored `pricing.streetAnchor` against the printed grid. It
 * computes nothing: every dollar is the stored anchor, checked against the
 * grid's own "Sale price today" figure for the same sale.
 */

import { printedAdjustedPrice } from '@/lib/pricing/seller-net'
import { SAME_STREET_PREMIUM_MAX } from '@/lib/pricing/price-anchor'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

export type StreetAnchorRead = {
  /** The street sales the anchor holds, as the grid prints them. */
  sales: CmaAdjustedComp[]
  /** The adjusted price the anchor is (the one sale's own, or the median of several). */
  anchor: number
  /** The most the price may sit above the anchor, rounded as the pricer rounded it. */
  ceiling: number
  /** The share above the anchor the ceiling allows (0.10). */
  premium: number
  /** True when the cover price IS the ceiling: the street sale set it. */
  holdsCover: boolean
}

function key(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * The stored anchor, matched to the printed sales by listing key (by address
 * only on a row that stored no keys), or null when the row has no anchor, a
 * named sale is not on the grid, or the grid's figure for a single anchored
 * sale is not the stored anchor.
 */
export function streetAnchorRead(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): StreetAnchorRead | null {
  const a = pricing?.streetAnchor
  if (!a || !(a.anchor > 0) || !(a.ceiling > 0)) return null
  const rows = comps ?? []
  const keys = (a.listingKeys ?? []).map(key).filter(Boolean)
  const addresses = (a.addresses ?? []).map(key).filter(Boolean)
  const named = keys.length > 0 ? keys : addresses
  if (named.length === 0) return null
  const sales = named
    .map((k) => rows.find((c) => (keys.length > 0 ? key(c.listingKey) : key(c.address)) === k) ?? null)
    .filter((c): c is CmaAdjustedComp => c != null)
  if (sales.length !== named.length) return null
  if (sales.length === 1 && Math.abs(printedAdjustedPrice(sales[0]!) - a.anchor) > 1) return null
  const rec = pricing?.recommended ?? 0
  return {
    sales,
    anchor: Math.round(a.anchor),
    ceiling: Math.round(a.ceiling),
    premium: SAME_STREET_PREMIUM_MAX,
    holdsCover: rec > 0 && Math.round(rec) === Math.round(a.ceiling) && Math.round(a.after) === Math.round(rec),
  }
}
