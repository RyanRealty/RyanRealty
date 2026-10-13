/**
 * Asking-price cuts we will publish. A seller markdown is a real cut. A feed
 * typo that moves a decimal place, or a cut larger than any honest Bend-area
 * markdown we will stand behind, is not.
 *
 * 64794 Hunnell Road (2026-10-13): $16,490,000 → $1,649,000 is a 90% "cut"
 * and exactly 10x, a missing-zero correction, not a seller markdown. It led
 * /price-drops, stretched the chart, and added ~$14.8M to "cut this week".
 */

/** Cuts deeper than this percent are withheld. Exactly 40% still counts. */
export const PRICE_CUT_SANITY_MAX_PCT = 40

/**
 * Slack around a 10x / 1/10 jump. A rounded typo (16,490,000 → 1,650,000)
 * is still a decimal-place shift, not a markdown.
 */
const DECIMAL_SHIFT_RATIO_MIN = 9.5
const DECIMAL_SHIFT_RATIO_MAX = 10.5

export function isDecimalShiftPriceChange(previous: number, current: number): boolean {
  if (!(previous > 0) || !(current > 0) || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return false
  }
  const ratio = previous / current
  return (
    (ratio >= DECIMAL_SHIFT_RATIO_MIN && ratio <= DECIMAL_SHIFT_RATIO_MAX) ||
    (ratio >= 1 / DECIMAL_SHIFT_RATIO_MAX && ratio <= 1 / DECIMAL_SHIFT_RATIO_MIN)
  )
}

/**
 * True when previous → current is a current asking-price cut we will count
 * or total. Recovered / raised / missing prices stay out (same rule as
 * tileAndEventToDrop). Over-40% cuts and ~10x decimal shifts stay out.
 */
export function isPlausibleAskingPriceCut(previous: number, current: number): boolean {
  if (!(previous > 0) || !(current > 0) || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return false
  }
  if (current >= previous) return false
  if (isDecimalShiftPriceChange(previous, current)) return false
  const pct = ((previous - current) / previous) * 100
  return pct <= PRICE_CUT_SANITY_MAX_PCT
}
