/**
 * Months-of-supply display. Public copy prints the figure, never a market-type
 * label. Internal `key` still follows CLAUDE.md §0: ≤4 sellers, 4–6 balanced,
 * ≥6 buyers, for CMA and other non-public branching.
 */

export type MonthsOfSupplyVerdict = { key: 'seller' | 'balanced' | 'buyer'; label: string }

/** One-decimal public line: "4.2 months of supply". */
export function publicSupplyLine(mos: number): string {
  return `${formatMonthsOfSupply(mos)} months of supply`
}

export function monthsOfSupplyVerdict(mos: number | null): MonthsOfSupplyVerdict | null {
  if (mos == null) return null
  const label = publicSupplyLine(mos)
  if (mos <= 4) return { key: 'seller', label }
  if (mos >= 6) return { key: 'buyer', label }
  return { key: 'balanced', label }
}

/**
 * Display a MOS value at 1 decimal WITHOUT letting the rounded digits cross
 * a classification threshold the raw value doesn't actually cross — a raw
 * 4.05 naively rounds to "4.0", which used to print beside a "balanced"
 * classification even though 4.05 is above the seller cutoff (design-audit P2).
 */
export function formatMonthsOfSupply(mos: number): string {
  const rounded = Math.round(mos * 10) / 10
  if (rounded === 4 && mos > 4) return '4.1'
  if (rounded === 6 && mos < 6) return '5.9'
  return rounded.toFixed(1)
}
