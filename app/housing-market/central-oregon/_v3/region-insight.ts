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
import { yearAgoClause } from '@/lib/market/year-ago-clause'
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

/**
 * The MLS property-type codes in a visitor's words, for the Allocation bar.
 *
 * PROPERTY_TYPE_LABELS is the site's canonical label set and stays canonical
 * everywhere else; what it is not is a chip. "All residential" abbreviates to
 * "ALL", which next to "LAND" and "COMMERCIAL" reads as a filter name rather
 * than a kind of building, and TASTE.md bans internal labels in copy a visitor
 * reads. `chip` is the band's short face; `plain` is the sentence above it.
 * Anything outside this map keeps the canonical label.
 */
const MIX_WORDS: Record<string, { chip: string; plain: string }> = {
  A: { chip: 'HOMES', plain: 'Houses, condos and townhomes' },
  B: { chip: 'IN PARK', plain: 'Manufactured homes in a park' },
  C: { chip: '2–4 UNITS', plain: 'Small income property, two to four units' },
  D: { chip: 'LAND', plain: 'Bare land' },
  E: { chip: 'FARMS', plain: 'Farms and ranches' },
  F: { chip: 'COMMERCIAL', plain: 'Commercial buildings' },
  G: { chip: 'LEASE', plain: 'Commercial leases' },
  H: { chip: 'BUSINESS', plain: 'Business opportunities' },
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
  const segments = parts.slice(0, 5).map((part) => {
    const words = MIX_WORDS[part.code]
    return {
      name: words?.chip ?? part.label.toUpperCase(),
      label: words?.plain ?? labelPropertyType(part.code),
      count: part.n,
      pct: (part.n / total) * 100,
    }
  })
  if (segments.length < 2) return null
  return {
    year: latest.year,
    total,
    segments,
    source: `Everything that closed in Central Oregon in ${latest.year}: houses, condos, land and commercial, counted from Oregon Data Share MLS.`,
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

/**
 * ISO 8601 interval for Dataset.temporalCoverage — the window the cards draw.
 * Month precision, because that is the grain of the rows behind them. Null when
 * no page published a series, so the payload never claims a coverage it has no
 * figures for.
 */
export function regionInsightTemporalCoverage(board: RegionInsightBoard): string | null {
  const cells = board.compare
    ? [...board.compare.priorCells, ...board.compare.cells]
    : board.pace?.cells ?? []
  const first = cells[0]
  const last = cells[cells.length - 1]
  if (!first || !last) return null
  return `${first.key}/${last.key}`
}

/**
 * The figures the cards publish, as Dataset variables, so the number a reader
 * sees and the number an answer engine reads are the same number (CLAUDE.md
 * section 0). Every entry is a value already on the page; a page the board could
 * not source contributes nothing.
 */
export function regionInsightDatasetVariables(
  board: RegionInsightBoard,
): { name: string; value: string | number; unitText?: string }[] {
  const out: { name: string; value: string | number; unitText?: string }[] = []
  const recent = board.compare?.cells[board.compare.cells.length - 1]
  const prior = board.compare?.priorCells[board.compare.priorCells.length - 1]
  if (recent?.median != null) {
    out.push({
      name: `Median sale price, ${recent.label}`,
      value: recent.median,
      unitText: 'USD',
    })
  }
  if (prior?.median != null) {
    out.push({
      name: `Median sale price, ${prior.label}`,
      value: prior.median,
      unitText: 'USD',
    })
  }
  const paceCell = board.pace?.cells[board.pace.cells.length - 1]
  if (paceCell?.closings != null) {
    out.push({ name: `Homes closed, ${paceCell.label}`, value: paceCell.closings })
  }
  if (board.mix) {
    out.push({ name: `Closed sales, all property types, ${board.mix.year}`, value: board.mix.total })
    const lead = board.mix.segments[0]
    if (lead) {
      out.push({
        name: `${lead.label} share of ${board.mix.year} closed sales`,
        value: Number(lead.pct.toFixed(1)),
        unitText: 'PERCENT',
      })
    }
  }
  return out
}

/**
 * The questions the cards answer, in the words a visitor types, for the FAQ
 * block AND the FAQPage payload it shares. Route-local on purpose: the shared
 * buildMarketFaq answers the region row's own figures and is used by other
 * market routes, and widening it there would put closed-sales answers on pages
 * that draw none. Every answer restates a number already on this page.
 */
export function regionInsightFaqs(
  board: RegionInsightBoard,
): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  const recent = board.compare?.cells[board.compare.cells.length - 1]
  const prior = board.compare?.priorCells[board.compare.priorCells.length - 1]
  if (recent?.median != null && prior?.median != null) {
    // VOICE-6: the same one-subject comparison the board's lede prints.
    const versus = yearAgoClause({
      now: recent.median,
      then: prior.median,
      thenMoney: insightMoney(prior.median),
      thenLabel: prior.label,
      delta: insightDelta(recent.median, prior.median),
    })
    out.push({
      question: 'What is a house actually selling for in Central Oregon right now?',
      answer:
        `In ${recent.label} the middle single-family sale across Central Oregon closed at ` +
        `${insightMoney(recent.median)}${versus ? `, ${versus}` : ''}. ` +
        'This is what buyers paid, not what sellers are asking; ' +
        'asking prices sit higher. Source: closed single-family sales through Oregon Data Share MLS.',
    })
  }
  const pace = board.pace
  const paceCell = pace?.cells[pace.cells.length - 1]
  const peak = pace ? pace.cells[pace.peakIndex] : undefined
  if (pace && paceCell?.closings != null) {
    out.push({
      question: 'How many homes sell in Central Oregon in a month?',
      answer:
        `${insightCount(paceCell.closings)} single-family homes closed across Central Oregon in ` +
        `${paceCell.label}.` +
        (peak?.closings != null
          ? ` The busiest of the last twelve months was ${peak.label}, at ${insightCount(peak.closings)}.`
          : '') +
        ' Only sales that actually closed are counted; a home that went under contract and fell ' +
        'through is not in the number. Source: Oregon Data Share MLS.',
    })
  }
  if (board.mix) {
    const lead = board.mix.segments[0]
    const land = board.mix.segments.find((segment) => segment.name === 'LAND')
    if (lead) {
      out.push({
        question: `What kinds of property sold in Central Oregon in ${board.mix.year}?`,
        answer:
          `${insightCount(board.mix.total)} sales closed across Central Oregon in ${board.mix.year}, ` +
          `counting every property type. ${lead.label} were ${lead.pct.toFixed(1)}% of them ` +
          `(${insightCount(lead.count)} sales)` +
          (land ? `, and bare land was ${land.pct.toFixed(1)}% (${insightCount(land.count)})` : '') +
          '. Source: closed sales through Oregon Data Share MLS across the Central Oregon ' +
          'service area, all property types.',
      })
    }
  }
  return out
}

/** One plain sentence for the meta description, built from the board. */
export function regionInsightMetaClause(board: RegionInsightBoard): string | null {
  const recent = board.compare?.cells[board.compare.cells.length - 1]
  const prior = board.compare?.priorCells[board.compare.priorCells.length - 1]
  if (!recent || !prior || recent.median == null || prior.median == null) return null
  const delta = insightDelta(recent.median, prior.median)
  return `The middle house sold for ${insightMoney(recent.median)} in ${recent.label}${
    delta ? ` (${delta} against ${prior.label})` : ''
  }.`
}
