/**
 * Row + caption shaping for the city page's town charts — the approved
 * chart-room rank forms (months-of-supply threshold bands, days-to-pending
 * lollipop, price-cut share vs the region, sale-to-ask dumbbell) plus the
 * city's median-close-by-year line. Pure: nothing here fetches; the server
 * component (city-market-charts.tsx) fetches through the DAL and hands rows
 * in. Everything renders through the V3Chart series atom — no new chart
 * component, no second geometry.
 *
 * SECTION 0 RULES THIS FILE ENCODES:
 *  - Titles are findings DERIVED from the rows ("Bend tightest at 3.5
 *    months"), never hand-written copy that data drift can falsify.
 *  - The subject city's months-of-supply row is BOUND to the same published
 *    figure the HUD verdict pill stamps (publishMonthsOfSupply output). When
 *    that publish gate withholds the figure, the whole chart is withheld —
 *    a chart must not print the number the pill refused.
 *  - A COUNT MAY ONLY SIT BESIDE A FIGURE WHEN IT IS THE POPULATION THAT
 *    FIGURE WAS COMPUTED OVER. Checked against the shipped
 *    refresh_market_pulse definition on 2026-08-19, and three of the four
 *    rank cards here fail that test, so they publish NO sample size:
 *      months of supply   actives / (closings in 180 days / 6). The row
 *                         publishes actives and closings in 30 and 90 days —
 *                         never the 180-day denominator. Half a ratio is not
 *                         its population.
 *      days to pending    median over closings in NINETY days that carry a
 *                         list-to-pending value, withheld under five of them.
 *                         sold_count_30d is a different window (Bend 163 vs
 *                         490); sold_count_90d is a superset of the measured
 *                         set, not the set.
 *      price-cut share    divides by actives PLUS active-under-contract.
 *                         active_count excludes active-under-contract, so it
 *                         is the wrong denominator (Bend 471 vs the 481 the
 *                         published 6.65% actually divided by).
 *    Their traces state the window and the floor instead — CLAUDE.md §0 rule
 *    7: cut the number, never approximate it. The sale-to-ask card DOES
 *    publish its n, because city_quarter_sale_to_ask returns count(*) and the
 *    median over the same grouped rows with no further filter.
 *  - Every card ships a full trace for its collapsed Source disclosure:
 *    table, filter, methodology stamp ON the rows, vintages.
 */

import { v3Text, type V3ChartBand, type V3ChartRangeRow, type V3ChartSeries } from '@/components/site/v3'
import type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'
import type { CityYearPricingRow } from '@/lib/data/pricing/getCityYearPricing'
import {
  MIN_CLOSINGS_PER_QUARTER,
  type CityQuarterPair,
} from '@/lib/data/pricing/getCityQuarterSaleToAsk'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { moneyTicks, yearTicks } from '@/lib/charts/ticks'
import { publishDaysFigure, publishDaysLabel } from '@/lib/market/publish-days-figure'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

/** Domain ceiling for the months-of-supply track (the chart-room scale). A
 *  degenerate row beyond it (36 months on 6 actives) draws clamped, in the
 *  exception ink, with its true reading. */
export const MOS_SCALE_MAX = 14

/** Small-sample floors the chart-room forms name in their readings. */
export const SMALL_ACTIVE_FLOOR = 10
export const SMALL_QUARTER_N_FLOOR = 30

/**
 * The publication floor market_pulse_live itself applies to
 * median_days_to_pending: under five measured closings in the 90-day window
 * the row stores NULL. Stated in the card's trace so a reader knows why a
 * town is missing, since the count behind it is not published.
 */
export const PULSE_DTP_FLOOR = 5

/** The window market_pulse_live measures days-to-pending in. */
export const PULSE_DTP_WINDOW_DAYS = 90

