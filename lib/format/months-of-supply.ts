/**
 * Months-of-supply display + classification per CLAUDE.md §0: ≤4 seller's
 * market, 4–6 balanced, ≥6 buyer's market.
 */

export type MonthsOfSupplyVerdict = { key: 'seller' | 'balanced' | 'buyer'; label: string }

export function monthsOfSupplyVerdict(mos: number | null): MonthsOfSupplyVerdict | null {
  if (mos == null) return null
  if (mos <= 4) return { key: 'seller', label: "Seller's market" }
  if (mos >= 6) return { key: 'buyer', label: "Buyer's market" }
  return { key: 'balanced', label: 'Balanced market' }
}

/**
 * Display a MOS value at 1 decimal WITHOUT letting the rounded digits cross
 * a classification threshold the raw value doesn't actually cross — a raw
 * 4.05 naively rounds to "4.0", printing a number that contradicts both the
 * page's own "Balanced market" verdict and its methodology text ("four
 * months or less is a seller's market") even though 4.05 genuinely IS
 * balanced (design-audit P2).
 */
export function formatMonthsOfSupply(mos: number): string {
  const rounded = Math.round(mos * 10) / 10
  if (rounded === 4 && mos > 4) return '4.1'
  if (rounded === 6 && mos < 6) return '5.9'
  return rounded.toFixed(1)
}
