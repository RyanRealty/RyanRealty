/**
 * Route-local: the community node's figure sets and its outbound edges.
 *
 * It lives beside the route rather than inside it because the route is under the
 * ci:file-size-budget floor and the gate's own instruction when a file approaches
 * it is to split, not to re-baseline.
 *
 * NOTHING HERE FETCHES. Every input is already loaded and already guarded by the
 * page. This module only decides which figures are honest to print, what sentence
 * says where they came from, and which doors the closing block carries.
 *
 * ONE PAIR, ONE TRACE, ONE STAMP. `resolveLivePair` is the single place the
 * active count is chosen, and it returns the median beside it, the sentence that
 * covers both, and the clock that dates them, so no figure can be dated by
 * another query's clock and no median can describe a different set from the count
 * next to it. The old chain picked the count in one place and the median in
 * another, and it ended at a median CLOSED SALE price published under the label
 * "Median list" on three community pages (lib/market/tile-medians.ts).
 */

import { v3Text, type V3InstrumentFigure, type V3QuietItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

type Tile = Parameters<typeof medianListPriceOfTiles>[0][number]

export type LivePair = {
  /** Null, never 0, when every source was silent. Absent is not zero (§0). */
  count: number | null
  /** The asking-price median of the SAME homes the count counts. */
  median: number | null
  /** The section 0 sentence covering both, without the word "Source". */
  trace: string
  /** The clock belonging to that source, or null when the source carries none. */
  stamp: string | null
  /**
   * True when the count IS a tile set this page holds, the homes the Field
   * plots and lists. False when it came from a mart row that carries no tiles.
   *
   * The page reads it to decide where the count's DOOR goes. A figure reading
   * "36 homes for sale" may only link somewhere that publishes those 36, and
   * the subdivision-name browse page does not: it filters on the literal MLS
   * SubdivisionName, which is the undercount the alias-aware set exists to
   * correct (/communities/tetherow 36 against /homes-for-sale/bend/tetherow 30,
   * curl-verified 2026-08-12). When the count is a tile set, the honest door is
   * this page's own Field, which holds exactly those homes.
   */
  fromTiles: boolean
}

/**
 * The live pair, in priority order:
 *
 *  1. A resort in its city -> the alias-aware set. A resort's homes are tagged
 *     under many MLS subdivision names, so the literal-name query undercounts
 *     every one of them, and this is the set that makes the figure here match
 *     the city ledger.
 *  2. A trustworthy boundary -> the single-family actives inside it. NOT the raw
 *     `listings_in_boundary` pin count, which filters on status only and so
 *     counts condos, land, and townhomes under a label that says single-family.
 *  3. Otherwise -> the homes resolved by MLS subdivision name.
 *  4. The market pulse row, when one exists for this community.
 *  5. The community snapshot, whose count and median are computed from one active
 *     set by the same view, so they pair honestly even with no tiles.
 */
export function resolveLivePair(input: {
  communityName: string
  subdivision: string
  boundaryRowCap: number
  aliasAwareCount: number | null
  resortTiles: readonly Tile[]
  communityTiles: readonly Tile[]
  boundaryReliable: boolean
  usedSubdivisionNarrowing: boolean
  pulse: { activeCount: number | null, medianListPrice: number | null, refreshedAt: string | null } | null
  snapshot: { activeSfrCount: number | null, medianListPrice: number | null, refreshedAt: string | null } | null
}): LivePair {
  const { communityName, communityTiles } = input

  if (input.aliasAwareCount != null) {
    return {
      count: input.aliasAwareCount,
      median: medianListPriceOfTiles(input.resortTiles),
      trace: `live MLS through Oregon Data Share, active single-family listings across every MLS subdivision name ${communityName} is filed under`,
      stamp: null,
      fromTiles: true,
    }
  }
  if (input.boundaryReliable && !input.usedSubdivisionNarrowing && communityTiles.length > 0) {
    return {
      count: communityTiles.length,
      median: medianListPriceOfTiles(communityTiles),
      trace: `live MLS through Oregon Data Share, active single-family listings inside the recorded ${communityName} boundary, which returns at most ${input.boundaryRowCap} homes`,
      stamp: null,
      fromTiles: true,
    }
  }
  if (communityTiles.length > 0) {
    return {
      count: communityTiles.length,
      median: medianListPriceOfTiles(communityTiles),
      trace: `live MLS through Oregon Data Share, active single-family listings whose MLS subdivision name is ${input.subdivision}`,
      stamp: null,
      fromTiles: true,
    }
  }
  if (input.pulse?.activeCount != null) {
    return {
      count: input.pulse.activeCount,
      median: input.pulse.medianListPrice,
      trace: `the ${communityName} row in the live market pulse, active single-family listings`,
      stamp: input.pulse.refreshedAt ?? null,
      fromTiles: false,
    }
  }
  return {
    count: input.snapshot?.activeSfrCount ?? null,
    median: input.snapshot?.medianListPrice ?? null,
    trace: `the ${communityName} community snapshot, active single-family listings tagged with the subdivision name`,
    stamp: input.snapshot?.refreshedAt ?? null,
    fromTiles: false,
  }
}

/**
 * The opening Instrument's figures. Every one is a door: PUBLIC-PRODUCT-OS calls
 * dead text naming a linkable thing a defect. The count and the median describe
 * the live pair. Months of supply and days to pending come from the market pulse
 * row, and the trace below names both sources rather than letting one borrow the
 * other's provenance.
 *
 * `mosDisplay` ARRIVES AS A STRING, already through formatMonthsOfSupply. This
 * builder does not round, because the rounding is the defect: `toFixed(1)` on a
 * raw 4.02 prints "4.0" under a headline reading "a balanced market" and above a
 * threshold clause saying 4 or less is a seller's market, while the same page's
 * FAQ, which goes through the canonical formatter, prints 4.1 and the Dataset
 * publishes 4.1. Three values for one statistic on one page. lib/format/months-
 * of-supply.ts is the single boundary-safe rule and the page calls it.
 */
export function buildLiveFigures(input: {
  activeCount: number | null
  medianListPrice: number | null
  /** Preformatted by lib/format/months-of-supply. Null when it is not publishable. */
  mosDisplay: string | null
  medianDaysToPending: number | null
  /** The door to the SAME homes the count counts. See LivePair.fromTiles. */
  countHref: string
  cityReportHref: string
}): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (input.activeCount != null) {
    figures.push({
      value: v3Text(input.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: input.countHref,
    })
  }
  if (input.medianListPrice != null) {
    figures.push({
      value: v3Text(formatPrice(input.medianListPrice)),
      label: v3Text('median list price'),
      href: input.countHref,
    })
  }
  if (input.mosDisplay != null) {
    figures.push({
      value: v3Text(input.mosDisplay),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  if (input.medianDaysToPending != null) {
    figures.push({
      value: v3Text(String(input.medianDaysToPending)),
      label: v3Text('median days to pending'),
      href: input.cityReportHref,
    })
  }
  return figures
}

/**
 * The pair's trace, with the pulse clause appended only when a pulse-sourced
 * figure is actually on screen, and the months-of-supply clauses appended only
 * when the months-of-supply FIGURE is. The thresholds are never restated in page
 * copy: they come from lib/market/classify.ts, which is also what computes the
 * verdict beside them (CLAUDE.md section 0).
 *
 * Naming each pulse figure separately matters because they no longer travel
 * together. The old single flag printed the formula and both thresholds whenever
 * EITHER figure showed, so a page carrying only days to pending published the
 * months-of-supply methodology with no months-of-supply figure anywhere on it.
 */
export function buildLiveTrace(input: {
  communityName: string
  pairTrace: string
  showsMonthsOfSupply: boolean
  showsDaysToPending: boolean
}): string {
  const clauses: string[] = []
  if (input.showsMonthsOfSupply && input.showsDaysToPending) {
    clauses.push(`Months of supply and days to pending come from the ${input.communityName} market pulse row.`)
  } else if (input.showsMonthsOfSupply) {
    clauses.push(`Months of supply comes from the ${input.communityName} market pulse row.`)
  } else if (input.showsDaysToPending) {
    clauses.push(`Median days to pending comes from the ${input.communityName} market pulse row.`)
  }
  if (input.showsMonthsOfSupply) clauses.push(MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE)
  if (clauses.length === 0) return input.pairTrace
  return `${input.pairTrace}. ${clauses.join(' ')}`
}

/**
 * The closed-sale Instrument's figures. A different population from the live
 * pair: homes that sold, not homes for sale, so they sit in their own section
 * under their own trace and never join the set above.
 */
export function buildClosedFigures(input: {
  medianSalePrice: number | null
  soldCount: number | null
  medianDaysOnMarket: number | null
  /** This place's market page, already place-filtered. */
  marketHref: string
}): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (input.medianSalePrice != null && input.medianSalePrice > 0) {
    figures.push({
      value: v3Text(formatPrice(input.medianSalePrice)),
      label: v3Text('median sale price'),
      href: input.marketHref,
    })
  }
  if (input.soldCount != null && input.soldCount > 0) {
    figures.push({
      value: v3Text(input.soldCount.toLocaleString('en-US')),
      label: v3Text('homes sold'),
      href: input.marketHref,
    })
  }
  const daysOnMarket = publishDaysFigure(input.medianDaysOnMarket)
  if (daysOnMarket) {
    figures.push({
      value: v3Text(daysOnMarket),
      label: v3Text('median days on market'),
      href: input.marketHref,
    })
  }
  return figures
}

/**
 * The closing block: the verified questions, then every destination this node
 * owes the graph (page-inventory.json records them as its exits). A door is
 * offered only when the thing behind it exists.
 *
 * TWO LABELS CARRY A CLAIM, SO BOTH ARE WRITTEN TO WHAT IS ACTUALLY BEHIND THEM.
 *
 * The browse door said "Every <community> home for sale". It is not: that route
 * filters on the literal MLS SubdivisionName and this page counts alias-aware, so
 * on 2026-08-12 /communities/tetherow published 36 while /homes-for-sale/bend/
 * tetherow published 30, a gap this page's own markup proves, since it links
 * 19504 Century Drive under the subdivision "Roald West", counted in the 36 and
 * absent from the 30. The door stays, because a Tetherow-filtered search is a
 * real and useful node. The word "every" goes, because only the alias-aware set
 * on this page is every one. Alias-awareness on the browse route is the real fix
 * and is reported to the orchestrator, since that route is not this unit's.
 *
 * The alerts door is new and it is a restoration, not an addition: the block this
 * sheet replaced ended its success state with "Sign in to manage alerts", and
 * V3Sheet renders prose, not links, so the route to manage a subscription an
 * email-capture form just created has to be a door here.
 *
 * THE SELL DOOR CARRIES ITS ORIGIN. `/sell#get-value` written bare drops
 * `?from=<path>`, which app/lp/seller-home-value/actions.ts turns into the CRM
 * source attribution, so the lead still arrives and just stops saying which
 * community page produced it, invisible in QA, and completed valuations per page
 * is this program's KPI. lib/site/valuation-href.ts is the one way to build it
 * (migration-recipe.md addendum 2026-08-11), and `pagePath` is what it carries.
 */
export function buildExploreEdges(input: {
  communityName: string
  cityName: string
  citySlug: string | null
  /** Place-filtered Homes URL (city + community slug). */
  browseHref: string
  /** Place-filtered Market URL for this community. */
  communityMarketHref: string
  cityReportHref: string
  /** This page's own path, e.g. '/communities/tetherow'. The valuation origin. */
  pagePath: string
  faqs: readonly { question: string, answer: string }[]
  golfCourses: readonly { slug: string, name: string }[]
  /** Registry resort list. Quiet doors, not a second hardcoded set. */
  resortItems: readonly V3QuietItem[]
}): V3QuietItem[] {
  const { citySlug, cityName } = input
  return [
    ...input.faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer })),
    { label: `Search ${input.communityName} homes`, href: input.browseHref },
    { label: `${input.communityName} market report`, href: input.communityMarketHref },
    { label: 'Manage your listing alerts', href: '/login?returnUrl=%2Faccount%2Fsaved-searches' },
    ...(citySlug ? [{ label: `${cityName} homes for sale`, href: homesForSalePath(cityName) }] : []),
    { label: `${cityName} market report`, href: input.cityReportHref },
    ...(citySlug ? [{ label: `About ${cityName}`, href: `/cities/${citySlug}` }] : []),
    ...(citySlug ? [{ label: `Open houses in ${cityName}`, href: `/open-houses/${citySlug}` }] : []),
    ...input.golfCourses.map((c) => ({
      label: `${c.name} golf course`,
      href: `/central-oregon/golf/${c.slug}`,
    })),
    ...input.resortItems,
    { label: 'Every Central Oregon community', href: '/communities' },
    { label: 'Central Oregon housing market', href: '/housing-market' },
    { label: 'Value my home', href: valuationHref(input.pagePath) },
    { label: 'Talk to a broker', href: '/contact' },
  ]
}
