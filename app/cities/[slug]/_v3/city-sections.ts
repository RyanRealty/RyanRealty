/**
 * Row shaping for the city node's PLACE LEDGERS — the neighborhood ledger, the
 * communities rail, the golf and master-planned ledger, the other-cities ledger,
 * the live activity ledger, and the city guides.
 *
 * WHY THIS FILE EXISTS. Two reasons, both mechanical, the same two
 * app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts states:
 * ci:file-size-budget refuses any file under app/ or lib/ at 600 lines, and the
 * route has to stay a readable list of sections. Nothing here fetches. Nothing
 * here reaches outside the v3 barrel.
 *
 * WHY THE ROW TYPES ARE DECLARED HERE AND NOT IMPORTED FROM components/site/kb/types.
 * They are plain data shapes, but importing one puts a KB module specifier on a
 * page the P9 roll just took off that register, which ci:public-ui counts as
 * register debt on this exact page. The shapes below are the same fields under
 * route-local names, so the page owes nothing to the old register.
 *
 * NOTHING HERE INVENTS A FIGURE, AND UNKNOWN IS NEVER ZERO (CLAUDE.md section 0).
 * Every builder comes in two forms: a FIGURE form for when the count read
 * succeeded, and a PLAIN form for when it did not. The plain form drops the value
 * column entirely rather than printing a zero the page cannot vouch for, and the
 * two forms are separate functions because V3Ledger's props union will not let one
 * list hold both — which is the type system enforcing exactly this rule.
 */