export type CityChartCard = {
  key: string
  /** The finding, derived from the rows. At most six words. */
  title: string
  /** One plain line under the title. At most fourteen words. */
  displayLine: string
  /** Full section 0 trace for the collapsed Source disclosure. */
  source: string
  updatedAt: string | null
  rows?: V3ChartRangeRow[]
  series?: V3ChartSeries[]
  kind: 'range' | 'line'
  bands?: V3ChartBand[]
  clampMax?: number
  refValue?: number
  refLabel?: string
  rangeKeyLabel?: string
  rangeBaseKeyLabel?: string
  /** Names what the rows' sample counts. Required when any row carries one. */
  sampleKey?: string
  marks?: boolean
  /** Line cards only: gridlines and axis labels, already formatted. */
  yTicks?: { value: number; label: string }[]
  xTicks?: { at: number; label: string }[]
}

export type CityRankInput = {
  towns: readonly MarketPulseSnapshot[]
  region: MarketPulseSnapshot | null
  /** market_pulse_live geo_slug form (space-separated) for the subject city. */
  subjectGeoSlug: string
  subjectName: string
  /** The HUD's published months of supply (publishMonthsOfSupply output). */
  publishedMos: number | null
  /** The pulse median-days-to-pending the HUD prints. */
  publishedDtp: number | null
  /**
   * The inventory count the page prints (publishCityInventory output —
   * usually the broader city-ADDRESS tile universe, not the pulse city
   * count). Used only to NAME the universe split in the trace when the two
   * differ; every chart row is computed on its own pulse population regardless.
   */
  displayedActiveCount?: number | null
}

function maxUpdatedAt(rows: readonly MarketPulseSnapshot[]): string | null {
  let max: string | null = null
  for (const r of rows) {
    if (r.updated_at && (max == null || r.updated_at > max)) max = r.updated_at
  }
  return max
}

function methodologyStamp(rows: readonly MarketPulseSnapshot[]): string {
  const stamps = new Set(rows.map((r) => r.methodology_version).filter((v): v is string => !!v))
  if (stamps.size === 0) return 'methodology unstamped'
  return `methodology ${[...stamps].sort().join(' / ')}`
}

function isSubject(row: MarketPulseSnapshot, input: CityRankInput): boolean {
  return row.geo_slug.trim().toLowerCase() === input.subjectGeoSlug.trim().toLowerCase()
}

/**
 * Months of supply by town, threshold bands. The subject row BINDS to the
 * HUD's published figure whenever the publish gate released one — never a
 * second computation beside the pill. When the gate withheld it (the page's
 * inventory count uses the broader city-ADDRESS universe, so pulse MoS may
 * not sit beside that number under one label — publishMonthsOfSupply), the
 * chart still stands: every row here is the pulse city population, named in
 * its own reading, and the trace names the universe split. One trace per
 * population, counts labeled by population (place-page section 0 rules).
 */
