/**
 * Public detached calendar-month leftover (Step 9 chart overlay).
 * window_months = 1 median_close / closed_count through getMetrics.
 * Miss omits that month. Does not print MoM rates. In-progress month is dropped
 * by the caller. If leftover cannot plot, the series is empty. Cache does not fill.
 */
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'

export const PUBLIC_MONTHLY_WINDOW_MONTHS = 1
export const PUBLIC_MONTHLY_MONTHS = 36

export type PublicMonthlyPoint = {
  periodStart: string
  periodEnd: string
  medianClose: number | null
  closedCount: number | null
}

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function lastDayOfMonth(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0))
  return d.toISOString().slice(0, 10)
}

/** Complete calendar months, oldest first, excluding currentMonthKey (YYYY-MM). */
export function completeMonthKeys(currentMonthKey: string, count = PUBLIC_MONTHLY_MONTHS): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(currentMonthKey)
  if (!match) return []
  let year = Number(match[1])
  let month = Number(match[2]) - 1
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}`)
  }
  return keys.reverse()
}

function publishedNumber(cell: MetricResult | null | undefined): number | null {
  if (!cell?.isPublishable || cell.value == null || !Number.isFinite(cell.value) || cell.value <= 0) {
    return null
  }
  return cell.value
}

export function leftoverMonthlyToCacheShape(rows: readonly PublicMonthlyPoint[]): {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
}[] {
  return rows
    .filter((row) => row.medianClose != null)
    .map((row) => ({
      periodStart: row.periodStart,
      medianSalePrice: row.medianClose,
      soldCount: row.closedCount,
    }))
}

/** Drop the Pacific in-progress month so a partial month cannot draw as a dip. */
export function dropCurrentMonth<T extends { periodStart: string }>(
  rows: readonly T[],
  currentMonthKey: string,
): T[] {
  if (!currentMonthKey) return [...rows]
  return rows.filter((row) => row.periodStart.slice(0, 7) !== currentMonthKey)
}

export function leftoverOrCacheMonthly<T extends { periodStart: string; medianSalePrice: number | null }>(
  leftover: readonly PublicMonthlyPoint[],
  cache: readonly T[],
  minMonths = 6,
): { months: Array<{ periodStart: string; medianSalePrice: number | null; soldCount: number | null }>; leftoverUsed: boolean } {
  const leftoverMonths = leftoverMonthlyToCacheShape(leftover)
  if (leftoverMonths.length >= minMonths) {
    return { months: leftoverMonths, leftoverUsed: true }
  }
  return { months: [], leftoverUsed: false }
}

/**
 * Neighborhood/community HUD grain: leftover neighborhood monthly when it can
 * plot; else this place's cache when dense; else leftover city monthly (labeled
 * city by the caller). Never fills a neighborhood leftover miss from leftover
 * city without cityFallback.
 */
export function leftoverNeighborhoodOrCityMonthly<
  T extends { periodStart: string; medianSalePrice: number | null },
>(opts: {
  leftoverNeighborhood: readonly PublicMonthlyPoint[]
  leftoverCity: readonly PublicMonthlyPoint[]
  neighborhoodCache: readonly T[]
  cityCache: readonly T[]
  currentMonthKey: string
  neighborhoodCacheSparse: boolean
  minMonths?: number
}): {
  months: Array<{ periodStart: string; medianSalePrice: number | null; soldCount: number | null }>
  leftoverUsed: boolean
  cityFallback: boolean
} {
  const minMonths = opts.minMonths ?? 6
  const place = leftoverOrCacheMonthly(
    opts.leftoverNeighborhood,
    dropCurrentMonth(opts.neighborhoodCache, opts.currentMonthKey),
    minMonths,
  )
  if (place.leftoverUsed) {
    return { ...place, cityFallback: false }
  }
  const city = leftoverOrCacheMonthly(
    opts.leftoverCity,
    dropCurrentMonth(opts.cityCache, opts.currentMonthKey),
    minMonths,
  )
  if (city.leftoverUsed) {
    return { ...city, cityFallback: true }
  }
  return { months: [], leftoverUsed: false, cityFallback: false }
}

export async function getPublicDetachedMonthly(opts: {
  geoType: 'city' | 'region' | 'neighborhood' | 'zip'
  geoSlug: string
  currentMonthKey: string
}): Promise<PublicMonthlyPoint[]> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return []
  const keys = completeMonthKeys(opts.currentMonthKey)
  if (keys.length === 0) return []

  const inputs = keys.flatMap((key) => {
    const [year, month] = key.split('-').map(Number)
    const periodStart = `${key}-01`
    const periodEnd = lastDayOfMonth(year!, (month ?? 1) - 1)
    return [
      {
        stat: 'median_close',
        geoType: opts.geoType,
        geoSlug,
        segment: 'detached',
        windowMonths: PUBLIC_MONTHLY_WINDOW_MONTHS,
        periodEnd,
        _periodStart: periodStart,
        _periodEnd: periodEnd,
      },
      {
        stat: 'closed_count',
        geoType: opts.geoType,
        geoSlug,
        segment: 'detached',
        windowMonths: PUBLIC_MONTHLY_WINDOW_MONTHS,
        periodEnd,
        _periodStart: periodStart,
        _periodEnd: periodEnd,
      },
    ]
  })

  const results = await getMetrics(
    inputs.map(({ stat, geoType, geoSlug, segment, windowMonths, periodEnd }) => ({
      stat,
      geoType,
      geoSlug,
      segment,
      windowMonths,
      periodEnd,
    })),
  )

  const byStart = new Map<string, PublicMonthlyPoint>()
  inputs.forEach((input, i) => {
    const start = input._periodStart
    const existing = byStart.get(start) ?? {
      periodStart: start,
      periodEnd: input._periodEnd,
      medianClose: null,
      closedCount: null,
    }
    const value = publishedNumber(results[i])
    if (input.stat === 'median_close') existing.medianClose = value
    if (input.stat === 'closed_count') existing.closedCount = value == null ? null : Math.round(value)
    byStart.set(start, existing)
  })
  return keys.map((key) => byStart.get(`${key}-01`)!).filter(Boolean)
}
