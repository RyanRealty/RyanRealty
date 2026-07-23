import type {
  ReportMetrics,
  ReportPriceBandsResult,
  ReportMetricsTimeSeriesPoint,
} from '@/app/actions/reports'

/** Central Oregon cities included in the home page snapshot, market pulse
 *  carousel, and default multi-city report pulls. Sourced from the one
 *  report-coverage registry (W8.8); re-exported here to preserve every existing
 *  `@/app/actions/market-report-types` import path. */
export { MARKET_REPORT_DEFAULT_CITIES } from '@/lib/data/geo/report-cities'

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
