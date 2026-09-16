/**
 * SITE-114. Sourced board for the ZIP page's beautifului InsightCards.
 *
 * PURE. The page already fetched leftover monthly + mix; this only shapes
 * those rows into Compare / Anomaly / Allocation pages. Absent is not zero.
 * When leftover ZIP months are sparse the page already fell back to the
 * parent city — `cityFallback` forces every sentence to say so.
 */

import { formatPriceCompact } from '@/lib/format/money'

export type ZipMixShare = {
  key: string
  share: number
  floor?: boolean
}

export const ZIP_INSIGHT_WINDOW = 12

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

const BED_CHIP: Record<string, { chip: string; plain: string }> = {
  '0': { chip: 'STUDIO', plain: 'Studios' },
  '1': { chip: '1-BED', plain: 'One-bedroom homes' },
  '2': { chip: '2-BED', plain: 'Two-bedroom homes' },
  '3': { chip: '3-BED', plain: 'Three-bedroom homes' },
  '4': { chip: '4-BED', plain: 'Four-bedroom homes' },
  '5': { chip: '5-BED', plain: 'Five-bedroom homes' },
  '6plus': { chip: '6+ BED', plain: 'Homes with six or more bedrooms' },
}

const FINANCE_CHIP: Record<string, { chip: string; plain: string }> = {
  cash: { chip: 'CASH', plain: 'Cash closes' },
  conventional: { chip: 'CONV', plain: 'Conventional loans' },
  fha: { chip: 'FHA', plain: 'FHA loans' },
  va: { chip: 'VA', plain: 'VA loans' },
  usda: { chip: 'USDA', plain: 'USDA loans' },
}

export type ZipMonthCell = {
  key: string
  label: string
  short: string
  median: number | null
  closings: number | null
}

export type ZipCompareBoard = {
  name: string
  priorName: string
  cells: ZipMonthCell[]
  priorCells: ZipMonthCell[]
  values: number[]
  priorValues: number[]
  source: string
}

export type ZipPaceBoard = {
  cells: ZipMonthCell[]
  closings: number[]
  medians: number[]
  peakIndex: number
  source: string
}

export type ZipMixSegment = {
  name: string
  label: string
  pct: number
  amount: string
}

export type ZipMixBoard = {
  kind: 'bedrooms' | 'financing'
  segments: ZipMixSegment[]
  source: string
}

export type ZipInsightBoard = {
  place: string
  scope: string
  compare: ZipCompareBoard | null
  pace: ZipPaceBoard | null
  mix: ZipMixBoard | null
}

export type ZipInsightMonth = {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
}

export function zipInsightMoney(value: number): string {
  return formatPriceCompact(value)
}

