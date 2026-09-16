/**
 * SITE-103 — the sourced board behind the region fold's beautifului InsightCards.
 *
 * PURE. Nothing here fetches, reads the clock, or classifies a market: the page
 * owns the reads and hands this module the rows it already renders elsewhere, the
 * same seam ./region-figures.ts and ./region-sections.ts use.
 *
 * WHY A BOARD AND NOT THREE COMPONENTS. The catalog object is ONE control with
 * three pages (Compare, Anomaly, Allocation) and one pager. Each page is a
 * distinct CLAIM about the same market, not three views of one series, so the
 * board resolves three independent populations and the client maps each to the
 * catalog card that fits it:
 *
 *   - COMPARE: the last twelve complete months of median sale price against the
 *     twelve before them. Two equal-length windows, so the scrubber reads one
 *     month on both lines at once. Monthly medians, single-family, region.
 *   - ANOMALY: how many homes closed each month across the same twelve months,
 *     with the median sale price of that month as the second metric. Closed
 *     sales, not active listings.
 *   - ALLOCATION: what closed in the last full calendar year, by property type,
 *     from the closed-sales mart. ALL types, which is why it never borrows the
 *     single-family trace above it.
 *
 * ABSENT IS NOT ZERO (CLAUDE.md section 0). A window with no median is dropped,
 * not drawn at 0; a monthly series with no closing counts omits the Anomaly page
 * rather than publishing an empty line; a mart year with no breakdown omits
 * Allocation. Every page carries the trace for the population it drew.
 */

import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { formatPriceCompact } from '@/lib/format/money'
import type { MedianMonth } from '../../_v3/market-charts'
import { compositionParts, pickLatestMartYear } from '../../_v3/closed-kpis'

/** Months in one comparison window. Twelve, so the two lines are apples to apples. */
export const INSIGHT_WINDOW_MONTHS = 12

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_SHORT = [
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

export type RegionMonthCell = {
  /** YYYY-MM, the key the DAL row carried. */
  key: string
  /** "August 2026" — what a visitor reads. */
  label: string
  /** "Aug 2026" — the scrubber face. */
  short: string
  median: number | null
  closings: number | null
}

export type RegionCompareBoard = {
  /** "The last twelve months" */
  name: string
  /** "The twelve months before" */
  priorName: string
  cells: RegionMonthCell[]
  priorCells: RegionMonthCell[]
  values: number[]
  priorValues: number[]
  source: string
}

export type RegionPaceBoard = {
  cells: RegionMonthCell[]
  closings: number[]
  medians: number[]
  /** The month with the most closings in the window. */
  peakIndex: number
  source: string
}

export type RegionMixSegment = {
  /** Chip face, e.g. "HOUSES". */
  name: string
  /** Plain name, e.g. "Single-family houses". */
  label: string
  count: number
  pct: number
}

export type RegionMixBoard = {
  year: number
  total: number
  segments: RegionMixSegment[]
  source: string
}

export type RegionInsightBoard = {
  compare: RegionCompareBoard | null
  pace: RegionPaceBoard | null
  mix: RegionMixBoard | null
}

function monthCell(row: MedianMonth): RegionMonthCell | null {
  const at = new Date(row.periodStart)
  if (Number.isNaN(at.getTime())) return null
  const month = at.getUTCMonth()
  const year = at.getUTCFullYear()
  const name = MONTH_NAMES[month]
  const short = MONTH_SHORT[month]
  if (!name || !short) return null
  const median =
    row.medianSalePrice != null && row.medianSalePrice > 0 ? row.medianSalePrice : null
  const closings = row.soldCount != null && row.soldCount > 0 ? row.soldCount : null
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `${name} ${year}`,
    short: `${short} ${year}`,
    median,
    closings,
  }
}

/** Oldest first, in-progress month already dropped by the caller. */
export function regionMonthCells(monthly: readonly MedianMonth[]): RegionMonthCell[] {
  const out: RegionMonthCell[] = []
  for (const row of monthly) {
    const cell = monthCell(row)
    if (cell) out.push(cell)
  }
  return out
}

/** The compact money face every figure on these cards prints. One formatter. */
export function insightMoney(value: number): string {
  return formatPriceCompact(value)
}

