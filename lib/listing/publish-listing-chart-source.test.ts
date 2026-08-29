import { describe, expect, it } from 'vitest'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import {
  publishListingChartSource,
  toListingPublicCoreChartSeries,
} from './publish-listing-chart-source'

describe('publishListingChartSource', () => {
  it('strips the leftover label and keeps the Bend city grain', () => {
    expect(
      publishListingChartSource({
        geoType: 'city',
        geoSlug: 'bend',
        metric: 'medianClosePrice',
        leftover: true,
      }),
    ).toBe('Bend city, monthly median close')
  })

  it('leaves a non-leftover Oregon Data Share line intact', () => {
    expect(
      publishListingChartSource({
        geoType: 'city',
        geoSlug: 'bend',
        metric: 'medianClosePrice',
      }),
    ).toBe('Oregon Data Share, Bend city, monthly')
  })
})

describe('toListingPublicCoreChartSeries', () => {
  it('keeps leftover data and drops leftover from the visitor source', () => {
    const raw: CoreChartSeries = {
      geoType: 'city',
      geoSlug: 'bend',
      series: [
        {
          metric: 'medianClosePrice',
          granularity: 'monthly',
          points: [{ periodStart: '2026-07-01', value: 795_000 }],
          source: "Market Truth leftover mt-v1 window_months=1 · geo_type='city' geo_slug='bend' · median_close",
          period: 'Jul 2026',
          leftover: true,
        },
      ],
    }
    const pub = toListingPublicCoreChartSeries(raw)
    expect(pub.series[0]!.leftover).toBe(true)
    expect(pub.series[0]!.source).toBe('Bend city, monthly median close')
    expect(JSON.stringify(pub)).not.toMatch(/Market Truth leftover/)
  })
})
