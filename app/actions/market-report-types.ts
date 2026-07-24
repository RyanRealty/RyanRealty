/** Central Oregon cities included in the default multi-city report pulls.
 *  Sourced from the one report-coverage registry (W8.8); re-exported here to
 *  preserve every existing `@/app/actions/market-report-types` import path.
 *
 *  W8.1 removed the CityReportMetrics / CityReport / MarketReportData types that
 *  used to live here: they described the get_city_period_metrics RPC payload for
 *  getMarketReportData, and both the action and its only renderers are retired.
 *  The /reports range table now reads market_stats_cache via getCityRangeReport. */
export { MARKET_REPORT_DEFAULT_CITIES } from '@/lib/data/geo/report-cities'
