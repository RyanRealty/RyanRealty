/**
 * ONE SIZE ADJUSTMENT, WHICHEVER SEARCH FOUND THE SALE (Matt 2026-10-08,
 * "Adjust on both paths").
 *
 * A sale is moved for size by half its own date-adjusted price per square
 * foot, times the living-area difference to the subject, rounded to the
 * dollar. Marginal square footage is worth less than average square footage,
 * which is the appraisal convention the half stands for. The facts-ladder walk
 * (lib/pricing/estimate.ts adjustCmaCompAlongMarket) and the listings-ladder
 * fallback with no city index (lib/cma/pricing.ts adjustComps) both call this,
 * so one sale cannot be priced two ways by the path that found it.
 *
 * No dollars move when:
 *   - the sale has no living area recorded (the letter says so on its row),
 *   - the subject has no living area recorded,
 *   - the set is the exclusive pocket (Matt 2026-09-17: the pocket recommends
 *     from the pocket as sold).
 */

export const SIZE_ADJ_FACTOR = 0.5

export type SizeAdjustmentBasis =
  | 'adjusted'
  | 'no-sale-living-area'
  | 'no-subject-living-area'
  | 'exclusive-pocket'

export type SizeAdjustmentResult = {
  /** Whole dollars added to the date-adjusted price. 0 when nothing moved. */
  sizeAdjustment: number
  /** The sale's date-adjusted price per square foot, 0 when it has no living area. */
  ppsfTimeAdjusted: number
  basis: SizeAdjustmentBasis
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

export function sizeAdjustmentFor(opts: {
  subjectSqft: number | null | undefined
  saleSqft: number | null | undefined
  timeAdjustedPrice: number
  exclusivePocket?: boolean
}): SizeAdjustmentResult {
  const saleSqft = opts.saleSqft
  const ppsfTimeAdjusted = positive(saleSqft) ? opts.timeAdjustedPrice / saleSqft : 0
  if (!positive(saleSqft)) return { sizeAdjustment: 0, ppsfTimeAdjusted, basis: 'no-sale-living-area' }
  if (!positive(opts.subjectSqft)) {
    return { sizeAdjustment: 0, ppsfTimeAdjusted, basis: 'no-subject-living-area' }
  }
  if (opts.exclusivePocket === true) return { sizeAdjustment: 0, ppsfTimeAdjusted, basis: 'exclusive-pocket' }
  // `+ 0` folds a -0 from Math.round into 0, so the grid never prints "-$0".
  const sizeAdjustment =
    Math.round((opts.subjectSqft - saleSqft) * ppsfTimeAdjusted * SIZE_ADJ_FACTOR) + 0
  return { sizeAdjustment, ppsfTimeAdjusted, basis: 'adjusted' }
}
