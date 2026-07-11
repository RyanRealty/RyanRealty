/**
 * BPO opinion reconciliation.
 *
 * The comp engine (lib/cma/pricing.ts) produces a market-supported value from
 * the time- and size-adjusted comparable sales. The opinion of value takes that
 * as its anchor and reconciles it against the property's demonstrated market
 * history: a home the market has repeatedly declined at higher prices is not
 * worth its last list price, and the opinion is pulled toward — never above —
 * what the comps support. A broker price override re-anchors on the broker's
 * number and preserves the reconciliation in the trace.
 *
 * Every number is bounded and traceable. History can only move the opinion down
 * from the comp anchor (max 6%), never inflate it.
 */

import type { CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { BpoListingHistory, BpoOpinion } from '@/lib/bpo/types'
import { formatPriceExact } from '@/lib/format/money'

const usd = formatPriceExact

function round5000(n: number): number {
  return Math.round(n / 5000) * 5000
}

function pct(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null
  return +(((part - whole) / whole) * 100).toFixed(1)
}

export function deriveOpinion(
  subject: CmaSubject,
  pricing: CmaPricing,
  market: CmaMarketContext | null,
  history: BpoListingHistory,
  opts: { priceOverride?: number | null } = {},
): BpoOpinion {
  const reasoning: string[] = []
  const compAnchor = pricing.recommended
  reasoning.push(
    `Comparable sales reconcile to ${usd(compAnchor)} (time- and size-adjusted, ${pricing.confidence.toLowerCase()} confidence, methods within ${pricing.convergenceSpreadPct ?? 0}%).`,
  )

  // Apply demonstrated market rejection as a bounded downward pull on the anchor.
  const pressure = history.listingPressureAdjustmentPct // <= 0
  let opinionValue = round5000(compAnchor * (1 + pressure))
  if (pressure < 0) {
    reasoning.push(
      `The listing history pulls the opinion ${Math.abs(pressure * 100).toFixed(1)}% below the comp reconciliation: ${
        history.failedAttemptsCount >= 2
          ? `${history.failedAttemptsCount} prior attempts failed to sell`
          : 'the current listing has sat unsold'
      }${
        history.currentDaysOnMarket != null && market?.medianDom
          ? ` (${history.currentDaysOnMarket} days on market vs an area median of ${Math.round(market.medianDom)})`
          : ''
      }.`,
    )
  } else if (history.currentIsActive && history.signals.some((s) => s.code === 'fresh_to_market')) {
    reasoning.push('The current listing is fresh to market, so time-on-market carries no weight yet. The opinion holds at the comp reconciliation.')
  }

  // Active-listing ceiling. A home still on the market after meaningful
  // exposure, or one that already failed to sell at higher prices, has not
  // proven it will trade even at its current ask. The opinion does not float
  // above an actively-marketed, unsold list price, no matter what the
  // size-adjusted comps imply on their own.
  // The ceiling only applies when the current list sits within or above the
  // comp-supported floor. A list below the comp floor (or a nominal sub-$5,000
  // ask) must never drag the opinion beneath what the comps support, and
  // round5000 of a tiny list would otherwise collapse the value toward $0.
  if (
    history.currentIsActive &&
    history.currentListPrice &&
    opinionValue > history.currentListPrice &&
    history.currentListPrice >= pricing.conservative
  ) {
    const medianDom = market?.medianDom ?? null
    const stale =
      (history.currentDaysOnMarket != null && medianDom != null && history.currentDaysOnMarket >= medianDom) ||
      history.failedAttemptsCount >= 1
    if (stale) {
      const ceilingValue = Math.max(round5000(history.currentListPrice), pricing.conservative)
      reasoning.push(
        `The home is listed today at ${usd(history.currentListPrice)} and has not sold` +
          `${history.currentDaysOnMarket != null ? ` in ${history.currentDaysOnMarket} days on market` : ''}` +
          `${history.failedAttemptsCount >= 1 ? `, after ${history.failedAttemptsCount} prior attempt${history.failedAttemptsCount > 1 ? 's' : ''} failed at higher prices` : ''}. ` +
          `An opinion above a price the market has already had the chance to meet is not supportable, so the opinion holds at ${usd(ceilingValue)} rather than the ${usd(compAnchor)} the size-adjusted comps alone would imply, and never below the ${usd(pricing.conservative)} the comparable sales still support.`,
      )
      opinionValue = ceilingValue
    }
  }

  // Broker override re-anchors on the broker's number.
  const priceOverride =
    opts.priceOverride != null && Number.isFinite(opts.priceOverride) && opts.priceOverride > 0
      ? Math.round(opts.priceOverride)
      : null
  const ratioBase = opinionValue > 0 ? opinionValue : compAnchor
  if (priceOverride) {
    opinionValue = round5000(priceOverride)
    reasoning.push('The opinion of value reflects a broker adjustment applied on review. The data-derived reconciliation is preserved above.')
  }

  // Range: scale the comp-derived tiers by the same ratio the anchor moved.
  const ratio = compAnchor > 0 ? opinionValue / compAnchor : 1
  let valueLow = round5000(pricing.conservative * ratio)
  let valueHigh = round5000(pricing.highEnd * ratio)
  if (valueLow > opinionValue) valueLow = round5000(opinionValue * 0.97)
  if (valueHigh < opinionValue) valueHigh = round5000(opinionValue * 1.03)
  void ratioBase

  // Confidence carries the comp engine's read; a thin history adds no lift.
  // When history pressure, the active-listing ceiling, or a broker override has
  // moved the opinion meaningfully off the raw comp anchor, the number is no
  // longer a clean read of the comps, so drop confidence one notch and say so.
  let confidence = pricing.confidence
  let confidenceReason = pricing.confidenceReason
  const anchorDivergence = compAnchor > 0 ? Math.abs(opinionValue - compAnchor) / compAnchor : 0
  if (anchorDivergence > 0.05) {
    const downgrade: Record<BpoOpinion['confidence'], BpoOpinion['confidence']> = {
      High: 'Moderate',
      Moderate: 'Supportable',
      Supportable: 'Supportable',
    }
    confidence = downgrade[confidence]
    confidenceReason = `${confidenceReason} The opinion diverges ${(anchorDivergence * 100).toFixed(1)}% from the raw comparable reconciliation, so we hold it one notch lower on confidence.`
  }

  const vsCurrentListPct =
    history.currentIsActive && history.currentListPrice
      ? pct(opinionValue, history.currentListPrice)
      : null
  if (vsCurrentListPct != null && history.currentListPrice) {
    reasoning.push(
      vsCurrentListPct < -1
        ? `The opinion sits ${Math.abs(vsCurrentListPct)}% below the current ${usd(history.currentListPrice)} list price.`
        : vsCurrentListPct > 1
          ? `The opinion sits ${vsCurrentListPct}% above the current ${usd(history.currentListPrice)} list price.`
          : `The opinion is in line with the current ${usd(history.currentListPrice)} list price.`,
    )
  }

  if (market?.marketVerdict) {
    reasoning.push(
      `${market.geoLabel} is a ${market.marketVerdict === 'seller' ? "seller's" : market.marketVerdict === 'buyer' ? "buyer's" : 'balanced'} market at ${market.monthsOfSupply ?? '—'} months of supply.`,
    )
  }

  return {
    opinionValue,
    valueLow,
    valueHigh,
    confidence,
    confidenceReason,
    vsCurrentListPct,
    compAnchor,
    priceOverride,
    reasoning,
  }
}
