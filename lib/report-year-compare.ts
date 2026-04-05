export type YearSeriesPoint = {
  period_start: string
  sold_count: number
  median_price: number | null
}

export type YearComparisonRow = {
  month: number
  monthLabel: string
  [key: string]: string | number | null
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getAvailableYears(series: YearSeriesPoint[]): number[] {
  const years = new Set<number>()
  for (const point of series) {
    const date = toDate(point.period_start)
    if (!date) continue
    years.add(date.getUTCFullYear())
  }
  return Array.from(years).sort((a, b) => b - a)
}

export function buildYtdComparisonRows(
  series: YearSeriesPoint[],
  years: number[],
  monthCap: number
): YearComparisonRow[] {
  const lookup = new Map<string, YearSeriesPoint>()
  for (const point of series) {
    const date = toDate(point.period_start)
    if (!date) continue
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`
    lookup.set(key, point)
  }

  const rows: YearComparisonRow[] = []
  for (let month = 1; month <= monthCap; month += 1) {
    const row: YearComparisonRow = {
      month,
      monthLabel: MONTH_LABELS[month - 1] ?? String(month),
    }
    for (const year of years) {
      const match = lookup.get(`${year}-${month}`)
      row[`sales_${year}`] = match?.sold_count ?? null
      row[`price_${year}`] = match?.median_price ?? null
    }
    rows.push(row)
  }
  return rows
}

export function summarizeInterpretation(
  rows: YearComparisonRow[],
  currentYear: number,
  compareYears: number[]
): string {
  const salesTotal = (year: number) =>
    rows.reduce((sum, row) => sum + Number(row[`sales_${year}`] ?? 0), 0)
  const avgMedian = (year: number) => {
    const prices = rows
      .map((row) => Number(row[`price_${year}`]))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (prices.length === 0) return null
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  }

  const currentSales = salesTotal(currentYear)
  const currentMedian = avgMedian(currentYear)
  if (compareYears.length === 0) {
    return `Year to date ${currentYear} shows ${currentSales} closed sales${currentMedian ? ` with an average median price around $${currentMedian.toLocaleString()}` : ''}.`
  }

  const peerSales = compareYears.map((year) => salesTotal(year)).filter((value) => value > 0)
  const peerMedians = compareYears
    .map((year) => avgMedian(year))
    .filter((value): value is number => value != null && value > 0)

  const salesDelta =
    peerSales.length > 0
      ? Math.round(((currentSales - peerSales.reduce((a, b) => a + b, 0) / peerSales.length) / Math.max(1, peerSales.reduce((a, b) => a + b, 0) / peerSales.length)) * 100)
      : null
  const medianDelta =
    currentMedian && peerMedians.length > 0
      ? Math.round(((currentMedian - peerMedians.reduce((a, b) => a + b, 0) / peerMedians.length) / (peerMedians.reduce((a, b) => a + b, 0) / peerMedians.length)) * 100)
      : null

  return `Year to date ${currentYear} is ${salesDelta == null ? 'tracking' : `${salesDelta >= 0 ? 'up' : 'down'} ${Math.abs(salesDelta)}%`} in closed sales${medianDelta == null ? '' : ` and ${medianDelta >= 0 ? 'up' : 'down'} ${Math.abs(medianDelta)}% in median pricing`} versus the selected comparison years. This is our interpretation of the data.`
}
