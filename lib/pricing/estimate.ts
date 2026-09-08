/**
 * Close-price estimate from a matched set.
 *
 * Time: walk the monthly market index between the comp's close and the as-of
 * date (lib/pricing/market-path.ts). A +3%/month run and a flat year are
 * different factors. The old single YoY smear is not used here.
 *
 * GLA: 50% of time-adjusted $/sqft on the size delta (appraisal convention).
 * Story: measured 13.5% one-story premium, 2024+ CO SFR 1600–2200.
 * Beds/baths/age: match filters, not stacked dollar lines.
 */

import { computePricing } from '@/lib/cma/pricing'
import type { CmaSiteData } from '@/lib/cma/county'
import { attachSellerNet, resolveConcessions, sellerNetFromPrice } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { citySlug, storyAdjustment, type StoryClass } from '@/lib/pricing/classes'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import {
  describeIndexShape,
  describePath,
  INDEX_MIN_N,
  isCompleteMonth,
  marketIndexTrend,
  marketPath,
  timeAdjustAlongPath,
  type MarketIndexPoint,
  type MarketPath,
} from '@/lib/pricing/market-path'
import { failedListAsk } from '@/lib/pricing/expired-list-cap'
import {
  reconcileAdjustedSales,
  weightedAdjustedPrice,
  type ReconcilableSale,
} from '@/lib/pricing/reconciliation'
import { applyFailedAskCap as applyExpiredFailedAskCap } from '@/lib/cma/expired-audit'

const SIZE_ADJ_FACTOR = 0.5
const MS_PER_MONTH = 30.44 * 86_400_000
/** Drop a comp whose time-adjusted $/sqft is this far from the set median. */
const PPSF_OUTLIER = 0.12

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

/** Interpolated percentile of a sorted-ascending numeric array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const frac = idx - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

function asSaleToList(n: number | null | undefined): number | null {
  return usableSaleToAskRatio(n)
}

function listFromClose(close: number, ratio: number | null): number {
  if (ratio != null && ratio > 0) return round1000(close / ratio)
  return close
}

/**
 * Sale band from the same trimmed $/sqft set as the close. These are
 * contract prices, not list prices.
 */
export function saleBandFromAdjusted(
  subjectSqft: number,
  adjusted: Array<{ ppsfTimeAdjusted: number }>,
): { low: number; mid: number; high: number } | null {
  if (subjectSqft <= 0 || adjusted.length < PRICING_MIN_COMPS) return null
  const trimmed = trimPpsfOutliers(adjusted)
  const vals = trimmed.map((r) => r.ppsfTimeAdjusted).filter((n) => n > 0).sort((a, b) => a - b)
  if (vals.length < PRICING_MIN_COMPS) return null
  return {
    low: round1000(percentile(vals, 0.25) * subjectSqft),
    mid: round1000(percentile(vals, 0.5) * subjectSqft),
    high: round1000(percentile(vals, 0.75) * subjectSqft),
  }
}

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000
}

/**
 * THE PRICING UNIT. Below a million a home is priced to the thousand; above it
 * to the five thousand. Nobody in this market writes an asking price, or reads
 * a value range, to the dollar — and cma-65365-concorde shipped "worth
 * $1,264,174 to $1,748,776", six digits of false precision on a figure whose
 * inputs are six sales.
 *
 * The range is rounded ONCE, here, and every surface reads the rounded figure:
 * the cover, `rangeRule.adjustedLow/High`, the sentence that explains the rule,
 * and the list tiers derived from it. A renderer that rounds again for display
 * is how two pages of the same document end up disagreeing.
 */
export function priceRoundingStep(n: number): number {
  return Math.abs(n) >= 1_000_000 ? 5_000 : 1_000
}

/**
 * "five", not "5". A count under ten reads as a word in seller prose; above it
 * the numeral is what a reader scans for.
 */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
export function countWord(n: number, capitalize = false): string {
  const word = n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n]! : String(n)
  return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

/** The low end of a range never rounds up into the evidence. */
export function roundPriceDown(n: number): number {
  if (!Number.isFinite(n)) return n
  return Math.floor(n / priceRoundingStep(n)) * priceRoundingStep(n)
}

/** The high end never rounds down out of it. */
export function roundPriceUp(n: number): number {
  if (!Number.isFinite(n)) return n
  return Math.ceil(n / priceRoundingStep(n)) * priceRoundingStep(n)
}

/** At or above this many sales the range drops one at each end. */
export const RANGE_TRIM_MIN_N = 6

/**
 * Redfin's ±50% exclusion, applied to every sale-to-ask ratio that reaches the
 * list-price step. Its definitions for share-sold-above-list and sale-to-list
 * both drop closes 50 percent above or below the ask (fetched 2026-09-07); ours
 * had no outlier rule at all, so one related-party transfer at 0.4x could bend
 * the ratio the whole recommendation is divided by.
 */
export const SALE_TO_ASK_MIN = 0.5
export const SALE_TO_ASK_MAX = 1.5

/** Months of index the printed time-adjustment rate is measured over. */
export const TIME_ADJUSTMENT_WINDOW_MONTHS = 12

