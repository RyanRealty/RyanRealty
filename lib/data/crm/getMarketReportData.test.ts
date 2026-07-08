import { describe, it, expect } from 'vitest'
import {
  computeMonthsOfSupply,
  classifyMarketVerdict,
  resolveAreaGeoType,
  buildAreaBlock,
  buildTrendSummary,
  monthLabel,
} from './getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'

describe('buildTrendSummary', () => {
  const pt = (
    periodStart: string,
    overrides: Partial<MarketTrendPoint> = {},
  ): MarketTrendPoint => ({
    periodStart,
    medianSalePrice: null,
    soldCount: null,
    medianDom: null,
    endOfPeriodInventory: null,
    ...overrides,
  })

  it('summarizes the two most recent completed months into MoM context', () => {
    const s = buildTrendSummary([
      pt('2026-04-01', { medianSalePrice: 718000, medianDom: 27, endOfPeriodInventory: 441 }),
      pt('2026-05-01', { medianSalePrice: 732000, medianDom: 24, endOfPeriodInventory: 468 }),
      pt('2026-06-01', { medianSalePrice: 748000, medianDom: 22, endOfPeriodInventory: 480 }),
    ])
    expect(s).not.toBeNull()
    expect(s!.latestMonthLabel).toBe('June')
    expect(s!.prevMonthLabel).toBe('May')
    expect(s!.latestMedianPrice).toBe(748000)
    expect(s!.prevMedianPrice).toBe(732000)
    // (748000 - 732000) / 732000 = 2.185...% -> 2.2 one decimal
    expect(s!.momPricePct).toBe(2.2)
    expect(s!.momInventoryDelta).toBe(12)
    expect(s!.momDomDelta).toBe(-2)
  })

  it('returns null with fewer than 2 points (no honest comparison possible)', () => {
    expect(buildTrendSummary([])).toBeNull()
    expect(buildTrendSummary([pt('2026-06-01', { medianSalePrice: 748000 })])).toBeNull()
  })

  it('leaves a delta null when either month lacks the figure (never fabricates)', () => {
    const s = buildTrendSummary([
      pt('2026-05-01', { medianSalePrice: 732000 }),
      pt('2026-06-01', { medianSalePrice: 748000, endOfPeriodInventory: 480 }),
    ])
    expect(s!.momPricePct).toBe(2.2)
    expect(s!.momInventoryDelta).toBeNull()
    expect(s!.momDomDelta).toBeNull()
  })
})

describe('monthLabel', () => {
  it('renders the UTC month name and null on garbage', () => {
    expect(monthLabel('2026-06-01')).toBe('June')
    expect(monthLabel('2026-12-01')).toBe('December')
    expect(monthLabel('not-a-date')).toBeNull()
    expect(monthLabel(null)).toBeNull()
  })
})

