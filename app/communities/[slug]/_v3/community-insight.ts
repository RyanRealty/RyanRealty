/**
 * The community fold's paged figure, as data (2026-10-01).
 *
 * THE SAME OBJECT THE CITY, NEIGHBORHOOD AND SUBDIVISION FOLDS SHIP
 * (app/cities/[slug]/_v3/city-insight.ts,
 * app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-insight.ts,
 * app/subdivisions/[slug]/_v3/subdivision-insight.ts), bound to this grain's
 * own reads: beautifului's InsightCards pager, page one the supply read, page
 * two the community's own closed sales. TASTE.md: design the class, not the
 * instance. The layout lock it answers: "a place page opens with a drawing and
 * a figure beside the alerts sentence".
 *
 * PAGE ONE HAS TWO HONEST FORMS, and which one prints is Market Truth's call,
 * never this file's:
 *
 *   1. MONTHS OF SUPPLY PUBLISHED. The community's own figure from
 *      market_metric `neighborhood:<community slug>` (place_membership
 *      is_primary on both sides of the ratio, so the actives and the closes are
 *      one set of houses). It prints when its 180-day closes clear the registry
 *      floor (min_n 30, REGISTRY.md section 2.3 D4): Sunriver, Eagle Crest,
 *      Northwest Crossing and Three Rivers on 2026-10-01. The prose is the
 *      verdict, off marketVerdict() on the same raw figure the bars draw
 *      (scripts/check-market-formula.mjs), so the word and the bars cannot
 *      disagree. The page passes the bars.
 *   2. WITHHELD UNDER THE FLOOR. Tetherow on 2026-10-01: 13 houses for sale,
 *      23 sold in 180 days, a ratio Market Truth computes and does not publish.
 *      The page says so with the count the withheld cell rests on (a count,
 *      which publishes at min_n 1), draws that count against the floor it
 *      missed (one mark per sale), and offers the parent place, which is what
 *      the registry tells a surface to do with a below-floor figure: the city's
 *      verdict in one sentence that names the city, and the page's door to the
 *      city's report. The city's own bars are not drawn: under this community's
 *      heading a reader takes them for the community's (taste judge,
 *      2026-10-01, honesty). No ratio for the community, no verdict for the
 *      community, no estimate.
 *
 * THIS FILE IS THE PURE TURN. It takes figures the page already read and
 * publishes them preformatted, so the client component formats nothing and
 * every numeral keeps the trace the page gave it (CLAUDE.md §0). Nothing here
 * fetches, reads the clock, or classifies a market.
 */

import { formatPrice } from '@/lib/format/money'
import { formatMonthYear } from '@/lib/format/date'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { buildPlatPriceBands, type PlatPriceBand } from '@/app/subdivisions/[slug]/_v3/subdivision-insight'
import {
  NBH_INSIGHT_MIN_MONTHS,
  NBH_INSIGHT_MONTHS,
  type NeighborhoodInsightPath,
  type NeighborhoodInsightPoint,
} from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-insight'

export type CommunityInsightPath = NeighborhoodInsightPath

/** Page one when the community's own months of supply published. */
export type CommunitySupplyPublished = {
  kind: 'published'
  /** "A balanced market." The verdict, bound to the figure the bars draw. */
  prose: string
}

/** Page one when Market Truth withheld the community's months of supply under its floor. */
export type CommunitySupplyFloor = {
  kind: 'floor'
  /** Detached houses closed in this community in the 180 days the ratio would divide by. */
  closedSixMonths: number
  closedLabel: string
  /** "23 houses sold in Tetherow in the last six months." Count first, then the floor. */
  lead: string
  /** "Calling it a buyer's or seller's market takes 30 sales, so we don't." */
  floorSentence: string
  /** "Bend as a whole is a seller's market." Null when the parent city has no published read. */
  contextSentence: string | null
  /** The floor, for the tally drawing when there is no parent read to draw. */
  minN: number
  /** One sentence, visitor words, for the tally's source line. */
  tallySource: string
}

