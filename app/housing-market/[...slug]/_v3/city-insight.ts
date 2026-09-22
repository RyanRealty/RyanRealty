/**
 * SITE-102 — sourced board behind the city market InsightCards.
 *
 * PURE. The page owns the reads. This module turns the same monthly series
 * and city closed-sales mart the Instrument already publishes into three
 * catalog pages. Visitor English only: no Market Truth, no mt-v1, no leftover.
 */

import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { compositionParts, pickLatestMartYear } from '../../_v3/closed-kpis'
import type { MedianMonth } from '../../_v3/market-charts'
import {
  INSIGHT_WINDOW_MONTHS,
  insightDelta,
  insightMoney,
  regionMonthCells,
  type RegionCompareBoard,
  type RegionInsightBoard,
  type RegionMixBoard,
  type RegionMonthCell,
  type RegionPaceBoard,
} from '../../central-oregon/_v3/region-insight'

export {
  insightCount,
  insightDelta,
  insightMoney,
  type RegionInsightBoard,
  type RegionMonthCell,
} from '../../central-oregon/_v3/region-insight'

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

const INTERNAL_COPY = /Market Truth|mt-v1|leftover|MarketPulse|definition_id|stat_id|market_metric/i

function cityMlsSource(cityName: string, extra: string): string {
  const line = `Oregon Data Share MLS. ${extra} Single-family houses in ${cityName}.`
  if (INTERNAL_COPY.test(line)) {
    throw new Error('city-insight: internal dataset name leaked into visitor English')
  }
  return line
}

function buildCompare(cells: readonly RegionMonthCell[], cityName: string): RegionCompareBoard | null {
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
    source: cityMlsSource(
      cityName,
      'Median price of the houses that actually closed each month.',
    ),
  }
}

function buildPace(cells: readonly RegionMonthCell[], cityName: string): RegionPaceBoard | null {
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
    source: cityMlsSource(
      cityName,
      'Every sale that closed in the month. Sales that fell through are not counted.',
    ),
  }
}

function buildMix(series: readonly CoMarketAnnualRow[], cityName: string): RegionMixBoard | null {
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
    source: cityMlsSource(
      cityName,
      `Everything that closed in ${latest.year}: houses, condos, land and commercial.`,
    ),
  }
}

export function buildCityInsightBoard(opts: {
  cityName: string
  monthly: readonly MedianMonth[]
  closedSeries: readonly CoMarketAnnualRow[]
}): RegionInsightBoard {
  const cells = regionMonthCells(opts.monthly)
  return {
    compare: buildCompare(cells, opts.cityName),
    pace: buildPace(cells, opts.cityName),
    mix: buildMix(opts.closedSeries, opts.cityName),
  }
}

export function cityInsightPageCount(board: RegionInsightBoard): number {
  return [board.compare, board.pace, board.mix].filter(Boolean).length
}

export function cityInsightDatasetVariables(
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
  }
  return out
}

export function cityInsightMetaClause(cityName: string, board: RegionInsightBoard): string | null {
  const recent = board.compare?.cells[board.compare.cells.length - 1]
  const prior = board.compare?.priorCells[board.compare.priorCells.length - 1]
  if (!recent || !prior || recent.median == null || prior.median == null) return null
  const delta = insightDelta(recent.median, prior.median)
  return `The middle ${cityName} house sold for ${insightMoney(recent.median)} in ${recent.label}${
    delta ? ` (${delta} against ${prior.label})` : ''
  }.`
}

export function cityInsightSources(board: RegionInsightBoard): string[] {
  return [board.compare?.source, board.pace?.source, board.mix?.source].filter(
    (line): line is string => Boolean(line),
  )
}
