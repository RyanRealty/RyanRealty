import { describe, expect, it } from 'vitest'
import { marketPage } from '@/lib/cma/render-market-page'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '56628 Sunstone Loop',
  city: 'Bend',
} as CmaSubject

const comps = [
  { closePrice: 1920000, sqft: 3832, domTotal: 165 },
  { closePrice: 2180000, sqft: 3217, domTotal: 40 },
  { closePrice: 1795000, sqft: 3021, domTotal: 72 },
] as CmaAdjustedComp[]

const market = {
  geoSlug: 'caldera-springs',
  geoLabel: 'Caldera Springs',
  periodStart: '2025-08-14',
  periodEnd: '2026-08-14',
  soldCount365: 39,
  medianSalePrice: 1790000,
  medianDom: 72,
  medianPpsf: 580,
  saleToListRatio: 0.937,
  yoyMedianPriceDeltaPct: 4.7,
  activeCount: 48,
  pendingCount: 12,
  medianListPrice: 1894900,
  monthsOfSupply: 22.2,
  mosFormula: 'market_pulse_live.months_of_supply',
  marketVerdict: 'buyer',
  methodologyVersion: 'v3-2026-05-07',
  computedAt: '2026-08-14T20:00:00.000Z',
  pulseUpdatedAt: '2026-08-14T20:00:00.000Z',
  trend: [
    { periodStart: '2026-07-01', medianSalePrice: 1795000, soldCount: 3, endOfPeriodInventory: 28 },
    { periodStart: '2026-06-01', medianSalePrice: null, soldCount: 1, endOfPeriodInventory: 26 },
  ],
} as CmaMarketContext

describe('marketPage', () => {
  it('compares these sales to this market and live inventory, not a ZIP dump', () => {
    const page = marketPage({ subject, comps, market })
    expect(page).not.toBeNull()
    const html = page!.body
    expect(html).toContain('The Caldera Springs market')
    expect(html).toContain('These sales')
    expect(html).toContain('This market')
    expect(html).toContain('For sale now')
    expect(html).toContain('Under contract')
    expect(html).toContain('$1,920,000')
    expect(html).toContain('$1,790,000')
    expect(html).toContain('$1,894,900')
    expect(html).toContain('a buyer\'s market')
    expect(html).toContain('22.2 months of supply')
    expect(html).not.toContain('ZIP')
    expect(html.replace(/&[a-zA-Z]+;/g, '').replace(/&#\d+;/g, '')).not.toMatch(/[—;]/)
  })

  it('does not draw a trend chart when fewer than six priced months exist', () => {
    const page = marketPage({ subject, comps, market })
    expect(page!.body).not.toContain('trend-chart')
  })

  it('cites analytics_mart_market_annual for the city year figure when present', () => {
    const page = marketPage({
      subject,
      comps,
      market: {
        ...market,
        yearMart: {
          year: 2024,
          geoType: 'city',
          geoSlug: 'bend',
          geoLabel: 'Bend',
          typeScope: 'all',
          soldCount: 2100,
          totalVolume: 1_800_000_000,
          medianClose: 625000,
          source: 'mart',
          table: 'analytics_mart_market_annual',
          computedAt: '2026-08-14T20:00:00.000Z',
          methodology: 'closed_cte+service_area_v1',
          typeLabel: 'all property types, 2024',
        },
      },
    })
    expect(page!.body).toContain('analytics_mart_market_annual')
    expect(page!.body).toContain('all property types, 2024')
    expect(page!.body).toContain('geo_type')
    expect(page!.body).toContain('bend')
  })

  it('omits the year cube when the mart row is missing', () => {
    const page = marketPage({ subject, comps, market })
    expect(page!.body).not.toContain('analytics_mart_market_annual')
  })

  it('draws a trend when six priced months are present', () => {
    const trend = [
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
    ].map((periodStart, i) => ({
      periodStart,
      medianSalePrice: 1700000 + i * 10000,
      soldCount: 4,
      endOfPeriodInventory: 20,
    }))
    const page = marketPage({ subject, comps, market: { ...market, trend } })
    expect(page!.body).toContain('trend-chart')
    expect(page!.body).toContain('Median close by month')
  })
})
