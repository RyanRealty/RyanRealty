/**
 * getCoreChartSeries — THE one assembler behind the tabbed core-chart module
 * (components/market/MarketCoreCharts). Market-data embeds are one chart or
 * zero charts: this function returns every series that module can tab through
 * for a single geo, each with its §0 source + period trace.
 *
 * Sources (cache only — never raw `listings`, per CLAUDE.md §0):
 *   - median close price / active inventory / median DOM / closed volume →
 *     `getMarketTrend` (market_stats_cache, period_type='monthly', completed
 *     months only — the in-progress month is already excluded there).
 *   - months of supply → COMPUTED from the same monthly rows with the §0
 *     formula: end_of_period_inventory / (trailing 6-month sold_count / 6).
 *   - price-cut share → `getMarketHistoryWeekly` metric
 *     'price_reduction_share' (percent 0-100 of active listings with at least
 *     one price drop — verified against the compute_and_cache_market_pulse
 *     source: `100.0 * COUNT(price_drop_count > 0) / COUNT(*)`, migration
 *     20260415210000). Feature-detected: until the market_history_weekly
 *     migration is applied the read fails soft to [] and the series is
 *     simply omitted.
 *
 * Window: 24 months (24-month monthly series; up to 104 weeks of weekly
 * price-cut share). No caching layer of its own — both underlying reads are
 * already resilient-cached, and the assembly here is pure computation.
 */

