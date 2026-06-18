export type KbYearSeries = { year: number; points: { m: number; value: number }[] }

/**
 * Group a monthly median-price series into up to `maxYears` calendar-year lines
 * (each carrying its months 1-12) for the year-over-year OVERLAY chart in
 * KbMarketHud. Lines share a Jan-Dec x-axis so seasonality + year-over-year shifts
 * read at a glance. Oldest year first; the newest is drawn last/brightest. Single
 * source for the homepage (region) + every city page. Every value stays live (§0).
 */
export function buildYearSeries(
  points: { periodStart: string; medianSalePrice: number | null }[],
  maxYears = 5,
): KbYearSeries[] {
  const byYear = new Map<number, { m: number; value: number }[]>()
  for (const p of points) {
    if (p.medianSalePrice == null) continue
    const d = new Date(p.periodStart)
    const year = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const arr = byYear.get(year) ?? []
    arr.push({ m, value: p.medianSalePrice })
    byYear.set(year, arr)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-maxYears)
  return years
    .map((year) => ({ year, points: (byYear.get(year) ?? []).sort((a, b) => a.m - b.m) }))
    .filter((s) => s.points.length > 0)
}
