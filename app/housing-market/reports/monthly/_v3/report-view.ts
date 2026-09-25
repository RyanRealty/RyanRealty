/**
 * The monthly Central Oregon market report, turned into barrel props.
 *
 * PURE. Nothing here fetches, reads the clock, or computes a market figure.
 * Every number on the two pages is read straight off an edition's frozen
 * payload (lib/market-report/types.ts) or off its list row, and formatted with
 * the same helpers the PDF uses (lib/market-report/format.ts), so the web page
 * and the PDF of one edition cannot print a figure two ways (CLAUDE.md §0).
 *
 * A figure the payload withholds (`v: null`, a sample under the registry floor)
 * prints as an en dash with the reason beside it. It is never estimated,
 * never zero-filled, and never borrowed from another window.
 *
 * The one check this module makes on a payload value is the verdict: a
 * months-of-supply verdict is printed only when it agrees with the house
 * thresholds for the number beside it (lib/market/classify.ts). Both come from
 * the same builder, so a mismatch means a corrupted row, and the page then
 * prints the number without a call rather than a call the number contradicts.
 */
import type { EditionListItem } from '@/lib/data/market-report/editions'
import {
  MONTHLY_REPORT_PATH,
  editionKey,
  editionPath,
  editionPdfFilename,
  editionPdfHref,
  hasPdf,
  parseEditionMonth,
} from './edition-keys'
import { FLOORS } from '@/lib/market-report/build-edition'
import {
  addMonths,
  count,
  days,
  money,
  monthLabel,
  monthName,
  moneyShort,
  mosText,
  pctChange,
} from '@/lib/market-report/format'
import { VERDICT_LABEL } from '@/lib/market-report/narrative'
import type { ReportGeo } from '@/lib/market-report/geos'
import type { EditionPayload, Kpis, MarketSection, MonthlySeries, Pt, Verdict } from '@/lib/market-report/types'
import { MOS_BALANCED_MAX, MOS_SELLER_MAX, marketVerdict } from '@/lib/market/classify'
import { formatFileSize } from '@/lib/format/bytes'
import { homesForSalePath } from '@/lib/slug'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { customTicks, moneyTicks, spacedTicks } from '@/lib/charts/ticks'
import type { StatValue } from '@/lib/site/json-ld'
import {
  v3Text,
  type V3Text,
  type V3ChartPoint,
  type V3ChartProps,
  type V3InstrumentFigure,
  type V3InstrumentFigures,
  type V3LedgerFigureRow,
} from '@/components/site/v3'

/* -------------------------------------------------------------------------- */
/* Paths and names                                                             */
/* -------------------------------------------------------------------------- */

export {
  MONTHLY_REPORT_PATH,
  editionKey,
  editionPath,
  editionPdfFilename,
  editionPdfHref,
  hasPdf,
  parseEditionMonth,
}

/** The page H1 of the archive, and the name the report goes by everywhere. */
export const MONTHLY_REPORT_NAME = 'Central Oregon monthly market report'

/** The source line the PDF prints on every page, word for word. */
export const REPORT_SOURCE_NAME = 'Oregon Data Share MLS data; Ryan Realty analysis'

/** Where the methods live: the archive page's questions. */
export const METHODS_HREF = `${MONTHLY_REPORT_PATH}#methods`

/** The archive, opened at the year an edition belongs to. */
export function archiveYearHref(key: string): string {
  return `${MONTHLY_REPORT_PATH}#${archiveYearId(Number(key.slice(0, 4)))}`
}

export function archiveYearId(year: number): string {
  return `archive-${year}`
}

/** H1 of one edition. The stored title says the same thing in title case. */
export function editionHeading(key: string): string {
  return `Central Oregon market report, ${monthLabel(key)}`
}

/** "Aug 2026": a month tick short enough for a 375px axis. */
function monthTickLabel(key: string): string {
  return `${monthName(key).slice(0, 3)} ${key.slice(0, 4)}`
}

/** A month as one number, so a missing month keeps its gap on the x axis. */
function monthIndex(key: string): number {
  return Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1
}

