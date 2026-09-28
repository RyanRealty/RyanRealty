/**
 * The order build.ts applies after competition is known.
 *
 * 1. Sitting high-DOM actives may pull Recommended down, inside the cap and
 *    not below pocket closed-sale support.
 * 2. Recommended is clamped into the closed-comp band.
 * 3. The failed-ask sentence is rewritten from that final recommendation.
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
  notes: string[]
  clamp?: CmaPricingClamp | null
  sellerNet?: CmaSellerNet | null
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
  next = rewriteFailedAskClampAfterRec(next)
  // The net sheet is anchored to recommended at the moment attachSellerNet
  // ran. The actives nudge is after that. A sheet still on the pre-nudge
  // list prints a second price (Grand Targhee $543k under a $527k rec).
  if (next.sellerNet) reanchorSellerNet(next)
  return next
}
