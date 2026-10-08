/**
 * WHAT THE SALES IN THE GRID SET: the price on the cover, or only the range.
 *
 * On most letters the cover price is the weighted price of the sales in the
 * grid, after the steps the letter names, and the grid says so: "The sales
 * that set this price", "Weight in this price", "Weight is how much each sale
 * moved the number".
 *
 * Two letters print a cover the weights did not make, and every one of those
 * sentences was false on them (reader review, 2026-10-08):
 *
 *  - A rule 26 hold (pricing.hold kind 'ask-below-band'). 20676 Wild Rose's
 *    cover is $593,000, under every sale in the grid: the failed-ask step put
 *    it there. Its three sales sold for $675,000 to $715,000 and adjust to
 *    $627,332 to $724,442, and the letter called them "the sales behind this
 *    price" with "Weight in this price 40% / 40% / 20%".
 *  - A cover held to the sale on the subject's street (lib/cma/street-anchor.ts).
 *    915 Saginaw's $800,000 is 536 Saginaw's adjusted $727,148 plus 10
 *    percent, rounded; the weights blend to about $960,000.
 *
 * On those letters the sales set the RANGE, and the letter calls them that.
 */

import { heldUnderBand } from '@/lib/cma/cover-value'
import { streetAnchorRead } from '@/lib/cma/street-anchor'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

export function salesSetOnlyTheRange(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[] | null | undefined,
): boolean {
  if (heldUnderBand(pricing)) return true
  return streetAnchorRead(pricing, comps)?.holdsCover === true
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
