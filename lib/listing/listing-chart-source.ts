/**
 * Listing Chart Room source lines. Same V3Chart geometry as place pages.
 * Public listing HTML must not carry leftover labels or leftover:true.
 */

import type { CoreChartMetric, CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { publishPublicChartSource } from '@/lib/market/publish-public-chart-source'

export function publishListingChartSource(input: {
  geoType: string
  geoSlug: string
  metric?: CoreChartMetric
}): string {
  return publishPublicChartSource({
    geoType: input.geoType,
    geoSlug: input.geoSlug,
    metric: input.metric,
    leftover: false,
  })
}

export function toListingCoreChartSeries(series: CoreChartSeries): CoreChartSeries {
  return {
    ...series,
    series: series.series.map((entry) => {
      const { leftover: _leftover, ...rest } = entry
      return {
        ...rest,
        source: publishListingChartSource({
          geoType: series.geoType,
          geoSlug: series.geoSlug,
          metric: entry.metric,
        }),
      }
    }),
  }
}
