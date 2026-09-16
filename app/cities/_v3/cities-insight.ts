/**
 * SITE-92 — the sourced board behind the cities-index InsightCards.
 *
 * PURE. The page owns the leftover reads and hands this module the monthly
 * series and the city inventory rows it already prints on the ledger. Absent
 * is not zero: a window with no median is dropped; a mix with fewer than two
 * published city counts omits Allocation.
 *
 *   COMPARE — last twelve complete months of median close against the twelve
 *             before them. Same leftover monthly series the ledger reveal uses.
 *   PACE    — homes that closed each of those twelve months, with that month's
 *             median close as the second metric.
 *   MIX     — live inventory share across featured cities that published a count.
 */

import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import { formatPriceCompact } from '@/lib/format/money'
import { formatCount } from '@/lib/format/count'

export const CITIES_INSIGHT_WINDOW = 12

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

export type CitiesMonthCell = {
  key: string
  label: string
  short: string
  median: number | null
  closings: number | null
}

export type CitiesCompareBoard = {
  name: string
  priorName: string
  cells: CitiesMonthCell[]
  priorCells: CitiesMonthCell[]
  values: number[]
  priorValues: number[]
  source: string
}

export type CitiesPaceBoard = {
  cells: CitiesMonthCell[]
  closings: number[]
  medians: number[]
  peakIndex: number
  source: string
}

export type CitiesMixSegment = {
  name: string
  label: string
  count: number
  pct: number
}

export type CitiesMixBoard = {
  total: number
  segments: CitiesMixSegment[]
  source: string
}

export type CitiesInsightBoard = {
  compare: CitiesCompareBoard | null
  pace: CitiesPaceBoard | null
  mix: CitiesMixBoard | null
}

export type CitiesMixRow = {
  slug: string
  name: string
  activeCount: number | null
}

export function insightMoney(value: number): string {
  return formatPriceCompact(value)
}

export function insightCount(value: number): string {
  return formatCount(Math.round(value))
}

export function insightDelta(now: number, then: number): string | null {
  if (!(then > 0) || !Number.isFinite(now) || !Number.isFinite(then)) return null
  const pct = ((now - then) / then) * 100
  if (!Number.isFinite(pct)) return null
  const rounded = Math.round(pct)
  if (rounded === 0) return 'level'
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function monthCell(point: PublicMonthlyPoint): CitiesMonthCell | null {
  const at = new Date(point.periodStart)
  if (Number.isNaN(at.getTime())) return null
  const month = at.getUTCMonth()
  const year = at.getUTCFullYear()
  const key = point.periodStart.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(key)) return null
  return {
    key,
    label: `${MONTH_NAMES[month]} ${year}`,
    short: `${MONTH_SHORT[month]} ${year}`,
    median: point.medianClose,
    closings: point.closedCount,
  }
}

function cellsFromMonthly(monthly: readonly PublicMonthlyPoint[]): CitiesMonthCell[] {
  const out: CitiesMonthCell[] = []
  for (const point of monthly) {
    const cell = monthCell(point)
    if (cell) out.push(cell)
  }
  return out
}

function buildCompare(cells: readonly CitiesMonthCell[]): CitiesCompareBoard | null {
  const priced = cells.filter((cell) => cell.median != null && cell.median > 0)
  if (priced.length < CITIES_INSIGHT_WINDOW * 2) return null
  const recent = priced.slice(-CITIES_INSIGHT_WINDOW)
  const prior = priced.slice(-CITIES_INSIGHT_WINDOW * 2, -CITIES_INSIGHT_WINDOW)
  if (recent.length !== CITIES_INSIGHT_WINDOW || prior.length !== CITIES_INSIGHT_WINDOW) return null
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
      'Median price of the detached homes that closed each month across Central Oregon, from Oregon Data Share via Market Truth.',
  }
}

function buildPace(cells: readonly CitiesMonthCell[]): CitiesPaceBoard | null {
  const counted = cells.filter((cell) => cell.closings != null && cell.median != null)
  if (counted.length < 6) return null
  const window = counted.slice(-CITIES_INSIGHT_WINDOW)
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
      'Every detached home that closed in the month across Central Oregon, counted from Oregon Data Share via Market Truth.',
  }
}

function buildMix(rows: readonly CitiesMixRow[]): CitiesMixBoard | null {
  const published = rows
    .map((row) => ({
      name: row.name.toUpperCase(),
      label: row.name,
      count: row.activeCount,
    }))
    .filter((row): row is { name: string; label: string; count: number } => row.count != null && row.count > 0)
    .sort((a, b) => b.count - a.count)
  if (published.length < 2) return null
  const top = published.slice(0, 6)
  const rest = published.slice(6)
  const restCount = rest.reduce((sum, row) => sum + row.count, 0)
  const segments: CitiesMixSegment[] = top.map((row) => ({
    name: row.name,
    label: row.label,
    count: row.count,
    pct: 0,
  }))
  if (restCount > 0) {
    segments.push({
      name: 'OTHER CITIES',
      label: 'The rest of the directory',
      count: restCount,
      pct: 0,
    })
  }
  const total = segments.reduce((sum, row) => sum + row.count, 0)
  if (!(total > 0) || segments.length < 2) return null
  for (const segment of segments) {
    segment.pct = (segment.count / total) * 100
  }
  return {
    total,
    segments,
    source:
      'Live active single-family listings on each city row, from Oregon Data Share via Market Truth. The bar is each city\'s share of that published set.',
  }
}

export function buildCitiesInsightBoard(opts: {
  monthly: readonly PublicMonthlyPoint[]
  cities: readonly CitiesMixRow[]
}): CitiesInsightBoard {
  const cells = cellsFromMonthly(opts.monthly)
  return {
    compare: buildCompare(cells),
    pace: buildPace(cells),
    mix: buildMix(opts.cities),
  }
}

export function citiesInsightPageCount(board: CitiesInsightBoard): number {
  return [board.compare, board.pace, board.mix].filter(Boolean).length
}

export function citiesInsightDatasetVariables(
  board: CitiesInsightBoard,
): { name: string; value: string | number; unitText?: string }[] {
  const out: { name: string; value: string | number; unitText?: string }[] = []
  const recent = board.compare?.cells[board.compare.cells.length - 1]
  const prior = board.compare?.priorCells[board.compare.priorCells.length - 1]
  if (recent?.median != null) {
    out.push({ name: `Median sale price, ${recent.label}`, value: recent.median, unitText: 'USD' })
  }
  if (prior?.median != null) {
    out.push({ name: `Median sale price, ${prior.label}`, value: prior.median, unitText: 'USD' })
  }
  const pace = board.pace?.cells[board.pace.cells.length - 1]
  if (pace?.closings != null) {
    out.push({ name: `Homes closed, ${pace.label}`, value: pace.closings, unitText: 'homes' })
  }
  if (board.mix) {
    out.push({
      name: 'Active single-family listings in the published city mix',
      value: board.mix.total,
      unitText: 'homes',
    })
  }
  return out
}
