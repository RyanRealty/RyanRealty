/**
 * Row + caption shaping for the neighborhood page's chart-room forms. Pure:
 * nothing here fetches. The server component (neighborhood-market-charts.tsx)
 * reads through the DAL and hands rows in. Everything draws through the
 * V3Chart series atom on lib/charts/plot geometry — no new chart component, no
 * second library.
 *
 * WHAT A BEND DISTRICT CAN HONESTLY SAY (verified live 2026-08-19, and the
 * reason this file is shorter than the city's):
 *
 *   market_pulse_live neighborhood rows exist (28 of them) but their CLOSED
 *   side is wrong at this grain. Awbrey Butte reads sold_count_30d = 1 and
 *   months_of_supply = 31.50 — that implies 12 closings in six months against
 *   a polygon-verified 75. Summit West reads 43.20 months against a real 3.6.
 *   So NOTHING here charts neighborhood months of supply, days to pending, or
 *   sold counts from the pulse. Cut, not estimated (CLAUDE.md §0).
 *
 *   market_stats_cache neighborhood rows under-count the same way: Awbrey
 *   Butte's trailing-year sold_count is 17 where the polygon says 138.
 *
 *   Two populations remain, and each is the one the page already publishes:
 *     ACTIVE  — getBendNeighborhoodPublicInventory (listing_boundary_xref_mv,
 *               SFR + PUBLIC_ACTIVE inside the recorded polygon). The page's
 *               own hero count and median list price come from this row, so a
 *               rank chart built on it cannot contradict the page.
 *     CLOSED  — neighborhood_year_pricing_mv (the same polygon assignment,
 *               1997 forward, identical to sale_pricing_facts detached under
 *               the same filters).
 *   They are never mixed under one label.
 *
 * Titles are FINDINGS derived from the rows, so data drift cannot falsify a
 * hand-written line. Each card ships its full §0 trace for the collapsed
 * Source disclosure.
 */

