import { describe, expect, it } from 'vitest'
import {
  publicChartPlaceLabel,
  publishPublicChartSource,
  toPublicCoreChartSeries,
} from './publish-public-chart-source'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'

describe('publishPublicChartSource', () => {
  it('names Bend city without table names (Tetherow city-fallback founding)', () => {
    const line = publishPublicChartSource({
      geoType: 'city',
      geoSlug: 'bend',
      metric: 'medianClosePrice',
    })
    expect(line).toBe('Oregon Data Share, Bend city, monthly')
    expect(line).not.toMatch(/market_stats_cache|market_pulse_live|geo_slug=/)
  })

  it('title-cases hyphen slugs', () => {
    expect(publicChartPlaceLabel('neighborhood', 'awbrey-glen')).toBe('Awbrey Glen')
  })
})

describe('toPublicCoreChartSeries', () => {
  it('rewrites every series source to the public line', () => {
    const raw: CoreChartSeries = {
      geoType: 'city',
      geoSlug: 'bend',
      series: [
        {
          metric: 'medianClosePrice',
          granularity: 'monthly',
          points: [{ periodStart: '2026-07-01', value: 777_450 }],
          source: "market_stats_cache.median_sale_price · geo_type='city' geo_slug='bend'",
          period: 'Jul 2026',
        },
      ],
    }
    const pub = toPublicCoreChartSeries(raw)
    expect(pub.series[0]!.source).toBe('Oregon Data Share, Bend city, monthly')
    expect(JSON.stringify(pub)).not.toMatch(/market_stats_cache|market_pulse_live|geo_slug=/)
  })
})