export interface PricingTimeAdjustment {
  /** Compound monthly change in the local price a square foot, percent. */
  pctPerMonth: number | null
  /**
   * The move across the whole window, percent. THIS is what the sentence
   * prints: it is the size of the path each sale is walked along, and unlike a
   * monthly rate a reader cannot multiply it out into a number the grid does
   * not show.
   */
  pctOverWindow: number | null
  windowMonths: number
  /** Sales behind that rate. */
  n: number
  /**
   * Which basis the date adjustment actually used on this build. The
   * `-trailing-3` suffix is the rule, not a label: the endpoint is the median
   * of the last three COMPLETE months of the city index, never the running
   * month (R2d, 2026-09-08).
   */
  basis: 'city-monthly-index-trailing-3' | 'year-over-year' | 'none'
  /** The complete months the endpoint is the median of, oldest first. */
  referenceMonths?: string[]
  /**
   * The shape of the window, derived from the same smoothed series every sale
   * walks: where it peaked or troughed, how far it has come back, and which
   * months move a sale up and which move it down. Absent on the fallback
   * bases, which have no series to read.
   */
  shape?: import('@/lib/pricing/market-path').IndexShape
  /**
   * Why the monthly index was not used, on the `year-over-year` basis. The
   * printed sentence carries it: three Bend documents were built minutes apart
   * on two different bases and none of them said so.
   */
  indexUnavailableReason?: string | null
  source: {
    table: string
    filter: string
    fetchedAt: string
    query: string
  }
  /** The basis in one sentence, for the line beside the first adjusted sale. */
  sentence: string
}

/**
 * The basis the date adjustment used, written out. Fannie Mae B4-1.3-09
 * requires the report to describe the data source and technique behind a time
 * adjustment; no chapter showed it (research brief 2026-09-07, item 5).
 *
 * Two bases, because the engine has two paths: the monthly city index the
 * facts path walks sale by sale, and — where there is no index — the
 * year-over-year median move the listings path spreads across the months.
 * Whichever one moved the numbers is the one printed.
 *
 * THE SENTENCE MUST DESCRIBE WHAT IS APPLIED (R2d, 2026-09-08). The round-two
 * document printed "moved down 0.4 percent a month" beside a grid column that
 * ran to −11.48 percent on a 4.5-month-old sale, because a monthly rate is not
 * what any sale is moved by. What is applied is the change in the city's
 * median price a square foot between the month the sale closed and the last
 * three complete months, so that is what the sentence now says, ending on the
 * size of the whole path rather than a rate a reader could multiply out.
 */
export function buildTimeAdjustmentBasis(opts: {
  citySlug: string
  points: MarketIndexPoint[]
  asOf: string
  /** For the sentence. Falls back to "this city" when the build has no name. */
  cityName?: string | null
  yoyMedianPriceDeltaPct?: number | null
  fetchedAt?: string
  windowMonths?: number
  /** Why the monthly index was not used, when it was not. Printed. */
  indexUnavailableReason?: string | null
}): PricingTimeAdjustment {
  const windowMonths = opts.windowMonths ?? TIME_ADJUSTMENT_WINDOW_MONTHS
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString()
  const city = opts.cityName?.trim() ? `${opts.cityName.trim()}'s` : "this city's"
  const trend = marketIndexTrend({ points: opts.points, asOf: opts.asOf, windowMonths })
  if (trend.pctPerMonth != null) {
    const move = trend.pctOverWindow ?? 0
    const shape = describeIndexShape({ points: opts.points, asOf: opts.asOf, windowMonths })
    const applied = `Each sale is moved by the change in ${city} median price a square foot between the month it closed and the last three complete months`
    return {
      pctPerMonth: trend.pctPerMonth,
      pctOverWindow: trend.pctOverWindow,
      windowMonths,
      n: trend.n,
      basis: 'city-monthly-index-trailing-3',
      referenceMonths: trend.referenceMonths,
      source: {
        table: 'pricing_market_index',
        filter: `city_slug='${opts.citySlug}', months ${trend.months} with at least ${INDEX_MIN_N} sales in the ${windowMonths} months to ${opts.asOf.slice(0, 10)}, complete months only. Each month reads as the median of the three-month window centred on it; the endpoint is the median of the last three complete months (${trend.referenceMonths.join(', ') || 'none'}), never the running month. Level ${trend.fromPpsf} to ${trend.toPpsf} $/sqft${trend.capped ? '; the ±25% path cap bound this window' : ''}`,
        fetchedAt,
        query: `select month, n, median_ppsf, median_sale_to_original, median_days_to_offer from pricing_market_index where city_slug = '${opts.citySlug}' order by month`,
      },
      shape,
      // THE SENTENCE NAMES THE PATH, NOT THE ENDPOINT. It used to end on the
      // first-to-last move — "a path that fell 1.6 percent" — and the grid
      // beside it then moved five of seven sales UP, one by 4.33 percent.
      // The second sentence is the shape of the same series, derived in
      // describeIndexShape, never written by hand.
      sentence: shape.clause
        ? `${applied}. Over the last ${windowMonths} months that index ${shape.clause}. The index is built from ${trend.n.toLocaleString('en-US')} sales.`
        : move === 0
          ? `${applied}, a path that held flat over the last ${windowMonths} months across ${trend.n.toLocaleString('en-US')} sales.`
          : `${applied}, a path that ${move > 0 ? 'rose' : 'fell'} ${Math.abs(move).toFixed(1)} percent over the last ${windowMonths} months across ${trend.n.toLocaleString('en-US')} sales.`,
    }
  }
  const yoy = opts.yoyMedianPriceDeltaPct
  if (yoy != null && Number.isFinite(yoy)) {
    const perMonth = Math.round((yoy / 12) * 10) / 10
    return {
      pctPerMonth: perMonth,
      pctOverWindow: Math.round(yoy * 10) / 10,
      windowMonths: 12,
      n: 0,
      basis: 'year-over-year',
      source: {
        table: 'market context (market_stats_cache / market_pulse_live)',
        filter: `Year-over-year median sale price change for this city, ${yoy}% over 12 months, spread evenly across the months`,
        fetchedAt,
        query: 'getCmaMarketContext(subject) -> yoyMedianPriceDeltaPct',
      },
      indexUnavailableReason: opts.indexUnavailableReason ?? 'no monthly index for this city',
      // SAY WHICH METHOD, AND WHY. 1617 NW 8th fell to this basis four minutes
      // after two other Bend documents used the monthly index, and nothing in
      // any of the three said they were measured differently.
      sentence: `There is no monthly price index behind this document, ${
        opts.indexUnavailableReason ?? 'no monthly index for this city'
      }, so each sale is moved by the year-over-year change instead. Median sale prices in this city are ${yoy > 0 ? 'up' : 'down'} ${Math.abs(yoy).toFixed(1)} percent against a year ago, about ${Math.abs(perMonth).toFixed(1)} percent a month, and each sale is moved by that rate for the months since it closed.`,
    }
  }
  return {
    pctPerMonth: null,
    pctOverWindow: null,
    windowMonths,
    n: 0,
    basis: 'none',
    source: {
      table: 'none',
      filter: 'No monthly index and no year-over-year figure for this city, so no sale was moved for its date.',
      fetchedAt,
      query: '',
    },
    sentence: 'There is no measured price path for this city, so no sale below was moved for when it sold.',
  }
}

