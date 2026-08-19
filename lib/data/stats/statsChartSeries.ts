/**
 * statsChartSeries — the cached FRED reads the /housing-market long-view
 * charts run on (chart-room forms, Matt-approved 2026-08-19).
 *
 * reachability: entry-point — /housing-market long-view section (Unit HUB).
 *
 * Two pulls, each cached ONCE and shared by every card that needs the data:
 *
 *   getRateChartSeries  — the full 30-year mortgage history plus the full
 *     10-year Treasury history, aligned into the weekly spread. The FULL
 *     history is read on purpose: the spread's norm is the mean weekly spread
 *     over every pair since the mortgage series began (1971), and computing it
 *     from the same read that draws the chart keeps one source for both
 *     numbers (CLAUDE.md section 0). The chart window trims to
 *     RATE_WINDOW_FROM after the norm is taken.
 *
 *   getNationalIndexSeries — Case-Shiller U.S. National and CPI-U monthlies
 *     from INDEX_BASE_YEAR, for the indexed-to-1998 and real-vs-nominal cards.
 *
 * Errors throw inside the fetch so the resilient cache never stores a blip as
 * "no data"; callers get null and render their empty reason honestly.
 *
 * IMPORT BY SUB-PATH: `@/lib/data/stats/statsChartSeries` — the lib/data
 * barrel is frozen by the p2.2 file-size ratchet.
 */

import 'server-only'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import {
  alignStatSpread,
  readPublicStatSeries,
  type StatPoint,
  type StatSpreadPoint,
} from '@/lib/data/stats/statsReads'

/** The registered stat_series ids these charts read. */
export const MORTGAGE_30_SERIES = 'fred:MORTGAGE30US'
export const TREASURY_10_SERIES = 'fred:DGS10'
export const CASE_SHILLER_SERIES = 'fred:CSUSHPINSA'
export const CPI_SERIES = 'fred:CPIAUCSL'

/** The approved chart-room rate window (time.fragment, 2026-08-19). */
export const RATE_WINDOW_FROM = '2015-01-01'

/** The mart's floor year — both index cards rebase to it. */
export const INDEX_BASE_YEAR = 1998

/** Generous page ceilings; DGS10 holds ~16k business-day rows. */
const RATE_MAX_POINTS = 4000
const DAILY_MAX_POINTS = 20000
const MONTHLY_MAX_POINTS = 1200

export type SpreadNorm = {
  /** Mean weekly spread over every aligned pair, in percentage points. */
  mean: number
  from: string
  to: string
  n: number
}

/** Pure: the full-history norm of an aligned spread. Exported for tests. */
export function spreadNorm(points: readonly StatSpreadPoint[]): SpreadNorm | null {
  if (points.length === 0) return null
  let sum = 0
  for (const p of points) sum += p.spread
  return {
    mean: sum / points.length,
    from: points[0]!.observationDate,
    to: points[points.length - 1]!.observationDate,
    n: points.length,
  }
}

/**
 * Pure: calendar-year averages of a monthly series, complete years only. A
 * partial year's average is not that year's average, so it is not published.
 * Exported for tests.
 */
export function annualAverages(
  points: readonly StatPoint[],
  monthsRequired = 12,
): Map<number, number> {
  const sums = new Map<number, { sum: number; n: number }>()
  for (const p of points) {
    const year = Number(p.observationDate.slice(0, 4))
    if (!Number.isInteger(year)) continue
    const row = sums.get(year) ?? { sum: 0, n: 0 }
    row.sum += p.value
    row.n += 1
    sums.set(year, row)
  }
  const out = new Map<number, number>()
  for (const [year, row] of sums) {
    if (row.n >= monthsRequired) out.set(year, row.sum / row.n)
  }
  return out
}

export type RateChartSeries = {
  /** Weekly 30-year points inside the chart window, ascending. */
  m30: StatPoint[]
  /** Weekly spread (30-year minus standing 10-year) inside the window. */
  spread: StatSpreadPoint[]
  /** The full-history norm those spread points are read against. */
  norm: SpreadNorm
}

async function fetchRateChartSeries(): Promise<RateChartSeries> {
  const [m30, d10] = await Promise.all([
    readPublicStatSeries(MORTGAGE_30_SERIES, { maxPoints: RATE_MAX_POINTS }),
    readPublicStatSeries(TREASURY_10_SERIES, { maxPoints: DAILY_MAX_POINTS }),
  ])
  if (!m30.ok) throw new Error(`statsChartSeries: ${MORTGAGE_30_SERIES} ${m30.reason}: ${m30.detail ?? ''}`)
  if (!d10.ok) throw new Error(`statsChartSeries: ${TREASURY_10_SERIES} ${d10.reason}: ${d10.detail ?? ''}`)
  const spreadFull = alignStatSpread(m30.data, d10.data)
  const norm = spreadNorm(spreadFull)
  if (!norm) throw new Error('statsChartSeries: no aligned spread pairs — norm cannot be published.')
  return {
    m30: m30.data.filter((p) => p.observationDate >= RATE_WINDOW_FROM),
    spread: spreadFull.filter((p) => p.observationDate >= RATE_WINDOW_FROM),
    norm,
  }
}

export const getRateChartSeries = makeResilientCached(
  fetchRateChartSeries,
  ['stats-rate-charts-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'stats-fred'] },
  null as RateChartSeries | null,
)

export type NationalIndexSeries = {
  /** Case-Shiller U.S. National monthlies from the base year, ascending. */
  caseShiller: StatPoint[]
  /** CPI-U monthlies from the base year, ascending. */
  cpi: StatPoint[]
}

async function fetchNationalIndexSeries(): Promise<NationalIndexSeries> {
  const from = `${INDEX_BASE_YEAR}-01-01`
  const [cs, cpi] = await Promise.all([
    readPublicStatSeries(CASE_SHILLER_SERIES, { from, maxPoints: MONTHLY_MAX_POINTS }),
    readPublicStatSeries(CPI_SERIES, { from, maxPoints: MONTHLY_MAX_POINTS }),
  ])
  if (!cs.ok) throw new Error(`statsChartSeries: ${CASE_SHILLER_SERIES} ${cs.reason}: ${cs.detail ?? ''}`)
  if (!cpi.ok) throw new Error(`statsChartSeries: ${CPI_SERIES} ${cpi.reason}: ${cpi.detail ?? ''}`)
  return { caseShiller: cs.data, cpi: cpi.data }
}

export const getNationalIndexSeries = makeResilientCached(
  fetchNationalIndexSeries,
  ['stats-national-index-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'stats-fred'] },
  null as NationalIndexSeries | null,
)
