/**
 * The latest complete month's median SALE price from a monthly closed-sale
 * series. The month's figure only: the chart beside it writes the year-over-
 * year comparison from its own compacted labels, and a second percent computed
 * here from the exact values could differ from it in the last digit.
 *
 * Why this exists (2026-09-07): the market FAQ answered "What is the median
 * home price in Bend?" with the median LIST price of the active listings. A
 * reader, and every peer report the answer engines cite beside ours, means the
 * median sale price of closed homes. The page's own chart already published
 * that figure ("Median sale price $750K in Aug 2026"); the FAQ did not. This
 * helper picks the figure the chart uses so the FAQ and the chart cannot
 * disagree.
 *
 * §0: no fabrication. A series without a positive complete-month value
 * returns null and the FAQ omits the sale sentence.
 */
export type MonthlySalePoint = { periodStart: string; medianSalePrice: number | null }

export type LatestSaleMedian = {
  value: number
  /** "August 2026" */
  monthLabel: string
  /** YYYY-MM of the month the value belongs to */
  monthKey: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function monthKeyOf(periodStart: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(periodStart)
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `${m[1]}-${m[2]}`
}

function labelOf(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

export function latestSaleMedian(
  months: readonly MonthlySalePoint[],
  /** YYYY-MM of the month still in progress; it is never the answer. */
  currentMonthKey?: string,
): LatestSaleMedian | null {
  const byKey = new Map<string, number>()
  for (const row of months) {
    const key = monthKeyOf(row.periodStart)
    if (!key) continue
    if (currentMonthKey && key >= currentMonthKey) continue
    const v = row.medianSalePrice
    if (v == null || !Number.isFinite(v) || v <= 0) continue
    byKey.set(key, v)
  }
  if (byKey.size === 0) return null
  const latestKey = [...byKey.keys()].sort().at(-1)!
  const value = byKey.get(latestKey)!
  return { value, monthLabel: labelOf(latestKey), monthKey: latestKey }
}
