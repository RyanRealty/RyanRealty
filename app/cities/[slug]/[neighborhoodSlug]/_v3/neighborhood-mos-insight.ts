/**
 * Neighborhood-local MOS history pages for InsightPager (SITE-104).
 * Years of closed sales + the live supply face — how supply moved, not a
 * second label of the two MOS bars.
 */

export type NeighborhoodSupplyMonth = {
  periodStart: string
  soldCount: number | null
}

export function buildNeighborhoodSupplyPages(input: {
  months: readonly NeighborhoodSupplyMonth[]
  homesForSale: number
  monthOfSales: number
  mosText: string
}): string[] {
  const byYear = new Map<string, number>()
  for (const row of input.months) {
    if (row.soldCount == null || !Number.isFinite(row.soldCount) || row.soldCount <= 0) continue
    const year = row.periodStart.slice(0, 4)
    if (!/^\d{4}$/.test(year)) continue
    byYear.set(year, (byYear.get(year) ?? 0) + Math.round(row.soldCount))
  }
  const years = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-3)
  const pages = years.map(([year, sold]) => `${year} · ${sold.toLocaleString('en-US')} sold`)
  const homes = Math.round(input.homesForSale)
  const pace = Number.isFinite(input.monthOfSales)
    ? input.monthOfSales.toLocaleString('en-US', { maximumFractionDigits: 1 })
    : null
  if (homes > 0 && pace) {
    pages.push(`Now · ${homes.toLocaleString('en-US')} for sale / ${pace} a month (${input.mosText} mo)`)
  }
  return pages
}
