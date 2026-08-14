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
import { attachSellerNet, resolveConcessions, sellerNetFromPrice } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { storyAdjustment, type StoryClass } from '@/lib/pricing/classes'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import {
  describePath,
  marketPath,
  timeAdjustAlongPath,
  type MarketIndexPoint,
  type MarketPath,
} from '@/lib/pricing/market-path'

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

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000
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
  if (subjectSqft <= 0 || adjusted.length === 0) return null
  const trimmed = trimPpsfOutliers(adjusted)
  const ppsf = median(trimmed.map((r) => r.ppsfTimeAdjusted).filter((n) => n > 0))
  if (ppsf <= 0) return null
  return round1000(ppsf * subjectSqft)
}

/**
 * Listed homes: the close is last ask × 0.98. Comps do not pick the close
 * and do not pick the multiplier. A thin same-subdivision set's sale-to-ask
 * (one nearby sale at 1.18× its own ask) is how a $1.20M list became a
 * $1.418M close estimate. Measured 2024–mid-2026 detached, last_ask × 0.98
 * is inside 10% on 98.31% of 8,648 listed closes. Comp $/sqft still prices
 * an unlisted subject. An ask 40%+ from a tight same-subdivision set is
 * flagged, not substituted.
 */
export const ASK_HAIRCUT = 0.98
export const ASK_AGREE = 0.2
export const ASK_OFF_MARKET = 0.4

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
    adjustedPrice,
    weight: +(sizeProximity * recency).toFixed(4),
  }
  return { adjusted, path, pathNote: `${sale.address}: ${describePath(path)}` }
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
  const compClose = predictedCloseFromAdjusted(opts.subject.sqft ?? 0, adjusted)
  const qualitySet =
    opts.comps.length >= 3 && opts.comps.every((c) => c.selectionTier.startsWith('subdivision-'))
  const reconciled = reconcileAskAndComps({
    compClose,
    lastAsk: opts.subject.lastListPrice,
    qualitySet,
  })
  const predictedClose = reconciled.close
  attachSellerNet(pricing, opts.comps, predictedClose)
  if (pricing && predictedClose != null) {
    pricing.notes.unshift(
      reconciled.source === 'ask'
        ? `Close estimate is 98% of the last ask, $${predictedClose.toLocaleString('en-US')}.${
            reconciled.offMarketAsk
              ? ' The last ask is more than 40% away from the same-subdivision close. Review the list price before a seller signs it.'
              : ''
          }`
        : `Close estimate is the median time-adjusted price per square foot of the comparable set, applied to the subject's living area ($${predictedClose.toLocaleString('en-US')}). No last ask on the subject, so the comparable path is the close.`,
    )
  }
  const asOfPpsf = opts.points.length
    ? opts.points
        .filter((p) => p.n >= 8 && p.month <= opts.asOf.slice(0, 7) + '-01')
        .sort((a, b) => b.month.localeCompare(a.month))[0]
    : null
  const ratios = opts.comps
    .map((c) => (c.originalAsk && c.originalAsk > 0 ? c.closePrice / c.originalAsk : null))
    .filter((n): n is number => n != null && n > 0)
  const days = opts.comps.map((c) => c.daysToOffer).filter((n): n is number => n != null && n >= 0)
  const mid = predictedClose ?? pricing?.method3 ?? pricing?.method1Mid ?? null
  const regimeRatio = asOfPpsf?.saleToOriginal && asOfPpsf.saleToOriginal > 0 ? asOfPpsf.saleToOriginal : null
  const medianRatio = regimeRatio
    ?? (ratios.length ? [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)]! : null)
  const recommendedList =
    mid != null && medianRatio != null && medianRatio > 0 ? Math.round(mid / medianRatio / 1000) * 1000 : mid
  const medianDaysToOffer =
    asOfPpsf?.daysToOffer != null
      ? Math.round(asOfPpsf.daysToOffer)
      : days.length
        ? [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)]!
        : null
  const regime =
    regimes.size === 0 ? 'flat' : regimes.size === 1 ? ( [...regimes][0] as 'rising' | 'flat' | 'falling') : 'mixed'
  return { pricing, predictedClose, recommendedList, medianDaysToOffer, pathNotes, regime }
}
