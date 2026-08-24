/**
 * MarketCoreCharts logic tests — tab omission, per-tab series binding, the §0
 * months-of-supply computation + computed verdict, formatting rules, and a
 * static-markup smoke render of the client component with fixture data.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  assembleCoreChartSeries,
  overlayLeftoverCoreCloseSeries,
  describeSpan,
  monthsOfSupplySeries,
  trendField,
  weeklyMetricPoints,
  type CoreChartSeries,
} from '@/lib/data/market/getCoreChartSeries'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import type { MarketHistoryWeeklyPoint } from '@/lib/data/market/getMarketHistoryWeekly'
import {
  MIN_POINTS_PER_TAB,
  buildCoreChartTabs,
  formatCoreChartAxis,
  formatCoreChartValue,
} from './core-charts'
import { MarketCoreCharts } from './MarketCoreCharts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Monthly trend point with sane defaults, overridable per test. */
function month(iso: string, over: Partial<MarketTrendPoint> = {}): MarketTrendPoint {
  return {
    periodStart: iso,
    medianSalePrice: 750_000,
    soldCount: 60,
    medianDom: 38,
    endOfPeriodInventory: 240,
    ...over,
  }
}

/** N consecutive months starting Jan 2025. */
function months(n: number, over: (i: number) => Partial<MarketTrendPoint> = () => ({})): MarketTrendPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const m = (i % 12) + 1
    const y = 2025 + Math.floor(i / 12)
    return month(`${y}-${String(m).padStart(2, '0')}-01`, over(i))
  })
}

function weekly(weekStart: string, value: number, metric = 'price_reduction_share'): MarketHistoryWeeklyPoint {
  return { weekStart, metric, value, source: 'market_pulse_live', capturedAt: '2026-07-20T08:00:00Z' }
}

// ---------------------------------------------------------------------------
// months of supply — the §0 formula, computed not copied
// ---------------------------------------------------------------------------

