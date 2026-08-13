/**
 * DAL rows turned into V3Chart props for the market hub family.
 *
 * D9: a trend lives under Instrument, not as a seventh pattern. value is
 * geometry only. Every tick and every reading is already formatted by the
 * caller through lib/format, so the number on screen is the number the
 * source trace covers. A cubic would invent values between the points.
 *
 * Nothing here fetches, reads the clock, or classifies a market. The page
 * drops the in-progress month (zonedDateKey) before calling.
 */

import { buildYearSeries, type KbYearSeries } from '@/lib/kb/year-series'
import { formatPriceCompact } from '@/lib/format/money'
import {
  v3Text,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartSeries,
} from '@/components/site/v3'

const MONTH_TICK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export type MedianMonth = {
  periodStart: string
  medianSalePrice: number | null
  soldCount?: number | null
}

function compactPricePoint(
  value: number,
  tick: string,
  at: number,
): V3ChartPoint | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const label = formatPriceCompact(value)
  if (!label || label === '\u2014') return null
  if (!tick) return null
  return { value, tick: v3Text(tick), label: v3Text(label), at }
}

/**
 * Drop the Pacific in-progress month so a partial month cannot draw as a dip.
 * `currentMonthKey` is YYYY-MM from zonedDateKey, passed in by the page.
 */
export function dropInProgressMonth<T extends { periodStart: string }>(
  monthly: readonly T[],
  currentMonthKey: string,
): T[] {
  if (!currentMonthKey) return [...monthly]
  return monthly.filter((row) => row.periodStart.slice(0, 7) !== currentMonthKey)
}

/**
 * One chronological monthly median line. Fallback when a year overlay cannot
 * plot, and the trailing-12-month instrument on the annual review.
 */
export function buildMonthlyMedianChart(
  monthly: readonly MedianMonth[],
  caption: string,
): V3ChartProps | undefined {
  const points: V3ChartPoint[] = []
  for (const row of monthly) {
    if (row.medianSalePrice == null) continue
    const d = new Date(row.periodStart)
    if (Number.isNaN(d.getTime())) continue
    const month = MONTH_TICK[d.getUTCMonth()]
    if (!month) continue
    const point = compactPricePoint(row.medianSalePrice, `${month} ${d.getUTCFullYear()}`, d.getTime())
    if (point) points.push(point)
  }
  if (points.length < 2) return undefined
  return {
    caption: v3Text(caption),
    series: [{ name: v3Text('Median sale'), points }],
  }
}

/**
 * Newest three calendar years that each have two or more finite months, sharing
 * a Jan-Dec axis. Falls back to one chronological monthly line.
 */
export function buildYearOverlayChart(
  years: readonly KbYearSeries[],
  monthly: readonly MedianMonth[],
): V3ChartProps | undefined {
  const overlay: V3ChartSeries[] = []
  for (const year of years.slice(-3)) {
    const points: V3ChartPoint[] = []
    for (const row of year.points) {
      const tick = MONTH_TICK[row.m - 1]
      if (!tick) continue
      const point = compactPricePoint(row.value, tick, row.m)
      if (point) points.push(point)
    }
    if (points.length < 2) continue
    overlay.push({ name: v3Text(String(year.year)), points })
  }
  if (overlay.length > 0) {
    return {
      caption: v3Text('Median sale price by month, recent years'),
      series: overlay,
    }
  }
  return buildMonthlyMedianChart(monthly, 'Median sale price, completed months')
}

/**
 * Region (or any geo) monthly median history → the overlay the live Instrument
 * mounts. Completes the year-series grouping here so the page does not import
 * lib/kb at the route.
 */
export function buildRegionMedianChart(monthly: readonly MedianMonth[]): V3ChartProps | undefined {
  return buildYearOverlayChart(buildYearSeries([...monthly], 5), monthly)
}

/** Last n completed months, oldest first. The trailing-12-month instrument uses 12. */
export function lastCompleteMonths<T>(monthly: readonly T[], n: number): T[] {
  if (n <= 0) return []
  return monthly.slice(-n)
}

/** Two charts on one page need distinct figure ids. No-op when the series cannot plot. */
export function withChartId(
  chart: V3ChartProps | undefined,
  id: string,
): V3ChartProps | undefined {
  return chart ? { ...chart, id } : undefined
}

export type ClosedYearPoint = {
  year: number
  soldCount: number
}

/**
 * Closed units by calendar year. One series. Volume is a different unit and
 * does not share this Y axis.
 */
export function buildClosedCountChart(
  rows: readonly ClosedYearPoint[],
  caption: string,
): V3ChartProps | undefined {
  const points: V3ChartPoint[] = [...rows]
    .filter((row) => row.year > 0 && row.soldCount > 0)
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      value: row.soldCount,
      tick: v3Text(String(row.year)),
      label: v3Text(row.soldCount.toLocaleString('en-US')),
      at: row.year,
    }))
  if (points.length < 2) return undefined
  return {
    caption: v3Text(caption),
    series: [{ name: v3Text('Homes sold'), points }],
  }
}
