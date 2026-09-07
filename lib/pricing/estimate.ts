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
  describePath,
  INDEX_MIN_N,
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
  windowMonths: number
  /** Sales behind that rate. */
  n: number
  /** Which basis the date adjustment actually used on this build. */
  basis: 'city-monthly-index' | 'year-over-year' | 'none'
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
 */
export function buildTimeAdjustmentBasis(opts: {
  citySlug: string
  points: MarketIndexPoint[]
  asOf: string
  yoyMedianPriceDeltaPct?: number | null
  fetchedAt?: string
  windowMonths?: number
}): PricingTimeAdjustment {
  const windowMonths = opts.windowMonths ?? TIME_ADJUSTMENT_WINDOW_MONTHS
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString()
  const trend = marketIndexTrend({ points: opts.points, asOf: opts.asOf, windowMonths })
  if (trend.pctPerMonth != null) {
    const direction = trend.pctPerMonth > 0 ? 'up' : trend.pctPerMonth < 0 ? 'down' : 'flat'
    return {
      pctPerMonth: trend.pctPerMonth,
      windowMonths,
      n: trend.n,
      basis: 'city-monthly-index',
      source: {
        table: 'pricing_market_index',
        filter: `city_slug='${opts.citySlug}', months ${trend.months} with at least ${INDEX_MIN_N} sales in the ${windowMonths} months to ${opts.asOf.slice(0, 10)}; median price a square foot ${trend.fromPpsf} to ${trend.toPpsf}${trend.capped ? '; the ±25% path cap bound this window' : ''}`,
        fetchedAt,
        query: `select month, n, median_ppsf, median_sale_to_original, median_days_to_offer from pricing_market_index where city_slug = '${opts.citySlug}' order by month`,
      },
      sentence:
        direction === 'flat'
          ? `Prices a square foot in this city have been flat over the last ${windowMonths} months, across ${trend.n.toLocaleString('en-US')} sales, so each sale below moves very little for when it sold.`
          : `Prices a square foot in this city have moved ${direction} ${Math.abs(trend.pctPerMonth)} percent a month over the last ${windowMonths} months, across ${trend.n.toLocaleString('en-US')} sales. Each sale below is moved by that path between the month it closed and today.`,
    }
  }
  const yoy = opts.yoyMedianPriceDeltaPct
  if (yoy != null && Number.isFinite(yoy)) {
    const perMonth = Math.round((yoy / 12) * 10) / 10
    return {
      pctPerMonth: perMonth,
      windowMonths: 12,
      n: 0,
      basis: 'year-over-year',
      source: {
        table: 'market context (market_stats_cache / market_pulse_live)',
        filter: `Year-over-year median sale price change for this city, ${yoy}% over 12 months, spread evenly across the months`,
        fetchedAt,
        query: 'getCmaMarketContext(subject) -> yoyMedianPriceDeltaPct',
      },
      sentence: `Median sale prices in this city are ${yoy > 0 ? 'up' : 'down'} ${Math.abs(yoy)} percent against a year ago, about ${Math.abs(perMonth)} percent a month, and each sale below is moved by that rate for the months since it closed.`,
    }
  }
  return {
    pctPerMonth: null,
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
 * D10, closed by construction: the range the seller reads is the spread of the
 * SAME adjusted sale prices the grid prints — six or more sales drop the
 * highest and the lowest, fewer keep every one — instead of p25/p75 of
 * time-adjusted $/sqft, which ignored the size and story adjustments the
 * document itemizes and on heterogeneous sets diverged from its own evidence
 * (Tumalo: band $1,241,000-$1,297,000 against ten printed values with median
 * $1,099,810).
 */
export function adjustedPriceRange(
  prices: readonly number[],
): { low: number; high: number; rule: PricingRangeRuleName; n: number; kept: number } | null {
  const vals = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (vals.length < PRICING_MIN_COMPS) return null
  if (vals.length >= RANGE_TRIM_MIN_N) {
    const kept = vals.slice(1, -1)
    return { low: kept[0]!, high: kept[kept.length - 1]!, rule: 'trimmed-one-each-end', n: vals.length, kept: kept.length }
  }
  return { low: vals[0]!, high: vals[vals.length - 1]!, rule: 'min-max', n: vals.length, kept: vals.length }
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
  const sale = opts.sale
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
    ...pricingSaleToCmaComp(sale),
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
  // The sales that carry a printed adjusted price. Land has no living area and
  // prices per acre, so it stays on the $/sqft path it already used.
  const pricedSales = opts.subjectSqft > 0
    ? opts.adjusted.filter(
        (a): a is EngineAdjustedSale & { adjustedPrice: number } =>
          a.adjustedPrice != null && Number.isFinite(a.adjustedPrice) && a.adjustedPrice > 0,
      )
    : []
  const range =
    pricedSales.length >= PRICING_MIN_COMPS
      ? adjustedPriceRange(pricedSales.map((a) => a.adjustedPrice))
      : null
  const reconciledValue =
    range != null
      ? weightedAdjustedPrice(pricedSales.map((a) => ({ adjustedPrice: a.adjustedPrice, weight: a.weight ?? 0 })))
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

  const recommendedList = mid != null ? listFromClose(mid, ratio) : null
  let conservativeList = range != null ? listFromClose(range.low, ratio) : band != null ? listFromClose(band.low, ratio) : null
  let highEndList = range != null ? listFromClose(range.high, ratio) : band != null ? listFromClose(band.high, ratio) : null
  if (reconciled.source === 'comps' && recommendedList != null) {
    if (conservativeList != null && conservativeList > recommendedList) conservativeList = recommendedList
    if (highEndList != null && highEndList < recommendedList) highEndList = recommendedList
  }

  const askStep =
    ratio != null
      ? ` Homes in this city are closing at ${(ratio * 100).toFixed(1)} percent of the price they first asked, so each figure is carried to an asking price at that share.`
      : ' No local share of the original ask was available, so the asking prices are the adjusted sale prices themselves.'
  const rangeRule: PricingRangeRule | null =
    range != null
      ? {
          rule: range.rule,
          n: range.n,
          kept: range.kept,
          adjustedLow: range.low,
          adjustedHigh: range.high,
          saleToAskRatio: ratio,
          saleToAskSource,
          ratiosExcluded,
          sentence:
            range.rule === 'trimmed-one-each-end'
              ? `The range is the spread of the ${range.n} sale prices adjusted for date and size, with the highest and the lowest set aside: $${range.low.toLocaleString('en-US')} to $${range.high.toLocaleString('en-US')}.${askStep}`
              : `The range is the spread of all ${range.n} sale prices adjusted for date and size: $${range.low.toLocaleString('en-US')} to $${range.high.toLocaleString('en-US')}.${askStep}`,
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
    return clipCoverToFailedAsk({ ...pricing, predictedClose: close }, opts.failedAsk)
  }
  const list = engine.recommendedList
  if (list == null || !Number.isFinite(list) || list <= 0) {
    return close != null ? { ...pricing, predictedClose: close } : pricing
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
        valueLow: bandLow,
        valueHigh: bandHigh,
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
  const valueLow = engine.rangeRule?.adjustedLow ?? conservative
  const valueHigh = engine.rangeRule?.adjustedHigh ?? highEnd
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

function asOfIndexPoint(points: MarketIndexPoint[], asOf: string): MarketIndexPoint | null {
  if (points.length === 0) return null
  const cutoff = asOf.slice(0, 7) + '-01'
  return (
    points
      .filter((p) => p.n >= INDEX_MIN_N && p.month <= cutoff)
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
  pricing.reconciliation = reconcileAdjustedSales({
    sales: args.adjusted as unknown as ReconcilableSale[],
    subjectSqft: args.subject.sqft ?? 0,
  })
  // What moved each sale for its date, stated where the document can print it.
  pricing.timeAdjustment = buildTimeAdjustmentBasis({
    citySlug: citySlug(args.subject.city),
    points: args.marketIndex,
    asOf: args.asOf,
    yoyMedianPriceDeltaPct: args.market?.yoyMedianPriceDeltaPct ?? null,
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