/**
 * Page two: the houses for sale, by asking price, on the catalog's
 * AllocationCard. ONE SET WITH THE FIGURE ABOVE IT: it prints only when the
 * priced houses the map counts are exactly the houses Market Truth counts as
 * for sale (the supply page's homes bar, the FAQ's inventory row), so the fold
 * cannot set 13 beside 15. Off that agreement the page is omitted, not
 * reconciled with a footnote.
 */
export type CommunityForSalePage = {
  bands: PlatPriceBand[]
  count: number
  countLabel: string
  /** Market Truth's middle asking price for the same houses, or null when withheld. */
  median: string | null
  medianValue: number | null
  note: string
  source: string
  href: string
  hrefLabel: string
}

export type CommunityInsightBoard = {
  supply: CommunitySupplyPublished | CommunitySupplyFloor | null
  forSale: CommunityForSalePage | null
  supplyHref: string
  supplyHrefLabel: string
  /** The closed-sale path, or null when the series is too thin to draw. */
  path: CommunityInsightPath | null
}

export type CommunityInsightInput = {
  placeName: string
  cityName: string
  /** The parent city's market report path, e.g. "/housing-market/bend". */
  marketHref: string
  /** The verdict sentence when the community's own months of supply published, else null. */
  verdictProse: string | null
  /**
   * The withheld cell's count and floor (getDetachedOverlays supplyFloor), or
   * null. Ignored when verdictProse is set: a published figure wins.
   */
  floor: { closedSixMonths: number; minN: number; asOf: string | null } | null
  /** The parent city's verdict label ("seller's market") when its bars publish, else null. */
  cityVerdictLabel: string | null
  /**
   * Complete months, oldest first, as `leftoverNeighborhoodOrCityMonthly`
   * publishes them, or an empty list when that read fell back to the city.
   */
  months: readonly { periodStart: string; medianSalePrice: number | null; soldCount: number | null }[]
  pathSourceName?: string
  /**
   * Asking prices of the detached houses for sale (status Active) inside the
   * community, from the population the map and the dials read. Omit for no page.
   */
  askingPrices?: readonly number[]
  /** Market Truth's detached for-sale count (hud.active): the agreement test. */
  activeCount?: number | null
  /** Market Truth's middle asking price for that set (hud.medianList). */
  medianListPrice?: number | null
  /** As-of words for the bands' source line. */
  inventoryAsOf?: string | null
}

export function buildCommunityForSale(
  input: Pick<CommunityInsightInput, 'placeName' | 'askingPrices' | 'activeCount' | 'medianListPrice' | 'inventoryAsOf'>,
): CommunityForSalePage | null {
  const prices = (input.askingPrices ?? []).filter((p) => Number.isFinite(p) && p > 0)
  const active = input.activeCount
  if (active == null || prices.length === 0 || prices.length !== active) return null
  const bands = buildPlatPriceBands(prices)
  if (bands.length < 2) return null
  const median = input.medianListPrice != null && input.medianListPrice > 0 ? input.medianListPrice : null
  const n = prices.length
  return {
    bands,
    count: n,
    countLabel: formatCount(n),
    median: median != null ? formatPriceExact(median) : null,
    medianValue: median,
    note: `Asking prices of all ${formatCount(n)} ${housesWord(n)} for sale in ${input.placeName}.`,
    source:
      `Oregon Data Share · detached single-family houses for sale (MLS status Active) inside the recorded ${input.placeName} boundary, ` +
      `each counted once in the round price band its asking price falls in. The middle asking price is for the same ${formatCount(n)} houses.` +
      (input.inventoryAsOf ? ` · as of ${input.inventoryAsOf}` : ''),
    href: '#homes',
    hrefLabel: `${input.placeName} homes for sale`,
  }
}

function housesWord(n: number): string {
  return n === 1 ? 'house' : 'houses'
}

