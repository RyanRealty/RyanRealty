/**
 * BPO offer strategy — the actionable recommendation the opinion of value
 * feeds into. A number is not advice. This turns the opinion, the market
 * verdict, and the listing-history leverage into a concrete plan:
 *
 *   Live listing  → buyer-acquisition plan: opening, target, and ceiling
 *                   offers, with the leverage that justifies each and the
 *                   terms to press.
 *   Off-market    → seller-positioning plan: where to list and the offer
 *                   range to expect, so the home avoids the days-on-market
 *                   trap this analysis so often surfaces.
 *
 * Leverage is scored from real signals (market months of supply, the current
 * listing's days on market vs the area median, prior failed attempts, the
 * decline from peak ask). Property-specific rejection outweighs the market
 * backdrop, so a distressed listing in a seller's market still reads
 * buyer-favored. Every figure is bounded and derived, never estimated.
 */

import type { CmaMarketContext } from '@/lib/cma/types'
import type { BpoListingHistory, BpoOpinion, BpoOfferStrategy, CmaSubject } from '@/lib/bpo/types'
import { formatPriceExact } from '@/lib/format/money'

const usd = formatPriceExact

function round5000(n: number): number {
  return Math.round(n / 5000) * 5000
}

/** 0 (seller-favored) → higher (buyer-favored). Property signals dominate. */
function scoreLeverage(market: CmaMarketContext | null, history: BpoListingHistory): number {
  let score = 0
  if (market?.marketVerdict === 'buyer') score += 2
  else if (market?.marketVerdict === 'balanced') score += 1
  const medianDom = market?.medianDom ?? null
  if (history.currentIsActive && history.currentDaysOnMarket != null && medianDom != null && medianDom > 0) {
    const ratio = history.currentDaysOnMarket / medianDom
    if (ratio >= 2.5) score += 2
    else if (ratio >= 1.5) score += 1
  }
  if (history.failedAttemptsCount >= 2) score += 2
  else if (history.failedAttemptsCount === 1) score += 1
  if (history.totalDeclineFromPeakPct != null && history.totalDeclineFromPeakPct <= -15) score += 1
  if (history.currentCutFromOriginalPct != null && history.currentCutFromOriginalPct <= -5) score += 1
  return score
}

function postureFromScore(score: number): BpoOfferStrategy['posture'] {
  if (score >= 4) return 'buyer-favored'
  if (score >= 2) return 'balanced'
  return 'seller-favored'
}

function buildLeverageBullets(
  market: CmaMarketContext | null,
  history: BpoListingHistory,
): string[] {
  const out: string[] = []
  if (history.currentIsActive && history.currentDaysOnMarket != null && market?.medianDom) {
    out.push(
      `${history.currentDaysOnMarket} days on market against a ${Math.round(market.medianDom)}-day area median. The longer it sits, the more room there is to negotiate.`,
    )
  }
  if (history.failedAttemptsCount >= 1) {
    out.push(
      `${history.failedAttemptsCount} prior listing attempt${history.failedAttemptsCount > 1 ? 's' : ''} came off the market without selling${
        history.peakAskingPrice ? `, at asking prices up to ${usd(history.peakAskingPrice)}` : ''
      }. The seller has already learned the market will not meet higher numbers.`,
    )
  }
  if (history.totalDeclineFromPeakPct != null && history.totalDeclineFromPeakPct <= -8) {
    out.push(`The ask is down ${Math.abs(history.totalDeclineFromPeakPct)}% from its peak, a sign of a motivated seller.`)
  }
  if (market?.marketVerdict) {
    out.push(
      `${market.geoLabel} is a ${market.marketVerdict === 'seller' ? "seller's" : market.marketVerdict === 'buyer' ? "buyer's" : 'balanced'} market at ${market.monthsOfSupply ?? '—'} months of supply${
        market.saleToListRatio != null ? `, where homes close near ${Math.round(market.saleToListRatio * 100)}% of list` : ''
      }.`,
    )
  }
  return out
}

