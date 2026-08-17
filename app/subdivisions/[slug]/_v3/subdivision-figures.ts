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
import { formatPrice } from '@/lib/format/money'
import type { MarketPulse, MarketStats } from '@/lib/data'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { currentYearSalesRow, publishPlatYtdStats } from '@/lib/market/publish-plat-year-sales'

/**
 * The plat's own closed statistics. The guard is the KB section's own guard, a
 * median or a sold count, so a row carrying nothing but a days-on-market value
 * does not open a section that used to stay shut.
 */
export function platStatsFigures(
  stats: MarketStats | null,
  history: readonly SubdivisionSalesYear[] = [],
): V3InstrumentFigure[] {
  const published = publishPlatYtdStats({
    stats,
    currentYear: currentYearSalesRow(history),
  })
  if (!published) return []
  if (published.medianSalePrice == null && published.soldCount == null) return []
  const figures: V3InstrumentFigure[] = []
  if (published.medianSalePrice != null) {
    figures.push({
      value: v3Text(formatPrice(published.medianSalePrice)),
      label: v3Text('median sale price'),
    })
  }
  if (published.medianDaysOnMarket != null) {
    figures.push({
      value: v3Text(`${Math.round(published.medianDaysOnMarket)} days`),
      label: v3Text('median days on market'),
    })
  }
  if (published.soldCount != null) {
    figures.push({
      value: v3Text(published.soldCount.toLocaleString('en-US')),
      label: v3Text('homes sold'),
    })
  }
  if (published.yoyChangePct != null) {
    const pct = published.yoyChangePct
    const sign = pct > 0 ? '+' : pct < 0 ? '-' : ''
    figures.push({
      value: v3Text(`${sign}${Math.abs(pct).toFixed(1)}%`),
      label: v3Text('median price, year over year'),
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
      value: v3Text(formatPrice(pulse.medianListPrice)),
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
 * Yearly closed-count series for Instrument.chart (D9). Fewer than two years
 * is not a line. Caption is the trace for this series. The rolling-period
 * figures on the same Instrument keep their own source line.
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
    caption: v3Text(`Closed single-family sales by year, ${displayName}`),
    series: [{ name: v3Text('Homes sold'), points }],
  }
}
