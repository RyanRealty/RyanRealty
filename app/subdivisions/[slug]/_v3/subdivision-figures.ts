/**
 * The market band's figures, and the rule that keeps them to ONE population.
 *
 * CLAUDE.md section 0: one trace per query, one stamp per trace, never borrowed
 * across populations. The plat node can reach three market rows, and only one of
 * them may fill a single Instrument.
 *
 *   - The plat's own market_stats_cache row (geo_type='subdivision', ytd). Best
 *     when it exists, because it is the only plat-level answer on the page.
 *   - The parent resort community's market_pulse_live row.
 *   - The parent city's market_pulse_live row.
 *
 * The KB page took the median from whichever of the last two carried one and the
 * days-to-pending from whichever carried that, so a community median could print
 * beside a city days-to-pending under one heading. `parentPulseFigures` takes a
 * SINGLE row, chosen by the caller as community-or-city, and every figure it
 * returns comes from that row and is stamped with that row's refresh time.
 *
 * A FIGURE THAT CANNOT BE TOLD FROM AN ABSENT ONE DOES NOT SHIP. The pulse mapper
 * at lib/data/market/getMarketPulse.ts reads `sold_count_30d` as
 * `(row.sold_count_30d as number) ?? 0`, so a NULL column and a genuine zero both
 * arrive here as the number 0 and this file cannot tell them apart. The page's own
 * doctrine is ABSENT IS NOT ZERO, and it already applies that to the plat active
 * count; publishing a 0 here under a trace that calls it "closings from the last
 * thirty days" is the same defect with a different column. So the closings figure
 * is guarded like the two above it, and the trace names only the figures that
 * survived the guard. The cost is a true zero suppressed on a genuinely quiet
 * month; the alternative is a fabricated zero on a licensed broker's public page,
 * and CLAUDE.md section 0 settles that trade: fewer numbers rather than one wrong
 * one. The real repair is a nullable `closedLast30Days` in the DAL, which this
 * route does not own — recorded as open in docs/plans/PUBLIC_PRODUCT/decisions.md.
 *
 * Nothing here rounds except through lib/format, and nothing here fetches.
 */

import { v3Text, type V3InstrumentFigure, type V3ChartProps, type V3ChartPoint } from '@/components/site/v3'
import { formatPrice, formatPriceExact } from '@/lib/format/money'
import type { MarketPulse, MarketStats } from '@/lib/data'
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
 * Which of the parent row's figures reached the page. The trace is built from
 * this, so no sentence covers a figure the guard above dropped.
 */
export type ParentPulseCoverage = {
  listPrice: boolean
  daysToPending: boolean
  closed: boolean
}

export type ParentPulseBand = {
  figures: V3InstrumentFigure[]
  covers: ParentPulseCoverage
}

/**
 * The parent market. ONE pulse row in, so the figures below cannot come from two
 * places. `href` is the node that row describes, which is what makes each figure
 * a door instead of dead text.
 */
export function parentPulseFigures(
  pulse: MarketPulse | null,
  href: string | undefined,
): ParentPulseBand {
  const covers: ParentPulseCoverage = { listPrice: false, daysToPending: false, closed: false }
  if (!pulse) return { figures: [], covers }
  const figures: V3InstrumentFigure[] = []
  if (pulse.medianListPrice != null) {
    figures.push({
      value: v3Text(formatPriceExact(pulse.medianListPrice)),
      label: v3Text('median list price'),
      href,
    })
    covers.listPrice = true
  }
  if (pulse.medianDaysToPending != null) {
    figures.push({
      value: v3Text(`${pulse.medianDaysToPending} days`),
      label: v3Text('median days to pending'),
      href,
    })
    covers.daysToPending = true
  }
  // The guard the header paragraph explains: 0 here is either no closings or no
  // computed column, and this file cannot tell which, so it prints neither.
  if (pulse.closedLast30Days > 0) {
    figures.push({
      value: v3Text(pulse.closedLast30Days.toLocaleString('en-US')),
      label: v3Text('closed in the last 30 days'),
      href,
    })
    covers.closed = true
  }
  return { figures, covers }
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
  return {
    caption: v3Text(`Closed single-family sales by MLS plat name, ${displayName}`),
    series: [{ name: v3Text('Closed counts'), points }],
  }
}
