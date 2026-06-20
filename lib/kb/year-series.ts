export type KbYearPoint = { m: number; value: number; soldCount: number | null }
export type KbYearSeries = { year: number; points: KbYearPoint[] }

/**
 * Group a monthly median-price series into up to `maxYears` calendar-year lines
 * (each carrying its months 1-12) for the year-over-year OVERLAY chart in
 * KbMarketHud. Lines share a Jan-Dec x-axis so seasonality + year-over-year shifts
 * read at a glance. Oldest year first; the newest is drawn last/brightest. Single
 * source for the homepage (region) + every city page. Every value stays live (§0).
 *
 * `soldCount` rides along so the chart can apply a sparse-geo volume floor — a
 * month closed by a handful of sales is noise, not a trend, and must not draw a
 * misleading zigzag (see KbMarketChart). null soldCount (older cache rows) means
 * "unknown" — never suppressed.
 */
export function buildYearSeries(
  points: { periodStart: string; medianSalePrice: number | null; soldCount?: number | null }[],
  maxYears = 5,
): KbYearSeries[] {
  const byYear = new Map<number, KbYearPoint[]>()
  for (const p of points) {
    if (p.medianSalePrice == null) continue
    const d = new Date(p.periodStart)
    const year = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const arr = byYear.get(year) ?? []
    arr.push({ m, value: p.medianSalePrice, soldCount: p.soldCount ?? null })
    byYear.set(year, arr)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-maxYears)
  return years
    .map((year) => ({ year, points: (byYear.get(year) ?? []).sort((a, b) => a.m - b.m) }))
    .filter((s) => s.points.length > 0)
}