export function deriveOfferStrategy(
  subject: CmaSubject,
  opinion: BpoOpinion,
  market: CmaMarketContext | null,
  history: BpoListingHistory,
): BpoOfferStrategy {
  const leverageScore = scoreLeverage(market, history)
  const posture = postureFromScore(leverageScore)
  const leverage = buildLeverageBullets(market, history)

  if (history.currentIsActive) {
    // Buyer-acquisition plan. Never advise paying above our opinion of value.
    const ceiling = opinion.opinionValue
    const openingDiscount = posture === 'buyer-favored' ? 0.06 : posture === 'balanced' ? 0.035 : 0.015
    const openingOffer = round5000(ceiling * (1 - openingDiscount))
    const targetOffer = round5000(ceiling * (1 - openingDiscount * 0.4))

    const terms: string[] = []
    if (posture === 'buyer-favored') {
      terms.push('Open below the opinion of value and hold firm. With this much time on market, there is no competing pressure to chase.')
      terms.push('Ask the seller to carry closing costs or fund repair credits found at inspection. A long-sitting seller trades price relief for certainty of closing.')
      terms.push('Keep standard inspection and financing contingencies. There is no need to waive protections to win an uncontested home.')
    } else if (posture === 'balanced') {
      terms.push('Open modestly under the opinion of value and expect to meet near the target. The seller has some, not full, motivation.')
      terms.push('Lead with a clean, well-qualified offer. Reasonable contingencies are fine, but tight timelines strengthen the position.')
    } else {
      terms.push('Come in at or near the opinion of value. Demand is firm and lowball offers will be passed over.')
      terms.push('Shorten contingency windows and lead with strong financing to stand out. Be ready to escalate if there is competition.')
    }

    const headline =
      posture === 'buyer-favored'
        ? `Buyer-favored. Open around ${usd(openingOffer)}, settle near ${usd(targetOffer)}, and do not exceed ${usd(ceiling)}.`
        : posture === 'balanced'
          ? `Balanced. Open near ${usd(openingOffer)} and expect to meet around ${usd(targetOffer)}, with ${usd(ceiling)} as the ceiling.`
          : `Seller-favored. Offer at or near ${usd(targetOffer)} and treat ${usd(ceiling)} as the ceiling.`

    return {
      mode: 'buyer',
      posture,
      leverageScore,
      headline,
      openingOffer,
      targetOffer,
      ceiling,
      recommendedList: null,
      expectedOfferLow: null,
      expectedOfferHigh: null,
      leverage,
      terms,
    }
  }

  // Seller-positioning plan (off-market subject).
  const recommendedList = opinion.opinionValue
  const saleToList = market?.saleToListRatio ?? null
  const lowFactor = saleToList != null ? Math.min(saleToList, 0.99) : 0.96
  const expectedOfferLow = round5000(recommendedList * lowFactor)
  const expectedOfferHigh = round5000(recommendedList)
  const terms: string[] = [
    `List at the opinion of value, ${usd(recommendedList)}. Pricing above it invites the same extended time on market and price cuts the record here already shows.`,
    market?.medianDom != null
      ? `Priced correctly, expect offers within the first ${Math.round(market.medianDom)} days. A home that lingers past the median signals an overpriced list.`
      : 'Priced correctly, expect early offers. A home that lingers signals an overpriced list.',
    `Expect strong offers to land between ${usd(expectedOfferLow)} and ${usd(expectedOfferHigh)}.`,
  ]
  const headline = `List at ${usd(recommendedList)} and expect offers between ${usd(expectedOfferLow)} and ${usd(expectedOfferHigh)}.`

  return {
    mode: 'seller',
    posture,
    leverageScore,
    headline,
    openingOffer: null,
    targetOffer: null,
    ceiling: null,
    recommendedList,
    expectedOfferLow,
    expectedOfferHigh,
    leverage,
    terms,
  }
}
