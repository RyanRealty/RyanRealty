/**
 * ONE 20% LINE (Matt 2026-10-08).
 *
 * "The comp search and the comparability review must make the same decision."
 * Before this, the two drew the price tier from different places:
 *
 *  - the search admitted a sale within a 30% tier gap of the home's own price
 *    anchor (SUBDIVISION_TIER_RATIO 1.3 in lib/pricing/classes.ts, on both
 *    ladders);
 *  - the review drew its band from the sales it kept, and its backstop
 *    (lib/cma/judge-ground.ts) accepted a price-tier cut 20% off the median of
 *    the OTHER candidates.
 *
 * So the search seated sales the review then dropped, and the three review
 * passes split on them. 1648 Pheasant: 2400 Jones at $381 a square foot was
 * seated against a $498 anchor and cut against a "$495 to $515" band that was
 * only the kept sales' own low and high. 20676 Wild Rose: 20606 Songbird ($281)
 * and 61131 Brown Trout ($282) were cut in one pass against Goldenrod's $343
 * as the floor, only 16% under the $335 anchor, and kept in the others.
 *
 * Now both read one line: a sale is inside the home's price tier when its
 * closed price per square foot is within PRICE_TIER_BAND of the home's
 * INDEPENDENT anchor (lib/pricing/price-anchor.ts on the facts walk, the
 * one-read anchor in lib/cma/comps.ts on the listings ladder; both are carried
 * on the selection as diagnostics.price_anchor). Not from the kept sales, not
 * from the other candidates' median.
 *
 * THE QUANTITY, both sides: the sale's CLOSE PRICE over its LIVING AREA, as it
 * closed, BEFORE any date adjustment. On the facts walk that is
 * sale_pricing_facts.close_ppsf (ClosePrice / TotalLivingAreaSqFt); on the
 * listings ladder it is closePrice / sqft of the same row; in the review it is
 * closePrice / sqft of the comp the judge is shown (salePpsf below). Unrounded
 * in every test.
 *
 * THE LINE IS WHOLE DOLLARS. The anchor is rounded to the dollar (the figure
 * the selection diagnostics store and the judge brief prints), and the floor
 * and ceiling are that figure times 0.8 and 1.2, rounded to the dollar. Every
 * reader computes the line from this one function, so the number printed for
 * the judge is the number the search used.
 *
 * NO ANCHOR, NO LINE. When a home has no independent anchor (fewer than
 * ANCHOR_MIN_N sales in its neighborhood and every ring), priceTierLine returns
 * null and each caller keeps the behavior it had before this ruling. Nothing
 * here invents a tier from a thin sample.
 */

/** How far from the anchor a sale's $/sqft may sit and still be the home's price tier. */
export const PRICE_TIER_BAND = 0.2

export type PriceTierLine = {
  /** The anchor, in whole dollars per square foot. */
  anchor: number
  /** Lowest $/sqft inside the tier, whole dollars (anchor x 0.8, rounded). */
  floor: number
  /** Highest $/sqft inside the tier, whole dollars (anchor x 1.2, rounded). */
  ceiling: number
}

export type PriceTierPosition = 'inside' | 'below' | 'above'

/** The line around an independent anchor, or null when there is no anchor. */
export function priceTierLine(anchorPpsf: number | null | undefined): PriceTierLine | null {
  if (anchorPpsf == null || !Number.isFinite(anchorPpsf) || anchorPpsf <= 0) return null
  const anchor = Math.round(anchorPpsf)
  if (anchor <= 0) return null
  return {
    anchor,
    floor: Math.round(anchor * (1 - PRICE_TIER_BAND)),
    ceiling: Math.round(anchor * (1 + PRICE_TIER_BAND)),
  }
}

/**
 * Close price per living square foot, before any date adjustment. Null when
 * either figure is missing, which every caller reads as "cannot be graded".
 */
export function salePpsf(closePrice: number | null | undefined, sqft: number | null | undefined): number | null {
  if (closePrice == null || sqft == null) return null
  if (!Number.isFinite(closePrice) || !Number.isFinite(sqft)) return null
  if (!(closePrice > 0) || !(sqft > 0)) return null
  return closePrice / sqft
}

/**
 * Where a sale's $/sqft sits against the line: inside (floor and ceiling
 * included), below, or above. Null when the sale has no usable $/sqft.
 */
export function priceTierPosition(
  ppsf: number | null | undefined,
  line: PriceTierLine,
): PriceTierPosition | null {
  if (ppsf == null || !Number.isFinite(ppsf) || ppsf <= 0) return null
  if (ppsf < line.floor) return 'below'
  if (ppsf > line.ceiling) return 'above'
  return 'inside'
}

/**
 * THE ADMISSION TEST both ladders run in place of the 30% tier gap.
 *
 * True when the sale is inside the line. A sale with no usable $/sqft cannot
 * be graded and passes, as it did under the 30% gap. `floorOnly` is the
 * custom/new carve-out the facts walk already had (customSalePriceFloorOk in
 * lib/pricing/classes.ts): a custom home selling far above its neighborhood is
 * what custom means, so only the floor binds; the review restores those peers
 * the same way (restoreCustomYearQualityPeers in lib/cma/judge-consistency.ts).
 */
export function insidePriceTier(
  ppsf: number | null | undefined,
  line: PriceTierLine,
  opts: { floorOnly?: boolean } = {},
): boolean {
  const position = priceTierPosition(ppsf, line)
  if (position == null || position === 'inside') return true
  if (position === 'above' && opts.floorOnly) return true
  return false
}

/** "$398 to $598 a square foot (within 20% of $498)", for traces and briefs. */
export function describePriceTierLine(line: PriceTierLine): string {
  return `$${line.floor} to $${line.ceiling} a square foot (within ${Math.round(PRICE_TIER_BAND * 100)}% of $${line.anchor})`
}