export function insightCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Percent change between two sourced medians, one decimal, sign carried. */
export function insightDelta(now: number, then: number): string | null {
  if (!(now > 0) || !(then > 0)) return null
  const pct = ((now - then) / then) * 100
  if (!Number.isFinite(pct)) return null
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`
}

function buildCompare(cells: readonly RegionMonthCell[]): RegionCompareBoard | null {
  const priced = cells.filter((cell) => cell.median != null)
  if (priced.length < INSIGHT_WINDOW_MONTHS * 2) return null
  const recent = priced.slice(-INSIGHT_WINDOW_MONTHS)
  const prior = priced.slice(-INSIGHT_WINDOW_MONTHS * 2, -INSIGHT_WINDOW_MONTHS)
  if (recent.length !== INSIGHT_WINDOW_MONTHS || prior.length !== INSIGHT_WINDOW_MONTHS) {
    return null
  }
  const first = recent[0]
  const last = recent[recent.length - 1]
  const priorFirst = prior[0]
  const priorLast = prior[prior.length - 1]
  if (!first || !last || !priorFirst || !priorLast) return null
  return {
    name: `${first.short} – ${last.short}`,
    priorName: `${priorFirst.short} – ${priorLast.short}`,
    cells: recent,
    priorCells: prior,
    values: recent.map((cell) => cell.median ?? 0),
    priorValues: prior.map((cell) => cell.median ?? 0),
    source:
      'Median price of the houses that actually closed each month across Central Oregon, single-family only, from Oregon Data Share MLS.',
  }
}

function buildPace(cells: readonly RegionMonthCell[]): RegionPaceBoard | null {
  const counted = cells.filter((cell) => cell.closings != null && cell.median != null)
  if (counted.length < 6) return null
  const window = counted.slice(-INSIGHT_WINDOW_MONTHS)
  const closings = window.map((cell) => cell.closings ?? 0)
  const medians = window.map((cell) => cell.median ?? 0)
  let peakIndex = 0
  for (let i = 1; i < closings.length; i += 1) {
    if ((closings[i] ?? 0) > (closings[peakIndex] ?? 0)) peakIndex = i
  }
  return {
    cells: window,
    closings,
    medians,
    peakIndex,
    source:
      'Every single-family sale that closed in the month, counted from Oregon Data Share MLS. Sales that fell through are not in here.',
  }
}

function buildMix(series: readonly CoMarketAnnualRow[]): RegionMixBoard | null {
  const latest = pickLatestMartYear(series)
  if (!latest) return null
  const parts = compositionParts(latest.propertyTypeBreakdown)
  if (parts.length < 2) return null
  const total = parts.reduce((sum, part) => sum + part.n, 0)
  if (!(total > 0)) return null
  const segments = parts.slice(0, 5).map((part) => ({
    name: part.label.split(/[\s/]+/)[0]?.toUpperCase() ?? part.code.toUpperCase(),
    label: part.label,
    count: part.n,
    pct: (part.n / total) * 100,
  }))
  if (segments.length < 2) return null
  return {
    year: latest.year,
    total,
    segments,
    source: `Everything that closed in Central Oregon in ${latest.year} — houses, condos, land and commercial — counted from Oregon Data Share MLS.`,
  }
}

/**
 * The board. `monthly` is the same median-by-month series the opening chart
 * draws; `closedSeries` is the same mart the size-of-the-market ledger prints.
 * Nothing is synthesised: a page that cannot be sourced is simply absent.
 */
export function buildRegionInsightBoard(opts: {
  monthly: readonly MedianMonth[]
  closedSeries: readonly CoMarketAnnualRow[]
  hud: LeftoverHudKpis
}): RegionInsightBoard {
  const cells = regionMonthCells(opts.monthly)
  return {
    compare: buildCompare(cells),
    pace: buildPace(cells),
    mix: buildMix(opts.closedSeries),
  }
}

/** How many pages the board can actually publish. Two is the catalog minimum. */
export function regionInsightPageCount(board: RegionInsightBoard): number {
  return [board.compare, board.pace, board.mix].filter(Boolean).length
}