export function buildMosCard(input: CityRankInput): CityChartCard | null {
  const bound = input.publishedMos != null && input.publishedMos > 0
  const rows = input.towns
    .map((t) => {
      const value =
        isSubject(t, input) && bound ? input.publishedMos! : t.months_of_supply
      if (value == null || !(value > 0)) return null
      return { town: t, value }
    })
    .filter((r): r is { town: MarketPulseSnapshot; value: number } => r != null)
    .sort((a, b) => a.value - b.value)
  if (rows.length < 2) return null
  if (!rows.some((r) => isSubject(r.town, input))) return null

  const subject = rows.find((r) => isSubject(r.town, input))!
  const universeSplit =
    input.displayedActiveCount != null &&
    input.displayedActiveCount !== subject.town.active_count
      ? ` The page's inventory count (${input.displayedActiveCount.toLocaleString('en-US')}) uses the broader ` +
        `${input.subjectName}-address universe; each row here is computed on its own pulse city population.`
      : ''
  const fmt = formatMonthsOfSupply(subject.value)
  const title =
    rows[0] === subject
      ? `${input.subjectName} tightest at ${fmt} months`
      : `${input.subjectName} supply: ${fmt} months`

  return {
    key: 'mos',
    kind: 'range',
    title,
    displayLine: 'Months of supply by town, leftover membership, single-family.',
    // No sample size, and no count in the reading. The published ratio is
    // actives over closings-in-180-days-divided-by-six; the row publishes the
    // numerator and two closing windows that are not the denominator. Naming
    // either half as "the population" would tell a reader a thin town's
    // reading is sturdier than it is. The trace carries the method instead.
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(`${formatMonthsOfSupply(r.value)} mo`),
      ...(r.town.active_count != null && r.town.active_count < SMALL_ACTIVE_FLOOR
        ? { note: v3Text('small active inventory') }
        : {}),
    })),
    bands: [
      { from: 0, to: 4, label: v3Text("Seller's ≤4") },
      { from: 4, to: 6, label: v3Text('4–6') },
      { from: 6, to: 99, label: v3Text("Buyer's ≥6") },
    ],
    clampMax: MOS_SCALE_MAX,
    source:
      `Leftover membership city rows, single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` +
      ` No sample size is drawn: the ratio rests on two populations, the actives ` +
      `and the six months of closings under them, and the cache publishes only ` +
      `the actives. A town with fewer than ${SMALL_ACTIVE_FLOOR} active listings ` +
      `is marked as a small active inventory.` +
      (bound
        ? ` The ${input.subjectName} row is the same published figure as the verdict above.`
        : universeSplit) +
      ` A row beyond ${MOS_SCALE_MAX} months draws at the edge of the scale with its true reading.`,
    updatedAt: maxUpdatedAt(rows.map((r) => r.town)),
  }
}

/**
 * Days-to-pending lollipop vs peers.
 *
 * No sample size is drawn. The published median is taken over closings in the
 * last 90 days that carry a list-to-pending measurement; the row publishes a
 * 30-day closing count (a different window: Bend 163 against 490) and a
 * 90-day closing count (a superset of the measured set, since the aggregate
 * filters again for a non-null measurement). Neither is the population, so
 * per §0 rule 7 neither is printed. The trace states the window and the floor.
 */