import {
  v3Text,
  type V3ChartRangeRow,
  type V3ChartSeries,
} from '@/components/site/v3'
import type { NeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import {
  ALL_BEND_DISTRICTS_SLUG,
  MIN_CLOSINGS_PER_YEAR,
  type NeighborhoodYearPricingRow,
} from '@/lib/data/geo/getNeighborhoodYearPricing'
import { formatPriceExact } from '@/lib/format/money'
import { customTicks, moneyTicks, windowClaim, yearTicks } from '@/lib/charts/ticks'

/** Closings under this floor get "small sample" in the row's reading. */
export const SMALL_YEAR_CLOSINGS_FLOOR = 10
/** Actives under this floor get "small sample" in the row's reading. */
export const SMALL_ACTIVE_FLOOR = 10
/** A base year thinner than this cannot anchor an index. */
export const MIN_INDEX_BASE_CLOSINGS = 10
/** Fewer years than this is not a series, and not a comparison. */
export const MIN_CHART_YEARS = 6

/** The §0 population clause every closed-side card repeats. */
export const CLOSED_POPULATION_CLAUSE =
  'neighborhood_year_pricing_mv. Closed single-family (property_type A, sub-type Single Family Residence) ' +
  'inside the recorded district polygon (public.boundaries, the same geometry as the map and the for-sale list), ' +
  'close price above zero, 300+ sqft, years with at least ' +
  `${MIN_CLOSINGS_PER_YEAR} closings.`

/** The §0 population clause the active-side card repeats. */
export const ACTIVE_POPULATION_CLAUSE =
  'listing_boundary_xref_mv. Active and active-under-contract single-family listings inside the recorded ' +
  'district polygon. The same read behind this page’s own count and median asking price.'

export type NeighborhoodChartCard = {
  key: string
  /** The finding, derived from the rows. At most six words. */
  title: string
  /** One plain line under the title. At most fourteen words. */
  displayLine: string
  /** Full §0 trace for the collapsed Source disclosure. */
  source: string
  /** Spans both grid columns. */
  wide?: boolean
  /** Single-view card. */
  view?: NeighborhoodChartView
  /** Segmented set of views of one population. */
  views?: { switchLabel: string; items: { key: string; label: string }[]; panels: NeighborhoodChartView[] }
}

export type NeighborhoodChartView = {
  caption: string
  kind: 'line' | 'bars' | 'range'
  series?: V3ChartSeries[]
  rows?: V3ChartRangeRow[]
  marks?: boolean
  run?: boolean
  baselineLabel?: string
  /**
   * One formatted sentence under the caption. Set on SWITCHER panels, where
   * one card title cannot describe several measures. A single-chart card
   * leaves it empty because there the title is already the claim.
   */
  claim?: string
  /** Line views only: gridlines and axis labels, already formatted. */
  yTicks?: { value: number; label: string }[]
  xTicks?: { at: number; label: string }[]
  /** Line views only: the subject series in ink, context series in tints. */
  emphasize?: 'first' | 'last'
  /**
   * Names what the rows' sample counts. Required by the atom whenever a row
   * carries one — a bare n names no population.
   */
  sampleKey?: string
}

function money(n: number): string {
  return formatPriceExact(Math.round(n))
}

/** Spread a claim only when the builder could write one. */
function claimOf(claim: string | undefined): { claim?: string } {
  return claim ? { claim } : {}
}

function ppsf(n: number): string {
  return `$${n.toFixed(0)} per sq ft`
}

function count(n: number): string {
  return n.toLocaleString('en-US')
}

/** Complete calendar years only, ascending. The running year is never charted. */
export function completeYears(
  rows: readonly NeighborhoodYearPricingRow[],
  currentYear: number,
): NeighborhoodYearPricingRow[] {
  return rows
    .filter((r) => r.year < currentYear && r.medianClose != null && r.medianClose > 0)
    .sort((a, b) => a.year - b.year)
}

/**
 * CARD 1 — this district's own closed history: median close, median $/sqft,
 * and homes sold, per complete year. Three views of ONE population, because
 * dollars and counts never share an axis; the control switches instead.
 */
export function buildDistrictHistoryCard(
  districtRows: readonly NeighborhoodYearPricingRow[],
  opts: { districtName: string; currentYear: number },
): NeighborhoodChartCard | null {
  const rows = completeYears(districtRows, opts.currentYear)
  if (rows.length < MIN_CHART_YEARS) return null
  const first = rows[0]!
  const last = rows[rows.length - 1]!
  const multiple = last.medianClose! / first.medianClose!
  const span = `${first.year}–${last.year}`

  const priceSeries: V3ChartSeries[] = [
    {
      name: v3Text(`${opts.districtName} median close`),
      points: rows.map((r) => ({
        value: r.medianClose!,
        tick: v3Text(String(r.year)),
        label: v3Text(money(r.medianClose!)),
        at: r.year,
      })),
    },
  ]

  const ppsfRows = rows.filter((r) => r.medianPpsf != null && r.medianPpsf > 0)
  const ppsfSeries: V3ChartSeries[] = [
    {
      name: v3Text(`${opts.districtName} median price per sq ft`),
      points: ppsfRows.map((r) => ({
        value: r.medianPpsf!,
        tick: v3Text(String(r.year)),
        label: v3Text(ppsf(r.medianPpsf!)),
        at: r.year,
      })),
    },
  ]

  const soldSeries: V3ChartSeries[] = [
    {
      name: v3Text(`${opts.districtName} homes sold`),
      points: rows.map((r) => ({
        value: r.closings,
        tick: v3Text(String(r.year)),
        label: v3Text(`${count(r.closings)} sold`),
        at: r.year,
      })),
    },
  ]

  // Every panel of a switcher states its own claim, computed off that panel's
  // own series: the card's one title cannot say what three measures are doing,
  // and the reader needs to know which measure is on screen.
  const panels: NeighborhoodChartView[] = [
    {
      caption: `Median close price per year, ${span}`,
      kind: 'line',
      marks: true,
      series: priceSeries,
      ...claimOf(windowClaim({ metric: 'Median close price', unit: 'money', series: priceSeries })),
      yTicks: moneyTicks(priceSeries),
      xTicks: yearTicks(priceSeries),
    },
  ]
  const items = [{ key: 'price', label: 'Price' }]
  if (ppsfRows.length >= MIN_CHART_YEARS) {
    panels.push({
      caption: `Median close price per square foot per year, ${span}`,
      kind: 'line',
      marks: true,
      series: ppsfSeries,
      // `value` without the "per sq ft" the metric name already carries.
      ...claimOf(
        windowClaim({
          metric: 'Median price per square foot',
          unit: 'money',
          series: ppsfSeries,
          value: `$${ppsfRows[ppsfRows.length - 1]!.medianPpsf!.toFixed(0)}`,
        }),
      ),
      yTicks: customTicks(ppsfSeries, (v) => ppsf(v)),
      xTicks: yearTicks(ppsfSeries),
    })
    items.push({ key: 'ppsf', label: 'Per sq ft' })
  }
  panels.push({
    caption: `Single-family homes sold per year, ${span}`,
    kind: 'bars',
    run: true,
    baselineLabel: v3Text('0 sold'),
    series: soldSeries,
    ...claimOf(
      windowClaim({
        metric: 'Homes sold',
        unit: 'count',
        series: soldSeries,
        value: count(last.closings),
      }),
    ),
  })
  items.push({ key: 'sold', label: 'Homes sold' })

  return {
    key: 'history',
    wide: true,
    title: `${opts.districtName} median ${multiple.toFixed(1)}x since ${first.year}`,
    displayLine: `Every complete year of single-family closings inside the ${opts.districtName} boundary.`,
    views: { switchLabel: 'Measure', items, panels },
    source:
      `${CLOSED_POPULATION_CLAUSE} ${first.year}: ${count(first.closings)} closings, median ` +
      `${money(first.medianClose!)}. ${last.year}: ${count(last.closings)} closings, median ` +
      `${money(last.medianClose!)}. ${opts.currentYear} is still running and is not charted.`,
  }
}

/**
 * CARD 2 — this district against all thirteen, both indexed to the same base
 * year. One source, one method, so the two lines are comparable; the index
 * removes the price level so the shape is the only thing being read.
 */
export function buildIndexedCard(
  districtRows: readonly NeighborhoodYearPricingRow[],
  allDistrictRows: readonly NeighborhoodYearPricingRow[],
  opts: { districtName: string; allLabel: string; currentYear: number },
): NeighborhoodChartCard | null {
  const mine = completeYears(districtRows, opts.currentYear)
  const all = completeYears(allDistrictRows, opts.currentYear)
  if (mine.length < MIN_CHART_YEARS || all.length < MIN_CHART_YEARS) return null

  const allByYear = new Map(all.map((r) => [r.year, r]))
  const common = mine.filter((r) => allByYear.has(r.year))
  if (common.length < MIN_CHART_YEARS) return null

  const baseRow =
    common.find(
      (r) =>
        r.closings >= MIN_INDEX_BASE_CLOSINGS &&
        (allByYear.get(r.year)?.closings ?? 0) >= MIN_INDEX_BASE_CLOSINGS,
    ) ?? common[0]!
  const baseYear = baseRow.year
  const mineBase = baseRow.medianClose!
  const allBase = allByYear.get(baseYear)!.medianClose!
  const window = common.filter((r) => r.year >= baseYear)
  if (window.length < MIN_CHART_YEARS) return null

  const lastYear = window[window.length - 1]!.year
  const mineLast = window[window.length - 1]!.medianClose!
  const allLast = allByYear.get(lastYear)!.medianClose!
  const mineMultiple = mineLast / mineBase
  const allMultiple = allLast / allBase

  const index = (value: number, base: number) => (value / base) * 100

  const series: V3ChartSeries[] = [
    {
      name: v3Text(opts.districtName),
      points: window.map((r) => ({
        value: index(r.medianClose!, mineBase),
        tick: v3Text(String(r.year)),
        label: v3Text(index(r.medianClose!, mineBase).toFixed(0)),
        at: r.year,
      })),
    },
    {
      name: v3Text(opts.allLabel),
      points: window.map((r) => {
        const row = allByYear.get(r.year)!
        return {
          value: index(row.medianClose!, allBase),
          tick: v3Text(String(r.year)),
          label: v3Text(index(row.medianClose!, allBase).toFixed(0)),
          at: r.year,
        }
      }),
    },
  ]

  return {
    key: 'indexed',
    wide: true,
    title: `${mineMultiple.toFixed(1)}x here, ${allMultiple.toFixed(1)}x across Bend`,
    displayLine: `Median close indexed to ${baseYear} = 100, this district against all thirteen.`,
    view: {
      // NO CLAIM: the title states both multiples off these same points.
      // `emphasize: 'first'` puts this district in full ink and the
      // thirteen-district line behind it as context, which is the TASTE
      // emphasis pattern for a subject-against-context chart.
      caption: `Median close price indexed to ${baseYear} = 100, ${baseYear}–${lastYear}`,
      kind: 'line',
      marks: true,
      series,
      emphasize: 'first',
      yTicks: customTicks(series, (v) => v.toFixed(0)),
      xTicks: yearTicks(series),
    },
    source:
      `${CLOSED_POPULATION_CLAUSE} Both lines come from that one table. ${opts.allLabel} is the union of the ` +
      `thirteen recorded Bend districts, which is narrower than the city of Bend: a Bend address outside every ` +
      `district polygon is not in it. ${baseYear} base: ${opts.districtName} ${money(mineBase)} over ` +
      `${count(baseRow.closings)} closings, ${opts.allLabel} ${money(allBase)} over ` +
      `${count(allByYear.get(baseYear)!.closings)}. ${lastYear}: ${money(mineLast)} and ${money(allLast)}.`,
  }
}

/**
 * CARD 3 — median close by district for the latest complete year the subject
 * has. Rank across the thirteen, same source and same method as card 1.
 */
export function buildClosedRankCard(
  rows: readonly NeighborhoodYearPricingRow[],
  opts: { subjectGeoSlug: string; districtName: string; currentYear: number },
): NeighborhoodChartCard | null {
  const complete = rows.filter(
    (r) =>
      r.geoSlug !== ALL_BEND_DISTRICTS_SLUG &&
      r.year < opts.currentYear &&
      r.medianClose != null &&
      r.medianClose > 0,
  )
  const subjectYears = complete
    .filter((r) => r.geoSlug === opts.subjectGeoSlug)
    .sort((a, b) => b.year - a.year)
  const year = subjectYears[0]?.year
  if (year == null) return null

  const yearRows = complete
    .filter((r) => r.year === year)
    .sort((a, b) => b.medianClose! - a.medianClose!)
  if (yearRows.length < 2) return null
  const rank = yearRows.findIndex((r) => r.geoSlug === opts.subjectGeoSlug)
  if (rank < 0) return null

  return {
    key: 'closed-rank',
    title: `${ordinal(rank + 1)} of ${yearRows.length} by ${year} median`,
    displayLine: `Median close price by Bend district, ${year}.`,
    view: {
      caption: `Median close price by Bend district, ${year}`,
      kind: 'range',
      // neighborhood_year_pricing_mv takes count(*) and percentile_cont over
      // the same grouped rows with no further filter, so `closings` is exactly
      // the population this median was computed over — it can be drawn.
      sampleKey: `closings in ${year}`,
      rows: yearRows.map((r) => ({
        tick: v3Text(r.geoLabel),
        value: r.medianClose!,
        label: v3Text(money(r.medianClose!)),
        sample: { n: r.closings },
        ...(r.closings < SMALL_YEAR_CLOSINGS_FLOOR ? { note: v3Text('small sample') } : {}),
      })),
    },
    source:
      `${CLOSED_POPULATION_CLAUSE} ${year} is the latest complete year; the running year is excluded so a ` +
      `full year is never charted against a partial one. The n beside each row is the closings that ` +
      `district's median was computed over; under ${SMALL_YEAR_CLOSINGS_FLOOR} of them it reads as a ` +
      `small sample.`,
  }
}

/**
 * CARD 4 — median asking price by district, live. The ACTIVE population, and
 * the subject row is the same figure this page prints above.
 */
export function buildAskingRankCard(
  inventory: readonly NeighborhoodPublicInventory[],
  opts: { subjectGeoSlug: string; districtName: string },
): NeighborhoodChartCard | null {
  const rows = inventory
    .filter((r) => r.activeCount > 0 && r.medianListPrice != null && r.medianListPrice > 0)
    .sort((a, b) => b.medianListPrice! - a.medianListPrice!)
  if (rows.length < 2) return null
  const rank = rows.findIndex((r) => r.geoSlug === opts.subjectGeoSlug)
  if (rank < 0) return null
  const subject = rows[rank]!

  return {
    key: 'asking-rank',
    title: `Asking ${money(subject.medianListPrice!)}, ${ordinal(rank + 1)} of ${rows.length}`,
    displayLine: 'Median asking price of active single-family listings, by Bend district.',
    view: {
      caption: 'Median asking price by Bend district, live',
      kind: 'range',
      // The median is taken over the PRICED actives, so pricedCount is its
      // population. activeCount is a superset (it counts listings with no
      // usable price, which the median never saw) and is not drawn.
      sampleKey: 'priced active single-family listings',
      rows: rows.map((r) => ({
        tick: v3Text(r.label),
        value: r.medianListPrice!,
        label: v3Text(money(r.medianListPrice!)),
        sample: { n: r.pricedCount },
        ...(r.pricedCount < SMALL_ACTIVE_FLOOR ? { note: v3Text('small sample') } : {}),
      })),
    },
    source:
      `${ACTIVE_POPULATION_CLAUSE} A district with no priced active listing is omitted rather than drawn at ` +
      'zero. The n beside each row is the priced listings that median was computed over, which is at or ' +
      `below the district's active count; under ${SMALL_ACTIVE_FLOOR} of them it reads as a small sample. ` +
      'Asking prices are what sellers want today; the closed charts on this page are what buyers paid.',
  }
}

/** 1st, 2nd, 3rd, 4th … — plain English rank for a card title. */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
