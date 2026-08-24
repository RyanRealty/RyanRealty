/**
 * Visitor-facing chart source line.
 *
 * Public HTML must not leak table names (`market_pulse_live`,
 * `market_stats_cache`) or raw `geo_slug='…'` traces. Name the geography
 * in English and the feed (Oregon Data Share).
 *
 * Founding case: /communities/tetherow serialized
 * `market_stats_cache.median_sale_price · geo_type='city' geo_slug='bend'`
 * into the page (fleet 5f0ec58d60988a52e76b8a559ef22f0c). The chart was
 * already a Bend city fallback — the leak was the table name, not the grain.
 */

import type { CoreChartMetric, CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'

function titleCaseSlug(slug: string): string {
  return slug
    .trim()
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function publicChartPlaceLabel(geoType: string, geoSlug: string): string {
  const name = titleCaseSlug(geoSlug)
  if (geoType === 'city') return `${name} city`
  if (geoType === 'region') {
    return geoSlug === 'central-oregon' ? 'Central Oregon' : name
  }
  return name
}

export function publishPublicChartSource(input: {
  geoType: string
  geoSlug: string
  metric?: CoreChartMetric
  leftover?: boolean
}): string {
  const place = publicChartPlaceLabel(input.geoType, input.geoSlug)
  if (input.leftover && input.metric === 'closedVolume') {
    return `Market Truth leftover, ${place}, monthly closed sales`
  }
  if (input.leftover) {
    return `Market Truth leftover, ${place}, monthly median close`
  }
  if (input.metric === 'priceCutShare') {
    return `Oregon Data Share, ${place}, weekly price-cut share`
  }
  if (input.metric === 'monthsOfSupply') {
    return `Oregon Data Share, ${place}, monthly months of supply`
  }
  return `Oregon Data Share, ${place}, monthly`
}

export function toPublicCoreChartSeries(series: CoreChartSeries): CoreChartSeries {
  return {
    ...series,
    series: series.series.map((entry) => ({
      ...entry,
      leftover: entry.leftover,
      source: publishPublicChartSource({
        geoType: series.geoType,
        geoSlug: series.geoSlug,
        metric: entry.metric,
        leftover: entry.leftover,
      }),
    })),
  }
}
