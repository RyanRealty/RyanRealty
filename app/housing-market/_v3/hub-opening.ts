/**
 * SITE-100 — how the market hub opens.
 *
 * The first viewport is the live answer (verdict + MOS two-bar + paged city
 * pace), not the report chooser. MOS publishes at city grain through
 * publishMonthsOfSupply; a miss omits. Nothing here fetches.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §3a / leftover HUD: region figures stay
 * on the leftover MarketPulse overlay the page already reads. City MOS uses
 * the same city snapshots the Ledger prints.
 */

import type { MarketPulseSnapshot } from '@/lib/data'
import type { MarketKind } from '@/lib/market/classify'
import { marketVerdict, MOS_PLAIN_LABEL } from '@/lib/market/classify'
import { formatDate } from '@/lib/format/date'
import { formatPriceCompact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPaceDelta } from '@/lib/data/market-truth/public-pace'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { marketHubChooser } from '@/lib/market/report-doors'
import {
  v3Text,
  type V3InsightPoint,
  type V3InsightSeries,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { CITY_LABELS, CITY_SLUG } from './hub-constants'
import type { CityLedger } from './hub-sections'
import { MONTH_TICK, type MedianMonth } from './market-charts'
import { MARKET_FOLD_LABEL } from './opening'

/** Fold label: names the tail, no integer, short enough for 375. */
export const HUB_FOLD_LABEL = MARKET_FOLD_LABEL

export type HubCityMosPage = {
  id: string
  label: string
  href: string
  caption: string
  plainLabel: string
  homesName: string
  homesLabel: string
  homesValue: number
  salesName: string
  salesLabel: string
  salesValue: number
  mosText: string
  /** The city's own verdict from the same raw value, or 'unknown'. */
  verdictKind: MarketKind
  verdictLabel: string
  source: string
  asOf: string | null
  tooltip: { homes: string; sales: string; source: string }
  /**
   * The city's median sale price by complete month — the card the insight
   * scrubs. Null when the leftover monthly cannot plot (absent is not zero;
   * never filled from another table).
   */
  series: V3InsightSeries | null
}

/** Complete months the city card draws. Two years reads the season twice. */
export const HUB_CITY_SERIES_MONTHS = 24

/**
 * The city insight's run: median sale price by complete month, the same
 * leftover monthly the city report's own chart draws, trimmed to the last
 * HUB_CITY_SERIES_MONTHS. Fewer than V3_INSIGHT_MIN_POINTS priced months
 * omits the card rather than drawing a confident sliver.
 */
export function buildCityInsightSeries(
  label: string,
  monthly: readonly MedianMonth[],
  opts: { minPoints: number; asOf?: string | null },
): V3InsightSeries | null {
  const points: V3InsightPoint[] = []
  for (const row of monthly.slice(-HUB_CITY_SERIES_MONTHS)) {
    if (row.medianSalePrice == null || !(row.medianSalePrice > 0)) continue
    const d = new Date(row.periodStart)
    if (Number.isNaN(d.getTime())) continue
    const month = MONTH_TICK[d.getUTCMonth()]
    if (!month) continue
    const face = formatPriceCompact(row.medianSalePrice)
    if (!face || face === '\u2014') continue
    points.push({ value: row.medianSalePrice, tick: `${month} ${d.getUTCFullYear()}`, label: face })
  }
  if (points.length < Math.max(2, opts.minPoints)) return null
  // The reading's comparison: this month against the same month a year
  // earlier, both from the run itself (§0: two published medians, one
  // division). A month with no published year-ago point reads alone.
  const byTick = new Map(points.map((p) => [p.tick, p.value]))
  for (const point of points) {
    const [month, year] = point.tick.split(' ')
    const priorTick = `${month} ${Number(year) - 1}`
    const prior = byTick.get(priorTick)
    if (prior == null || !(prior > 0)) continue
    point.note = `${formatPaceDelta((point.value - prior) / prior)} against ${priorTick}`
  }
  const first = points[0]!
  const last = points[points.length - 1]!
  return {
    caption: 'Median sale price by month',
    points,
    source: `Oregon Data Share. ${label} single-family houses closed each complete calendar month, ${first.tick} to ${last.tick}; the median of that month's closes. A month with too few closes to publish is left out, not drawn as a dip.`,
    sourceName: 'Oregon Data Share',
    asOf: opts.asOf ?? null,
  }
}

/**
 * Monthly closing pace implied by MOS: active / months of supply.
 * Counted integer — a tenth of a closing is spreadsheet precision (SITE-88).
 * Miss omits.
 */
export function monthlyPaceFromMos(
  active: number | null | undefined,
  mosRaw: number | null | undefined,
): number | null {
  if (active == null || !(active > 0) || mosRaw == null || !(mosRaw > 0)) return null
  const pace = Math.round(active / mosRaw)
  return pace > 0 ? pace : null
}

export function formatHubPace(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/**
 * City-grain MOS pages for the InsightPager. Trusted grain only; miss omits.
 * Same snapshots the city Ledger renders — no second query.
 */
export function buildCityMosPages(
  snapshots: readonly MarketPulseSnapshot[],
  opts: {
    /** Per-city complete monthly medians, keyed by CITY_SLUG. A missing key omits the card. */
    monthlyBySlug?: ReadonlyMap<string, readonly MedianMonth[]>
    minSeriesPoints: number
  } = { minSeriesPoints: 6 },
): HubCityMosPage[] {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const pages: HubCityMosPage[] = []
  for (const label of CITY_LABELS) {
    const slug = CITY_SLUG[label]
    const snapshot = byLabel.get(label)
    if (!slug || !snapshot) continue
    const active = snapshot.active_count
    const mos = publishMonthsOfSupply({
      grain: 'city',
      source: 'market-truth',
      pulseMos: snapshot.months_of_supply,
      pulseActiveCount: snapshot.active_count,
      displayedActiveCount: snapshot.active_count,
    })
    const sales = monthlyPaceFromMos(active, mos)
    if (active == null || !(active > 0) || mos == null || sales == null) continue
    const homesLabel = active.toLocaleString('en-US')
    const salesLabel = formatHubPace(sales)
    const mosText = formatMonthsOfSupply(mos)
    const href = `/housing-market/${slug}`
    const asOf = snapshot.updated_at
    // Visitor copy: the stamp through the canonical formatter, never the raw
    // ISO string with its clock and offset.
    const tipStamp = asOf ? formatDate(asOf) : null
    const tipSource =
      tipStamp && tipStamp !== '\u2014'
        ? `Oregon Data Share · ${label} single-family · as of ${tipStamp}`
        : `Oregon Data Share · ${label} single-family`
    // Same derivation the region verdict uses (page.tsx invariant 1): classify
    // the raw published value, format only to print it.
    const verdict = marketVerdict(mos)
    const monthly = opts.monthlyBySlug?.get(slug)
    const series = monthly
      ? buildCityInsightSeries(label, monthly, { minPoints: opts.minSeriesPoints })
      : null
    pages.push({
      id: slug,
      label,
      href,
      caption: `${label}: about ${mosText} months of homes on the market.`,
      plainLabel: MOS_PLAIN_LABEL,
      homesName: 'Homes for sale',
      homesLabel,
      homesValue: active,
      salesName: 'A month of sales',
      salesLabel,
      salesValue: sales,
      mosText,
      verdictKind: verdict.kind,
      verdictLabel: verdict.label,
      source: `Oregon Data Share. ${homesLabel} homes for sale in ${label} vs ${salesLabel} sales a month.`,
      asOf,
      tooltip: {
        homes: homesLabel,
        sales: salesLabel,
        source: tipSource,
      },
      series,
    })
  }
  return pages
}

/**
 * Document title. Layer A (ci:seo-shell) locks the head term. Live counts
 * go in the description and the H1, never a second title.
 */
export function hubLiveTitle(_active?: number | null): string {
  return 'Central Oregon Housing Market'
}

export function hubLiveDescription(
  active: number | null | undefined,
  mosText: string | null | undefined,
): string {
  if (active != null && active > 0 && mosText) {
    return `${active.toLocaleString('en-US')} single-family homes for sale in Central Oregon. Homes vs a month of sales: ${mosText} months. City reports from Oregon Data Share / MarketPulse.`
  }
  if (active != null && active > 0) {
    return `${active.toLocaleString('en-US')} single-family homes for sale in Central Oregon. City reports and weekly snapshots from Oregon Data Share / MarketPulse.`
  }
  return 'Live single-family inventory and pace by city in Central Oregon. City reports and weekly snapshots from Oregon Data Share / MarketPulse.'
}

export function buildHubCityItemList(
  rows: CityLedger['rows'],
): ReadonlyArray<{ name: string; url: string }> {
  return rows.map((row) => ({
    name: `${String(row.what)} housing market`,
    url: row.href,
  }))
}

export function hubOpeningNote(
  verdictKind: MarketKind,
  cityPageCount: number,
): string {
  const cityBit =
    cityPageCount > 1
      ? 'Page a city for its own pace and two years of sale prices.'
      : cityPageCount === 1
        ? "The city card is that city's own pace and two years of sale prices."
        : 'A city with no published pace is omitted.'
  if (verdictKind === 'unknown') {
    return `Live single-family inventory for Central Oregon. ${cityBit}`
  }
  return `Homes for sale against a month of sales. ${cityBit}`
}

export type HubChooserInput = {
  active: number | null
  cityRowCount: number
  closedSoldCount: number | null
  closedYear: number | null
  mosText: string | null
  verdictLabel: string
  verdictKind: MarketKind
  newestWeeklyLabel: string | null
  refreshedAt: string | null
  cityRefreshedAt: string | null
}

const CHOOSER_SOURCE_NAME = 'Oregon Data Share / MarketPulse'

/**
 * Report doors after the city Ledger — not in the first viewport (SITE-100).
 * Figures match the sections they point at. Absent is not zero.
 */
export function buildHubChooserItems(input: HubChooserInput): V3QuietItem[] {
  return marketHubChooser().map((door) => {
    if (door.label === 'Live market') {
      return {
        ...door,
        href: '#market',
        lead: true,
        mark: 'market' as const,
        detail: 'The verdict, the inventory, and the chart, on this page.',
        ...(input.active != null && input.active > 0
          ? {
              figure: {
                value: input.active.toLocaleString('en-US'),
                live: input.active,
                unit: 'single-family homes for sale',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.refreshedAt,
              },
            }
          : {}),
      }
    }
    if (door.label === 'By city') {
      return {
        ...door,
        mark: 'map' as const,
        detail: 'One live row per city, each with its own median and its own pace.',
        ...(input.cityRowCount > 0
          ? {
              figure: {
                value: String(input.cityRowCount),
                live: input.cityRowCount,
                unit: 'cities with a live row',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.cityRefreshedAt,
              },
            }
          : {}),
      }
    }
    if (door.label === 'Every closed sale') {
      return {
        ...door,
        mark: 'history' as const,
        detail: 'Every closed sale we hold, by city, type, and year.',
        ...(input.closedSoldCount != null &&
        input.closedSoldCount > 0 &&
        input.closedYear != null
          ? {
              figure: {
                value: input.closedSoldCount.toLocaleString('en-US'),
                live: input.closedSoldCount,
                unit: `closed sales in ${input.closedYear}, all types`,
                source: `Oregon Data Share closed sales, ${input.closedYear}`,
                sourceName: `Central Oregon MLS closed sales, ${input.closedYear}`,
              },
            }
          : {}),
      }
    }
    if (door.label === 'Months of supply') {
      return {
        ...door,
        mark: 'supply' as const,
        detail:
          input.verdictKind === 'unknown'
            ? 'What the number means, and how it is worked out.'
            : `Central Oregon reads as a ${input.verdictLabel} at that pace.`,
        ...(input.mosText != null
          ? {
              figure: {
                value: input.mosText,
                unit: 'months of supply',
                source: CHOOSER_SOURCE_NAME,
                sourceName: CHOOSER_SOURCE_NAME,
                updatedAt: input.refreshedAt,
              },
            }
          : {}),
      }
    }
    return {
      ...door,
      mark: 'page' as const,
      detail: 'Published sales reports and the dated weekly snapshots.',
      ...(input.newestWeeklyLabel
        ? {
            figure: {
              value: input.newestWeeklyLabel,
              unit: 'newest weekly snapshot',
              source: 'Published weekly snapshots on Oregon Data Share dates',
              sourceName: 'Published weekly snapshots',
            },
          }
        : {}),
    }
  })
}

const LEAD_LABELS = new Set(['homes for sale, single-family', 'a month of sales'])

export function isHubLeadFigure(figure: V3InstrumentFigure): boolean {
  return LEAD_LABELS.has(String(figure.label))
}

/**
 * The Instrument's figure row when the two bars draw: median list and days
 * to an offer — the price and the wait, the two things the bars do not say.
 * The two counts the bars already draw never come back as tiles (layout
 * lock: two bars, never a KPI tile). Falls back to every opening figure when
 * neither publishes, so the Instrument keeps its required first figure.
 */
export function hubInstrumentFigures(
  opening: readonly V3InstrumentFigure[],
  barsDrawn: boolean,
): V3InstrumentFigure[] {
  if (!barsDrawn) return [...opening]
  const priceAndWait = opening.filter((figure) => {
    const label = String(figure.label)
    return label.includes('median list') || label.includes('days to an offer')
  })
  return priceAndWait.length > 0 ? priceAndWait : [...opening]
}

/**
 * Whole-number face for beui-number: a count ("1,531") or an exact dollar
 * figure ("$749,500", whole dollars) rides the wheel and settles on the
 * caller's string. Percents, tenths, and compact money ("$749K") stay static —
 * the wheel would have to invent digits the label does not carry (judge
 * 2026-09-13: "$749,500 and 30 sit as two leftover numerals... Money does not
 * swap").
 */
export function wholeCountFromLabel(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('%')) return undefined
  const bare = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(bare)) return undefined
  const n = Number(bare.replace(/,/g, ''))
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

export type HubExtraItem = {
  value: string
  label: string
  count?: number
  href?: string
  /**
   * This item's length behind its figure, 0 to 1 — a PROPORTION the builder
   * owns (V3Ledger's `weight` rule): a count's share of the page's largest
   * count, or a published percent over 100. Absent when the page's items do
   * not share a unit, so a bar is never drawn across dollars and days.
   */
  weight?: number
}

/**
 * One property type as a part of the whole — the allocation card's segment.
 * Every string is formatted here; V3Insight computes only positions.
 */
export type HubTypeSegment = {
  id: string
  /** Legend face, e.g. "Condos". */
  label: string
  /** Published active count. */
  value: number
  valueLabel: string
  /** This type's count over the sum of every listed type, 0 to 1. */
  share: number
  shareLabel: string
  /** One plain sentence for the type (publicSegmentRowSentence). */
  note: string
  href?: string
}

export type HubTypeRow = {
  segment: string
  /** The plural noun for the legend, e.g. "condos". */
  noun: string
  count: number
  sentence: string
  href?: string
}

export type HubExtraPage = {
  id: string
  label: string
  claim: string
  items: HubExtraItem[]
  /** The allocation card, when the page is parts of one whole. */
  segments?: HubTypeSegment[]
  segmentsCaption?: string
  segmentsSource?: { source: string; sourceName?: string; asOf?: string | null }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Parts of one whole: each published type count over the sum of every type
 * listed (§0: published counts, one addition, one division each). A row with
 * no positive count is left out; an empty set returns none.
 */
export function buildHubTypeSegments(rows: readonly HubTypeRow[]): HubTypeSegment[] {
  const kept = rows.filter((row) => Number.isFinite(row.count) && row.count > 0 && row.noun.trim())
  const total = kept.reduce((sum, row) => sum + row.count, 0)
  if (kept.length === 0 || total <= 0) return []
  return kept
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((row) => {
      const share = row.count / total
      return {
        id: row.segment,
        label: capitalise(row.noun.trim()),
        value: row.count,
        valueLabel: row.count.toLocaleString('en-US'),
        share,
        shareLabel: share * 100 < 1 ? 'under 1%' : `${Math.round(share * 100)}%`,
        // The row sentence starts with its noun (it used to follow a count);
        // as a sentence of its own it starts with a capital.
        note: capitalise(row.sentence.trim()),
        ...(row.href ? { href: row.href } : {}),
      }
    })
}

/** "98.1%" or "at least 62%" → 0.981 / 0.62. Anything else is not a share. */
export function shareFromLabel(value: string): number | undefined {
  const match = /^(?:at least )?(\d+(?:\.\d+)?)%$/.exec(value.trim())
  if (!match) return undefined
  const pct = Number(match[1])
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return undefined
  return pct / 100
}

/**
 * Lengths for one page: every item a count → each over the largest; every
 * item a percent → each over 100; mixed units → none. Out of range is dropped,
 * not clamped (a bar whose length was guessed is worse than no bar).
 */
export function weighExtraItems(items: readonly HubExtraItem[]): HubExtraItem[] {
  if (items.length === 0) return []
  const allCounts = items.every((item) => item.count != null && item.count > 0)
  if (allCounts) {
    const max = Math.max(...items.map((item) => item.count!))
    return items.map((item) => ({ ...item, weight: item.count! / max }))
  }
  const shares = items.map((item) => shareFromLabel(item.value))
  if (shares.every((share) => share != null)) {
    return items.map((item, i) => ({ ...item, weight: shares[i]! }))
  }
  return [...items]
}

function extraItemsFromFigures(figures: readonly V3InstrumentFigure[]): HubExtraItem[] {
  const items: HubExtraItem[] = []
  for (const figure of figures) {
    const value = String(figure.value)
    const label = String(figure.label)
    if (!value || !label) continue
    items.push({
      value,
      label,
      ...(figure.count != null && Number.isFinite(figure.count) && figure.count > 0
        ? { count: figure.count }
        : wholeCountFromLabel(value) != null
          ? { count: wholeCountFromLabel(value) }
          : {}),
      ...(figure.href ? { href: figure.href } : {}),
    })
  }
  return weighExtraItems(items)
}

/**
 * Extra leftover tiles become insight pages, not a closed cream fold. Miss
 * omits a page. Claims carry no figure — the items do. The Types page is the
 * demo's allocation card (one bar of every type, the selected type's count
 * and share, its sentence, the legend as doors); Features draws a length per
 * share; Sale pace is the plain pair. Median list and days to an offer are
 * the Instrument's own figures now, so no page repeats them (judge
 * 2026-09-13: the fold-after tiles restated what a bar already drew).
 */
export function buildHubExtraPages(input: {
  types: readonly HubTypeRow[]
  typesSource?: { source: string; sourceName?: string; asOf?: string | null }
  pace: readonly V3InstrumentFigure[]
  mix: readonly V3InstrumentFigure[]
}): HubExtraPage[] {
  const pages: HubExtraPage[] = []
  const segments = buildHubTypeSegments(input.types)
  if (segments.length > 0) {
    pages.push({
      id: 'types',
      label: 'Types',
      claim:
        'What is for sale across Central Oregon besides single-family houses, each type as a share of that whole. Hover a type to read it; tap it to browse those listings.',
      items: [],
      segments,
      segmentsCaption: 'For sale by type',
      ...(input.typesSource ? { segmentsSource: input.typesSource } : {}),
    })
  }
  const mixItems = extraItemsFromFigures(input.mix)
  if (mixItems.length > 0) {
    pages.push({
      id: 'features',
      label: 'Features',
      claim: 'What a typical recent closed house had, as a share of closes, when a share published.',
      items: mixItems,
    })
  }
  const paceItems = extraItemsFromFigures(input.pace)
  if (paceItems.length > 0) {
    pages.push({
      id: 'pace',
      label: 'Sale pace',
      claim: 'How the recent closed and pending pace reads, from Oregon Data Share.',
      items: paceItems,
    })
  }
  return pages
}

/**
 * Lead tiles under the MOS drawing. Integer month-of-sales face.
 * Sentences say what each figure means; no second number in a sentence.
 */
export function buildOpeningFigures(input: {
  follow: V3InstrumentFigure[]
  monthOfSales: number | null
}): V3InstrumentFigure[] {
  const { follow, monthOfSales } = input
  if (monthOfSales == null) return follow
  const salesLabel = formatHubPace(monthOfSales)
  return [
    ...follow.filter((figure) => String(figure.label) === 'homes for sale, single-family'),
    {
      value: v3Text(salesLabel),
      label: v3Text('a month of sales'),
      href: '/months-of-supply',
      count: monthOfSales,
      sentence: v3Text('How many single-family houses have been selling in a typical recent month.'),
    },
    ...follow.filter(
      (figure) =>
        String(figure.label) !== 'homes for sale, single-family' &&
        String(figure.label) !== MOS_PLAIN_LABEL,
    ),
  ]
}

