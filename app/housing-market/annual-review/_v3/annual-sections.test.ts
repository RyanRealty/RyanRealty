import { describe, expect, it } from 'vitest'
import type { MarketDetail } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { buildAnnualCharts, buildYearLedger, overlayYearDetailWithLeftover } from './annual-sections'

const BEND = { slug: 'bend', label: 'Bend' } as const

function detail(overrides: Partial<MarketDetail> = {}): MarketDetail {
  return {
    geoType: 'city',
    geoSlug: 'bend',
    geoLabel: 'Bend',
    periodType: 'rolling_365d',
    periodStart: '2025-08-23',
    periodEnd: '2026-08-23',
    medianSalePrice: 719000,
    avgSalePrice: null,
    totalVolume: null,
    soldCount: 1640,
    medianDom: 25,
    medianPricePerSqft: 399,
    avgSaleToListRatio: 0.969,
    yoyMedianPriceDeltaPct: -2.1,
    yoyPpsfChangePct: null,
    yoyDomChange: 3,
    marketHealthLabel: 'balanced',
    marketHealthScore: null,
    endOfPeriodInventory: null,
    cashPurchasePct: null,
    medianConcessionsAmount: null,
    updatedAt: '2026-08-23T00:00:00Z',
    methodologyVersion: null,
    ...overrides,
  }
}

function leftover(overrides: Partial<PublicPaceRow> = {}): PublicPaceRow {
  return {
    ...EMPTY_PUBLIC_PACE,
    medianClose: 760000,
    closedCount: 2095,
    yoyMedian: -0.0193548387096775,
    daysToContract: 28,
    ...overrides,
  }
}

describe('buildAnnualCharts leftover overlay', () => {
  const months = [
    { periodStart: '2024-01-01', medianSalePrice: 450000, soldCount: 20 },
    { periodStart: '2024-06-01', medianSalePrice: 460000, soldCount: 22 },
    { periodStart: '2025-01-01', medianSalePrice: 500000, soldCount: 18 },
    { periodStart: '2025-06-01', medianSalePrice: 510000, soldCount: 19 },
    { periodStart: '2026-01-01', medianSalePrice: 520000, soldCount: 17 },
    { periodStart: '2026-06-01', medianSalePrice: 530000, soldCount: 16 },
  ]

  it('names leftover membership when leftover plots', () => {
    const charts = buildAnnualCharts(months, '2026-08', true)
    expect(charts.region?.caption).toBe('Median sale price by month, single-family, recent years')
    expect(charts.trailing?.caption).toBe('Median sale price, single-family, last 12 completed months')
  })

  it('keeps the cache caption when leftover cannot plot', () => {
    const charts = buildAnnualCharts(months, '2026-08', false)
    expect(charts.region?.caption).toBe('Median sale price by month, recent years')
    expect(charts.trailing?.caption).toBe('Median sale price, last 12 completed months')
  })
})

describe('overlayYearDetailWithLeftover', () => {
  it('replaces cache median, sold count, and YoY with leftover close figures', () => {
    const out = overlayYearDetailWithLeftover(detail(), leftover(), BEND)
    expect(out?.medianSalePrice).toBe(760000)
    expect(out?.soldCount).toBe(2095)
    expect(out?.yoyMedianPriceDeltaPct).toBeCloseTo(-1.93548387096775)
    expect(out?.medianSalePrice).not.toBe(719000)
    expect(out?.soldCount).not.toBe(1640)
    expect(out?.yoyMedianPriceDeltaPct).not.toBe(-2.1)
  })

  it('nulls median, sold, and YoY on leftover miss even when cache had values', () => {
    const out = overlayYearDetailWithLeftover(detail(), EMPTY_PUBLIC_PACE, BEND)
    expect(out?.medianSalePrice).toBeNull()
    expect(out?.soldCount).toBeNull()
    expect(out?.yoyMedianPriceDeltaPct).toBeNull()
    expect(out?.soldCount).not.toBe(0)
    expect(out?.medianSalePrice).not.toBe(719000)
    expect(out?.yoyMedianPriceDeltaPct).not.toBe(-2.1)
  })

  it('leaves cache medianDom unchanged and does not map leftover days-to-contract', () => {
    const hit = overlayYearDetailWithLeftover(detail({ medianDom: 41 }), leftover(), BEND)
    expect(hit?.medianDom).toBe(41)
    expect(hit?.medianDom).not.toBe(28)
    const miss = overlayYearDetailWithLeftover(detail({ medianDom: 41 }), EMPTY_PUBLIC_PACE, BEND)
    expect(miss?.medianDom).toBe(41)
  })

  it('leftover-only (no cache detail) still produces a printable median', () => {
    const out = overlayYearDetailWithLeftover(null, leftover(), BEND)
    expect(out).not.toBeNull()
    expect(out?.medianSalePrice).toBe(760000)
    expect(out?.soldCount).toBe(2095)
    expect(out?.yoyMedianPriceDeltaPct).toBeCloseTo(-1.93548387096775)
    expect(out?.geoLabel).toBe('Bend')
    expect(out?.medianDom).toBeNull()
    const ledger = buildYearLedger([BEND], [out])
    expect(ledger.rows).toHaveLength(1)
    expect(ledger.rows[0]?.value).toBe('$760,000')
    expect(ledger.rows[0]?.when).toBe('2,095 sold')
    expect(ledger.missing).toEqual([])
  })

  it('returns null when leftover has none of the three and cache detail is missing', () => {
    expect(overlayYearDetailWithLeftover(null, EMPTY_PUBLIC_PACE, BEND)).toBeNull()
    expect(
      overlayYearDetailWithLeftover(
        null,
        leftover({ medianClose: null, closedCount: null, yoyMedian: null }),
      ),
    ).toBeNull()
  })
})