/**
 * The x axis of a monthly run: each January the line crosses, labelled with
 * its year. A four-digit label centred on its month fits inside the page gutter
 * at the plot's ends, where a "Feb 2009" label pushed a 375px page sideways.
 * The hover reading still names every month in full. Under two Januaries, the
 * run's own spaced month labels.
 */
function yearStartTicks(
  pts: readonly { k: string }[],
  lines: Parameters<typeof spacedTicks>[0],
): { at: number; label: V3Text }[] {
  const januaries = pts.filter((p) => p.k.slice(5, 7) === '01')
  if (januaries.length >= 2) {
    return januaries.map((p) => ({ at: monthIndex(p.k), label: v3Text(p.k.slice(0, 4)) }))
  }
  return spacedTicks(lines, 3)
}

/**
 * Months-of-supply gridlines, every label to the same precision: "2.0, 2.5,
 * 3.0" when any line falls between whole months, "2, 3, 4" when none does,
 * never "2, 2.5, 3" down one axis.
 */
function supplyTicks(lines: Parameters<typeof customTicks>[0]): { value: number; label: V3Text }[] {
  const ticks = customTicks(lines, (v) => v.toFixed(1))
  const whole = ticks.every((t) => Math.abs(t.value - Math.round(t.value)) < 1e-9)
  return whole ? ticks.map((t) => ({ value: t.value, label: v3Text(t.value.toFixed(0)) })) : ticks
}

/* -------------------------------------------------------------------------- */
/* The PDF, described                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The smallest size the house formatter would print as "1000 KB". The reports
 * run just under a megabyte (1,032,165 bytes for August 2026), and
 * lib/format/bytes switches to megabytes only at 1,024 KB, so the download
 * label read "1008 KB". From here up this prints megabytes to one decimal, in
 * the same binary units; below it, the house formatter as is.
 */
const PDF_MB_FROM_BYTES = 999.5 * 1024

/** "1.0 MB", "293 KB", or '' when the row carries no size. */
export function pdfSize(bytes: number | null | undefined): string {
  if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= PDF_MB_FROM_BYTES) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`
  }
  return formatFileSize(bytes)
}

/**
 * "PDF, 19 pages, 1.0 MB". A page count or a size the row does not carry is
 * left out rather than guessed; the word PDF is always there.
 */
export function pdfFacts(item: Pick<EditionListItem, 'page_count' | 'pdf_bytes'>): string {
  const parts = ['PDF']
  const pages = item.page_count
  if (typeof pages === 'number' && Number.isFinite(pages) && pages > 0) {
    parts.push(`${pages} ${pages === 1 ? 'page' : 'pages'}`)
  }
  const size = pdfSize(item.pdf_bytes)
  if (size) parts.push(size)
  return parts.join(', ')
}

/** "Download the August 2026 report (PDF, 19 pages, 1.0 MB)": the link says where it goes. */
export function downloadLabel(key: string, item: Pick<EditionListItem, 'page_count' | 'pdf_bytes'>): string {
  return `Download the ${monthLabel(key)} report (${pdfFacts(item)})`
}

/* -------------------------------------------------------------------------- */
/* Verdicts and withheld figures                                               */
/* -------------------------------------------------------------------------- */

/**
 * The stored verdict, printed only when it matches the house thresholds for
 * the stored months of supply (≤ 4 seller's, 4 to 6 balanced, ≥ 6 buyer's).
 */
export function publishedVerdict(k: Pick<Kpis, 'mos' | 'verdict'>): Verdict | null {
  if (k.mos == null || k.verdict == null) return null
  const kind = marketVerdict(k.mos).kind
  const expected: Verdict | null =
    kind === 'sellers' ? 'seller' : kind === 'buyers' ? 'buyer' : kind === 'balanced' ? 'balanced' : null
  return expected === k.verdict ? k.verdict : null
}

/** The period a figure covers, the way the PDF's table heads it: "August", "Jun to Aug". */
export function periodWord(k: Pick<Kpis, 'period'>): string {
  const endKey = k.period.end.slice(0, 7)
  if (k.period.kind === 'month') return monthName(endKey)
  if (k.period.kind === 'trailing3') {
    const startKey = addMonths(endKey, -2)
    return `${monthName(startKey).slice(0, 3)} to ${monthName(endKey).slice(0, 3)}`
  }
  return '12 months'
}

/** What a year-over-year change is measured against: "August 2025", "the same months a year earlier". */
function priorPeriod(k: Pick<Kpis, 'period'>): string {
  const endKey = k.period.end.slice(0, 7)
  if (k.period.kind === 'month') return `${monthName(endKey)} ${Number(endKey.slice(0, 4)) - 1}`
  return 'the same months a year earlier'
}

function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n === 1 ? one : many}`
}