import {
  v3Text,
  V3_CHART_CATEGORY_SLOTS,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartSeries,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { moneyTicks, monthTicks, yoyClaim } from '@/lib/charts/ticks'
import { formatPriceCompact, formatPriceExact } from '@/lib/format/money'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import type { KbYearSeries } from '@/lib/kb/year-series'

/**
 * A place that has its own node: a neighborhood, a golf or master-planned
 * community, a city. `activeCount` is null when the count could not be measured
 * on this render, which is a different fact from zero and renders differently.
 * `img` is '' when no verified photo exists for the place — never a stand-in.
 */
export type CityPlaceItem = {
  name: string
  href: string
  activeCount: number | null
  medianPrice: number | null
  img: string
  /**
   * "2 townhomes · 1 condo" — the destination plat's OWN Market Truth segment
   * counts (publish-subdivision-type-bits), so the row and the page it opens
   * can never disagree. Absent when the plat publishes no other types.
   */
  typeBits?: string | null
}

/**
 * A community in the marquee rail. Everything a place carries, plus the town it
 * sits in and the silent Area Guide clip when one is published for it.
 */
export type CityCommunityItem = CityPlaceItem & {
  town: string
  video: { url: string; embedType: 'iframe' | 'video-tag' } | null
}

/** A live-feed row: one MLS event on one listing. */
export type CityActivityItem = {
  label?: string | null
  address?: string | null
  cityLine?: string | null
  price: number | null
  imageUrl?: string | null
  /** Absent when the feed row carried no listing key, in which case there is no
   *  door and the row is dropped rather than rendered as dead text. */
  href?: string | null
  whenLabel?: string | null
}

/** A published guide. */
export type CityArticleItem = {
  title: string
  href: string
  excerpt?: string | null
  imageUrl?: string | null
  dateLabel?: string | null
}

/** The median line under a place name, or nothing when there is no median. */
function medianDetail(medianPrice: number | null): string | null {
  return medianPrice != null && medianPrice > 0 ? `${formatPriceExact(medianPrice)} median list` : null
}

/** A row's photo, only when the caller resolved a verified one. */
function media(img: string): { src: string } | undefined {
  return img.trim() ? { src: img.trim() } : undefined
}

/**
 * Place rows WITH their live active count in the value column. The caller must
 * pass a trace to V3Ledger; the props union makes that a compile error otherwise.
 * A place whose count is null is still listed — its node is still reachable — and
 * its value column reads as unmeasured rather than as zero.
 */
export function placeFigureRows(
  items: readonly CityPlaceItem[],
  kindLabel: string,
): V3LedgerFigureRow[] {
  /**
   * Each row's share of the busiest place in the same list, which V3Ledger
   * draws as a length when the caller turns `encode` on.
   *
   * Computed HERE, beside the figure it encodes, because this function already
   * owns the number and its wording — the ledger primitive is not allowed to do
   * arithmetic on a figure it might then disagree with. A place with no
   * measured count gets no weight and therefore no bar, which is the same
   * answer its value column gives ("not measured"). A measured zero gets a
   * weight of zero, because none listed is a fact, not a gap.
   */
  const counts = items
    .map((i) => i.activeCount)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)
  const busiest = counts.length > 0 ? Math.max(...counts) : 0

  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    const median = medianDetail(item.medianPrice)
    const detail = [median, item.typeBits ?? null].filter(Boolean).join(' · ') || null
    return [
      {
        id: href,
        href,
        when: v3Text(kindLabel),
        what: v3Text(name),
        ...(detail ? { detail: v3Text(detail) } : {}),
        value: v3Text(
          // A MEASURED zero prints as the absence it is, matching /cities'
          // "None listed now" (2026-08-27 audit: "Vandevert Ranch — 0 active"
          // was the one bare zero left on the site). null stays 'not measured':
          // unknown is not zero, and zero is not unknown.
          item.activeCount == null
            ? 'not measured'
            : item.activeCount === 0
              ? 'none listed now'
              : `${item.activeCount.toLocaleString('en-US')} active`,
        ),
        ...(typeof item.activeCount === 'number' &&
        Number.isFinite(item.activeCount) &&
        item.activeCount >= 0 &&
        busiest > 0
          ? { weight: item.activeCount / busiest }
          : {}),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * The same rows with NO value column, for the branch where the count read
 * degraded. The places are still doors; only the unverifiable figure is withheld.
 */
export function placePlainRows(
  items: readonly CityPlaceItem[],
  kindLabel: string,
): V3LedgerPlainRow[] {
  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    const median = medianDetail(item.medianPrice)
    const detail = [median, item.typeBits ?? null].filter(Boolean).join(' · ') || null
    return [
      {
        id: href,
        href,
        when: v3Text(kindLabel),
        what: v3Text(name),
        ...(detail ? { detail: v3Text(detail) } : {}),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * The communities rail as rows. The rail's own ordering is applied by the caller
 * (marquee and video cards first, then by active count), so this only shapes.
 * The clip is not played here — V3Ledger renders the poster frame, and the
 * community's own node is where the clip plays — but a community that HAS one is
 * marked, because that is why it leads the list.
 */
export function communityRows(items: readonly CityCommunityItem[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    return [
      {
        id: href,
        href,
        when: v3Text(item.video ? `${item.town} · Area guide` : item.town),
        what: v3Text(name),
        value: v3Text(
          item.activeCount != null ? `${item.activeCount.toLocaleString('en-US')} active` : 'not measured',
        ),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * Live MLS events as rows. The price is the figure, so the caller owes the trace.
 * Every row carries the listing's own photo, which is what makes the feed
 * scannable — the thumbnail contract this section has had since D93.
 */
export function activityRows(items: readonly CityActivityItem[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const href = item.href?.trim()
    const address = item.address?.trim()
    if (!href || !address) return []
    const when = [item.label?.trim(), item.whenLabel?.trim()].filter(Boolean).join(' · ')
    const detail = item.cityLine?.trim()
    return [
      {
        id: `${href}-${item.label}-${item.whenLabel}`,
        href,
        when: v3Text(when || 'Update'),
        what: v3Text(address),
        ...(detail ? { detail: v3Text(detail) } : {}),
        value: v3Text(
          formatPublishedAsk(item.price) ?? 'Price on request',
        ),
        ...(item.imageUrl?.trim() ? { media: { src: item.imageUrl.trim() } } : {}),
      },
    ]
  })
}

/**
 * The approved area-guide clip as a guides-Ledger row (2026-08-26). The KB
 * register played it inline (KbAreaGuideVideo); the six closed patterns hold
 * no mid-page media slot on a Field-opening node, so the owned clip keeps a
 * named door here — the "Watch {place}" affordance the deploy smoke gate
 * (scripts/check-video-sections.mjs) asserts — and plays full-bleed on the
 * community Stage where the pattern for owned media exists. Absent video,
 * absent row.
 */
export function areaGuideRow(
  placeName: string,
  video: { url: string } | null | undefined,
  posterSrc?: string,
): V3LedgerPlainRow[] {
  const url = video?.url?.trim()
  if (!url) return []
  return [
    {
      id: 'area-guide',
      href: url,
      newTab: true,
      when: v3Text('Area guide'),
      what: v3Text(`Watch ${placeName}`),
      detail: v3Text('The approved silent flyover, straight from the file.'),
      ...(posterSrc?.trim() ? { media: { src: posterSrc.trim() } } : {}),
    },
  ]
}

/** Published guides as rows. No figures, so no trace is owed. */
export function articleRows(items: readonly CityArticleItem[]): V3LedgerPlainRow[] {
  return items.flatMap((item) => {
    const title = item.title?.trim()
    const href = item.href?.trim()
    if (!title || !href) return []
    const detail = item.excerpt?.trim()
    return [
      {
        id: href,
        href,
        when: v3Text(item.dateLabel?.trim() || 'Guide'),
        what: v3Text(title),
        ...(detail ? { detail: v3Text(detail) } : {}),
        ...(item.imageUrl?.trim() ? { media: { src: item.imageUrl.trim() } } : {}),
      },
    ]
  })
}

/**
 * The Instrument's KPI figures, all off the ONE leftover pile (D19 / MARKET_TRUTH):
 * leftoverHudKpis is the sole source, a missing cell is omitted, and pulse and the
 * stats cache never fill a tile. This replaced the pulse-driven three-figure set the
 * reverted draft carried — the leftover HUD became the city SoR after 2026-08-15
 * (D78: the hero count is hud.active), so restoring the pulse figures would publish
 * a second population under the same labels.
 *
 * Months of supply: leftoverHudKpis already ran publishMonthsOfSupply with
 * source 'market-truth', so `hud.monthsSupply` is the PUBLISHED raw value. The
 * caller classifies THAT value (marketVerdict) and this builder formats it with
 * formatMonthsOfSupply, so the printed digits cannot cross a threshold the raw
 * value did not cross.
 */
export function leftoverMarketFigures(
  hud: LeftoverHudKpis,
  links: { browse: string; monthsOfSupply: string },
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (hud.medianList != null && hud.medianList > 0) {
    figures.push({
      value: v3Text(formatPriceExact(hud.medianList)),
      label: v3Text('median list price'),
      href: links.browse,
    })
  }
  if (hud.active != null && hud.active > 0) {
    figures.push({
      value: v3Text(hud.active.toLocaleString('en-US')),
      label: v3Text('detached homes for sale'),
      href: links.browse,
    })
  }
  if (hud.pending != null && hud.pending > 0) {
    figures.push({
      value: v3Text(hud.pending.toLocaleString('en-US')),
      label: v3Text('pending · now'),
    })
  }
  if (hud.closed30 != null && hud.closed30 > 0) {
    figures.push({
      value: v3Text(hud.closed30.toLocaleString('en-US')),
      label: v3Text('closed · 30 days'),
    })
  }
  if (hud.new30 != null && hud.new30 > 0) {
    figures.push({
      value: v3Text(hud.new30.toLocaleString('en-US')),
      label: v3Text('new · 30 days'),
    })
  }
  if (hud.saleToList != null) {
    figures.push({
      value: v3Text(`${hud.saleToList.toFixed(1)}%`),
      // The value is the pace row's saleToOriginal — a 12-month statistic.
      // It wore the bare label 'sale to list' while the surrounding run
      // promises "every figure names its own window" (2026-08-27 audit).
      label: v3Text('sale to original list · 12 months'),
    })
  }
  // Tenths, through publishDaysFigure — the medians land on half-days, and
  // integer-rounding one published days figure beside another page's tenths is
  // the Black Butte 40-vs-39.5 defect. Same digits buildMarketFaq interpolates.
  const daysToPending = publishDaysFigure(hud.daysToPending)
  if (daysToPending) {
    figures.push({
      value: v3Text(daysToPending),
      label: v3Text('median to pending · 90 days'),
    })
  }
  if (hud.monthsSupply != null && hud.monthsSupply > 0) {
    figures.push({
      value: v3Text(formatMonthsOfSupply(hud.monthsSupply)),
      label: v3Text('months of supply'),
      href: links.monthsOfSupply,
    })
  }
  if (hud.sold12mo != null && hud.sold12mo > 0) {
    figures.push({
      value: v3Text(hud.sold12mo.toLocaleString('en-US')),
      label: v3Text('sold · 12 months'),
    })
  }
  return figures
}

/**
 * The leftover pace keys the HUD figures above already print. publicPaceItems
 * repeats these three under its own labels, and printing 97.6% twice under two
 * labels reads as two findings (the ZIP page's rule, shared).
 */
export const CITY_PACE_KEYS_ON_THE_HUD = new Set(['pending', 'sto', 'closed'])

const MONTH_TICK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Chart title a buyer can read. Source line under the Instrument traces the pile. */
export function placeMedianChartCaption(placeName: string): string {
  return `Median sale price by month in ${placeName}`
}

/**
 * The median-close year overlay for a place Instrument — the same construction
 * the ZIP node ships (zipMedianChart), one copy for the place family. Absent
 * months are dropped, a year with fewer than two plottable points is dropped,
 * and an empty overlay returns undefined so the caller mounts no chart.
 *
 * The claim, the gridlines, and the month axis all come out of lib/charts/ticks
 * — the same three helpers every other public chart now calls, so no two
 * surfaces can round the same series two ways.
 */
export function placeMedianChart(
  years: readonly KbYearSeries[],
  caption: string,
): V3ChartProps | undefined {
  const overlay: V3ChartSeries[] = []
  for (const year of years.slice(-V3_CHART_CATEGORY_SLOTS)) {
    const points: V3ChartPoint[] = []
    for (const row of year.points) {
      const tick = MONTH_TICK[row.m - 1]
      if (!tick) continue
      if (!Number.isFinite(row.value) || row.value <= 0) continue
      const label = formatPriceCompact(row.value)
      if (!label || label === '—') continue
      points.push({ value: row.value, tick: v3Text(tick), label: v3Text(label), at: row.m })
    }
    if (points.length < 2) continue
    overlay.push({ name: v3Text(String(year.year)), points })
  }
  if (overlay.length === 0) return undefined

  // The claim: the latest plotted month against the same month a year
  // earlier, from the same series the chart draws. No prior month, no
  // comparison — the sentence shrinks rather than estimates.
  const claim = yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })
  const yTicks = moneyTicks(overlay)

  return {
    caption: v3Text(caption),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series: overlay,
    overlay: 'yoy',
    emphasize: 'last',
    ...(yTicks.length ? { yTicks } : {}),
    xTicks: monthTicks(MONTH_TICK),
  }
}

/**
 * The About block: the hand-written city description where one exists, then the
 * city's own PLACE FACTS. No market data and NO FIGURES — a number belongs in an
 * Instrument with its source line, which is V3Quiet's own contract. A city with
 * neither a description nor quick facts returns nothing and the block does not
 * render, rather than generated filler.
 */
export function cityAboutItems(
  description: string | null | undefined,
  quickFacts: {
    population?: string
    county?: string
    elevation?: string
    schoolDistrict?: string
    nearestAirport?: string
  } | null,
): V3QuietItem[] {
  const items: V3QuietItem[] = []
  const prose = description?.trim()
  if (prose) items.push({ kind: 'prose', body: prose })
  const facts: Array<[string, string | undefined]> = [
    ['Population', quickFacts?.population],
    ['County', quickFacts?.county ? `${quickFacts.county} County` : undefined],
    ['Elevation', quickFacts?.elevation],
    ['School district', quickFacts?.schoolDistrict],
    ['Nearest commercial airport', quickFacts?.nearestAirport],
  ]
  for (const [term, body] of facts) {
    if (body?.trim()) items.push({ kind: 'prose', term, body: body.trim() })
  }
  return items
}

/* -------------------------------------------------------------------------- */
/* Source traces + closing edges                                              */
/* -------------------------------------------------------------------------- */

/**
 * The traces live here, next to the builders whose figures they cover, for the reason
 * app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts states: a source
 * sentence written at the render site drifts from the query that produced the number.
 * No sentence in this file contains a number.
 */
const FEED = 'live MLS through Oregon Data Share'

/**
 * The trace over the Instrument's leftover-HUD figures. Every figure names its
 * own window on its label; a cell the metric layer withheld is absent, never
 * estimated (§0). The MoS clauses ride along only when a supply figure prints.
 */
export function cityMarketTrace(cityName: string, hasMos: boolean): string {
  return (
    `regional MLS through Oregon Data Share, read through the Market Truth metric layer: ` +
    `detached single-family houses inside the ${cityName} city boundary. ` +
    `Every figure names its own window; a figure the layer withheld is absent, not estimated.` +
    (hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

/** The trace over every place ledger's active-count column. */
export const PLACE_COUNT_TRACE = `${FEED}, active single-family listings, counted per place`

/** The trace over the live activity ledger's price column. */
export function cityActivityTrace(cityName: string): string {
  return `${FEED}, new listings, price changes, pendings, and closings on ${cityName} homes`
}

/**
 * THE STATED ABSENCE, for the render where the Instrument has no figure to print.
 *
 * The sentence is derived from THIS PAGE'S OWN MARKET READS — the leftover
 * membership headline/inventory cells and the 12-month pace row — never from the
 * figure array, and it states no count of its own. The inventory listed on this
 * page is counted once, in the Field, under the Field's trace; restating it here
 * would put a number in a Quiet with nothing to sit under it (invariant 4). The
 * closing clause about the rows is conditional for the same reason: with no row
 * above, "the homes above carry their own live list prices" describes homes that
 * are not there.
 */
export function marketAbsenceItems(cityName: string, hasRows: boolean): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body =
    `The Market Truth metric layer published no figure for ${cityName} on this refresh, ` +
    `so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

/**
 * Caption beside the Field. The count is the listed set, never a pulse figure
 * from a different filter. Months of supply and the verdict use the same raw
 * value the Instrument classifies. Absent MoS is omitted, never written as zero.
 */
export function cityFieldCaption(input: {
  cityName: string
  count: number
  mosLabel: string | null
  verdictKind: 'sellers' | 'balanced' | 'buyers' | 'unknown'
  verdictLabel: string
}): string | null {
  if (input.count <= 0) return null
  // The listed set is an EXPLICIT PREVIEW CAP (CITY_PLACE_LIST_CAP, the same
  // cap the KB dual-pane list carried): the newest qualifying listings, list
  // and pins one set. The full inventory figure lives in the Instrument under
  // its own trace, and the Instrument's action is the view-all door.
  const homes = `The ${input.count.toLocaleString('en-US')} newest single-family listings in ${input.cityName}`
  if (input.verdictKind === 'unknown' || input.mosLabel == null) return homes
  return `${homes} · ${input.mosLabel} months of supply · a ${input.verdictLabel}`
}

/**
 * Trace over the Field's listed set. No borrowed pulse stamp. SFR-only since
 * C-02: every sibling geo map (community, neighborhood, subdivision, ZIP,
 * homepage) pulls the Single Family Residence sub-type, and an all-types pool
 * here put a 1,000-home badge beside a 491 hero on /cities/bend.
 */
export function cityFieldTrace(cityName: string): string {
  return (
    `${FEED}, the newest active single-family homes ` +
    `with a ${cityName} address, a list price, and a street. The map plots this same set; ` +
    `the Instrument below carries the full inventory count under its own trace`
  )
}

export function cityFieldEmptyMessage(cityName: string, tilesReturned: number): string {
  return tilesReturned === 0
    ? `No single-family home in ${cityName} is listed in the active feed on this refresh.`
    : `Every active ${cityName} listing this refresh returned was missing a list price or a street address, so none of them is shown as a row.`
}

/**
 * The closing edges the ledgers above do not already carry, plus the outbound MLS and
 * Census citations MarketSources used to render. Census only when the page actually
 * renders a population figure - never link padding.
 *
 * `links.valuation` arrives from lib/site/valuation-href.ts, the one builder for a
 * valuation link on a content surface. It carries `?from=<this route>`, which the
 * seller flow stores as the lead's source_url; a bare /sell#get-value records the
 * valuation page as its own origin and the city that produced the lead is lost.
 */
export function cityExploreItems(
  cityName: string,
  slug: string,
  links: { browse: string; valuation: string },
  hasPopulation: boolean,
): V3QuietItem[] {
  const items: V3QuietItem[] = [
    { label: `See every ${cityName} home for sale`, href: links.browse },
    { label: `${cityName} market report`, href: `/housing-market/${slug}` },
    { label: `Open houses in ${cityName}`, href: `/open-houses/${slug}` },
    { label: 'Every Central Oregon city', href: '/cities' },
    { label: 'Value my home', href: links.valuation },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  // The westside-luxury door (ci:westside-backlog): Bend keeps its edge to the
  // luxury page. KbPopularSearches carried it on the KB register; the closing
  // Quiet is where the graph's outbound edges live on the barrel.
  if (slug === 'bend') {
    items.splice(1, 0, { label: 'Luxury homes in Bend', href: '/luxury-homes-bend' })
  }
  if (hasPopulation) items.push({ label: 'U.S. Census Bureau', href: 'https://www.census.gov' })
  return items
}