export function buildCommunitySupply(
  input: Pick<CommunityInsightInput, 'placeName' | 'cityName' | 'verdictProse' | 'floor' | 'cityVerdictLabel'>,
): CommunitySupplyPublished | CommunitySupplyFloor | null {
  if (input.verdictProse) return { kind: 'published', prose: input.verdictProse }
  const floor = input.floor
  if (!floor) return null
  const n = floor.closedSixMonths
  if (!Number.isInteger(n) || n < 0 || !Number.isInteger(floor.minN) || n >= floor.minN) return null
  const place = input.placeName
  const lead =
    n === 0
      ? `No houses sold in ${place} in the last six months.`
      : `${formatCount(n)} ${housesWord(n)} sold in ${place} in the last six months.`
  const floorSentence = `Calling it a buyer's or seller's market takes ${formatCount(floor.minN)} sales, so we don't.`
  const contextSentence = input.cityVerdictLabel
    ? `${input.cityName} as a whole is a ${input.cityVerdictLabel}.`
    : null
  const tallySource =
    `Oregon Data Share · detached single-family houses inside the recorded ${place} boundary that closed in the last 180 days, ` +
    `one mark per sale, against the ${formatCount(floor.minN)} closed sales a months-of-supply figure needs before it is published.` +
    (floor.asOf ? ` · as of ${floor.asOf}` : '')
  return {
    kind: 'floor',
    closedSixMonths: n,
    closedLabel: formatCount(n),
    lead,
    floorSentence,
    contextSentence,
    minN: floor.minN,
    tallySource,
  }
}

export function buildCommunityInsightBoard(input: CommunityInsightInput): CommunityInsightBoard {
  const points: NeighborhoodInsightPoint[] = []
  for (const row of input.months) {
    const median = row.medianSalePrice
    const sold = row.soldCount
    // Both metrics or neither: a price line beside a blank volume line is a
    // toggle that answers nothing, and a zero-filled month is a §0 lie.
    if (median == null || !Number.isFinite(median) || median <= 0) continue
    if (sold == null || !Number.isFinite(sold) || sold <= 0) continue
    const label = formatMonthYear(String(row.periodStart).slice(0, 10))
    if (!label) continue
    points.push({ label, median, sold: Math.round(sold) })
  }
  const tail = points.slice(-NBH_INSIGHT_MONTHS)
  const sourceName = input.pathSourceName ?? 'Oregon Data Share'
  const last = tail[tail.length - 1]
  const path: CommunityInsightPath | null =
    tail.length >= NBH_INSIGHT_MIN_MONTHS && last
      ? {
          points: tail,
          window: `${tail[0].label} - ${last.label}`,
          range: {
            medianLow: formatPrice(Math.min(...tail.map((p) => p.median))),
            medianHigh: formatPrice(Math.max(...tail.map((p) => p.median))),
            soldLow: Math.min(...tail.map((p) => p.sold)).toLocaleString('en-US'),
            soldHigh: Math.max(...tail.map((p) => p.sold)).toLocaleString('en-US'),
          },
          latest: { label: last.label, median: last.median, medianFormatted: formatPrice(last.median) },
          source: `${sourceName} · closed detached single-family sales inside the recorded ${input.placeName} boundary, one point per month ${input.placeName} published a closed median, ${tail[0].label} through ${last.label}. Median sale price is the middle closed price that month; homes sold is how many closed. A month where too few homes closed to publish a median is not plotted, and neither is the month in progress, so a thin month never draws as a fall.`,
          href: input.marketHref,
          hrefLabel: `The ${input.cityName} market report`,
        }
      : null
  const supply = buildCommunitySupply(input)
  // A withheld figure's door is the parent place it is offered against.
  const offersCity = supply?.kind === 'floor' && supply.contextSentence != null
  return {
    supply,
    forSale: buildCommunityForSale(input),
    supplyHref: offersCity ? input.marketHref : '/months-of-supply',
    supplyHrefLabel: offersCity ? `The ${input.cityName} market report` : 'How months of supply is counted',
    path,
  }
}
