'use server'

import {
  getReportMetrics,
  getReportPriceBands,
  getReportMetricsTimeSeries,
  type ReportMetrics,
  type ReportPriceBandsResult,
  type ReportMetricsTimeSeriesPoint,
} from '@/app/actions/reports'

export const BEACON_REPORT_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'La Pine',
  'Sunriver',
  'Tumalo',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Crooked River Ranch',
] as const

export type BeaconCityMetrics = {
  city: string
  metrics: ReportMetrics
}

export type BeaconReportData = {
  periodStart: string
  periodEnd: string
  metricsByCity: BeaconCityMetrics[]
  priceBandsSample: ReportPriceBandsResult | null
  priceBandsSampleCity: string | null
  timeseriesSample: ReportMetricsTimeSeriesPoint[] | null
  timeseriesSampleCity: string | null
}

/**
 * Fetch beacon report data for the last 7 days (or given range) across multiple cities.
 * Returns metrics per city, plus sample price bands and timeseries for the first city (for chart tiles).
 */
export async function getBeaconReportData(options?: {
  periodStart?: string
  periodEnd?: string
  cities?: string[]
}): Promise<BeaconReportData> {
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
    : [...BEACON_REPORT_DEFAULT_CITIES]

  const metricsResults = await Promise.all(
    cities.map(async (city) => {
      const { data } = await getReportMetrics(city, periodStart, periodEnd)
      return { city, metrics: data }
    })
  )

  const metricsByCity: BeaconCityMetrics[] = metricsResults
    .filter((r): r is { city: string; metrics: ReportMetrics } => r.metrics != null)
    .map((r) => ({ city: r.city, metrics: r.metrics! }))

  const firstCity = cities[0] ?? 'Bend'
  const [priceBandsRes, timeseriesRes] = await Promise.all([
    getReportPriceBands(firstCity, periodStart, periodEnd, false),
    getReportMetricsTimeSeries(firstCity, 4),
  ])

  return {
    periodStart,
    periodEnd,
    metricsByCity,
    priceBandsSample: priceBandsRes.data ?? null,
    priceBandsSampleCity: firstCity,
    timeseriesSample: timeseriesRes.data ?? null,
    timeseriesSampleCity: firstCity,
  }
}
