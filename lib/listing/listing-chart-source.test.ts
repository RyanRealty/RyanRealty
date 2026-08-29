import { describe, expect, it } from 'vitest'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { publishListingChartSource, toListingCoreChartSeries } from './listing-chart-source'

describe('publishListingChartSource', () => {
  it('names the place without leftover labels', () => {
    expect(
      publishListingChartSource({
        geoType: 'city',
        geoSlug: 'redmond',
        metric: 'medianClosePrice',
      }),
    ).toBe('Oregon Data Share, Redmond city, monthly')
  })
})

describe('toListingCoreChartSeries', () => {
  it('strips leftover membership and leftover source copy from serialized HTML', () => {
    const raw: CoreChartSeries = {
      geoType: 'city',
      geoSlug: 'redmond',
      series: [
        {
          metric: 'medianClosePrice',
          granularity: 'monthly',
          points: [{ periodStart: '2026-07-01', value: 625_000 }],
          source: "Market Truth leftover mt-v1 window_months=1 · geo_type='city' geo_slug='redmond'",
          period: 'Jul 2026',
          leftover: true,
        },
      ],
    }
    const pub = toListingCoreChartSeries(raw)
    const html = JSON.stringify(pub)
    expect(pub.series[0]!.source).toBe('Oregon Data Share, Redmond city, monthly')
    expect(pub.series[0]!.leftover).toBeUndefined()
    expect(html).not.toMatch(/Market Truth leftover/)
    expect(html).not.toMatch(/leftover":true/)
    expect(html).not.toMatch(/leftover:true/)
  })
})