/** "a, b and c" */
function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The figures a row withholds, in the order the table prints them. */
export function withheldFigures(k: Kpis): string[] {
  const out: string[] = []
  if (k.median.v == null && k.sales > 0) out.push('median')
  if (k.medianYoY == null && k.sales > 0) out.push('change from a year ago')
  if (k.dtc.v == null && k.sales > 0) out.push('days to pending')
  if (k.mos == null) out.push('months of supply')
  return out
}

/** "Median and months of supply withheld: too few sales to publish." */
export function withheldClause(k: Kpis): string | null {
  const names = withheldFigures(k)
  if (names.length === 0) return null
  const list = listJoin(names)
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} withheld: too few sales to publish`
}

/** The sentence under a table of these rows: what a dash means and what decides a market call. */
export function floorsSentence(): string {
  return `A dash means too few sales to publish. A median needs ${FLOORS.median} sales; a change from a year ago and a market call need ${FLOORS.yoy}.`
}

/* -------------------------------------------------------------------------- */
/* Figures: the Instrument's supporting numbers                                */
/* -------------------------------------------------------------------------- */

const DASH = '–'

export type FigureLinks = {
  /** Where the price, sales and speed figures lead (the edition page). */
  href?: string
  /** Where the months-of-supply figure leads (the definition). */
  supplyHref?: string
}

/**
 * The four numbers the report leads with: median sale price with its change
 * from a year ago, homes sold, median days to pending, and months of supply
 * with its call. Four, because the Instrument sets four across at every width
 * from 48rem, so a fifth would sit alone on a second row. A withheld number
 * keeps its place as a dash, and its label says why.
 */
export function marketFigures(k: Kpis, links: FigureLinks = {}): V3InstrumentFigures {
  const when = periodWord(k)
  /** "median sale price in August", "median sale price, Jun to Aug" */
  const during = (base: string) => (k.period.kind === 'month' ? `${base} in ${when}` : `${base}, ${when}`)
  const figure = (value: string, label: string, href?: string): V3InstrumentFigure => ({
    value: v3Text(value),
    label: v3Text(label),
    ...(href ? { href } : {}),
  })

  const change =
    k.medianYoY != null
      ? ` (${pctChange(k.medianYoY)} from ${priorPeriod(k)})`
      : ` (change from ${priorPeriod(k)} withheld: needs ${FLOORS.yoy} sales in both)`
  const median =
    k.median.v != null
      ? figure(money(k.median.v), `${during('median sale price')}${change}`, links.href)
      : figure(
          DASH,
          `median sale price: ${plural(k.sales, 'sale', 'sales')}, under the ${FLOORS.median} a median needs`,
        )

  const sold = figure(count(k.sales), during('homes sold'), links.href)

  const pending =
    k.dtc.v != null
      ? figure(days(k.dtc.v), 'median days to pending', links.href)
      : figure(DASH, `days to pending: under ${FLOORS.dtc} sales with a pending date`)

  const verdict = publishedVerdict(k)
  const supply =
    k.mos != null
      ? figure(
          mosText(k.mos),
          verdict ? `months of supply, ${VERDICT_LABEL[verdict]}` : 'months of supply',
          links.supplyHref,
        )
      : figure(DASH, `months of supply: ${plural(k.closed6, 'sale', 'sales')} in six months, under the ${FLOORS.mos} a reading needs`)

  return [median, sold, pending, supply]
}

/* -------------------------------------------------------------------------- */
/* Charts: the stored 36-month series                                          */
/* -------------------------------------------------------------------------- */

type Plotted = { k: string; v: number }

/** The points that carry a value; a withheld month is a gap, never a zero. */
function plotted(points: readonly Pt[]): Plotted[] {
  const out: Plotted[] = []
  for (const p of points) {
    if (p.v != null && Number.isFinite(p.v)) out.push({ k: p.k, v: p.v })
  }
  return out
}

function extremes(points: readonly Plotted[]): { lo: Plotted; hi: Plotted } {
  let lo = points[0]!
  let hi = points[0]!
  for (const p of points) {
    if (p.v < lo.v) lo = p
    if (p.v > hi.v) hi = p
  }
  return { lo, hi }
}

/**
 * The median sale price, month by month, as the edition stored it. The claim
 * names the last plotted month and the range the line itself spans, both read
 * off the plotted points; it computes no change of its own.
 */
export function medianTrendChart(series: MonthlySeries | undefined, place: string): V3ChartProps | undefined {
  if (!series) return undefined
  const pts = plotted(series.median)
  if (pts.length < 2) return undefined
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const { lo, hi } = extremes(pts)
  const points: V3ChartPoint[] = pts.map((p) => ({
    value: p.v,
    label: v3Text(money(p.v)),
    tick: v3Text(monthTickLabel(p.k)),
    at: monthIndex(p.k),
  }))
  const lines = [{ name: v3Text('Median sale price'), points }]
  const yTicks = moneyTicks(lines)
  const xTicks = yearStartTicks(pts, lines)
  return {
    caption: v3Text(`${place} median sale price by month, ${monthLabel(first.k)} to ${monthLabel(last.k)}`),
    claim: v3Text(
      `The median home sold for ${money(last.v)} in ${monthLabel(last.k)}, against a range of ${money(lo.v)} to ${money(hi.v)} since ${monthLabel(first.k)}.`,
    ),
    series: lines,
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
    restingRead: 'last',
    emptyReason: v3Text('Too few sales in these months to draw a median.'),
  }
}

/**
 * Months of supply, month by month, over the balanced zone, as the edition
 * stored it. The claim is the edition month's own reading and call (the last
 * point of this same line), in the words the PDF prints beside it.
 */
export function supplyTrendChart(
  series: MonthlySeries | undefined,
  place: string,
  k: Kpis,
): V3ChartProps | undefined {
  if (!series) return undefined
  const pts = plotted(series.mos)
  if (pts.length < 2) return undefined
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const points: V3ChartPoint[] = pts.map((p) => ({
    value: p.v,
    label: v3Text(`${mosText(p.v)} months`),
    tick: v3Text(monthTickLabel(p.k)),
    at: monthIndex(p.k),
  }))
  const lines = [{ name: v3Text('Months of supply'), points }]
  const yTicks = supplyTicks(lines)
  const xTicks = yearStartTicks(pts, lines)
  const verdict = publishedVerdict(k)
  const claim =
    k.mos != null && verdict && last.k === k.period.end.slice(0, 7)
      ? `${mosText(k.mos)} months of supply at the end of ${monthLabel(last.k)}: ${VERDICT_LABEL[verdict]} by our measure.`
      : null
  return {
    caption: v3Text(`${place} months of supply by month, ${monthLabel(first.k)} to ${monthLabel(last.k)}`),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series: lines,
    bands: [
      {
        from: MOS_SELLER_MAX,
        to: MOS_BALANCED_MAX,
        label: v3Text(`Balanced: above ${MOS_SELLER_MAX} and under ${MOS_BALANCED_MAX} months`),
      },
    ],
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
    restingRead: 'last',
    emptyReason: v3Text('Too few sales in these months for a supply reading.'),
  }
}

/* -------------------------------------------------------------------------- */
/* Market by market: the overview table as a Ledger                           */
/* -------------------------------------------------------------------------- */

/** Where a market's row leads: its live page on this site. */
export function marketHref(geo: ReportGeo): string {
  if (geo.type === 'region') return '/housing-market'
  if (geo.type === 'city' && SITE_CITY_SLUGS.includes(geo.slug)) return `/cities/${geo.slug}`
  return homesForSalePath(geo.label)
}

/** The full section behind an overview row, for its twelve-month line and its run. */
function sectionFor(payload: EditionPayload, geo: ReportGeo): MarketSection | undefined {
  if (geo.type === 'region') return payload.region
  return (
    payload.monthly.find((s) => s.geo.slug === geo.slug) ?? payload.towns.find((s) => s.geo.slug === geo.slug)
  )
}

/** "3.9 months of supply, a seller's market" or the bare number when the call is not printable. */
function supplyClause(k: Kpis): string | null {
  if (k.mos == null) return null
  const verdict = publishedVerdict(k)
  return `${mosText(k.mos)} months of supply${verdict ? `, ${VERDICT_LABEL[verdict]}` : ''}`
}

/**
 * One row's second line: the window the row covers, every printable figure,
 * then what is withheld and why. The window leads because the towns are read
 * over three months and the region, Bend and Redmond by month, and a row must
 * say which it is at every width (the Ledger hides its `when` column beside a
 * bar).
 */
export function marketDetail(k: Kpis): string {
  const parts: string[] = []
  if (k.medianYoY != null) parts.push(`${pctChange(k.medianYoY)} vs a year ago`)
  parts.push(`${count(k.sales)} sold`)
  if (k.dtc.v != null) parts.push(`${days(k.dtc.v)} to pending`)
  parts.push(`${count(k.active)} for sale`)
  const supply = supplyClause(k)
  if (supply) parts.push(supply)
  const withheld = withheldClause(k)
  if (withheld) parts.push(withheld)
  return `${periodWord(k)}: ${parts.join(' · ')}`
}

/** The twelve months to the edition month, which the row does not print. */
export function twelveMonthLine(k12: Kpis): string {
  const median = k12.median.v != null ? ` at a median of ${money(k12.median.v)}` : ''
  const change = k12.median.v != null && k12.medianYoY != null ? ` (${pctChange(k12.medianYoY)} on the 12 months before)` : ''
  return `Last 12 months: ${plural(k12.sales, 'home', 'homes')} sold${median}${change}.`
}

/**
 * Every market in the edition's overview, one row each, in the PDF's order:
 * Central Oregon, Bend, Redmond, then the smaller towns. The median is drawn as
 * a length on the list's one scale (the largest median at full ink); a row
 * whose median is withheld draws no bar.
 */
export function marketLedgerRows(payload: EditionPayload): V3LedgerFigureRow[] {
  const medians = payload.overview
    .map((r) => r.kpis.median.v)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  const top = medians.length ? Math.max(...medians) : 0
  return payload.overview.map((r) => {
    const k = r.kpis
    const section = sectionFor(payload, r.geo)
    const run = section?.series?.median.map((p) => p.v) ?? undefined
    const reveal = section
      ? {
          line: v3Text(twelveMonthLine(section.kpis12)),
          ...(run ? { series: run, seriesLabel: v3Text('median sale price by month, last 36 months') } : {}),
        }
      : undefined
    return {
      id: `${r.geo.type}-${r.geo.slug}`,
      href: marketHref(r.geo),
      what: v3Text(r.geo.label),
      detail: v3Text(marketDetail(k)),
      value: v3Text(k.median.v != null ? money(k.median.v) : DASH),
      ...(k.median.v != null && top > 0 ? { weight: k.median.v / top } : {}),
      ...(reveal ? { reveal } : {}),
    }
  })
}

/** How each overview row is read, for the note over the table. */
export function overviewNote(payload: EditionPayload): string | null {
  const monthly = payload.overview.some((r) => r.kpis.period.kind === 'month')
  const trailing = payload.overview.some((r) => r.kpis.period.kind === 'trailing3')
  if (monthly && trailing) {
    return 'Central Oregon, Bend and Redmond are read by month. The smaller towns sell fewer homes, so they are read over the last three months, which gives each median enough sales to stand on.'
  }
  return null
}

/** The trace under the table: which homes, which windows, which source. */
export function overviewSource(payload: EditionPayload, completeThrough: string): string {
  const anyLot = payload.overview.filter((r) => r.segment === 'detached').map((r) => r.geo.label)
  const homes = anyLot.length
    ? `Single-family homes on less than one acre, except ${listJoin(anyLot)} (any lot size)`
    : 'Single-family homes on less than one acre'
  return `${REPORT_SOURCE_NAME}, ${homes.charAt(0).toLowerCase()}${homes.slice(1)} · ${monthLabel(payload.editionMonth)} edition, MLS records as of ${completeThrough}`
}

/* -------------------------------------------------------------------------- */
/* Traces and structured data                                                  */
/* -------------------------------------------------------------------------- */

/** The trace for one market's figures and chart. */
export function sectionSource(place: string, key: string, completeThrough: string): string {
  return `${REPORT_SOURCE_NAME}, ${place} single-family homes on less than one acre, ${monthLabel(key)} · the charts are the 36 months to ${monthLabel(key)} as this edition stored them · MLS records as of ${completeThrough}`
}

/**
 * The same figures as the Instrument, as schema.org PropertyValues. Each value
 * is the number the page prints (money() and days() round to whole units,
 * months of supply is stored to one decimal), so the markup and the screen
 * carry one number per fact.
 */
export function datasetVariables(k: Kpis, key: string): StatValue[] {
  const when = monthLabel(key)
  const out: StatValue[] = []
  if (k.median.v != null) out.push({ name: `Median sale price, ${when}`, value: Math.round(k.median.v), unitText: 'USD' })
  out.push({ name: `Homes sold, ${when}`, value: k.sales })
  if (k.dtc.v != null) out.push({ name: `Median days to pending, ${when}`, value: Math.round(k.dtc.v), unitText: 'days' })
  out.push({ name: `Homes for sale at the end of ${when}`, value: k.active })
  if (k.mos != null) out.push({ name: `Months of supply, ${when}`, value: k.mos })
  return out
}

/* -------------------------------------------------------------------------- */
/* Descriptions                                                                */
/* -------------------------------------------------------------------------- */

const DESCRIPTION_BUDGET = 155

function fitted(candidates: readonly string[]): string {
  return candidates.find((c) => c.length <= DESCRIPTION_BUDGET) ?? candidates[candidates.length - 1]!
}

/** The snippet for one edition, quoting only figures the payload prints. */
export function editionDescription(key: string, k: Kpis): string {
  const when = monthLabel(key)
  const median = k.median.v != null ? `median sale price ${money(k.median.v)}` : null
  const change = k.median.v != null && k.medianYoY != null ? ` (${pctChange(k.medianYoY)} from a year ago)` : ''
  const sold = `${plural(k.sales, 'home', 'homes')} sold`
  const supply = k.mos != null ? `${mosText(k.mos)} months of supply` : null
  const full = [median ? `${median}${change}` : null, sold, supply].filter(Boolean).join(', ')
  const short = [median, sold].filter(Boolean).join(', ')
  return fitted([
    `Central Oregon market report, ${when}: ${full}. Read it here or download the free PDF.`,
    `Central Oregon market report, ${when}: ${full}.`,
    `Central Oregon market report, ${when}: ${short}.`,
  ])
}

/** The archive's snippet: what it is, how far back it goes, and the latest numbers. */
export function archiveDescription(oldestKey: string, latestKey: string, k: Kpis | null): string {
  const since = monthLabel(oldestKey)
  const head = `Every monthly Central Oregon market report since ${since}, free to read here or download as a PDF.`
  if (!k || k.median.v == null) return fitted([head])
  const latest = `${monthLabel(latestKey)}: median sale price ${money(k.median.v)}, ${plural(k.sales, 'home', 'homes')} sold.`
  return fitted([
    `${head} ${latest}`,
    `Every Central Oregon monthly market report since ${since}, free to read or download. ${latest}`,
    head,
  ])
}

/* -------------------------------------------------------------------------- */
/* The archive, by year                                                         */
/* -------------------------------------------------------------------------- */

export type ArchiveCell = {
  key: string
  /** "Aug" */
  short: string
  /** "August 2026" */
  label: string
  href: string
  pdfHref: string | null
  /** "PDF, 19 pages, 1.0 MB" */
  pdf: string | null
  /** The edition's first headline sentence, shown on hover and focus. */
  lead: string | null
  latest: boolean
  /** Central Oregon's median sale price that month, "$640K"; null when withheld or not stored. */
  median: string | null
  /**
   * Where that median sits between the archive's lowest and highest, 0 to 1:
   * the month's bar shade. Null when there is no median.
   */
  shade: number | null
}

export type ArchiveYear = {
  year: number
  /** Twelve slots, January first; null where no edition is published. */
  slots: (ArchiveCell | null)[]
  count: number
}

/**
 * The first sentence of a stored summary. The summary is the edition's headline
 * sentences joined with spaces (scripts/market-report-publish.ts), and every one
 * of them ends in a period followed by the next capital or figure.
 */
export function firstSentence(summary: string | null | undefined): string | null {
  const text = summary?.trim()
  if (!text) return null
  const [first] = text.split(/(?<=\.)\s+(?=[A-Z0-9$])/)
  return first?.trim() || null
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function monthShort(index: number): string {
  return MONTHS_SHORT[index] ?? ''
}

/**
 * Every published edition, grouped by calendar year, newest year first. Each
 * month carries Central Oregon's median sale price as stored with the edition
 * and a shade placing it between the lowest and highest median in the
 * archive, so the calendar reads as the price cycle before a month is opened.
 */
export function archiveYears(list: readonly EditionListItem[]): ArchiveYear[] {
  const latestKey = list.length ? list.map(editionKey).sort().at(-1) ?? null : null
  const medians = list.flatMap((item) => {
    const v = item.figures?.median
    return typeof v === 'number' && Number.isFinite(v) ? [v] : []
  })
  const lo = medians.length ? Math.min(...medians) : 0
  const hi = medians.length ? Math.max(...medians) : 0
  const shadeOf = (v: number | null | undefined): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    return hi > lo ? (v - lo) / (hi - lo) : 1
  }
  const byYear = new Map<number, (ArchiveCell | null)[]>()
  for (const item of list) {
    const key = editionKey(item)
    const year = Number(key.slice(0, 4))
    const month = Number(key.slice(5, 7))
    if (!Number.isInteger(year) || month < 1 || month > 12) continue
    const slots = byYear.get(year) ?? Array.from({ length: 12 }, () => null)
    slots[month - 1] = {
      key,
      short: monthShort(month - 1),
      label: monthLabel(key),
      href: editionPath(key),
      pdfHref: hasPdf(item) ? editionPdfHref(key) : null,
      pdf: hasPdf(item) ? pdfFacts(item) : null,
      lead: firstSentence(item.summary),
      latest: key === latestKey,
      median: typeof item.figures?.median === 'number' ? moneyShort(item.figures.median) : null,
      shade: shadeOf(item.figures?.median),
    }
    byYear.set(year, slots)
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, slots]) => ({ year, slots, count: slots.filter(Boolean).length }))
}

/** The edition before and after one month, from the newest-first list. */
export function editionNeighbors(
  list: readonly EditionListItem[],
  key: string,
): { older: EditionListItem | null; newer: EditionListItem | null } {
  const sorted = [...list].sort((a, b) => (a.edition_month < b.edition_month ? 1 : -1))
  const i = sorted.findIndex((item) => editionKey(item) === key)
  if (i < 0) return { older: null, newer: null }
  return { older: sorted[i + 1] ?? null, newer: i > 0 ? sorted[i - 1]! : null }
}