export function buildDtpCard(input: CityRankInput): CityChartCard | null {
  /** A town with no median, split by WHY — the two reasons are not the same
   *  claim about the world, and one sentence covering both is false for one
   *  of them. Metolius closed 4 homes in the window and is withheld by the
   *  floor; saying it had no closings is a fabrication. */
  const noClosings: string[] = []
  const belowFloor: string[] = []
  const rows = input.towns
    .map((t) => {
      const value = isSubject(t, input)
        ? (input.publishedDtp ?? t.median_days_to_pending)
        : t.median_days_to_pending
      if (value == null || !(value > 0)) {
        if ((t.sold_count_90d ?? 0) > 0) belowFloor.push(t.geo_label)
        else noClosings.push(t.geo_label)
        return null
      }
      return { town: t, value }
    })
    .filter((r): r is { town: MarketPulseSnapshot; value: number } => r != null)
    .sort((a, b) => a.value - b.value)
  if (rows.length < 2) return null
  const subject = rows.find((r) => isSubject(r.town, input))
  if (!subject) return null

  return {
    key: 'dtp',
    kind: 'range',
    title: `${input.subjectName} pends in ${publishDaysFigure(subject.value)} days`,
    displayLine: 'Median days to pending by town, leftover 90-day list-to-pending.',
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(publishDaysLabel(r.value) ?? `${r.value} days`),
    })),
    source:
      `Leftover membership city rows, single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      `Median days from listing to an accepted offer, measured on leftover houses that closed in the ` +
      `last ${PULSE_DTP_WINDOW_DAYS} days and carry a list-to-pending measurement. A town with ` +
      `fewer than ${PULSE_DTP_FLOOR} of those is withheld by the cache. No sample size is drawn ` +
      `beside these rows: the count of measured closings is not published, and the counts that ` +
      `are published cover other windows.` +
      (belowFloor.length > 0
        ? ` Withheld under the ${PULSE_DTP_FLOOR}-closing floor: ${belowFloor.sort().join(', ')}.`
        : '') +
      (noClosings.length > 0
        ? ` Omitted, no closings in the ${PULSE_DTP_WINDOW_DAYS}-day window: ${noClosings.sort().join(', ')}.`
        : ''),
    updatedAt: maxUpdatedAt(rows.map((r) => r.town)),
  }
}

/**
 * Price-cut share by town with the region reference rule.
 *
 * No sample size is drawn, and the reading no longer says "of N active".
 * refresh_market_pulse divides the cut count by actives PLUS coming-soon PLUS
 * active-under-contract, while `active_count` counts only actives and coming
 * soon. Live 2026-08-19: Bend's 6.65% is 32 of 481, and the row publishes 471.
 * The denominator is not published, so it is not printed.
 */
export function buildCutsCard(input: CityRankInput): CityChartCard | null {
  // price_reduction_share is stored as a PERCENT on market_pulse_live
  // (Bend 6.6 = 6.6% — verified live 2026-08-19), not a fraction.
  const rows = input.towns
    .map((t) => {
      const share = t.price_reduction_share
      if (share == null || share < 0) return null
      return { town: t, value: share }
    })
    .filter((r): r is { town: MarketPulseSnapshot; value: number } => r != null)
    .sort((a, b) => b.value - a.value || (b.town.active_count ?? -1) - (a.town.active_count ?? -1))
  if (rows.length < 2) return null
  const subject = rows.find((r) => isSubject(r.town, input))
  if (!subject) return null

  const regionShare = input.region?.price_reduction_share
  const regionPct = regionShare != null && regionShare >= 0 ? regionShare : null
  const townActive = rows.reduce((n, r) => n + (r.town.active_count ?? 0), 0)

  return {
    key: 'cuts',
    kind: 'range',
    title: `${subject.value.toFixed(1)}% of ${input.subjectName} actives cut`,
    displayLine: 'Share of active single-family listings with a price cut, by town.',
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(`${r.value.toFixed(1)}%`),
      ...(r.town.active_count != null && r.town.active_count < SMALL_ACTIVE_FLOOR
        ? { note: v3Text('small active inventory') }
        : {}),
    })),
    ...(regionPct != null
      ? { refValue: regionPct, refLabel: `Region ${regionPct.toFixed(1)}%` }
      : {}),
    source:
      `market_pulse_live city rows${input.region ? ' and the central-oregon region row' : ''}, ` +
      `single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      'Share of a town’s active, coming-soon, and active-under-contract single-family ' +
      'listings carrying at least one price drop. No sample size is drawn: that denominator ' +
      'is not published on the row, and the active count that is published excludes the ' +
      'under-contract listings the share divides by. A town with fewer than ' +
      `${SMALL_ACTIVE_FLOOR} active listings is marked as a small active inventory.` +
      (regionPct != null && input.region && input.region.active_count != null && townActive > 0
        ? ` The region rule is all Central Oregon single-family — ${input.region.active_count.toLocaleString('en-US')} actives, ` +
          `broader than the ${townActive.toLocaleString('en-US')} actives across the ${rows.length} towns charted.`
        : ''),
    updatedAt: maxUpdatedAt(rows.map((r) => r.town)),
  }
}