export type PricingRangeRuleName = 'trimmed-one-each-end' | 'min-max'

export interface PricingRangeRule {
  /** Which rule produced the low and high below. */
  rule: PricingRangeRuleName
  /** Sales the rule ran over. */
  n: number
  /** Sales left after the rule (n, or n − 2). */
  kept: number
  /** The low and high of the PRINTED adjusted sale prices, before any ask step. */
  adjustedLow: number
  adjustedHigh: number
  /** The share of the original ask sales are closing at, used to carry the value to an ask. */
  saleToAskRatio: number | null
  /** Where that share came from. */
  saleToAskSource: 'city-index' | 'market-context' | 'these-sales' | 'none'
  /** Sale-to-ask ratios dropped by the ±50% rule. */
  ratiosExcluded: number
  /** The rule in one sentence, in the document's own words. */
  sentence: string
}

/**
 * SET ASIDE MEANS SET ASIDE (tasteReview round three, §2 item 1).
 *
 * The range rule trimmed one sale at each end to draw the range and then
 * the price was reconciled over ALL of them, so on cma-65365-concorde the two
 * sales the document said had been set aside carried 38.4 percent of the
 * recommended price, and on cma-19968 22.3 percent. A reader told a sale was
 * removed will not expect it to be the second-heaviest sale in the answer.
 *
 * One rule, applied everywhere: at six or more priced sales the single highest
 * and the single lowest adjusted price are set aside. They stay in the grid as
 * evidence and they carry NOTHING — not a weight, not a dollar of the printed
 * price, not an end of the range. This is the one place that decides which
 * sales those are, so the range, the weights, the sentence and the count a
 * reader can check cannot come apart.
 *
 * The kept and set-aside lists both keep the ORDER they were given: the grid
 * renders in that order and a weight numbered three must be the sale numbered
 * three.
 */
export function partitionByRangeRule<T extends { adjustedPrice?: number | null }>(
  sales: readonly T[],
): { priced: T[]; kept: T[]; setAside: T[]; rule: PricingRangeRuleName | null } {
  const priced = sales.filter(
    (s): s is T & { adjustedPrice: number } =>
      s.adjustedPrice != null && Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0,
  )
  if (priced.length < PRICING_MIN_COMPS) {
    return { priced, kept: priced, setAside: [], rule: null }
  }
  if (priced.length < RANGE_TRIM_MIN_N) {
    return { priced, kept: priced, setAside: [], rule: 'min-max' }
  }
  // Sort a COPY of the indices so ties resolve by position and the original
  // order survives into both lists.
  const order = priced.map((_, i) => i).sort((a, b) => priced[a]!.adjustedPrice - priced[b]!.adjustedPrice)
  const aside = new Set([order[0]!, order[order.length - 1]!])
  return {
    priced,
    kept: priced.filter((_, i) => !aside.has(i)),
    setAside: priced.filter((_, i) => aside.has(i)),
    rule: 'trimmed-one-each-end',
  }
}

/**
 * The printed range, off the partition: the spread of the KEPT sales. Under
 * `trimmed-one-each-end` that is the same low and high the old sorted slice
 * produced — the second-lowest and second-highest — reached the one way that
 * cannot disagree with the weights.
 */
export function rangeFromPartition(part: {
  priced: readonly { adjustedPrice?: number | null }[]
  kept: readonly { adjustedPrice?: number | null }[]
  rule: PricingRangeRuleName | null
}): { low: number; high: number; rule: PricingRangeRuleName; n: number; kept: number } | null {
  if (part.rule == null || part.kept.length === 0) return null
  const vals = part.kept.map((k) => k.adjustedPrice ?? 0).sort((a, b) => a - b)
  return {
    low: vals[0]!,
    high: vals[vals.length - 1]!,
    rule: part.rule,
    n: part.priced.length,
    kept: part.kept.length,
  }
}

/** A sale-to-ask ratio a list price may be divided by. */
export function usableSaleToAskRatio(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const ratio = n > 2 ? n / 100 : n
  return ratio >= SALE_TO_ASK_MIN && ratio <= SALE_TO_ASK_MAX ? ratio : null
}

/** Keep comps whose time-adjusted $/sqft sits inside the set. */
export function trimPpsfOutliers<T extends { ppsfTimeAdjusted: number }>(rows: T[]): T[] {
  if (rows.length < 4) return rows
  const mid = median(rows.map((r) => r.ppsfTimeAdjusted))
  if (mid <= 0) return rows
  const kept = rows.filter((r) => Math.abs(r.ppsfTimeAdjusted - mid) / mid <= PPSF_OUTLIER)
  return kept.length >= 3 ? kept : rows
}

/**
 * Close-price point estimate: median time-adjusted $/sqft of the trimmed
 * set, times subject GLA. On a tight same-subdivision set this beats a
 * weighted mix of 10 mixed-tier sales.
 */
