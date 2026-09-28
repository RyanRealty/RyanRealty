/**
 * The order build.ts applies after competition is known.
 *
 * 1. Sitting high-DOM actives may pull Recommended down, inside the cap and
 *    not below pocket closed-sale support.
 * 2. Recommended is clamped into the closed-comp band.
 * 3. The failed-ask sentence is rewritten from that final recommendation.
 * 4. Conservative and high end move to keep the recommendation inside them.
 *    A minimum-width open can put the closed-band low under the earlier
 *    conservative tier, and the nudge follows that low. The recommendation
 *    and the closed band stay where those steps put them.
 *
 * Marshmallow printed "recommend listing at $933,000" from step 0 (the
 * clamp) and then step 1 moved the rec. The sentence has to be last.
 */

import type { CmaPricingClamp, CmaSellerNet } from '@/lib/cma/types'
import {
  nudgeRecommendedDownForHighDomActives,
  type ActiveDomNudgeRival,
} from '@/lib/pricing/active-dom-nudge'
import { clampRecommendedToClosedBand } from '@/lib/pricing/recommended-in-band'
import { rewriteFailedAskClampAfterRec } from '@/lib/cma/expired-audit'
import { reanchorSellerNet } from '@/lib/pricing/seller-net'

export type FinishRecommendedPricing = {
  recommended: number
  valueLow: number
  valueHigh: number
  /** List tiers. When present, they are pulled into line with the final recommendation. */
  conservative?: number
  highEnd?: number
  notes: string[]
  clamp?: CmaPricingClamp | null
  sellerNet?: CmaSellerNet | null
}

/**
 * The accuracy contract requires conservative <= recommended <= highEnd.
 * Later steps may lower the recommendation without moving those tiers.
 * Move the tiers. Do not move the recommendation.
 */
export function alignListTiersToRecommended<T extends { recommended: number; conservative?: number; highEnd?: number }>(
  pricing: T,
): T {
  const conservative =
    typeof pricing.conservative === 'number' && pricing.conservative > pricing.recommended
      ? pricing.recommended
      : pricing.conservative
  const highEnd =
    typeof pricing.highEnd === 'number' && pricing.highEnd < pricing.recommended
      ? pricing.recommended
      : pricing.highEnd
  if (conservative === pricing.conservative && highEnd === pricing.highEnd) return pricing
  return { ...pricing, conservative, highEnd }
}

export function finishRecommendedAfterActives<T extends FinishRecommendedPricing>(
  pricing: T,
  input: {
    actives: readonly ActiveDomNudgeRival[]
    pocketClosedSupport?: number | null
  },
): T {
  let next = pricing
  if (input.actives.length > 0) {
    const bandLow = Math.min(next.valueLow, next.valueHigh)
    const bandHigh = Math.max(next.valueLow, next.valueHigh)
    const nudge = nudgeRecommendedDownForHighDomActives({
      recommended: next.recommended,
      bandLow,
      bandHigh,
      pocketClosedSupport: input.pocketClosedSupport,
      actives: input.actives,
    })
    if (nudge.nudged && nudge.reason) {
      next = { ...next, recommended: nudge.recommended, notes: [...next.notes, nudge.reason] }
    }
  }
  next = clampRecommendedToClosedBand(next)
  next = alignListTiersToRecommended(next)
  next = rewriteFailedAskClampAfterRec(next)
  // The net sheet is anchored to recommended at the moment attachSellerNet
  // ran. The actives nudge is after that. A sheet still on the pre-nudge
  // list prints a second price (Grand Targhee $543k under a $527k rec).
  if (next.sellerNet) reanchorSellerNet(next)
  return next
}
