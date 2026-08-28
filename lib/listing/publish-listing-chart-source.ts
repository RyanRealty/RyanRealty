/**
 * Listing-template chart source. The shared public line still names
 * Market Truth leftover on market/place pages. The listing footnote must
 * not. Keep the leftover flag on the series; strip only the visitor label.
 */

import type { CoreChartMetric, CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import {
  publishPublicChartSource,
  toPublicCoreChartSeries,
} from '@/lib/market/publish-public-chart-source'

const LEFTOVER_PREFIX = /^Market Truth leftover, /

export function publishListingChartSource(input: {
  geoType: string
  geoSlug: string
  metric?: CoreChartMetric
  leftover?: boolean
}): string {
  return publishPublicChartSource(input).replace(LEFTOVER_PREFIX, '')
}

export function toListingPublicCoreChartSeries(series: CoreChartSeries): CoreChartSeries {
  const pub = toPublicCoreChartSeries(series)
  return {
    ...pub,
    series: pub.series.map((entry) => ({
      ...entry,
      source: entry.source.replace(LEFTOVER_PREFIX, ''),
    })),
  }
}