describe('computeMonthsOfSupply', () => {
  it('computes active / (sold12mo / 12) and rounds to one decimal', () => {
    // 60 active, 120 sold/yr -> 10/mo -> 6.0 months
    expect(computeMonthsOfSupply(60, 120)).toBe(6)
    // 491 active, 1657 sold/yr (Bend rolling_365d) -> 1657/12 = 138.08/mo -> 3.6
    expect(computeMonthsOfSupply(491, 1657)).toBe(3.6)
    // 28 active, 31 sold/yr (Tetherow) -> 31/12 = 2.583/mo -> 10.8
    expect(computeMonthsOfSupply(28, 31)).toBe(10.8)
  })

  it('returns null when inputs are missing or non-finite', () => {
    expect(computeMonthsOfSupply(null, 100)).toBeNull()
    expect(computeMonthsOfSupply(60, null)).toBeNull()
    expect(computeMonthsOfSupply(undefined, undefined)).toBeNull()
    expect(computeMonthsOfSupply(Number.NaN, 100)).toBeNull()
    expect(computeMonthsOfSupply(60, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('returns null on a zero close rate (never divides by zero, never fabricates)', () => {
    expect(computeMonthsOfSupply(60, 0)).toBeNull()
    expect(computeMonthsOfSupply(60, -5)).toBeNull()
  })
})

describe('resolveAreaGeoType', () => {
  it('Central Oregon cities resolve to city', () => {
    for (const c of ['bend', 'redmond', 'sisters', 'sunriver', 'tumalo', 'la-pine', 'terrebonne']) {
      expect(resolveAreaGeoType(c)).toBe('city')
    }
  })

  it('resort communities resolve to neighborhood (the cache convention)', () => {
    for (const n of ['tetherow', 'broken-top', 'eagle-crest', 'pronghorn', 'caldera-springs']) {
      expect(resolveAreaGeoType(n)).toBe('neighborhood')
    }
  })
})

const FULL_DETAIL = {
  medianSalePrice: 721000,
  soldCount: 1657,
  medianDom: 25,
  yoyMedianPriceDeltaPct: -1.22,
  marketHealthLabel: 'Warm',
  endOfPeriodInventory: 491,
  updatedAt: '2026-06-25T00:00:00Z',
}

describe('buildAreaBlock', () => {
  it('builds a city block, live pulse winning for active + MoS', () => {
    const block = buildAreaBlock({
      slug: 'bend',
      geoType: 'city',
      detail: FULL_DETAIL,
      pulse: { activeCount: 480, monthsOfSupply: 3.5, refreshedAt: '2026-06-25T12:00:00Z' },
    })
    expect(block).not.toBeNull()
    expect(block!.activeListings).toBe(480) // live pulse, not historical 491
    expect(block!.monthsOfSupply).toBe(3.5) // cache-computed live MoS
    expect(block!.marketVerdict).toBe('sellers') // derived from 3.5
    expect(block!.source).toBe('market_pulse_live')
    expect(block!.areaLabel).toBe('Bend')
    expect(block!.href).toBe('/cities/bend')
  })

  it('builds a community block, computing MoS from rolling_365d (no pulse row)', () => {
    const block = buildAreaBlock({
      slug: 'tetherow',
      geoType: 'neighborhood',
      detail: {
        medianSalePrice: 1700000,
        soldCount: 31,
        medianDom: 26,
        yoyMedianPriceDeltaPct: -28.04,
        marketHealthLabel: 'Cool',
        endOfPeriodInventory: 28,
        updatedAt: '2026-06-25T00:00:00Z',
      },
      pulse: null,
    })
    expect(block).not.toBeNull()
    expect(block!.activeListings).toBe(28)
    expect(block!.monthsOfSupply).toBe(10.8) // 28 / (31/12)
    expect(block!.marketVerdict).toBe('buyers') // derived from 10.8
    expect(block!.source).toBe('market_stats_cache:rolling_365d')
    expect(block!.href).toBe('/communities/tetherow')
  })

  it('omits an area with no usable cache data (returns null, never fabricates)', () => {
    expect(buildAreaBlock({ slug: 'aspen-lakes', geoType: 'neighborhood', detail: null, pulse: null })).toBeNull()
    // all-null detail (e.g. tumalo rolling_365d) -> no signal -> omit
    expect(
      buildAreaBlock({
        slug: 'tumalo',
        geoType: 'city',
        detail: {
          medianSalePrice: null,
          soldCount: 0,
          medianDom: null,
          yoyMedianPriceDeltaPct: null,
          marketHealthLabel: null,
          endOfPeriodInventory: 0,
          updatedAt: '2026-06-25T00:00:00Z',
        },
        pulse: null,
      }),
    ).toBeNull()
  })

  it('the verdict in a built block always matches the canonical classifier output for its monthsOfSupply', () => {
    const block = buildAreaBlock({ slug: 'bend', geoType: 'city', detail: FULL_DETAIL, pulse: null })
    expect(block).not.toBeNull()
    // Thresholds are the canonical classifier's responsibility (lib/market/classify.ts);
    // we only verify the block's verdict equals classifyMarketVerdict(block.monthsOfSupply).
    expect(block!.marketVerdict).toBe(classifyMarketVerdict(block!.monthsOfSupply))
  })
})
