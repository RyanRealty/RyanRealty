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
  // The current year is a partial year: its bar is labelled "to date" and the
  // claim states it alone. Comparing eight months to twelve is not a year over
  // year (CLAUDE.md section 0: the same window across two years; evaluator
  // pass six, S3).
  const thisYear = new Date().getFullYear()
  const points: V3ChartPoint[] = [...history]
    .filter((row) => row.closedCount > 0)
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      value: row.closedCount,
      tick: v3Text(String(row.year)),
      label: v3Text(row.year === thisYear ? `${row.closedCount.toLocaleString('en-US')} to date` : row.closedCount.toLocaleString('en-US')),
      at: row.year,
    }))
  if (points.length < 2) return undefined
  const series = [{ name: v3Text('Closed counts'), points }]
  const last = points[points.length - 1]!
  // The claim is the plat's latest closed year against the year before it,
  // both off this same series. A plat with a gap in its history carries no
  // comparison rather than reaching to the nearest year it does have; a
  // partial current year carries none either.
  const claim =
    last.at === thisYear
      ? yoyClaim({
          metric: 'Closed sales',
          unit: 'count',
          series: [{ name: series[0]!.name, points: [last] }],
          value: last.value.toLocaleString('en-US'),
          latestLabel: `${thisYear} so far`,
        })
      : yoyClaim({ metric: 'Closed sales', unit: 'count', series })
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

/**
 * THE PLAT'S OWN SERIES, ATTRIBUTED BY BOUNDARY (SITE-24).
 *
 * Same drawing as subdivisionSalesChart above, different join, and it exists
 * because that one is empty for a whole class of plats: it matches the MLS
 * SubdivisionName, and every home inside Golf Homes At Tetherow or Tennis
 * Tracts At Broken Top is filed under "Tetherow" or "Broken Top". Those pages
 * printed "Too few recent sales here to chart." over plats holding 107 and 110
 * closed sales. This series is the same union the plat's lifetime count is
 * built from (public.subdivision_plat_closed_mv, closed_by_year), grouped by
 * calendar year of the close, so the line and the figure beside it are one
 * population and the years sum to the total.
 *
 * EVERY PROPERTY TYPE, like the count. The caption says so rather than letting
 * a reader carry over the single-family scope of the sibling chart.
 *
 * THE CURRENT YEAR IS A PARTIAL YEAR and its point is labelled "to date"; the
 * claim above the drawing never compares a partial year to a full one (§0, the
 * same rule the sibling applies).
 */
export function platClosedYearChart(
  displayName: string,
  closedByYear: Readonly<Record<number, number>> | null | undefined,
): V3ChartProps | undefined {
  if (!closedByYear) return undefined
  const thisYear = new Date().getFullYear()
  const points: V3ChartPoint[] = Object.entries(closedByYear)
    .map(([year, count]) => ({ year: Number(year), count: Number(count) }))
    .filter((row) => Number.isInteger(row.year) && Number.isFinite(row.count) && row.count > 0)
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      value: row.count,
      tick: v3Text(String(row.year)),
      label: v3Text(
        row.year === thisYear
          ? `${row.count.toLocaleString('en-US')} to date`
          : row.count.toLocaleString('en-US'),
      ),
      at: row.year,
    }))
  // Fewer than two years is not a line. The count still prints as a figure.
  if (points.length < 2) return undefined
  const series = [{ name: v3Text('Closed sales'), points }]
  const last = points[points.length - 1]!
  const claim =
    last.at === thisYear
      ? yoyClaim({
          metric: 'Closed sales',
          unit: 'count',
          series: [{ name: series[0]!.name, points: [last] }],
          value: last.value.toLocaleString('en-US'),
          latestLabel: `${thisYear} so far`,
        })
      : yoyClaim({ metric: 'Closed sales', unit: 'count', series })
  const yTicks = countTicks(series)
  const xTicks = yearTicks(series)
  return {
    caption: v3Text(
      `Closed sales inside the recorded ${displayName} plat, by year, every property type`,
    ),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series,
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}
