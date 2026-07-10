/**
 * BPO rationale narrative — deterministic templated prose that reasons over the
 * listing history, the comps, and the market to explain the opinion of value.
 *
 * Brand-voice compliant by construction (CLAUDE.md brand voice): no em-dashes,
 * no semicolons, no banned vocabulary, sentence case, plain declarative
 * sentences. Every number in the prose is one the build already computed and
 * traced. The output is stored in broker_price_opinions.rationale and printed
 * in the report.
 */

import type { CmaAdjustedComp, CmaMarketContext } from '@/lib/cma/types'
import type { BpoListingHistory, BpoOpinion, CmaSubject } from '@/lib/bpo/types'
import { formatPriceExact } from '@/lib/format/money'

const usd = formatPriceExact

export function buildBpoRationale(args: {
  subject: CmaSubject
  history: BpoListingHistory
  opinion: BpoOpinion
  market: CmaMarketContext | null
  comps: CmaAdjustedComp[]
}): string {
  const { subject, history, opinion, market, comps } = args
  const paras: string[] = []

  // 1. What the comps say.
  const sqftLine = subject.sqft ? `${subject.sqft.toLocaleString('en-US')} square feet` : 'the home'
  paras.push(
    `Our opinion of value for ${subject.streetAddress} is ${usd(opinion.opinionValue)}, with a supported range of ${usd(opinion.valueLow)} to ${usd(opinion.valueHigh)}. ` +
      `That figure comes from ${comps.length} closed sales, each adjusted for the time since it sold and for the difference in size against ${sqftLine}. ` +
      `The adjusted comparables reconcile to ${usd(opinion.compAnchor)}.`,
  )

  // 2. What the listing history says.
  if (history.currentIsActive && history.currentListPrice) {
    if (history.failedAttemptsCount >= 1) {
      paras.push(
        `The property is listed today at ${usd(history.currentListPrice)}` +
          `${history.currentDaysOnMarket != null ? ` and has been on market ${history.currentDaysOnMarket} days` : ''}. ` +
          `Before this listing it went to market ${history.failedAttemptsCount === 1 ? 'once' : `${history.failedAttemptsCount} times`} and came off without selling` +
          `${history.peakAskingPrice ? `, at asking prices as high as ${usd(history.peakAskingPrice)}` : ''}. ` +
          `The market has already answered those prices. That record, not the current list, sets the ceiling on value.`,
      )
    } else if (history.currentDaysOnMarket != null && history.currentDaysOnMarket <= 21) {
      paras.push(
        `The property is fresh to market at ${usd(history.currentListPrice)}, ${history.currentDaysOnMarket} days in, with no prior failed listings. ` +
          `Time on market carries no weight yet, so the opinion rests on the comparable sales.`,
      )
    } else {
      paras.push(
        `The property is listed today at ${usd(history.currentListPrice)}` +
          `${history.currentDaysOnMarket != null ? ` and has been on market ${history.currentDaysOnMarket} days` : ''}. ` +
          `${history.currentCutFromOriginalPct != null && history.currentCutFromOriginalPct <= -3 ? `It has already cut ${Math.abs(history.currentCutFromOriginalPct)}% from its original ask. ` : ''}` +
          `The opinion reconciles the current list against what the comparable sales support.`,
      )
    }
  } else if (history.lastSalePrice && history.lastSaleDate) {
    paras.push(
      `The home is not on the market now. It last sold for ${usd(history.lastSalePrice)} in ${history.lastSaleDate.slice(0, 4)}. ` +
        `The opinion reflects current comparable sales, not that dated transaction.`,
    )
  } else {
    paras.push(
      `The property has no prior MLS listing history to weigh. The opinion rests on the comparable sales and current market conditions.`,
    )
  }

  // 3. Market frame.
  if (market) {
    const verdict =
      market.marketVerdict === 'seller'
        ? "a seller's market"
        : market.marketVerdict === 'buyer'
          ? "a buyer's market"
          : 'a balanced market'
    paras.push(
      `${market.geoLabel} is ${verdict}${market.monthsOfSupply != null ? ` at ${market.monthsOfSupply} months of supply` : ''}` +
        `${market.medianDom != null ? `, with homes taking a median of ${Math.round(market.medianDom)} days to sell` : ''}. ` +
        `${opinion.confidenceReason} We hold this opinion at ${opinion.confidence.toLowerCase()} confidence.`,
    )
  } else {
    paras.push(`We hold this opinion at ${opinion.confidence.toLowerCase()} confidence. ${opinion.confidenceReason}`)
  }

  return paras.join('\n\n')
}