export function predictedCloseFromAdjusted(
  subjectSqft: number,
  adjusted: Array<{ ppsfTimeAdjusted: number }>,
): number | null {
  if (subjectSqft <= 0 || adjusted.length < PRICING_MIN_COMPS) return null
  const trimmed = trimPpsfOutliers(adjusted)
  const ppsf = median(trimmed.map((r) => r.ppsfTimeAdjusted).filter((n) => n > 0))
  if (ppsf <= 0) return null
  return round1000(ppsf * subjectSqft)
}

/**
 * Live listings only: the close is current ask × 0.98. Comps do not pick
 * that close or the multiplier. A thin same-subdivision set's sale-to-ask
 * (one nearby sale at 1.18× its own ask) is how a $1.20M list became a
 * $1.418M close estimate. Measured 2024–mid-2026 detached, last_ask × 0.98
 * is inside 10% on 98.31% of 8,648 listed closes.
 *
 * A closed, expired, withdrawn, or canceled ListPrice is not today's ask.
 * Comp $/sqft prices those subjects. An ask 40%+ from a tight
 * same-subdivision set is flagged, not substituted.
 */
export const ASK_HAIRCUT = 0.98
export const ASK_AGREE = 0.2
export const ASK_OFF_MARKET = 0.4
const LIVE_ASK = /active|pending|coming/i

/** Current list price, or null when the home is not on the market. */
export function currentListAsk(
  subject: Pick<CmaSubject, 'lastListPrice' | 'standardStatus'>,
): number | null {
  const ask = subject.lastListPrice
  if (ask == null || !(ask > 0)) return null
  return LIVE_ASK.test(subject.standardStatus ?? '') ? ask : null
}

export function reconcileAskAndComps(opts: {
  compClose: number | null
  lastAsk: number | null | undefined
  /** Unused for the close pick. Kept so callers can still pass a measured sto. */
  medianSaleToAsk?: number | null
  /** Unused for the close pick. Kept so callers can still pass the flag. */
  qualitySet?: boolean
}): { close: number | null; source: 'ask' | 'comps' | 'none'; offMarketAsk?: boolean } {
  const ask = opts.lastAsk != null && opts.lastAsk > 0 ? opts.lastAsk : null
  const askClose = ask != null ? round1000(ask * ASK_HAIRCUT) : null
  if (askClose == null && opts.compClose == null) return { close: null, source: 'none' }
  if (askClose == null) return { close: opts.compClose, source: 'comps' }
  const offMarketAsk =
    opts.compClose != null &&
    opts.qualitySet === true &&
    Math.abs(askClose - opts.compClose) / opts.compClose >= ASK_OFF_MARKET
  return { close: askClose, source: 'ask', offMarketAsk }
}

export function pricingSaleToCmaComp(sale: SelectedPricingComp): CmaComp {
  const concessions = resolveConcessions({
    amount: sale.concessionsAmount,
    yn: sale.concessionsYn,
    closeDate: sale.closeDate,
  })
  return {
    listingKey: sale.listingKey,
    mlsNumber: sale.listNumber,
    address: sale.address,
    city: sale.city,
    subdivision: sale.subdivision,
    latitude: sale.latitude,
    longitude: sale.longitude,
    beds: sale.beds,
    baths: sale.baths,
    sqft: sale.sqft,
    lotAcres: sale.lotAcres,
    propertySubType: sale.productClass === 'detached' ? 'Single Family Residence' : sale.productClass,
    yearBuilt: sale.yearBuilt,
    photoUrl: sale.photoUrl,
    publicRemarks: sale.publicRemarks,
    viewDescription: null,
    taxAnnual: null,
    listPrice: sale.lastAsk,
    closePrice: sale.closePrice,
    concessionsAmount: concessions,
    concessionsYn: sale.concessionsYn,
    sellerNet: sellerNetFromPrice(sale.closePrice, concessions),
    closeDate: sale.closeDate,
    daysToOffer: sale.daysToOffer,
    domTotal: sale.cdom,
    selectionTier: sale.selectionTier,
    proximity: sale.proximity,
  }
}

export function adjustCompAlongMarket(opts: {
  subject: CmaSubject
  subjectStory: StoryClass
  sale: SelectedPricingComp
  saleStory: StoryClass
  points: MarketIndexPoint[]
  asOf: string
}): { adjusted: CmaAdjustedComp; path: MarketPath; pathNote: string } {
  return adjustCmaCompAlongMarket({ ...opts, comp: pricingSaleToCmaComp(opts.sale) })
}

/**
 * The same walk, off a comp the listings ladder produced.
 *
 * ONE CITY, ONE BASIS (tasteReview round three, §1). cma-1617-nw-8th is a Bend
 * document built four minutes after two other Bend documents, and it fell to
 * the year-over-year basis with `n: 0` while they walked the monthly index.
 * The cause was not the city slug and not a missing index: the facts ladder
 * returned under three sales, so `pickCompSource` sent it to the listings
 * ladder, the build only loaded `pricing_market_index` on the facts path, and
 * `usePath` additionally required every comp to carry a `sale_pricing_facts`
 * row. A comp off the listings ladder has a close date, a close price and a
 * living area, which is everything this walk needs — so it walks the same index
 * its city's other documents walk, and the only thing it cannot contribute is
 * the story class, which is a fact about the sale and not about the path.
 */
