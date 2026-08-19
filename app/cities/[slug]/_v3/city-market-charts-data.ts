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
 *  - Each row's native reading carries its population, labeled ("N active
 *    single-family", "N closed in 30 days"), with small samples named.
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
import { publishDaysFigure, publishDaysLabel } from '@/lib/market/publish-days-figure'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

/** Domain ceiling for the months-of-supply track (the chart-room scale). A
 *  degenerate row beyond it (36 months on 6 actives) draws clamped, in the
 *  exception ink, with its true reading. */
export const MOS_SCALE_MAX = 14

/** Small-sample floors the chart-room forms name in their readings. */
export const SMALL_ACTIVE_FLOOR = 10
export const SMALL_CLOSINGS_FLOOR = 5
export const SMALL_QUARTER_N_FLOOR = 30

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
  marks?: boolean
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
   * differ; every chart row names its own pulse population regardless.
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
        `${input.subjectName}-address universe; each row here names its own pulse city population.`
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
    displayLine: 'Months of supply by town, live single-family active listings.',
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(`${formatMonthsOfSupply(r.value)} mo`),
      note: v3Text(
        `${r.town.active_count.toLocaleString('en-US')} active single-family · ` +
          `${(r.town.sold_count_30d ?? 0).toLocaleString('en-US')} closed in 30 days` +
          (r.town.active_count < SMALL_ACTIVE_FLOOR ? ' · small sample' : ''),
      ),
    })),
    bands: [
      { from: 0, to: 4, label: v3Text("Seller's ≤4") },
      { from: 4, to: 6, label: v3Text('4–6') },
      { from: 6, to: 99, label: v3Text("Buyer's ≥6") },
    ],
    clampMax: MOS_SCALE_MAX,
    source:
      `market_pulse_live city rows, single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` +
      (bound
        ? ` The ${input.subjectName} row is the same published figure as the verdict above.`
        : universeSplit) +
      ` A row beyond ${MOS_SCALE_MAX} months draws at the edge of the scale with its true reading.`,
    updatedAt: maxUpdatedAt(rows.map((r) => r.town)),
  }
}

/** Days-to-pending lollipop vs peers. */
export function buildDtpCard(input: CityRankInput): CityChartCard | null {
  const omitted: string[] = []
  const rows = input.towns
    .map((t) => {
      const value = isSubject(t, input)
        ? (input.publishedDtp ?? t.median_days_to_pending)
        : t.median_days_to_pending
      if (value == null || !(value > 0)) {
        omitted.push(t.geo_label)
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
    displayLine: 'Median days to pending by town, live single-family listings.',
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(publishDaysLabel(r.value) ?? `${r.value} days`),
      note: v3Text(
        `${(r.town.sold_count_30d ?? 0).toLocaleString('en-US')} closed in 30 days` +
          ((r.town.sold_count_30d ?? 0) < SMALL_CLOSINGS_FLOOR ? ' · small sample' : ''),
      ),
    })),
    source:
      `market_pulse_live city rows, single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      'Median days from listing to an accepted offer, measured on homes that went under contract.' +
      (omitted.length > 0
        ? ` Omitted, no closings in the window so the median is undefined: ${omitted.sort().join(', ')}.`
        : ''),
    updatedAt: maxUpdatedAt(rows.map((r) => r.town)),
  }
}

/** Price-cut share by town with the region reference rule. */
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
    .sort((a, b) => b.value - a.value || b.town.active_count - a.town.active_count)
  if (rows.length < 2) return null
  const subject = rows.find((r) => isSubject(r.town, input))
  if (!subject) return null

  const regionShare = input.region?.price_reduction_share
  const regionPct = regionShare != null && regionShare >= 0 ? regionShare : null
  const townActive = rows.reduce((n, r) => n + r.town.active_count, 0)

  return {
    key: 'cuts',
    kind: 'range',
    title: `${subject.value.toFixed(1)}% of ${input.subjectName} actives cut`,
    displayLine: 'Share of active single-family listings with a price cut, by town.',
    rows: rows.map((r) => ({
      tick: v3Text(r.town.geo_label),
      value: r.value,
      label: v3Text(`${r.value.toFixed(1)}%`),
      note: v3Text(
        `${r.value.toFixed(1)}% of ${r.town.active_count.toLocaleString('en-US')} active single-family` +
          (r.town.active_count < SMALL_ACTIVE_FLOOR ? ' · small sample' : ''),
      ),
    })),
    ...(regionPct != null
      ? { refValue: regionPct, refLabel: `Region ${regionPct.toFixed(1)}%` }
      : {}),
    source:
      `market_pulse_live city rows${input.region ? ' and the central-oregon region row' : ''}, ` +
      `single-family (${methodologyStamp(rows.map((r) => r.town))}). ` +
      'Share of active listings with at least one price drop.' +
      (regionPct != null && input.region
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
    rows: pairs.map((p) => ({
      tick: v3Text(p.city),
      value: p.currentMedian * 100,
      label: v3Text(`${(p.currentMedian * 100).toFixed(1)}%`),
      baseValue: p.priorMedian * 100,
      baseLabel: v3Text(`${(p.priorMedian * 100).toFixed(1)}%`),
      note: v3Text(
        `Q${q} ${cur} n=${p.currentClosings} · Q${q} ${prior} n=${p.priorClosings}` +
          (p.currentClosings < SMALL_QUARTER_N_FLOOR || p.priorClosings < SMALL_QUARTER_N_FLOOR
            ? ' · small sample'
            : ''),
      ),
    })),
    refValue: 100,
    refLabel: 'Full ask',
    rangeKeyLabel: `Q${q} ${cur}`,
    rangeBaseKeyLabel: `Q${q} ${prior}`,
    source:
      `sale_pricing_facts detached closes, aggregated by the city_quarter_sale_to_ask function. ` +
      `Median sale price as a share of the original ask, Q${q} ${prior} vs Q${q} ${cur} — ` +
      `the latest quarter complete in both years. Towns with at least ` +
      `${MIN_CLOSINGS_PER_QUARTER} closings on each side; close price 0.1–10x of last ask, 300+ sqft.`,
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

  return {
    key: 'year',
    kind: 'line',
    marks: true,
    title: `${opts.subjectName} median ${multiple.toFixed(1)}x since ${first.year}`,
    displayLine: `Median detached close price per year, ${first.year}–${last.year}.`,
    series: [
      {
        name: v3Text(`${opts.subjectName} median close`),
        points: rows.map((r) => ({
          value: r.medianClose!,
          tick: v3Text(String(r.year)),
          label: v3Text(`$${Math.round(r.medianClose!).toLocaleString('en-US')}`),
          at: r.year,
        })),
      },
    ],
    source:
      `sale_pricing_facts detached closes, aggregated by the city_year_pricing function. ` +
      `Median close price per calendar year, years with at least 3 closings; ` +
      `${opts.currentYear} is still in progress and not charted. ` +
      `Close price 0.1–10x of last ask, 300+ sqft.`,
    updatedAt: opts.factsAsOf,
  }
}
