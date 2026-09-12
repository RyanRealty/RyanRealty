import { describe, expect, it } from 'vitest'
import type { MarketDetail } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import {
  buildAnnualCharts,
  buildAnnualMosChart,
  buildInventoryLedger,
  buildRegionFigures,
  buildYearLedger,
  monthlyPaceFromMos,
  overlayYearDetailWithLeftover,
} from './annual-sections'

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

describe('SITE-101 inventory bars encode active count', () => {
  it('sets weight from active share and prints active in when', () => {
    const ledger = buildInventoryLedger(
      [
        { slug: 'bend', label: 'Bend' },
        { slug: 'sisters', label: 'Sisters' },
      ],
      [
        {
          geo_label: 'Bend',
          geo_slug: 'bend',
          active_count: 800,
          median_list_price: 750000,
          months_of_supply: 4.2,
          updated_at: '2026-09-11T00:00:00Z',
        } as never,
        {
          geo_label: 'Sisters',
          geo_slug: 'sisters',
          active_count: 200,
          median_list_price: 740000,
          months_of_supply: 5.1,
          updated_at: '2026-09-11T00:00:00Z',
        } as never,
      ],
    )
    expect(ledger.rows).toHaveLength(2)
    expect(String(ledger.rows[0]?.when)).toBe('800 active')
    expect(String(ledger.rows[1]?.when)).toBe('200 active')
    expect(ledger.rows[0]?.weight).toBe(1)
    expect(ledger.rows[1]?.weight).toBe(0.25)
    // Medians stay the printed value — nearly equal prices must not equal bar length.
    expect(String(ledger.rows[0]?.value)).toMatch(/\$750/)
    expect(String(ledger.rows[1]?.value)).toMatch(/\$740/)
  })
})

describe('SITE-71 MOS is two bars, never a KPI tile', () => {
  it('lead figures are the two bars plus list and wait, with no months-of-supply tile', () => {
    const figures = buildRegionFigures({ active: 1562, daysToPending: 29 }, 4.9, 750000)
    expect(figures.map((f) => String(f.label))).toEqual([
      'homes for sale, single-family',
      'a month of sales',
      'median list price',
      'days to an offer, last 90 days',
    ])
    expect(figures.some((f) => String(f.label) === 'months of supply')).toBe(false)
    expect(figures).toHaveLength(4)
    for (const figure of figures) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
      expect(String(figure.sentence), String(figure.label)).not.toMatch(/\d/)
    }
  })

  it('SITE-101 omits restated MOS tiles when the drawing publishes', () => {
    const figures = buildRegionFigures({ active: 1562, daysToPending: 29 }, 4.9, 750000, {
      omitMosTiles: true,
    })
    expect(figures.map((f) => String(f.label))).toEqual([
      'median list price',
      'days to an offer, last 90 days',
    ])
    expect(figures.some((f) => String(f.label) === 'homes for sale, single-family')).toBe(false)
    expect(figures.some((f) => String(f.label) === 'a month of sales')).toBe(false)
  })

  it('rearranges monthly pace from raw MOS and omits when either input is absent', () => {
    // Whole homes for display (SITE-101): 1562 / 4.9 → 319, not 318.8.
    expect(monthlyPaceFromMos(1562, 4.9)).toBe(319)
    expect(monthlyPaceFromMos(null, 4.9)).toBeNull()
    expect(monthlyPaceFromMos(1562, null)).toBeNull()
    expect(monthlyPaceFromMos(0, 4.9)).toBeNull()
    expect(monthlyPaceFromMos(1562, 0)).toBeNull()
  })

  it('draws MOS as two named range bars whose claim uses formatMonthsOfSupply', () => {
    const chart = buildAnnualMosChart(1562, 4.9)
    expect(chart?.kind).toBe('range')
    expect(chart?.rows?.map((row) => String(row.tick))).toEqual(['Homes for sale', 'A month of sales'])
    expect(String(chart?.rows?.[0]?.label)).toBe('1,562')
    expect(String(chart?.rows?.[1]?.label)).toBe('319')
    expect(String(chart?.claim)).toContain(formatMonthsOfSupply(4.9))
    expect(String(chart?.claim)).toContain('1,562')
    expect(buildAnnualMosChart(null, 4.9)).toBeUndefined()
    expect(buildAnnualMosChart(1562, null)).toBeUndefined()
    expect(buildAnnualMosChart(0, 4.9)).toBeUndefined()
  })

  it('drops the month-of-sales figure when MOS cannot publish, and never prints a zero tile', () => {
    const noMos = buildRegionFigures({ active: 1562, daysToPending: 29 }, null, 750000)
    expect(noMos.some((f) => String(f.label) === 'a month of sales')).toBe(false)
    expect(noMos.some((f) => String(f.label) === 'months of supply')).toBe(false)
    expect(noMos.some((f) => String(f.value) === '0')).toBe(false)
    const noActive = buildRegionFigures({ active: null, daysToPending: 29 }, 4.9, 750000)
    expect(noActive.some((f) => String(f.label) === 'homes for sale, single-family')).toBe(false)
    expect(noActive.some((f) => String(f.label) === 'a month of sales')).toBe(false)
  })
})