describe('monthsOfSupplySeries', () => {
  it('computes active / (closed_6mo / 6) per month once six closed months exist', () => {
    const trend = months(8, () => ({ soldCount: 60, endOfPeriodInventory: 240 }))
    const mos = monthsOfSupplySeries(trend)
    // First emittable month is index 5 (six months of closed data) → 8 - 5 = 3 points.
    expect(mos).toHaveLength(3)
    // 240 / ((60 * 6) / 6) = 240 / 60 = 4.0
    expect(mos[0]!.value).toBeCloseTo(4.0, 10)
    expect(mos[0]!.periodStart).toBe('2025-06-01')
  })

  it('skips months whose trailing 6-month closed window is incomplete', () => {
    const trend = months(8, (i) => (i === 3 ? { soldCount: null } : {}))
    const mos = monthsOfSupplySeries(trend)
    // Windows containing index 3 (months 5..8 = indexes 5,6,7 need 0..7) — index 5
    // window is 0-5 (contains 3), index 6 is 1-6 (contains 3), index 7 is 2-7
    // (contains 3): all skipped.
    expect(mos).toHaveLength(0)
  })

  it('skips months with null inventory and windows with zero closed sales', () => {
    const noInventory = months(6, () => ({ endOfPeriodInventory: null }))
    expect(monthsOfSupplySeries(noInventory)).toHaveLength(0)
    const noSales = months(6, () => ({ soldCount: 0 }))
    expect(monthsOfSupplySeries(noSales)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// assembly — feature detection + §0 trace
// ---------------------------------------------------------------------------

describe('assembleCoreChartSeries', () => {
  it('omits the price-cut series when market_history_weekly has no rows (feature detect)', () => {
    const out = assembleCoreChartSeries('city', 'bend', months(30), [])
    expect(out.series.map((s) => s.metric)).not.toContain('priceCutShare')
    // The other five all present with dense fixture data.
    expect(out.series.map((s) => s.metric)).toEqual([
      'medianClosePrice',
      'activeInventory',
      'medianDom',
      'monthsOfSupply',
      'priceCutShare',
      'closedVolume',
    ].filter((m) => m !== 'priceCutShare'))
  })

  it('includes the price-cut series when weekly rows exist, ignoring other metrics', () => {
    const rows = [weekly('2026-07-06', 31.2), weekly('2026-07-13', 29.8), weekly('2026-07-13', 4.4, 'months_of_supply')]
    const out = assembleCoreChartSeries('city', 'bend', months(30), rows)
    const cut = out.series.find((s) => s.metric === 'priceCutShare')
    expect(cut).toBeDefined()
    expect(cut!.points.map((p) => p.value)).toEqual([31.2, 29.8])
    expect(cut!.granularity).toBe('weekly')
  })

  it('caps every monthly series at the 24-month window', () => {
    const out = assembleCoreChartSeries('city', 'bend', months(30), [])
    for (const s of out.series.filter((x) => x.granularity === 'monthly')) {
      expect(s.points.length).toBeLessThanOrEqual(24)
    }
    const price = out.series.find((s) => s.metric === 'medianClosePrice')!
    expect(price.points).toHaveLength(24)
    // Window is the LAST 24 of 30 → starts Jul 2025.
    expect(price.points[0]!.periodStart).toBe('2025-07-01')
  })

  it('carries a §0 source trace and period on every series', () => {
    const out = assembleCoreChartSeries('city', 'bend', months(30), [weekly('2026-07-06', 31.2), weekly('2026-07-13', 29.8)])
    for (const s of out.series) {
      expect(s.source.length).toBeGreaterThan(10)
      expect(s.source).toMatch(/market_stats_cache|market_history_weekly/)
      expect(s.source).toContain("geo_slug='bend'")
      expect(s.period).toMatch(/\(\d+ (months|weeks)\)/)
    }
    const mos = out.series.find((s) => s.metric === 'monthsOfSupply')!
    expect(mos.source).toContain('end_of_period_inventory / (trailing 6-month sold_count / 6)')
  })

  it('drops series entirely when the trend lacks that column', () => {
    const out = assembleCoreChartSeries('neighborhood', 'tetherow', months(10, () => ({ medianDom: null, endOfPeriodInventory: null })), [])
    const metrics = out.series.map((s) => s.metric)
    expect(metrics).not.toContain('medianDom')
    expect(metrics).not.toContain('activeInventory')
    expect(metrics).not.toContain('monthsOfSupply')
    expect(metrics).toContain('medianClosePrice')
    expect(metrics).toContain('closedVolume')
  })
})

describe('overlayLeftoverCoreCloseSeries', () => {
  const leftover = [1, 2, 3, 4, 5, 6, 7].map((month) => ({
    periodStart: `2026-0${month}-01`,
    periodEnd: `2026-0${month}-28`,
    medianClose: 700000 + month,
    closedCount: 10 + month,
  }))

  it('overlays leftover median and closed count and leaves DOM/MOS on cache', () => {
    const assembled = assembleCoreChartSeries('city', 'bend', months(30), [])
    const out = overlayLeftoverCoreCloseSeries(assembled, leftover)
    const median = out.series.find((s) => s.metric === 'medianClosePrice')
    const closed = out.series.find((s) => s.metric === 'closedVolume')
    const dom = out.series.find((s) => s.metric === 'medianDom')
    const mos = out.series.find((s) => s.metric === 'monthsOfSupply')
    expect(median?.leftover).toBe(true)
    expect(median?.points[0]?.value).toBe(700001)
    expect(closed?.leftover).toBe(true)
    expect(closed?.points[0]?.value).toBe(11)
    expect(dom?.leftover).toBeUndefined()
    expect(mos?.leftover).toBeUndefined()
    expect(mos?.source).toContain('end_of_period_inventory / (trailing 6-month sold_count / 6)')
  })

  it('does not mix leftover into cache when leftover cannot plot', () => {
    const assembled = assembleCoreChartSeries('city', 'bend', months(30), [])
    const cacheMedian = assembled.series.find((s) => s.metric === 'medianClosePrice')?.points[0]?.value
    const out = overlayLeftoverCoreCloseSeries(assembled, leftover.slice(0, 2))
    expect(out.series.find((s) => s.metric === 'medianClosePrice')?.leftover).toBeUndefined()
    expect(out.series.find((s) => s.metric === 'medianClosePrice')?.points[0]?.value).toBe(cacheMedian)
  })
})

describe('series helpers', () => {
  it('trendField drops null values and binds the right column', () => {
    const trend = months(3, (i) => (i === 1 ? { medianSalePrice: null } : { medianSalePrice: 700_000 + i }))
    const pts = trendField(trend, 'medianSalePrice')
    expect(pts).toHaveLength(2)
    expect(pts.map((p) => p.value)).toEqual([700_000, 700_002])
  })

  it('weeklyMetricPoints filters by metric name', () => {
    const rows = [weekly('2026-07-06', 30), weekly('2026-07-06', 4.2, 'months_of_supply')]
    expect(weeklyMetricPoints(rows, 'price_reduction_share')).toHaveLength(1)
  })

  it('describeSpan names both endpoints without dashes', () => {
    const label = describeSpan(
      [
        { periodStart: '2024-08-01', value: 1 },
        { periodStart: '2026-07-01', value: 2 },
      ],
      'monthly',
    )
    expect(label).toBe('Aug 2024 to Jul 2026 (2 months)')
    expect(label).not.toMatch(/[—–-]/)
  })
})

// ---------------------------------------------------------------------------
// tab building — omission + binding + computed verdict
// ---------------------------------------------------------------------------

function seriesFixture(over: Partial<Record<string, number[]>> = {}): CoreChartSeries {
  const mk = (metric: string, values: number[], granularity: 'monthly' | 'weekly' = 'monthly') => ({
    metric: metric as CoreChartSeries['series'][number]['metric'],
    granularity,
    points: values.map((v, i) => ({ periodStart: `2026-${String(i + 1).padStart(2, '0')}-01`, value: v })),
    source: `market_stats_cache.test · geo_type='city' geo_slug='bend'`,
    period: 'Jan 2026 to Jun 2026 (6 months)',
  })
  return {
    geoType: 'city',
    geoSlug: 'bend',
    series: Object.entries({
      medianClosePrice: [740_000, 748_000, 752_000],
      activeInventory: [220, 231, 245],
      medianDom: [34, 36, 38],
      monthsOfSupply: [3.6, 4.1, 4.4],
      priceCutShare: [28.4, 30.1, 31.2],
      closedVolume: [58, 61, 49],
      ...over,
    })
      .filter(([, values]) => values.length > 0)
      .map(([metric, values]) => mk(metric, values)),
  }
}

describe('buildCoreChartTabs', () => {
  it('builds one tab per populated series, in canonical order', () => {
    const tabs = buildCoreChartTabs(seriesFixture())
    expect(tabs.map((t) => t.metric)).toEqual([
      'medianClosePrice',
      'activeInventory',
      'medianDom',
      'monthsOfSupply',
      'priceCutShare',
      'closedVolume',
    ])
  })

  it('omits a tab when its series is missing or below the point floor', () => {
    const tabs = buildCoreChartTabs(
      seriesFixture({ priceCutShare: [], medianDom: [38] /* 1 point < MIN_POINTS_PER_TAB */ }),
    )
    const metrics = tabs.map((t) => t.metric)
    expect(MIN_POINTS_PER_TAB).toBe(2)
    expect(metrics).not.toContain('priceCutShare')
    expect(metrics).not.toContain('medianDom')
    expect(metrics).toContain('medianClosePrice')
  })

  it('returns [] for null/empty data (module renders nothing, never an empty chart)', () => {
    expect(buildCoreChartTabs(null)).toEqual([])
    expect(buildCoreChartTabs(undefined)).toEqual([])
    expect(buildCoreChartTabs({ geoType: 'city', geoSlug: 'bend', series: [] })).toEqual([])
  })

  it('binds each tab to ITS series values (no cross-tab bleed)', () => {
    const tabs = buildCoreChartTabs(seriesFixture())
    const by = Object.fromEntries(tabs.map((t) => [t.metric, t]))
    expect(by.medianClosePrice!.rows.map((r) => r.value)).toEqual([740_000, 748_000, 752_000])
    expect(by.closedVolume!.rows.map((r) => r.value)).toEqual([58, 61, 49])
    expect(by.monthsOfSupply!.rows.map((r) => r.value)).toEqual([3.6, 4.1, 4.4])
    expect(by.closedVolume!.kind).toBe('bar')
    expect(by.medianClosePrice!.kind).toBe('line')
  })

  it('computes the months-of-supply verdict FROM the latest value (§0 thresholds)', () => {
    const seller = buildCoreChartTabs(seriesFixture({ monthsOfSupply: [3.0, 3.4] }))
    expect(seller.find((t) => t.metric === 'monthsOfSupply')!.verdictLabel).toBe("Seller's market")
    const balanced = buildCoreChartTabs(seriesFixture({ monthsOfSupply: [3.9, 4.6] }))
    expect(balanced.find((t) => t.metric === 'monthsOfSupply')!.verdictLabel).toBe('Balanced market')
    const buyer = buildCoreChartTabs(seriesFixture({ monthsOfSupply: [5.8, 6.4] }))
    expect(buyer.find((t) => t.metric === 'monthsOfSupply')!.verdictLabel).toBe("Buyer's market")
    // Non-MoS tabs never carry a verdict.
    expect(seller.find((t) => t.metric === 'medianClosePrice')!.verdictLabel).toBeNull()
  })

  it('formats latest values by brand number rules', () => {
    const by = Object.fromEntries(buildCoreChartTabs(seriesFixture()).map((t) => [t.metric, t]))
    expect(by.medianClosePrice!.latestValue).toBe('$752,000')
    expect(by.medianDom!.latestValue).toBe('38 days')
    expect(by.priceCutShare!.latestValue).toBe('31.2%')
    expect(by.monthsOfSupply!.latestValue).toBe('4.4 mo')
    expect(by.closedVolume!.latestValue).toBe('49 sold')
  })
})

describe('formatters', () => {
  it('rounds currency to the nearest thousand (never narrative-shifting rounding)', () => {
    expect(formatCoreChartValue('medianClosePrice', 474_500)).toBe('$475,000')
    expect(formatCoreChartValue('medianClosePrice', 474_400)).toBe('$474,000')
  })
  it('axis: compact currency and integer counts', () => {
    expect(formatCoreChartAxis('medianClosePrice', 740_000)).toBe('$740K')
    expect(formatCoreChartAxis('medianClosePrice', 1_250_000)).toBe('$1.3M')
    expect(formatCoreChartAxis('closedVolume', 61.2)).toBe('61')
  })
  it('months-of-supply display never crosses a verdict threshold when rounding', () => {
    expect(formatCoreChartValue('monthsOfSupply', 4.04)).toBe('4.1 mo')
    expect(formatCoreChartValue('monthsOfSupply', 5.96)).toBe('5.9 mo')
  })
})

// ---------------------------------------------------------------------------
// static render smoke — per-tab binding reaches the markup
// ---------------------------------------------------------------------------

describe('MarketCoreCharts static render', () => {
  it('renders every tab trigger and the active tab readout', () => {
    const html = renderToStaticMarkup(
      createElement(MarketCoreCharts, { data: seriesFixture(), heading: 'Bend market trends' }),
    )
    expect(html).toContain('Bend market trends')
    for (const label of ['Median price', 'Inventory', 'Days on market', 'Months of supply', 'Price cuts', 'Closed sales']) {
      expect(html).toContain(label)
    }
    // Default tab = first tab (median price): its latest readout is in the markup.
    expect(html).toContain('$752,000')
  })

  it('renders nothing at all when no series is chartable', () => {
    const html = renderToStaticMarkup(
      createElement(MarketCoreCharts, { data: { geoType: 'city', geoSlug: 'bend', series: [] } }),
    )
    expect(html).toBe('')
  })

  it('names the fallback scope when scopeLabel is set (§0 honesty)', () => {
    const html = renderToStaticMarkup(
      createElement(MarketCoreCharts, { data: seriesFixture(), scopeLabel: 'Bend (city)' }),
    )
    expect(html).toContain('Charted at Bend (city) scope')
  })
})