export function adjustCmaCompAlongMarket(opts: {
  subject: CmaSubject
  subjectStory: StoryClass
  comp: CmaComp
  saleStory: StoryClass
  points: MarketIndexPoint[]
  asOf: string
}): { adjusted: CmaAdjustedComp; path: MarketPath; pathNote: string } {
  const sale = opts.comp
  const path = marketPath({ points: opts.points, fromDate: sale.closeDate, toDate: opts.asOf })
  const timeAdjustedPrice = timeAdjustAlongPath(sale.closePrice, path)
  const timeAdjustment = timeAdjustedPrice - sale.closePrice
  const monthsSinceClose = Math.max(
    0,
    (new Date(opts.asOf).getTime() - new Date(sale.closeDate).getTime()) / MS_PER_MONTH,
  )
  const subjectSqft = opts.subject.sqft ?? 0
  const ppsfTimeAdjusted = sale.sqft > 0 ? timeAdjustedPrice / sale.sqft : 0
  const sizeAdjustment =
    subjectSqft > 0 ? Math.round((subjectSqft - sale.sqft) * ppsfTimeAdjusted * SIZE_ADJ_FACTOR) : 0
  const storyAdj = storyAdjustment(opts.subjectStory, opts.saleStory, timeAdjustedPrice)
  const adjustedPrice = timeAdjustedPrice + sizeAdjustment + storyAdj
  const sizeProximity = subjectSqft > 0 ? 1 / (1 + Math.abs(subjectSqft - sale.sqft) / subjectSqft) : 1
  const recency = 1 / (1 + monthsSinceClose / 12)
  const adjusted: CmaAdjustedComp = {
    ...sale,
    monthsSinceClose: +monthsSinceClose.toFixed(1),
    timeAdjustment,
    timeAdjustedPrice,
    ppsfTimeAdjusted: +ppsfTimeAdjusted.toFixed(2),
    sizeAdjustment,
    storyAdjustment: storyAdj,
    adjustedPrice,
    weight: +(sizeProximity * recency).toFixed(4),
  }
  return { adjusted, path, pathNote: `${sale.address}: ${describePath(path)}` }
}

export type EngineListResult = {
  predictedClose: number | null
  compsImpliedClose: number | null
  recommendedList: number | null
  conservativeList: number | null
  highEndList: number | null
  source: 'ask' | 'comps' | 'none'
  offMarketAsk?: boolean
  /** How the low and high were produced, and the ask step applied to them. */
  rangeRule?: PricingRangeRule | null
  /** The value the printed sales support, before the ask step. */
  reconciledValue?: number | null
}

/** One sale as the list step sees it: a $/sqft, and where the adjustments landed. */
export type EngineAdjustedSale = {
  ppsfTimeAdjusted: number
  adjustedPrice?: number
  weight?: number
}

/**
 * The only list/close formula. Listing stamps and the CMA cover both call
 * this. Method 1/2/3 stay on the evidence board; they do not pick the list.
 *
 * THE RANGE AND THE POINT BOTH COME OFF THE PRINTED SALES (D10). The low and
 * high are the spread of the per-sale adjusted prices, trimmed one at each end
 * once there are six of them; the point is those same prices reconciled by the
 * weights the document prints (lib/pricing/reconciliation.ts). Both are then
 * carried to an ASK by the share of the original ask sales are closing at.
 * A caller that has no adjusted prices — or a land subject with no living
 * area — still gets the older $/sqft percentile band, which is what it always
 * had.
 */
export function listPriceFromEngine(opts: {
  subjectSqft: number
  lastAsk: number | null | undefined
  adjusted: EngineAdjustedSale[]
  saleToAskRatios: number[]
  asOfSaleToOriginal?: number | null
  marketSaleToList?: number | null
  qualitySet: boolean
  methodFallback?: number | null
}): EngineListResult {
  const band = saleBandFromAdjusted(opts.subjectSqft, opts.adjusted)
  // The sales that carry a printed adjusted price, split by the ONE range rule
  // (partitionByRangeRule). Land has no living area and prices per acre, so it
  // stays on the $/sqft path it already used.
  const part = opts.subjectSqft > 0
    ? partitionByRangeRule(opts.adjusted)
    : { priced: [], kept: [], setAside: [], rule: null as PricingRangeRuleName | null }
  const range = rangeFromPartition(part)
  // The price is reconciled over the KEPT sales only. A sale the document says
  // was set aside carries none of it.
  const reconciledValue =
    range != null
      ? weightedAdjustedPrice(
          part.kept.map((a) => ({ adjustedPrice: a.adjustedPrice ?? 0, weight: a.weight ?? 0 })),
        )
      : null

  const compsImpliedClose =
    reconciledValue ?? band?.mid ?? predictedCloseFromAdjusted(opts.subjectSqft, opts.adjusted)
  const reconciled = reconcileAskAndComps({
    compClose: compsImpliedClose,
    lastAsk: opts.lastAsk,
    qualitySet: opts.qualitySet,
  })
  const predictedClose = reconciled.close
  const mid = predictedClose ?? opts.methodFallback ?? null

  const kept = opts.saleToAskRatios
    .map(usableSaleToAskRatio)
    .filter((n): n is number => n != null)
  const ratiosExcluded = opts.saleToAskRatios.filter((n) => Number.isFinite(n) && n > 0).length - kept.length
  const fromIndex = asSaleToList(opts.asOfSaleToOriginal)
  const fromMarket = fromIndex == null ? asSaleToList(opts.marketSaleToList) : null
  const fromSales =
    fromIndex == null && fromMarket == null && kept.length >= 3
      ? [...kept].sort((a, b) => a - b)[Math.floor(kept.length / 2)]!
      : null
  const ratio = fromIndex ?? fromMarket ?? fromSales
  const saleToAskSource: PricingRangeRule['saleToAskSource'] =
    fromIndex != null ? 'city-index' : fromMarket != null ? 'market-context' : fromSales != null ? 'these-sales' : 'none'

  // Rounded ONCE, before anything is derived from it: the value range the cover
  // prints, the sentence that explains it, and the list tiers all start here,
  // so no two surfaces can round the same spread differently.
  const rangeLow = range != null ? roundPriceDown(range.low) : null
  const rangeHigh = range != null ? roundPriceUp(range.high) : null

  const recommendedList = mid != null ? listFromClose(mid, ratio) : null
  let conservativeList = rangeLow != null ? listFromClose(rangeLow, ratio) : band != null ? listFromClose(band.low, ratio) : null
  let highEndList = rangeHigh != null ? listFromClose(rangeHigh, ratio) : band != null ? listFromClose(band.high, ratio) : null
  if (reconciled.source === 'comps' && recommendedList != null) {
    if (conservativeList != null && conservativeList > recommendedList) conservativeList = recommendedList
    if (highEndList != null && highEndList < recommendedList) highEndList = recommendedList
  }

  const askStep =
    ratio != null
      ? ` Homes in this city are closing at ${(ratio * 100).toFixed(1)} percent of the price they first asked, so each figure is carried to an asking price at that share.`
      : ' No local share of the original ask was available, so the asking prices are the adjusted sale prices themselves.'
  const rangeRule: PricingRangeRule | null =
    range != null && rangeLow != null && rangeHigh != null
      ? {
          rule: range.rule,
          n: range.n,
          kept: range.kept,
          adjustedLow: rangeLow,
          adjustedHigh: rangeHigh,
          saleToAskRatio: ratio,
          saleToAskSource,
          ratiosExcluded,
          // ONE COUNT. The sentence used to open on the number of sales the
          // rule ran over (7) and then describe a spread of the five it kept,
          // so the printed n, the strip's n and the sentence's n were three
          // different claims about the same picture. It now names the sales
          // that produced the range, and the ones that did not, separately.
          sentence:
            range.rule === 'trimmed-one-each-end'
              ? `The range is the spread of the ${countWord(range.kept)} sale prices behind this price, adjusted for date and size: $${rangeLow.toLocaleString('en-US')} to $${rangeHigh.toLocaleString('en-US')}. ${
                  range.n - range.kept === 1
                    ? 'One more sale sat outside every one of them and was set aside'
                    : `${countWord(range.n - range.kept, true)} more sales sat outside every one of them and were set aside`
                }, so no single sale could set the range.${askStep}`
              : `The range is the spread of all ${countWord(range.n)} sale prices adjusted for date and size: $${rangeLow.toLocaleString('en-US')} to $${rangeHigh.toLocaleString('en-US')}.${askStep}`,
        }
      : null

  return {
    predictedClose,
    compsImpliedClose,
    recommendedList,
    conservativeList,
    highEndList,
    source: reconciled.source,
    offMarketAsk: reconciled.offMarketAsk,
    rangeRule,
    reconciledValue,
  }
}

