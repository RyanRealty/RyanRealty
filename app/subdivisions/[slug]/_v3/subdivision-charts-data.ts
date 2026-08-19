/**
 * Row + finding shaping for the plat page's chart-room cards. Pure: nothing
 * here fetches or reads the clock. The server component
 * (SubdivisionMarketCharts.tsx) reads through the DAL and hands rows in, and
 * every card renders through the V3Chart series atom. No new chart component,
 * no second geometry (lib/charts/plot.ts).
 *
 * A PLAT IS A SMALL-SAMPLE GEOGRAPHY, AND THAT IS THIS FILE'S WHOLE PROBLEM.
 * Verified against production 2026-08-19: the busiest cached plat closed 43
 * single-family homes year to date, most closed six to sixteen, and in the
 * long history Kitty Hawk closes one to four homes a year with whole years
 * missing. A median drawn through a one-sale year is not a market reading, so
 * this file follows the treatment the approved rank fragment uses
 * (design_system/ryan-realty/ui_kits/chart-room/rank.fragment.html):
 *
 *   1. A year enters the MEDIAN line only with at least
 *      PLAT_MEDIAN_MIN_CLOSINGS closings. Thin years still enter the COUNT
 *      bars, because a count of two is exactly two.
 *   2. Every withheld year is named in the Source trace with the reason, the
 *      way the fragment names the towns whose median is undefined.
 *   3. Every rank row carries its population in its reading, and rows under
 *      the floor say "small sample" there.
 *   4. When a plat cannot clear the floor in enough years, the price view is
 *      withheld and the card ships the counts alone. Fewer charts, never an
 *      invented one (CLAUDE.md section 0).
 *
 * Titles are FINDINGS computed from the same rows the chart draws, so the
 * words cannot go stale against the line. Traces live in the collapsed Source
 * disclosure V3ChartCard renders, never as visible paragraphs (Matt
 * 2026-08-19).
 */

import {
  v3Text,
  type V3ChartCardProps,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartRangeRow,
} from '@/components/site/v3'
import type { MartAnnualPoint } from '@/lib/data/analytics/getCoMarketAnnual'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'

/**
 * Closings a single year needs before its median joins a price line. Five is
 * the same floor the city rank cards call a small sample
 * (SMALL_CLOSINGS_FLOOR in app/cities/[slug]/_v3/city-market-charts-data.ts).
 */
export const PLAT_MEDIAN_MIN_CLOSINGS = 5

/** Year-to-date closings under which a rank row is labeled a small sample. */
export const SMALL_PEER_SOLD_FLOOR = 10

/** Years both series must share before a plat-against-area line is drawn. */
export const MIN_COMPARE_YEARS = 3

/** Peers a rank card needs, subject included, before the ranking says anything. */
export const MIN_PEER_ROWS = 3

type PlatYear = {
  year: number
  closedCount: number
  medianClosePrice: number | null
}

const n = (value: number) => value.toLocaleString('en-US')

/** Complete years only, ascending. The in-progress year is not a year. */
function completeYears(
  history: readonly SubdivisionSalesYear[],
  currentYear: number,
): PlatYear[] {
  return history
    .filter((r) => r.year < currentYear && r.closedCount > 0)
    .map((r) => ({
      year: r.year,
      closedCount: r.closedCount,
      medianClosePrice:
        r.medianClosePrice != null && r.medianClosePrice > 0 ? r.medianClosePrice : null,
    }))
    .sort((a, b) => a.year - b.year)
}

/** The years whose median is thick enough to plot. */
function medianYears(years: readonly PlatYear[]): Array<PlatYear & { medianClosePrice: number }> {
  return years.filter(
    (r): r is PlatYear & { medianClosePrice: number } =>
      r.medianClosePrice != null && r.closedCount >= PLAT_MEDIAN_MIN_CLOSINGS,
  )
}

function pricePoints(
  rows: ReadonlyArray<{ year: number; medianClosePrice: number }>,
): V3ChartPoint[] {
  return rows.map((r) => ({
    value: r.medianClosePrice,
    tick: v3Text(String(r.year)),
    label: v3Text(formatPrice(r.medianClosePrice)),
    at: r.year,
  }))
}

