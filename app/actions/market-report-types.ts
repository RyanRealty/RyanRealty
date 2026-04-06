import type {
  ReportMetrics,
  ReportPriceBandsResult,
  ReportMetricsTimeSeriesPoint,
} from '@/app/actions/reports'

/** Central Oregon cities included in the home page snapshot, market pulse carousel, and default multi-city report pulls. */
export const MARKET_REPORT_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'La Pine',
  'Sunriver',
  'Tumalo',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Powell Butte',
  'Crooked River Ranch',
] as const

export type CityReportMetrics = {
  city: string
  metrics: ReportMetrics
}

/** Per-city data for market pulse carousel: one card per city with metrics + optional timeseries and price bands. */
export type CityReport = CityReportMetrics & {
  timeseries: ReportMetricsTimeSeriesPoint[] | null
  priceBands: ReportPriceBandsResult | null
  /** City hero/banner image URL for card background (from cities index). */
  heroImageUrl?: string | null
}

export type MarketReportData = {
  periodStart: string
  periodEnd: string
  /** One entry per city; each has metrics and optionally timeseries/priceBands. */
  metricsByCity: CityReport[]
  priceBandsSample: ReportPriceBandsResult | null
  priceBandsSampleCity: string | null
  timeseriesSample: ReportMetricsTimeSeriesPoint[] | null
  timeseriesSampleCity: string | null
}