/**
 * The cover's value range, rounded at the pricing unit on every path out of
 * `applyEngineRecommendedList` — including the two early returns, where a
 * broker override or a missing engine list used to leave the raw figure from
 * `lib/cma/pricing.ts` on the cover.
 */
function roundValueRange(pricing: CmaPricing): CmaPricing {
  const low = Math.min(pricing.valueLow, pricing.valueHigh)
  const high = Math.max(pricing.valueLow, pricing.valueHigh)
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) return pricing
  return { ...pricing, valueLow: roundPriceDown(low), valueHigh: roundPriceUp(high) }
}

function clipCoverToFailedAsk(pricing: CmaPricing, failedAsk: number | null | undefined): CmaPricing {
  const ask = failedAsk != null && Number.isFinite(failedAsk) && failedAsk > 0 ? failedAsk : null
  if (ask == null) return pricing
  const next: CmaPricing = { ...pricing, notes: [...pricing.notes] }
  const beforeRec = next.recommended
  const beforeHigh = next.highEnd
  applyExpiredFailedAskCap(next, { lastFailedListPrice: ask, offMarketDate: null })
  next.failedAsk = ask
  next.failedAskCapped = next.recommended !== beforeRec || next.highEnd !== beforeHigh
  return next
}

/** Write the engine list onto the CMA cover. A broker override still wins. */
export function applyEngineRecommendedList(
  pricing: CmaPricing,
  engine: Pick<
    EngineListResult,
    'recommendedList' | 'predictedClose' | 'conservativeList' | 'highEndList' | 'source'
  > & { rangeRule?: PricingRangeRule | null },
  opts: { priceOverride?: number | null; lastAsk?: number | null; failedAsk?: number | null } = {},
): CmaPricing {
  const close =
    engine.predictedClose != null && engine.predictedClose > 0 ? engine.predictedClose : (pricing.predictedClose ?? null)
  // How the printed low and high were produced rides along on every path,
  // including a broker override — the rule describes the evidence, not the
  // number someone typed over it.
  if (engine.rangeRule !== undefined) pricing.rangeRule = engine.rangeRule
  if (opts.priceOverride != null && Number.isFinite(opts.priceOverride) && opts.priceOverride > 0) {
    return clipCoverToFailedAsk(roundValueRange({ ...pricing, predictedClose: close }), opts.failedAsk)
  }
  const list = engine.recommendedList
  if (list == null || !Number.isFinite(list) || list <= 0) {
    return roundValueRange(close != null ? { ...pricing, predictedClose: close } : pricing)
  }
  const conservative =
    engine.conservativeList != null && engine.conservativeList > 0 ? engine.conservativeList : list
  const highEnd = engine.highEndList != null && engine.highEndList > 0 ? engine.highEndList : list

  // SHOW BOTH, NEVER BLEND (Matt 2026-08-27). On a live-listed subject the
  // engine's list is ask×0.98÷sale-to-list — the subject's own asking price
  // wearing a ratio. Printing that as OUR recommendation restates the seller's
  // number back at them, and because the band stays comp-only it also landed
  // outside its own band on all three 2026-08-27 test builds (range-consistency
  // hard failures: Tumalo, Bluff, Florida). The recommendation on the ask path
  // is therefore the midpoint of the comp-supported band — the same "mid-range,
  // stay within support" placement the 2026-08-25 rule uses — and the ask ships
  // beside it as currentAsk, stated on the document, never averaged in.
  //
  // predictedClose keeps the moat's ask-derived close (measured: within 10% on
  // 98.31% of 8,648 listed closes) — that is a CLOSE estimate for admin, not
  // the seller-facing list recommendation. Listing stamps and public reads call
  // listPriceFromEngine directly and are untouched by this branch.
  if (engine.source === 'ask') {
    const bandLow = Math.min(conservative, highEnd)
    const bandHigh = Math.max(conservative, highEnd)
    const recommended = round1000((bandLow + bandHigh) / 2)
    const ask = opts.lastAsk != null && opts.lastAsk > 0 ? opts.lastAsk : null
    return clipCoverToFailedAsk(
      {
        ...pricing,
        recommended,
        conservative: bandLow,
        highEnd: bandHigh,
        // Rounded OUTWARD, so the recommendation (the midpoint of the band it
        // is drawn from) can never fall outside the range printed beside it.
        valueLow: roundPriceDown(bandLow),
        valueHigh: roundPriceUp(bandHigh),
        predictedClose: close,
        currentAsk: ask,
        askDerivedList: list,
        notes: pricing.notes,
      },
      opts.failedAsk,
    )
  }

  // D10: what the home is WORTH is the spread of the sale prices the document
  // prints, adjusted for date and size — not those figures carried to an ask,
  // and not a $/sqft percentile computed on a different basis. The three list
  // tiers below are that same evidence carried to an asking price, which is a
  // separate statement and is labelled as one. Where a caller has no adjusted
  // prices (a land subject prices per acre) the tiers stand in, as before.
  // rangeRule carries figures already rounded at the pricing unit; the tier
  // fallback (a land subject prices per acre and has no adjusted sale prices)
  // is rounded here, so both arrive at the cover on the same grid.
  const valueLow = engine.rangeRule?.adjustedLow ?? roundPriceDown(conservative)
  const valueHigh = engine.rangeRule?.adjustedHigh ?? roundPriceUp(highEnd)
  return clipCoverToFailedAsk(
    {
      ...pricing,
      recommended: list,
      conservative,
      highEnd,
      valueLow: Math.min(valueLow, valueHigh),
      valueHigh: Math.max(valueLow, valueHigh),
      predictedClose: close,
      notes: pricing.notes,
    },
    opts.failedAsk,
  )
}

