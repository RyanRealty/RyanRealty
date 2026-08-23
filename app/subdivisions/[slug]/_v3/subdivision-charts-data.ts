/**
 * Row + finding shaping for the plat page's chart-room cards. Pure: nothing
 * here fetches or reads the clock. The server component
 * (SubdivisionMarketCharts.tsx) reads through the DAL and hands rows in, and
 * every card renders through the V3Chart series atom.
 *
 * REGISTRY §4: subdivision publishes counts and individual sales, never a
 * price statistic. A count of two is exactly two. A median through a one-sale
 * year is not a market reading, and neither is a median through a thick year
 * whose closed side is an MLS SubdivisionName join rather than membership.
 * Price lines, vs-area median cards, and peer median ranks stay off this grain.
 */

import { v3Text, type V3ChartCardProps, type V3ChartPoint } from '@/components/site/v3'
import type { MartAnnualPoint } from '@/lib/data/analytics/getCoMarketAnnual'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'

/** Peers a rank card needs, subject included, before the ranking says anything. */
export const MIN_PEER_ROWS = 3

type PlatYear = {
  year: number
  closedCount: number
}

const n = (value: number) => value.toLocaleString('en-US')

/** Complete years only, ascending. The in-progress year is not a year. */
function completeYears(
  history: readonly SubdivisionSalesYear[],
  currentYear: number,
): PlatYear[] {
  return history
    .filter((r) => r.year < currentYear && r.closedCount > 0)
    .map((r) => ({ year: r.year, closedCount: r.closedCount }))
    .sort((a, b) => a.year - b.year)
}

const PLAT_SOURCE_CLAUSE =
  'Supabase listings through the get_subdivision_sales_history function: ' +
  "single-family closed sales (PropertyType 'A', status closed, a close date and a close price) " +
  'whose MLS subdivision name slugs to this plat, grouped by close year. ' +
  'REGISTRY: this grain publishes counts, not a closed-sale median.'

/* ------------------------------------------------------------------ */
/* Card 1 — the plat's own record: homes sold by year                  */
/* ------------------------------------------------------------------ */

export function buildPlatHistoryCard(
  history: readonly SubdivisionSalesYear[],
  opts: { platName: string; currentYear: number },
): V3ChartCardProps | undefined {
  const years = completeYears(history, opts.currentYear)
  if (years.length < 2) return undefined

  const first = years[0]!
  const last = years[years.length - 1]!
  const totalClosed = years.reduce((sum, r) => sum + r.closedCount, 0)
  const window = `${first.year} to ${last.year}`

  const soldPoints: V3ChartPoint[] = years.map((r) => ({
    value: r.closedCount,
    tick: v3Text(String(r.year)),
    label: v3Text(`${n(r.closedCount)} sold`),
    at: r.year,
  }))

  const progressClause = history.some((r) => r.year === opts.currentYear && r.closedCount > 0)
    ? ` ${opts.currentYear} is still in progress and is not charted.`
    : ''

  return {
    id: 'plat-history',
    title: v3Text(`${n(totalClosed)} sales, ${window}`),
    line: v3Text('Single-family homes sold each year.'),
    source: v3Text(
      `${PLAT_SOURCE_CLAUSE} ${n(totalClosed)} closings across ${n(years.length)} years, ${window}.` +
        progressClause +
        ' No median price is charted.',
    ),
    wide: true,
    chart: {
      caption: v3Text(`Single-family homes sold each year in ${opts.platName}, ${window}`),
      kind: 'bars',
      run: true,
      baselineLabel: v3Text('0'),
      series: [{ name: v3Text('Homes sold'), points: soldPoints }],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Card 2 — vs-area median. Withheld: a price statistic at this grain. */
/* ------------------------------------------------------------------ */

export type AreaSeries = {
  label: string
  slug: string
  kind: 'city' | 'region'
  rows: readonly MartAnnualPoint[]
}

export function buildPlatVsAreaCard(
  _history: readonly SubdivisionSalesYear[],
  _area: AreaSeries,
  _opts: { platName: string; currentYear: number },
): V3ChartCardProps | undefined {
  return undefined
}

/* ------------------------------------------------------------------ */
/* Card 3 — this plat among its siblings, ranked by closed count       */
/* ------------------------------------------------------------------ */

export type PeerPlatRow = {
  slug: string
  name: string
  soldCount: number
}

export type PeerStamp = {
  parentLabel: string
  unnamedCount: number
  periodStart: string | null
  periodEnd: string | null
  methodologyVersion: string | null
  computedAt: string | null
}

export function buildPeerPlatsCard(
  peers: readonly PeerPlatRow[],
  subjectSlug: string,
  stamp: PeerStamp,
): V3ChartCardProps | undefined {
  const withSales = peers
    .filter((p) => p.soldCount > 0)
    .sort((a, b) => b.soldCount - a.soldCount || a.name.localeCompare(b.name))
  if (withSales.length < MIN_PEER_ROWS) return undefined

  const index = withSales.findIndex((p) => p.slug === subjectSlug)
  if (index < 0) return undefined
  const subject = withSales[index]!

  const title =
    index === 0
      ? `Most sales in ${stamp.parentLabel}`
      : index === withSales.length - 1
        ? `Fewest sales in ${stamp.parentLabel}`
        : `${n(subject.soldCount)} sales year to date`

  const window =
    stamp.periodStart && stamp.periodEnd ? `${stamp.periodStart} to ${stamp.periodEnd}` : 'year to date'
  const unnamedClause =
    stamp.unnamedCount > 0
      ? ` ${n(stamp.unnamedCount)} carry an MLS token that is not a place name and are left out entirely.`
      : ''

  return {
    id: 'plat-peers',
    title: v3Text(title),
    line: v3Text(`Homes sold year to date by plat in ${stamp.parentLabel}.`),
    source: v3Text(
      `market_stats_cache rows, geo_type subdivision, period_type ytd, window ${window}` +
        (stamp.methodologyVersion ? `, methodology ${stamp.methodologyVersion}` : '') +
        '. Single-family closed sales matched on city and MLS subdivision name, one row per plat. Count only; REGISTRY does not publish a plat median.' +
        ` ${n(withSales.length)} of the ${n(peers.length)} named ${stamp.parentLabel} plats closed a sale in the window and are charted.` +
        ` The rest closed no single-family sale in the window.` +
        unnamedClause +
        ` ${subject.name}: ${n(subject.soldCount)} closings.`,
    ),
    wide: true,
    chart: {
      caption: v3Text(`Homes sold year to date by plat in ${stamp.parentLabel}, single-family`),
      kind: 'range',
      sampleKey: v3Text('closings year to date'),
      rows: withSales.map((p) => ({
        tick: v3Text(p.name),
        value: p.soldCount,
        label: v3Text(n(p.soldCount)),
        sample: { n: p.soldCount },
      })),
    },
  }
}
