/**
 * WHAT THE SALES IN THE GRID SET: the price on the cover, or only the range.
 *
 * On most letters the cover price is the weighted price of the sales in the
 * grid, after the steps the letter names, and the grid says so: "The sales
 * that set this price", "Weight in this price", "Weight is how much each sale
 * moved the number".
 *
 * Some letters print a cover the weights did not make, and every one of those
 * sentences was false on them (reader reviews, 2026-10-08):
 *
 *  - A rule 26 hold (pricing.hold kind 'ask-below-band'). 20676 Wild Rose's
 *    cover is $593,000, under every sale in the grid: the failed-ask step put
 *    it there. Its three sales sold for $675,000 to $715,000 and adjust to
 *    $627,332 to $724,442, and the letter called them "the sales behind this
 *    price" with "Weight in this price 40% / 40% / 20%".
 *  - A cover held to the sale on the subject's street (lib/cma/street-anchor.ts).
 *    915 Saginaw's $800,000 is 536 Saginaw's adjusted $727,148 plus 10
 *    percent, rounded; the weights blend to about $960,000.
 *  - A cover the failed-ask ceiling moved, on a letter that does not print the
 *    clamp sentence saying so. 62475 Woodsman (a rule 22 hold) printed
 *    "62531 Woodsman carries the most weight of the four sales behind this
 *    price, at 32.4 percent" and "Weight is how much each sale moved the
 *    number" over weights that blend to $1,584,134, under a $1,576,000 cover
 *    the ceiling set (0.985 x the $1,600,000 last ask). A reader multiplying
 *    the printed weights could not reach the cover, and a held letter prints
 *    no clamp sentence (SKILL.md rule 26), so nothing on it joins the two.
 *
 * On those letters the sales set the RANGE, and the letter calls them that.
 * An unheld letter whose cover the ceiling moved keeps "in this price": its
 * clamp sentence ("The sales support a value of $X. Because $Y already
 * failed to sell, we recommend the price on the cover") says, under the
 * number, what moved it. A cover the list step carried off the weighted price
 * is still the weights' number; the expected-sale sentence or the range line
 * says where it sits.
 */

import { heldForMatt, heldUnderBand } from '@/lib/cma/cover-value'
import { clampSentence } from '@/lib/cma/set-aside'
import { streetAnchorRead } from '@/lib/cma/street-anchor'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

/**
 * A cover inside one $1,000 step of the weighted price is that price rounded
 * to the thousand, in either direction.
 */
export const COVER_ROUNDING_STEP = 1000

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) ? n : null
}

/** `pricing.reconciliation.weightedPrice`, the value the printed weights blend to, or null. */
export function storedWeightedPrice(pricing: CmaPricing | null | undefined): number | null {
  const recon = (pricing as unknown as { reconciliation?: { weightedPrice?: unknown } | null } | null)
    ?.reconciliation
  const price = num(recon?.weightedPrice)
  return price != null && price > 0 ? price : null
}

/**
 * True when the failed-ask ceiling moved the recommended tier to the cover's
 * number, and the cover is not the weighted price anyway (one rounding step
 * or more from `reconciliation.weightedPrice`, when the row stored one).
 */
export function clampMovedCoverOffTheWeights(pricing: CmaPricing | null | undefined): boolean {
  if (!pricing) return false
  const rec = num(pricing.recommended)
  if (rec == null || !(rec > 0)) return false
  const moved = (pricing.clamp?.applications ?? []).some(
    (a) =>
      a.tier === 'recommended' &&
      Math.round(a.after) === Math.round(rec) &&
      Math.round(a.before) !== Math.round(a.after),
  )
  if (!moved) return false
  const weighted = storedWeightedPrice(pricing)
  return weighted == null || Math.abs(rec - weighted) >= COVER_ROUNDING_STEP
}

/**
 * The one decision every page asks: the heading over the grid, its weight
 * row, the sentence under it, the map's legend and pin notes, and Basis and
 * limits.
 */
export function salesSetOnlyTheRange(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): boolean {
  if (heldUnderBand(pricing)) return true
  if (streetAnchorRead(pricing, comps)?.holdsCover === true) return true
  // The ceiling set the cover, and the letter does not print the sentence
  // that says so: a held letter never does (lib/cma/render-pricing-page.ts
  // pricingPage), and a row that stored no sentence cannot.
  if (!clampMovedCoverOffTheWeights(pricing)) return false
  return heldForMatt(pricing) || !clampSentence(pricing)
}

/** The grid's weight row, named for what the weights are on this letter. */
export const WEIGHT_IN_PRICE_ROW_LABEL = 'Weight in this price'
export const WEIGHT_AMONG_SALES_ROW_LABEL = 'Weight among these sales'

export function weightRowLabel(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): string {
  return salesSetOnlyTheRange(pricing, comps) ? WEIGHT_AMONG_SALES_ROW_LABEL : WEIGHT_IN_PRICE_ROW_LABEL
}

/** "the three sales that set the range", where the stored sentence said "behind this price". */
const BEHIND_THIS_PRICE = /\bsales behind this price\b/g

/**
 * The stored reconciliation sentence (lib/pricing/reconciliation.ts writes it
 * at build, so a delivered letter carries it as written) in the letter's
 * words for this letter: on a range-only letter its "sales behind this price"
 * is "sales that set the range".
 */
export function reconciliationSentenceFor(
  sentence: string,
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): string {
  if (!salesSetOnlyTheRange(pricing, comps)) return sentence
  return sentence.replace(BEHIND_THIS_PRICE, 'sales that set the range')
}

/** What the weight figures are, under the grid. */
export function weightMeaningSentence(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): string {
  return salesSetOnlyTheRange(pricing, comps)
    ? 'Weight is how much each sale counts beside the others in this chapter. It does not set the price on the cover.'
    : 'Weight is how much each sale moved the number, over the sales in this chapter.'
}
