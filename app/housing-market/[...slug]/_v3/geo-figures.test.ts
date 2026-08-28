import { describe, expect, it } from 'vitest'
import type { MarketDetail } from '@/lib/data'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { buildCityPeriodFigures, buildLiveFigures, buildPublicPaceFigures } from './geo-figures'

function hud(overrides: Partial<LeftoverHudKpis> = {}): LeftoverHudKpis {
  return {
    active: 47,
    pending: null,
    closed30: null,
    new30: null,
    medianList: 399900,
    saleToList: null,
    daysToPending: null,
    monthsSupply: 4.9,
    sold12mo: null,
    ...overrides,
  }
}

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
    yoyDomChange: null,
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
    pendingCount: 311,
    daysToContract: 28,
    ...overrides,
  }
}

const CURRENT_MONTH_KEY = '2026-08'

describe('buildLiveFigures — list median digits', () => {
  it('Madras: prints the exact leftover median the FAQ publishes, not a thousand-round', () => {
    const live = buildLiveFigures(hud({ medianList: 399900 }), '4.9', 'Madras')
    const list = live.figures.find((f) => String(f.label).includes('median list price'))
    expect(list?.value).toBe('$399,900')
    expect(String(list?.value)).not.toContain('$400,000')
  })

  it('prints leftover pending on the live instrument and leftover-membership trace', () => {
    const live = buildLiveFigures(hud({ pending: 316, closed30: 180, daysToPending: 19 }), '4.4', 'Bend')
    const labels = live.figures.map((f) => String(f.label))
    expect(labels).toContain('pending · now')
    expect(labels).toContain('closed in the last 30 days')
    expect(labels).toContain('median to pending · 90 days')
    expect(live.trace).toMatch(/single-family houses/)
    expect(live.trace).not.toMatch(/live MLS/)
  })
})

describe('buildCityPeriodFigures — leftover 12-month overlay', () => {
  const ytd = detail({
    periodType: 'ytd',
    periodStart: '2026-01-01',
    medianSalePrice: 725000,
    soldCount: 1007,
  })
  const monthly = detail({
    periodType: 'monthly',
    periodStart: '2026-08-01',
    medianSalePrice: 725000,
    soldCount: 80,
  })
  const rolling = detail()

  it('prints leftover median close, closed count, and YoY instead of the cache rolling row', () => {
    const { figures, trace } = buildCityPeriodFigures({
      ytd,
      monthly,
      rolling,
      leftover: leftover(),
      currentMonthKey: CURRENT_MONTH_KEY,
    })
    const labels = figures.map((f) => String(f.label))
    const values = figures.map((f) => String(f.value))
    expect(labels).toContain('median close · 12 months')
    expect(values).toContain('$760,000')
    expect(labels).toContain('closed sales · 12 months')
    expect(values).toContain('2,095')
    expect(labels).toContain('YoY median close · 12 months')
    expect(values).toContain('-1.9%')
    expect(labels).not.toContain('12-month median sale')
    expect(values).not.toContain('$719,000')
    expect(values).not.toContain('1,640')
    expect(values).not.toContain('-2.1%')
    expect(trace).toMatch(/Market Truth/)
    expect(trace).not.toMatch(/mt-v1/)
    expect(trace).not.toMatch(/the last 12 months from market_stats_cache/)
  })

  it('omits 12-month cache median, closed count, and YoY when leftover misses', () => {
    const { figures, trace } = buildCityPeriodFigures({
      ytd,
      monthly,
      rolling,
      leftover: EMPTY_PUBLIC_PACE,
      currentMonthKey: CURRENT_MONTH_KEY,
    })
    const labels = figures.map((f) => String(f.label))
    const values = figures.map((f) => String(f.value))
    expect(labels).not.toContain('12-month median sale')
    expect(labels).not.toContain('median close · 12 months')
    expect(labels).not.toContain('closed sales · 12 months')
    expect(labels).not.toContain('YoY median close · 12 months')
    expect(values).not.toContain('$719,000')
    expect(values).not.toContain('1,640')
    expect(values).not.toContain('0')
    expect(trace).toBeNull()
  })

  it('omits YTD and this-month cache figures, and does not print unadjusted MoM', () => {
    const { figures } = buildCityPeriodFigures({
      ytd,
      monthly,
      rolling,
      leftover: leftover(),
      currentMonthKey: CURRENT_MONTH_KEY,
    })
    const labels = figures.map((f) => String(f.label))
    expect(labels).not.toContain('YTD median sale')
    expect(labels).not.toContain('YTD homes sold')
    expect(labels).not.toContain('this month median sale')
    expect(figures.some((f) => /MoM|month over month/i.test(String(f.label)))).toBe(false)
    expect(figures.some((f) => String(f.label) === 'median sale price')).toBe(false)
  })
})

describe('buildPublicPaceFigures — 12-month close trio belongs on period figures', () => {
  it('keeps days to contract, and does not reprint leftover close/count/YoY or HUD pending', () => {
    const figures = buildPublicPaceFigures(leftover())
    const labels = figures.map((f) => String(f.label))
    expect(labels).not.toContain('pending · now')
    expect(labels).toContain('days to contract · 12 months')
    expect(labels).not.toContain('median close · 12 months')
    expect(labels).not.toContain('closed sales · 12 months')
    expect(labels).not.toContain('YoY median close · 12 months')
  })
})

