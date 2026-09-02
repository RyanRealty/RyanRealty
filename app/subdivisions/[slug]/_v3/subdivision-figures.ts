/**
 * The market band's figures, and the rule that keeps them to ONE population.
 *
 * CLAUDE.md §0: one trace per query, one stamp per trace, never borrowed across
 * populations. THE PLAT IS THE ONLY POPULATION THIS FILE MAY READ.
 *
 * A plat page can physically reach three market rows: its own
 * market_stats_cache row (geo_type='subdivision', ytd), its parent resort
 * community's market_pulse_live row, and its parent city's. Only the first is
 * this plat. The other two were a defect, not a fallback: on 2026-08-16
 * `fix: withhold parent pulse on registry plat pages` (3f34bf65) removed them
 * after /subdivisions/ridge-at-eagle-crest printed the plat's own $910,000
 * median beside Redmond's 19.5 pending days under one heading. The band now
 * reads the plat's counted set (lib/market/publish-plat-figures.ts), the Market
 * Truth recorded-plat counts, and the row below — and `parentPulseFigures` is
 * gone. ci:publish-plat-figures and ci:subdivision-stats-integrity both hold
 * that line; the second one now FAILS on a closedLast30Days figure appearing
 * here, which is the only way the parent row could come back.
 *
 * A FIGURE THAT CANNOT BE TOLD FROM AN ABSENT ONE DOES NOT SHIP. That rule
 * still governs everything below: a plat-grain closed price goes through
 * publishSubdivisionClosedPrice, which withholds (REGISTRY §4), and the cache
 * soldCount stays off this band because it is YTD MLS-name closings rather than
 * recorded-plat 12-month membership.
 *
 * Nothing here rounds except through lib/format, and nothing here fetches.
 */

import { v3Text, type V3InstrumentFigure, type V3ChartProps, type V3ChartPoint } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { countTicks, yearTicks, yoyClaim } from '@/lib/charts/ticks'
import type { MarketStats } from '@/lib/data'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { publishSubdivisionClosedPrice } from '@/lib/market/publish-subdivision-closed-price'

/**
 * The plat's own closed statistics from market_stats_cache (MLS name join).
 * Closed-sale prices go through publishSubdivisionClosedPrice and stay null
 * (REGISTRY §4). Cache soldCount stays off this band: it is YTD MLS-name
 * closings, not recorded-plat 12-month membership closed_count. Days on
 * market may still open the band.
 */
export function platStatsFigures(stats: MarketStats | null): V3InstrumentFigure[] {
  if (!stats) return []
  const figures: V3InstrumentFigure[] = []
  const publishedMedian = publishSubdivisionClosedPrice(stats.medianSalePrice)
  if (publishedMedian != null) {
    figures.push({
      value: v3Text(formatPrice(publishedMedian)),
      label: v3Text('closed median'),
    })
  }
  if (stats.medianDaysOnMarket != null) {
    figures.push({
      value: v3Text(`${Math.round(stats.medianDaysOnMarket)} days`),
      label: v3Text('median days on market'),
    })
  }
  const publishedYoy = publishSubdivisionClosedPrice(stats.yoyChangePct)
  if (publishedYoy != null) {
    const sign = publishedYoy > 0 ? '+' : publishedYoy < 0 ? '-' : ''
    figures.push({
      value: v3Text(`${sign}${Math.abs(publishedYoy).toFixed(1)}%`),
      label: v3Text('closed median, year over year'),
    })
  }
  return figures
}

/**
 * Yearly closed-count series for Instrument.chart (D9). MLS plat-name join,
 * not recorded-plat membership. Fewer than two years is not a line.
 */
export function subdivisionSalesChart(
  displayName: string,
  history: readonly SubdivisionSalesYear[],
): V3ChartProps | undefined {
  const points: V3ChartPoint[] = [...history]
    .filter((row) => row.closedCount > 0)
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      value: row.closedCount,
      tick: v3Text(String(row.year)),
      label: v3Text(row.closedCount.toLocaleString('en-US')),
      at: row.year,
    }))
  if (points.length < 2) return undefined
  const series = [{ name: v3Text('Closed counts'), points }]
  // The claim is the plat's latest closed year against the year before it,
  // both off this same series. A plat with a gap in its history carries no
  // comparison rather than reaching to the nearest year it does have.
  const claim = yoyClaim({ metric: 'Closed sales', unit: 'count', series })
  const yTicks = countTicks(series)
  const xTicks = yearTicks(series)
  return {
    caption: v3Text(`Closed single-family sales by MLS plat name, ${displayName}`),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series,
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}