/**
 * The index row the list step reads for sale-to-original and days-to-offer.
 *
 * COMPLETE MONTHS ONLY (R2d, 2026-09-08). This used to take the running month,
 * so on 2026-09-07 the ratio the recommended list price is divided by came
 * from Redmond's ten September sales rather than August's seventy-eight. Same
 * partial-month fault as the date adjustment, on the other half of the price.
 */
function asOfIndexPoint(points: MarketIndexPoint[], asOf: string): MarketIndexPoint | null {
  if (points.length === 0) return null
  return (
    points
      .filter((p) => p.n >= INDEX_MIN_N && isCompleteMonth(p.month, asOf))
      .sort((a, b) => b.month.localeCompare(a.month))[0] ?? null
  )
}

/** CMA build cover: same engine list as the listing stamp, one call site. */
export function applyEngineCoverToCmaPricing(
  pricing: CmaPricing,
  input: {
    subjectSqft: number
    lastAsk: number | null | undefined
    failedAsk?: number | null
    adjusted: Array<{ ppsfTimeAdjusted: number }>
    pricingSales: Array<{ closePrice: number; originalAsk: number | null; selectionTier?: string }>
    marketIndex: MarketIndexPoint[]
    asOf: string
    usedTiers: string[]
    priceOverride?: number | null
    marketSaleToList?: number | null
  },
): CmaPricing {
  const asOfPpsf = asOfIndexPoint(input.marketIndex, input.asOf)
  const saleToAskRatios = input.pricingSales
    .map((s) => (s.originalAsk && s.originalAsk > 0 ? s.closePrice / s.originalAsk : null))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const qualitySet =
    input.pricingSales.length >= 3 &&
    (input.pricingSales.every((s) => (s.selectionTier ?? '').startsWith('subdivision-')) ||
      (input.usedTiers.length > 0 && input.usedTiers.every((t) => t.startsWith('subdivision-'))))
  const engine = listPriceFromEngine({
    subjectSqft: input.subjectSqft,
    lastAsk: input.lastAsk,
    adjusted: input.adjusted,
    saleToAskRatios,
    asOfSaleToOriginal: asOfPpsf?.saleToOriginal,
    marketSaleToList: input.marketSaleToList,
    qualitySet,
    methodFallback: pricing.method3 ?? pricing.method1Mid,
  })
  return applyEngineRecommendedList(pricing, engine, {
    priceOverride: input.priceOverride,
    lastAsk: input.lastAsk,
    failedAsk: input.failedAsk,
  })
}

