/**
 * When a plat page prints a YTD strip next to a calendar-year sales table,
 * those two 2026 (or current-year) sold figures must share one source.
 *
 * The year table is the SoR: getSubdivisionSalesHistory →
 * get_subdivision_sales_history (closed SFR, CloseDate year, slugify_geo).
 * The YTD strip is market_stats_cache periodType='ytd'. Those rows can
 * disagree on the same calendar year (Ridge At Eagle Crest: YTD 9 / $850,000
 * next to 2026 17 / $575,000 — fleet 0db0fe1f57c4a353e27acf7a85f41fd6).
 *
 * Withhold the cache YTD strip when sold count or nearest-thousand median
 * contradicts the current-year table row. Do not invent a merge.
 */

export type PlatYearSalesRow = {
  year: number
  closedCount: number
  medianClosePrice: number | null
}

export type PlatYtdStats = {
  soldCount: number | null
  medianSalePrice: number | null
  medianDaysOnMarket: number | null
  yoyChangePct: number | null
}

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

function nearestThousand(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value / 1000) * 1000
}

export function currentYearSalesRow(
  history: readonly PlatYearSalesRow[],
  year = new Date().getUTCFullYear(),
): PlatYearSalesRow | null {
  return history.find((row) => row.year === year) ?? null
}

export function publishPlatYtdStats<T extends PlatYtdStats>(input: {
  stats: T | null | undefined
  currentYear: PlatYearSalesRow | null | undefined
}): T | null {
  const stats = input.stats ?? null
  if (!stats) return null
  if (stats.soldCount == null && stats.medianSalePrice == null) return null

  const yearRow = input.currentYear ?? null
  if (!yearRow || yearRow.closedCount <= 0) return stats

  const ytdSold = asCount(stats.soldCount)
  if (ytdSold != null && ytdSold !== yearRow.closedCount) return null

  const ytdMedian = nearestThousand(stats.medianSalePrice)
  const yearMedian = nearestThousand(yearRow.medianClosePrice)
  if (ytdMedian != null && yearMedian != null && ytdMedian !== yearMedian) return null

  return stats
}