export function zipInsightCount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function zipInsightDelta(now: number, then: number): string | null {
  if (!(now > 0) || !(then > 0)) return null
  const pct = ((now - then) / then) * 100
  if (!Number.isFinite(pct)) return null
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`
}

export function zipInsightHasPages(board: ZipInsightBoard): boolean {
  const n =
    Number(board.compare != null) + Number(board.pace != null) + Number(board.mix != null)
  return n >= 2
}

function monthCell(row: ZipInsightMonth): ZipMonthCell | null {
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

function cellsFromMonths(months: readonly ZipInsightMonth[]): ZipMonthCell[] {
  const out: ZipMonthCell[] = []
  for (const row of months) {
    const cell = monthCell(row)
    if (cell) out.push(cell)
  }
  return out
}

function scopeClause(zip: string, cityName: string, cityFallback: boolean): string {
  return cityFallback
    ? `${cityName} at city scope, not ZIP ${zip}`
    : `ZIP ${zip}`
}

function buildCompare(
  cells: readonly ZipMonthCell[],
  source: string,
): ZipCompareBoard | null {
  const priced = cells.filter((cell) => cell.median != null)
  if (priced.length < ZIP_INSIGHT_WINDOW * 2) return null
  const recent = priced.slice(-ZIP_INSIGHT_WINDOW)
  const prior = priced.slice(-ZIP_INSIGHT_WINDOW * 2, -ZIP_INSIGHT_WINDOW)
  if (recent.length !== ZIP_INSIGHT_WINDOW || prior.length !== ZIP_INSIGHT_WINDOW) return null
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
    source,
  }
}

function buildPace(cells: readonly ZipMonthCell[], source: string): ZipPaceBoard | null {
  const counted = cells.filter((cell) => cell.closings != null && cell.median != null)
  if (counted.length < 6) return null
  const window = counted.slice(-ZIP_INSIGHT_WINDOW)
  const closings = window.map((cell) => cell.closings ?? 0)
  const medians = window.map((cell) => cell.median ?? 0)
  let peakIndex = 0
  for (let i = 1; i < closings.length; i += 1) {
    if ((closings[i] ?? 0) > (closings[peakIndex] ?? 0)) peakIndex = i
  }
  return { cells: window, closings, medians, peakIndex, source }
}

function formatShare(share: number): string {
  const pct = Math.round(share * 1000) / 10
  return `${pct.toFixed(1)}%`
}

function mixSegments(
  shares: readonly ZipMixShare[],
  words: Record<string, { chip: string; plain: string }>,
): ZipMixSegment[] {
  const named = shares
    .map((row) => {
      const w = words[row.key]
      if (!w || !(row.share > 0)) return null
      return { row, w }
    })
    .filter((item): item is { row: ZipMixShare; w: { chip: string; plain: string } } => item != null)
  if (named.length < 2) return []
  const total = named.reduce((sum, item) => sum + item.row.share, 0)
  if (!(total > 0)) return []
  return named.slice(0, 5).map((item) => {
    const pct = Number(((item.row.share / total) * 100).toFixed(1))
    return {
      name: item.w.chip,
      label: item.w.plain,
      pct,
      amount: formatShare(item.row.share),
    }
  })
}

function buildMix(
  bedrooms: readonly ZipMixShare[],
  financing: readonly ZipMixShare[],
  source: string,
): ZipMixBoard | null {
  const beds = mixSegments(bedrooms, BED_CHIP)
  if (beds.length >= 2) {
    return { kind: 'bedrooms', segments: beds, source }
  }
  const loans = mixSegments(financing, FINANCE_CHIP)
  if (loans.length >= 2) {
    return { kind: 'financing', segments: loans, source }
  }
  return null
}

function withAsOf(source: string, asOf?: string | null): string {
  if (!asOf) return source
  return `${source.replace(/\.$/, '')} as of ${asOf}.`
}

export function buildZipInsightBoard(input: {
  zip: string
  cityName: string
  cityFallback: boolean
  months: readonly ZipInsightMonth[]
  bedrooms: readonly ZipMixShare[]
  financing: readonly ZipMixShare[]
  asOf?: string | null
}): ZipInsightBoard {
  const place = `ZIP ${input.zip}`
  const scope = scopeClause(input.zip, input.cityName, input.cityFallback)
  const cells = cellsFromMonths(input.months)
  const monthSource = withAsOf(
    input.cityFallback
      ? `Median close of detached single-family homes in ${input.cityName}, because ZIP ${input.zip} does not yet have a publishable monthly series. Oregon Data Share.`
      : `Median close of detached single-family homes inside ZIP ${input.zip}. Oregon Data Share.`,
    input.asOf,
  )
  const paceSource = withAsOf(
    input.cityFallback
      ? `Closed detached sales by month in ${input.cityName}, not ZIP ${input.zip}. Oregon Data Share.`
      : `Closed detached sales by month inside ZIP ${input.zip}. Oregon Data Share.`,
    input.asOf,
  )
  const mixSource = withAsOf(
    `Detached closes in ZIP ${input.zip} over the last 12 months, among the groups this page publishes (each at least 5%). Oregon Data Share.`,
    input.asOf,
  )
  return {
    place,
    scope,
    compare: buildCompare(cells, monthSource),
    pace: buildPace(cells, paceSource),
    mix: buildMix(input.bedrooms, input.financing, mixSource),
  }
}