/** computePricing + engine cover. Keeps lib/cma/build.ts from growing. */
export function priceCmaSet(args: {
  subject: CmaSubject
  adjusted: CmaAdjustedComp[]
  market: CmaMarketContext | null
  input: { sellerImprovementsTotal?: number | null; priceOverride?: number | null }
  /** Parcel record. Land uses it for the infrastructure schedule; homes ignore it. */
  site?: CmaSiteData | null
  selection: {
    pricingSales?: Array<{ closePrice: number; originalAsk: number | null; selectionTier?: string }>
    tiersUsed: string[]
  }
  marketIndex: MarketIndexPoint[]
  asOf: string
  /**
   * Why `marketIndex` is empty, when it is. It reaches the printed sentence:
   * a document on the year-over-year basis says which method it used and why,
   * instead of looking identical to one built on the index (round three, §1).
   */
  indexUnavailableReason?: string | null
  /** Build path passes the shared `computePricing` so the valuation-engine gate stays honest. */
  computePricing?: typeof computePricing
}): CmaPricing | null {
  const priceFn = args.computePricing ?? computePricing
  const pricing = priceFn(args.subject, args.adjusted, args.market, {
    sellerImprovementsTotal: args.input.sellerImprovementsTotal ?? null,
    priceOverride: args.input.priceOverride ?? null,
    site: args.site ?? null,
  })
  if (!pricing) return null
  // Which sale carried the price. Attached BEFORE the engine cover so the
  // weights the document prints are the weights the value was built from.
  //
  // The range rule runs FIRST, and the sales it sets aside never reach the
  // reconciliation: a sale the document says was removed carries none of the
  // price (tasteReview round three, §2 item 1). `listPriceFromEngine` runs the
  // same pure partition over the same array, so the printed weights and the
  // printed number come from one set.
  const part = partitionByRangeRule(args.adjusted)
  pricing.reconciliation = reconcileAdjustedSales({
    sales: part.kept as unknown as ReconcilableSale[],
    subjectSqft: args.subject.sqft ?? 0,
  })
  pricing.setAside = part.setAside.map((sale) => {
    const s = sale as unknown as CmaAdjustedComp
    const high = part.setAside.length > 1 && s.adjustedPrice === Math.max(...part.setAside.map((x) => (x as unknown as CmaAdjustedComp).adjustedPrice))
    return {
      listingKey: s.listingKey,
      address: s.address,
      adjustedPrice: Math.round(s.adjustedPrice),
      end: (high ? 'high' : 'low') as 'high' | 'low',
      reason: `${high ? 'highest' : 'lowest'} of the adjusted sales, set aside so one sale cannot set the range`,
    }
  })
  // What moved each sale for its date, stated where the document can print it.
  pricing.timeAdjustment = buildTimeAdjustmentBasis({
    citySlug: citySlug(args.subject.city),
    cityName: args.subject.city,
    points: args.marketIndex,
    asOf: args.asOf,
    yoyMedianPriceDeltaPct: args.market?.yoyMedianPriceDeltaPct ?? null,
    indexUnavailableReason: args.indexUnavailableReason ?? null,
  })
  return applyEngineCoverToCmaPricing(pricing, {
    subjectSqft: args.subject.sqft ?? 0,
    lastAsk: currentListAsk(args.subject),
    failedAsk: failedListAsk(args.subject),
    adjusted: args.adjusted,
    pricingSales: args.selection.pricingSales ?? [],
    marketIndex: args.marketIndex,
    asOf: args.asOf,
    usedTiers: args.selection.tiersUsed,
    priceOverride: args.input.priceOverride,
    marketSaleToList: args.market?.saleToListRatio,
  })
}

export function estimateClosePrice(opts: {
  subject: CmaSubject
  subjectStory: StoryClass
  comps: SelectedPricingComp[]
  compStories: StoryClass[]
  points: MarketIndexPoint[]
  asOf: string
  market: CmaMarketContext | null
}): {
  pricing: CmaPricing | null
  predictedClose: number | null
  /** Comps-implied close. Listed public over/under uses this, never the ask haircut. */
  compsImpliedClose: number | null
  recommendedList: number | null
  medianDaysToOffer: number | null
  pathNotes: string[]
  regime: 'rising' | 'flat' | 'falling' | 'mixed'
} {
  const pathNotes: string[] = []
  const regimes = new Set<string>()
  const adjusted = opts.comps.map((sale, i) => {
    const row = adjustCompAlongMarket({
      subject: opts.subject,
      subjectStory: opts.subjectStory,
      sale,
      saleStory: opts.compStories[i] ?? 'unknown',
      points: opts.points,
      asOf: opts.asOf,
    })
    pathNotes.push(row.pathNote)
    regimes.add(row.path.regime)
    return row.adjusted
  })
  const pricing = computePricing(opts.subject, adjusted, opts.market)
  const qualitySet =
    opts.comps.length >= 3 && opts.comps.every((c) => c.selectionTier.startsWith('subdivision-'))
  const asOfPpsf = asOfIndexPoint(opts.points, opts.asOf)
  const ratios = opts.comps
    .map((c) => (c.originalAsk && c.originalAsk > 0 ? c.closePrice / c.originalAsk : null))
    .filter((n): n is number => n != null && n > 0)
  const engine = listPriceFromEngine({
    subjectSqft: opts.subject.sqft ?? 0,
    lastAsk: currentListAsk(opts.subject),
    adjusted,
    saleToAskRatios: ratios,
    asOfSaleToOriginal: asOfPpsf?.saleToOriginal,
    marketSaleToList: opts.market?.saleToListRatio,
    qualitySet,
    methodFallback: pricing?.method3 ?? pricing?.method1Mid ?? null,
  })
  const predictedClose = engine.predictedClose
  attachSellerNet(pricing, opts.comps, predictedClose)
  if (pricing && predictedClose != null) {
    pricing.notes.unshift(
      engine.source === 'ask'
        ? `Close estimate is 98% of the last ask, $${predictedClose.toLocaleString('en-US')}.${
            engine.offMarketAsk
              ? ' The last ask is more than 40% away from the same-subdivision close. Review the list price before a seller signs it.'
              : ''
          }`
        : `Close estimate is the median time-adjusted price per square foot of the comparable set, applied to the subject's living area ($${predictedClose.toLocaleString('en-US')}). No last ask on the subject, so the comparable path is the close.`,
    )
  }
  const days = opts.comps.map((c) => c.daysToOffer).filter((n): n is number => n != null && n >= 0)
  const medianDaysToOffer =
    asOfPpsf?.daysToOffer != null
      ? Math.round(asOfPpsf.daysToOffer)
      : days.length
        ? [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)]!
        : null
  const regime =
    regimes.size === 0 ? 'flat' : regimes.size === 1 ? ( [...regimes][0] as 'rising' | 'flat' | 'falling') : 'mixed'
  return {
    pricing,
    predictedClose,
    compsImpliedClose: engine.compsImpliedClose,
    recommendedList: engine.recommendedList,
    medianDaysToOffer,
    pathNotes,
    regime,
  }
}