/** "at least 5 closings" clause, stated once so every trace says it the same way. */
const MEDIAN_FLOOR_CLAUSE =
  `Median drawn only for years with at least ${PLAT_MEDIAN_MIN_CLOSINGS} closings.`

const PLAT_SOURCE_CLAUSE =
  'Supabase listings through the get_subdivision_sales_history function: ' +
  "single-family closed sales (PropertyType 'A', status closed, a close date and a close price) " +
  'whose MLS subdivision name slugs to this plat, grouped by close year.'

/* ------------------------------------------------------------------ */
/* Card 1 — the plat's own record: price and volume by year            */
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
  const soldPanel: V3ChartProps = {
    caption: v3Text(`Single-family homes sold each year in ${opts.platName}, ${window}`),
    kind: 'bars',
    run: true,
    baselineLabel: v3Text('0'),
    series: [{ name: v3Text('Homes sold'), points: soldPoints }],
  }

  const thick = medianYears(years)
  const belowFloor = years.filter((r) => r.closedCount < PLAT_MEDIAN_MIN_CLOSINGS).length
  const noMedian = years.filter(
    (r) => r.closedCount >= PLAT_MEDIAN_MIN_CLOSINGS && r.medianClosePrice == null,
  ).length
  const thinClause =
    (belowFloor > 0
      ? ` ${n(belowFloor)} of the ${n(years.length)} years closed fewer than that and are counted in the homes-sold view only.`
      : '') +
    (noMedian > 0
      ? ` ${n(noMedian)} more clear the floor but carry no published median and are counted there too.`
      : '')
  // Only claim the running year is withheld when this plat actually recorded
  // one. Saying it on a plat whose last close was 2024 implies a figure exists.
  const progressClause = history.some(
    (r) => r.year === opts.currentYear && r.closedCount > 0,
  )
    ? ` ${opts.currentYear} is still in progress and is not charted.`
    : ''

  // Too thin for an honest price line: ship the counts alone and say why.
  if (thick.length < MIN_COMPARE_YEARS) {
    return {
      id: 'plat-history',
      // The window, not "since": a plat whose last close was 2015 must not
      // read as a run that is still going.
      title: v3Text(`${n(totalClosed)} sales, ${window}`),
      line: v3Text('Single-family homes sold each year.'),
      source: v3Text(
        `${PLAT_SOURCE_CLAUSE} ${n(totalClosed)} closings across ${n(years.length)} years, ${window}.` +
          progressClause +
          ` No median price is charted: ${MEDIAN_FLOOR_CLAUSE.toLowerCase()}` +
          ` ${
            thick.length === 0
              ? 'No year clears it'
              : thick.length === 1
                ? 'Only one year clears it'
                : `Only ${n(thick.length)} years clear it`
          }, too few to draw a line.`,
      ),
      wide: true,
      chart: soldPanel,
    }
  }

  const firstMedian = thick[0]!
  const lastMedian = thick[thick.length - 1]!
  const multiple = lastMedian.medianClosePrice / firstMedian.medianClosePrice
  // The span the multiple was measured over, never "since". The last year
  // thick enough to carry a median can be years behind the last closing.
  const medianWindow = `${firstMedian.year} to ${lastMedian.year}`
  const title =
    multiple >= 1
      ? `Median ${multiple.toFixed(1)}x, ${medianWindow}`
      : `Median down ${Math.round((1 - multiple) * 100)}%, ${medianWindow}`

  const pricePanel: V3ChartProps = {
    caption: v3Text(
      `Median close price by year in ${opts.platName}, ${firstMedian.year} to ${lastMedian.year}`,
    ),
    marks: true,
    series: [{ name: v3Text('Median close'), points: pricePoints(thick) }],
  }

  return {
    id: 'plat-history',
    title: v3Text(title),
    line: v3Text('Median close price and homes sold each year.'),
    source: v3Text(
      `${PLAT_SOURCE_CLAUSE} ${n(totalClosed)} closings across ${n(years.length)} years, ${window}.` +
        progressClause +
        ` ${MEDIAN_FLOOR_CLAUSE}${thinClause}` +
        ` Median ${formatPrice(firstMedian.medianClosePrice)} in ${firstMedian.year} on ${n(firstMedian.closedCount)} closings,` +
        ` ${formatPrice(lastMedian.medianClosePrice)} in ${lastMedian.year} on ${n(lastMedian.closedCount)} closings.` +
        ' Price and count are different units, so the control switches between them rather than sharing one axis.',
    ),
    wide: true,
    switcher: {
      label: v3Text('Measure'),
      items: [
        { key: 'price', label: v3Text('Price') },
        { key: 'sold', label: v3Text('Homes sold') },
      ],
      panels: [pricePanel, soldPanel],
      defaultKey: 'price',
    },
  }
}