import { z } from 'zod'
import { getMarketTrend, type MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import { getMarketHistoryWeekly, type MarketHistoryWeeklyPoint } from '@/lib/data/market/getMarketHistoryWeekly'
import type { GeoType } from '@/lib/data/types/shared'
import { formatDate } from '@/lib/format/date'

// 24-month display window; +6 leading months so the first plotted
// months-of-supply point still has a full trailing 6-month closed window.
const WINDOW_MONTHS = 24
const MOS_TRAILING_MONTHS = 6

const InputSchema = z.object({
  geoType: z.enum(['region', 'city', 'community', 'neighborhood', 'zip', 'subdivision']),
  geoSlug: z.string().min(1).max(200),
})

export type CoreChartMetric =
  | 'medianClosePrice'
  | 'activeInventory'
  | 'medianDom'
  | 'monthsOfSupply'
  | 'priceCutShare'
  | 'closedVolume'

export type CoreChartPoint = {
  /** ISO date the period starts (month start for monthly, Monday for weekly). */
  periodStart: string
  value: number
}

export type CoreChartSeriesEntry = {
  metric: CoreChartMetric
  granularity: 'monthly' | 'weekly'
  /** Oldest → newest. */
  points: CoreChartPoint[]
  /** §0 verification trace: table.column + filter behind every point. */
  source: string
  /** Human-readable span, e.g. "Aug 2024 to Jul 2026 (24 months)". */
  period: string
}

export type CoreChartSeries = {
  geoType: GeoType
  geoSlug: string
  series: CoreChartSeriesEntry[]
}

// ---------------------------------------------------------------------------
// Pure assembly helpers (exported for colocated tests)
// ---------------------------------------------------------------------------

const monthLabel = (d: Date) => formatDate(d, { day: undefined, timeZone: 'UTC' })

/** "Aug 2024 to Jul 2026 (24 months)" — no dashes (brand punctuation floor). */
export function describeSpan(points: CoreChartPoint[], granularity: 'monthly' | 'weekly'): string {
  if (points.length === 0) return ''
  const first = new Date(points[0]!.periodStart)
  const last = new Date(points[points.length - 1]!.periodStart)
  const unit = granularity === 'monthly' ? 'months' : 'weeks'
  const firstLabel = monthLabel(first)
  const lastLabel = monthLabel(last)
  const span = firstLabel === lastLabel ? firstLabel : `${firstLabel} to ${lastLabel}`
  return `${span} (${points.length} ${unit})`
}

/** Pull one numeric field off the monthly trend as chart points, dropping nulls. */
export function trendField(
  trend: MarketTrendPoint[],
  key: 'medianSalePrice' | 'soldCount' | 'medianDom' | 'endOfPeriodInventory',
): CoreChartPoint[] {
  return trend
    .filter((p) => typeof p[key] === 'number' && Number.isFinite(p[key] as number))
    .map((p) => ({ periodStart: p.periodStart, value: p[key] as number }))
}

/**
 * Months of supply per month, computed with the §0 formula:
 *   active / (closed_last_6_months / 6)
 * where active = that month's end_of_period_inventory and the closed window is
 * that month plus the prior 5. A month is only emitted when the inventory value
 * AND all six closed-count months exist (never a partial-window fabrication).
 */
export function monthsOfSupplySeries(trend: MarketTrendPoint[]): CoreChartPoint[] {
  const out: CoreChartPoint[] = []
  for (let i = MOS_TRAILING_MONTHS - 1; i < trend.length; i++) {
    const inventory = trend[i]!.endOfPeriodInventory
    if (inventory == null || !Number.isFinite(inventory)) continue
    let closed6 = 0
    let complete = true
    for (let j = i - (MOS_TRAILING_MONTHS - 1); j <= i; j++) {
      const sold = trend[j]!.soldCount
      if (sold == null || !Number.isFinite(sold)) {
        complete = false
        break
      }
      closed6 += sold
    }
    if (!complete || closed6 <= 0) continue
    out.push({
      periodStart: trend[i]!.periodStart,
      value: inventory / (closed6 / MOS_TRAILING_MONTHS),
    })
  }
  return out
}

/** Weekly history points for one metric → chart points (already oldest → newest). */
export function weeklyMetricPoints(rows: MarketHistoryWeeklyPoint[], metric: string): CoreChartPoint[] {
  return rows
    .filter((r) => r.metric === metric && Number.isFinite(r.value))
    .map((r) => ({ periodStart: r.weekStart, value: r.value }))
}

/**
 * Pure assembly from already-fetched inputs. Series with zero points are
 * omitted entirely (the module renders one chart or zero charts, never an
 * empty one).
 */
export function assembleCoreChartSeries(
  geoType: GeoType,
  geoSlug: string,
  trend: MarketTrendPoint[],
  weekly: MarketHistoryWeeklyPoint[],
): CoreChartSeries {
  const geoTrace = `geo_type='${geoType}' geo_slug='${geoSlug}'`
  const cacheTrace = (column: string) =>
    `market_stats_cache.${column} · ${geoTrace} · period_type='monthly' · completed months only`

  const window = trend.slice(-WINDOW_MONTHS)
  const mosAll = monthsOfSupplySeries(trend)
  const mos = mosAll.slice(-WINDOW_MONTHS)

  const candidates: Array<Omit<CoreChartSeriesEntry, 'period'>> = [
    {
      metric: 'medianClosePrice',
      granularity: 'monthly',
      points: trendField(window, 'medianSalePrice'),
      source: cacheTrace('median_sale_price'),
    },
    {
      metric: 'activeInventory',
      granularity: 'monthly',
      points: trendField(window, 'endOfPeriodInventory'),
      source: cacheTrace('end_of_period_inventory'),
    },
    {
      metric: 'medianDom',
      granularity: 'monthly',
      points: trendField(window, 'medianDom'),
      source: cacheTrace('median_dom'),
    },
    {
      metric: 'monthsOfSupply',
      granularity: 'monthly',
      points: mos,
      source:
        `computed: end_of_period_inventory / (trailing 6-month sold_count / 6) · ` +
        `market_stats_cache monthly rows · ${geoTrace}`,
    },
    {
      metric: 'priceCutShare',
      granularity: 'weekly',
      points: weeklyMetricPoints(weekly, 'price_reduction_share'),
      source:
        `market_history_weekly.value · metric='price_reduction_share' · ${geoTrace} · ` +
        `percent of active listings with at least one price drop (frozen weekly from market_pulse_live)`,
    },
    {
      metric: 'closedVolume',
      granularity: 'monthly',
      points: trendField(window, 'soldCount'),
      source: cacheTrace('sold_count'),
    },
  ]

  return {
    geoType,
    geoSlug,
    series: candidates
      .filter((c) => c.points.length > 0)
      .map((c) => ({ ...c, period: describeSpan(c.points, c.granularity) })),
  }
}

// ---------------------------------------------------------------------------
// Public fetcher
// ---------------------------------------------------------------------------

/**
 * Assemble the core chart series for one geo. Never throws: each upstream read
 * is resilient-cached and falls back to [], so a transient blip (or the not-yet-
 * applied market_history_weekly migration) shrinks the series list instead of
 * failing the page.
 */
export async function getCoreChartSeries(input: {
  geoType: GeoType
  geoSlug: string
}): Promise<CoreChartSeries> {
  const { geoType, geoSlug } = InputSchema.parse(input)

  const [trend, weekly] = await Promise.all([
    // 24-month window + 6 leading months so month 1 of the window still gets a
    // complete trailing-6 months-of-supply computation.
    getMarketTrend(geoType, geoSlug, WINDOW_MONTHS + MOS_TRAILING_MONTHS).catch(
      () => [] as MarketTrendPoint[],
    ),
    // Feature-detected: fails soft to [] until the market_history_weekly
    // migration (20260722020100) is applied. 104 weeks ≈ the 24-month window.
    getMarketHistoryWeekly({
      geoType,
      geoSlug,
      metrics: ['price_reduction_share'],
      weeks: 104,
    }).catch(() => [] as MarketHistoryWeeklyPoint[]),
  ])

  return assembleCoreChartSeries(geoType, geoSlug, trend, weekly)
}
