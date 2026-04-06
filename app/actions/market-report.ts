'use server'

import {
  getReportMetrics,
  getReportPriceBands,
  getReportMetricsTimeSeries,
} from '@/app/actions/reports'
import {
  MARKET_REPORT_DEFAULT_CITIES,
  type CityReport,
  type MarketReportData,
} from '@/app/actions/market-report-types'
import { getCitiesForIndex } from '@/app/actions/cities'

/** Industry-standard residential filters: include condos/townhomes, exclude manufactured/mobile and land/acreage. */
const RESIDENTIAL_ONLY = {
  includeCondoTown: true,
  includeManufactured: false,
  includeAcreage: false,
} as const

/**
 * Fetch market report data for the given range across multiple cities.
 * Residential focus: condos and townhomes included; manufactured, land or acreage, and commercial excluded unless flags change.
 * Returns per-city metrics for the home page city carousel and reports page.
 */
export async function getMarketReportData(options?: {
  periodStart?: string
  periodEnd?: string
  cities?: string[]
}): Promise<MarketReportData> {
  const end = options?.periodEnd
    ? new Date(options.periodEnd)
    : new Date()
  const start = options?.periodStart
    ? new Date(options.periodStart)
    : (() => {
        const d = new Date(end)
        d.setDate(d.getDate() - 7)
        return d
      })()
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)
  const cities = options?.cities?.length
    ? options.cities
    : [...MARKET_REPORT_DEFAULT_CITIES]
  const daysInRange = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const numMonthsTimeseries = daysInRange > 180 ? 12 : 6

  const results = await Promise.all(
    cities.map(async (city) => {
      const [metricsRes, priceBandsRes, timeseriesRes] = await Promise.all([
        getReportMetrics(city, periodStart, periodEnd, undefined, undefined, RESIDENTIAL_ONLY),
        getReportPriceBands(city, periodStart, periodEnd, false, undefined, RESIDENTIAL_ONLY),
        getReportMetricsTimeSeries(city, numMonthsTimeseries, undefined, RESIDENTIAL_ONLY),
      ])
      const metrics = metricsRes.data
      if (!metrics) return null
      return {
        city,
        metrics,
        timeseries: timeseriesRes.data ?? null,
        priceBands: priceBandsRes.data ?? null,
      } satisfies CityReport
    })
  )

  let metricsByCity: CityReport[] = results.filter(
    (r): r is CityReport => r != null
  )

  // Drop obvious no-data rows so the slider only shows meaningful market cards.
  metricsByCity = metricsByCity.filter((row) => {
    const m = row.metrics
    return m.sold_count > 0 || m.current_listings > 0 || m.sales_12mo > 0
  })

  // Attach city hero images for slider card backgrounds (match by name, case-insensitive).
  try {
    const citiesForIndex = await getCitiesForIndex()
    const heroByLowerName = new Map<string, string | null>()
    for (const c of citiesForIndex) {
      const key = c.name.trim().toLowerCase()
      if (c.heroImageUrl) heroByLowerName.set(key, c.heroImageUrl)
      const slugKey = c.slug.toLowerCase().replace(/-/g, ' ')
      if (c.heroImageUrl && slugKey !== key) heroByLowerName.set(slugKey, c.heroImageUrl)
    }
    metricsByCity = metricsByCity.map((row) => ({
      ...row,
      heroImageUrl: heroByLowerName.get(row.city.trim().toLowerCase()) ?? null,
    }))
  } catch {
    // Non-fatal: cards render without background image
  }

  const first = metricsByCity[0]
  return {
    periodStart,
    periodEnd,
    metricsByCity,
    priceBandsSample: first?.priceBands ?? null,
    priceBandsSampleCity: first?.city ?? null,
    timeseriesSample: first?.timeseries ?? null,
    timeseriesSampleCity: first?.city ?? null,
  }
}