/** Sale-to-original-ask dumbbell, same quarter across two years. */
export function buildStoCard(
  pairs: readonly CityQuarterPair[],
  opts: { subjectCitySlug: string; subjectName: string; factsAsOf: string | null },
): CityChartCard | null {
  if (pairs.length < 2) return null
  const subject = pairs.find((p) => p.citySlug === opts.subjectCitySlug)
  if (!subject) return null
  const q = subject.quarter
  const cur = subject.currentYear
  const prior = subject.priorYear

  return {
    key: 'sto',
    kind: 'range',
    title: `${opts.subjectName} at ${(subject.currentMedian * 100).toFixed(1)}% of ask`,
    displayLine: `Median sale-to-original-ask by town, detached closes, Q${q} ${prior} vs Q${q} ${cur}.`,
    // The one card here that CAN show its n. city_quarter_sale_to_ask returns
    // count(*) and percentile_cont over the same grouped rows with no further
    // filter, so `closings` is exactly the population each median was taken
    // over — on both sides of the pair.
    rows: pairs.map((p) => ({
      tick: v3Text(p.city),
      value: p.currentMedian * 100,
      label: v3Text(`${(p.currentMedian * 100).toFixed(1)}%`),
      baseValue: p.priorMedian * 100,
      baseLabel: v3Text(`${(p.priorMedian * 100).toFixed(1)}%`),
      sample: { n: p.currentClosings, baseN: p.priorClosings },
      ...(p.currentClosings < SMALL_QUARTER_N_FLOOR || p.priorClosings < SMALL_QUARTER_N_FLOOR
        ? { note: v3Text('small sample') }
        : {}),
    })),
    refValue: 100,
    refLabel: 'Full ask',
    rangeKeyLabel: `Q${q} ${cur}`,
    rangeBaseKeyLabel: `Q${q} ${prior}`,
    sampleKey: `detached closes, Q${q} ${cur} (Q${q} ${prior})`,
    source:
      `sale_pricing_facts detached closes, aggregated by the city_quarter_sale_to_ask function. ` +
      `Median sale price as a share of the original ask, Q${q} ${prior} vs Q${q} ${cur} — ` +
      `the latest quarter complete in both years. Towns with at least ` +
      `${MIN_CLOSINGS_PER_QUARTER} closings on each side; close price 0.1–10x of last ask, 300+ sqft. ` +
      `The n beside each row is the closings that median was computed over, current quarter first. ` +
      `A row under ${SMALL_QUARTER_N_FLOOR} closings on either side reads as a small sample.`,
    updatedAt: opts.factsAsOf,
  }
}

/** The city's median detached close price by complete year. */
export function buildYearCard(
  yearRows: readonly CityYearPricingRow[],
  opts: { subjectName: string; currentYear: number; factsAsOf: string | null },
): CityChartCard | null {
  const rows = yearRows
    .filter((r) => r.medianClose != null && r.medianClose > 0 && r.year < opts.currentYear)
    .sort((a, b) => a.year - b.year)
  if (rows.length < 2) return null
  const first = rows[0]!
  const last = rows[rows.length - 1]!
  const multiple = last.medianClose! / first.medianClose!
  const series: V3ChartSeries[] = [
    {
      name: v3Text(`${opts.subjectName} median close`),
      points: rows.map((r) => ({
        value: r.medianClose!,
        tick: v3Text(String(r.year)),
        label: v3Text(`$${Math.round(r.medianClose!).toLocaleString('en-US')}`),
        at: r.year,
      })),
    },
  ]

  return {
    key: 'year',
    kind: 'line',
    marks: true,
    // NO CLAIM on this card: the title is the claim ("Bend median 3.6x since
    // 2015"), computed from these same rows. The gridlines are compact money
    // because an axis of "$615,000" labels does not fit the plot's gutter —
    // every point keeps its exact reading in the hover and the data list.
    title: `${opts.subjectName} median ${multiple.toFixed(1)}x since ${first.year}`,
    displayLine: `Median detached close price per year, ${first.year}–${last.year}.`,
    series,
    yTicks: moneyTicks(series),
    xTicks: yearTicks(series),
    source:
      `sale_pricing_facts detached closes, aggregated by the city_year_pricing function. ` +
      `Median close price per calendar year, years with at least 3 closings; ` +
      `${opts.currentYear} is still in progress and not charted. ` +
      `Close price 0.1–10x of last ask, 300+ sqft.`,
    updatedAt: opts.factsAsOf,
  }
}