/* ------------------------------------------------------------------ */
/* Card 2 — the plat against the market it sits inside                 */
/* ------------------------------------------------------------------ */

export type AreaSeries = {
  /** What the visitor calls the comparison geography. */
  label: string
  /** The mart geo_slug the rows came from, for the trace. */
  slug: string
  kind: 'city' | 'region'
  rows: readonly MartAnnualPoint[]
}

export function buildPlatVsAreaCard(
  history: readonly SubdivisionSalesYear[],
  area: AreaSeries,
  opts: { platName: string; currentYear: number },
): V3ChartCardProps | undefined {
  const thick = medianYears(completeYears(history, opts.currentYear))
  if (thick.length < MIN_COMPARE_YEARS) return undefined

  const areaByYear = new Map<number, MartAnnualPoint>()
  for (const row of area.rows) {
    if (row.medianClose != null) areaByYear.set(row.year, row)
  }
  const shared = thick.filter((r) => areaByYear.has(r.year))
  if (shared.length < MIN_COMPARE_YEARS) return undefined

  const from = shared[0]!.year
  const to = shared[shared.length - 1]!.year
  const areaSpan = [...areaByYear.values()]
    .filter((r) => r.year >= from && r.year <= to)
    .sort((a, b) => a.year - b.year)
  if (areaSpan.length < 2) return undefined

  const latest = shared[shared.length - 1]!
  const latestArea = areaByYear.get(latest.year)!
  const ratio = latest.medianClosePrice / latestArea.medianClose!

  // The year the comparison was measured in rides in the title. A plat whose
  // last thick year is 2020 must not read as a claim about this year.
  const title =
    ratio >= 1.05
      ? `${ratio.toFixed(1)}x the ${area.label} median, ${latest.year}`
      : ratio <= 0.95
        ? `${Math.round((1 - ratio) * 100)}% under ${area.label}, ${latest.year}`
        : `Level with ${area.label}, ${latest.year}`

  return {
    id: 'plat-vs-area',
    title: v3Text(title),
    line: v3Text(`Median close price by year, ${from} to ${to}.`),
    source: v3Text(
      `Plat: ${PLAT_SOURCE_CLAUSE} ${MEDIAN_FLOOR_CLAUSE} ${n(shared.length)} years qualify between ${from} and ${to}.` +
        ` ${area.label}: analytics_mart_market_annual, geo ${area.slug}, type_scope sfr, the same closed single-family universe` +
        ` across the whole ${area.kind === 'city' ? 'city' : 'region'} at a close price of at least $1,000.` +
        ` ${latest.year}: ${formatPrice(latest.medianClosePrice)} across ${n(latest.closedCount)} plat closings` +
        ` against ${formatPrice(latestArea.medianClose!)} across ${n(latestArea.soldCount)} ${area.label} closings.`,
    ),
    wide: true,
    chart: {
      caption: v3Text(
        `Median close price by year, ${opts.platName} and ${area.label}, ${from} to ${to}`,
      ),
      marks: true,
      series: [
        { name: v3Text(`${opts.platName} median`), points: pricePoints(shared) },
        {
          name: v3Text(`${area.label} median`),
          points: areaSpan.map((r) => ({
            value: r.medianClose!,
            tick: v3Text(String(r.year)),
            label: v3Text(formatPrice(r.medianClose!)),
            at: r.year,
          })),
        },
      ],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Card 3 — the rank form: this plat among its siblings                */
/* ------------------------------------------------------------------ */

export type PeerPlatRow = {
  slug: string
  /** Visitor name. A plat whose MLS token is an abbreviation never reaches here. */
  name: string
  soldCount: number
  medianSalePrice: number | null
}

export type PeerStamp = {
  /** Registry parent, e.g. "Sunriver". Names the peer set in the finding. */
  parentLabel: string
  /**
   * Sibling plats whose cached row exists but whose MLS token is not a place
   * name (StoneTH, WildflS), so they never reach the chart at any sale count.
   * Counted here so the trace can say they are absent rather than imply they
   * closed nothing.
   */
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
  const withMedian = peers
    .filter(
      (p): p is PeerPlatRow & { medianSalePrice: number } =>
        p.medianSalePrice != null && p.medianSalePrice > 0 && p.soldCount > 0,
    )
    .sort((a, b) => b.medianSalePrice - a.medianSalePrice || b.soldCount - a.soldCount)
  if (withMedian.length < MIN_PEER_ROWS) return undefined

  const index = withMedian.findIndex((p) => p.slug === subjectSlug)
  if (index < 0) return undefined
  const subject = withMedian[index]!

  const title =
    index === 0
      ? `Highest median in ${stamp.parentLabel}`
      : index === withMedian.length - 1
        ? `Lowest median in ${stamp.parentLabel}`
        : `Median ${formatPriceCompact(subject.medianSalePrice)} year to date`

  const rows: V3ChartRangeRow[] = withMedian.map((p) => ({
    tick: v3Text(p.name),
    value: p.medianSalePrice,
    label: v3Text(formatPriceCompact(p.medianSalePrice)),
    note: v3Text(
      `${n(p.soldCount)} closed year to date` +
        (p.soldCount < SMALL_PEER_SOLD_FLOOR ? ' · small sample' : ''),
    ),
  }))

  const thin = withMedian.filter((p) => p.soldCount < SMALL_PEER_SOLD_FLOOR)
  const thinClause =
    thin.length > 0
      ? ` ${n(thin.length)} of the ${n(withMedian.length)} closed fewer than ${SMALL_PEER_SOLD_FLOOR} homes in the window, so those medians read as small samples and are labeled that way.`
      : ''
  // A plat can close a sale and still publish no median (the cache withholds
  // one under its own disclosure rule). Counting it as "closed nothing" would
  // be the wrong claim, so the trace names that group on its own.
  const soldNoMedian = peers.filter(
    (p) => p.soldCount > 0 && (p.medianSalePrice == null || p.medianSalePrice <= 0),
  ).length
  const withheldClause =
    soldNoMedian > 0
      ? ` ${n(soldNoMedian)} more closed a sale in the window but publish no median, so they are not charted.`
      : ''
  const unnamedClause =
    stamp.unnamedCount > 0
      ? ` ${n(stamp.unnamedCount)} carry an MLS token that is not a place name and are left out entirely.`
      : ''
  const window =
    stamp.periodStart && stamp.periodEnd ? `${stamp.periodStart} to ${stamp.periodEnd}` : 'year to date'

  return {
    id: 'plat-peers',
    title: v3Text(title),
    line: v3Text(`Median sale price by plat in ${stamp.parentLabel}, year to date.`),
    source: v3Text(
      `market_stats_cache rows, geo_type subdivision, period_type ytd, window ${window}` +
        (stamp.methodologyVersion ? `, methodology ${stamp.methodologyVersion}` : '') +
        '. Single-family closed sales matched on city and MLS subdivision name, one row per plat.' +
        ` ${n(withMedian.length)} of the ${n(peers.length)} named ${stamp.parentLabel} plats publish a median for this window and are charted.` +
        thinClause +
        withheldClause +
        ` The rest closed no single-family sale in the window.` +
        unnamedClause +
        ` ${subject.name}: ${formatPrice(subject.medianSalePrice)} across ${n(subject.soldCount)} closings.`,
    ),
    wide: true,
    chart: {
      caption: v3Text(
        `Median sale price year to date by plat in ${stamp.parentLabel}, single-family`,
      ),
      kind: 'range',
      rows,
    },
  }
}
