/**
 * The order build.ts applies after competition is known.
 *
 * 1. Sitting high-DOM actives may pull Recommended down. The pull is measured
 *    against the closed-sale low from before a minimum-width open. That open
 *    is presentation and does not move the recommendation. The pull stops at
 *    the conservative tier, which the same-subdivision floor is copied onto.
 *    The tier is not lowered to follow the pull.
 * 2. Recommended is clamped into the printed closed-comp band.
 * 3. The printed recommendation, the list tiers, and the band ends sit on
 *    the thousand-dollar grid. Nearest thousand, inside the printed band.
 *    A raw off-grid floor is not a reason to step up. When the unrounded
 *    pin is within one thousand of the last ask, the printed list does not
 *    go above that ask.
 * 4. The failed-ask sentence is rewritten from that final recommendation.
 *
 * The nudge function itself may still land under a list tier when its caller
 * passes only the sale band (Canter, $701k toward $675k lands at $682k). The
 * build grades range-consistency on this final recommendation, so this step
 * holds the tier.
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
import { priceUnderFailedAsk } from '@/lib/pricing/failed-ask-under'
import { closedSaleLow, rewriteFailedAskClampAfterRec } from '@/lib/cma/expired-audit'
import { reanchorSellerNet } from '@/lib/pricing/seller-net'
import { roundPrintedPrices, type PricingRangeRule } from '@/lib/pricing/estimate'

export type FinishRecommendedPricing = {
  recommended: number
  valueLow: number
  valueHigh: number
  /** List tiers. A nudge must not drop the recommendation under the floor. */
  conservative?: number
  highEnd?: number
  notes: string[]
  clamp?: CmaPricingClamp | null
  sellerNet?: CmaSellerNet | null
  rangeRule?: PricingRangeRule | null
  failedAsk?: number | null
}

/**
 * Thousand-dollar grid at or above `floor`, never above the pre-nudge rec.
 * Returns the original rec when the grid has no room under it.
 */
function gridAtOrAboveFloor(floor: number, original: number): number {
  const stepped = Math.ceil(floor / 1000) * 1000
  const next = stepped + 1e-6 < floor ? stepped + 1000 : stepped
  return Math.min(original, next)
}

/**
 * Homes shown because the sales place had nothing listed do not move the
 * price. A sitting active in the sales place still can.
 */
export function rivalsThatMayNudgeTheList<T>(
  band: {
    rivals?: readonly T[] | null
    emptyPlace?: string | null
    productWidened?: boolean | null
  } | null | undefined,
): T[] {
  if (!band) return []
  if (band.emptyPlace?.trim() || band.productWidened === true) return []
  return [...(band.rivals ?? [])]
}

export function finishRecommendedAfterActives<T extends FinishRecommendedPricing>(
  pricing: T,
  input: {
    actives: readonly ActiveDomNudgeRival[]
    pocketClosedSupport?: number | null
    /** Failed last ask. Rounding will not print a list above it when the unrounded pin is within one thousand. */
    ask?: number | null
  },
): T {
  let next = pricing
  if (input.actives.length > 0) {
    const printedLow = Math.min(next.valueLow, next.valueHigh)
    const printedHigh = Math.max(next.valueLow, next.valueHigh)
    const saleLow = closedSaleLow(next)
    const chaseLow = saleLow != null && saleLow > 0 ? saleLow : printedLow
    const nudge = nudgeRecommendedDownForHighDomActives({
      recommended: next.recommended,
      bandLow: chaseLow,
      bandHigh: printedHigh,
      pocketClosedSupport: input.pocketClosedSupport,
      actives: input.actives,
    })
    if (nudge.nudged && nudge.reason) {
      let recommended = nudge.recommended
      const floor = next.conservative
      // The tier stays. A pull that would cross it stops on the tier.
      if (typeof floor === 'number' && floor > 0 && recommended < floor) {
        recommended = gridAtOrAboveFloor(floor, next.recommended)
      }
      if (recommended < next.recommended) {
        next = { ...next, recommended, notes: [...next.notes, nudge.reason] }
      }
    }
  }
  const beforeBand = next.recommended
  next = clampRecommendedToClosedBand(next)
  const ask = input.ask
  if (ask != null && Number.isFinite(ask) && ask > 0) {
    if (beforeBand < ask && next.recommended >= ask) {
      next = { ...next, recommended: beforeBand }
    } else if (next.recommended >= ask) {
      next = { ...next, recommended: priceUnderFailedAsk(ask) }
    }
  }
  next = roundPrintedPrices(next, input.ask)
  next = rewriteFailedAskClampAfterRec(next)
  // The net sheet is anchored to recommended at the moment attachSellerNet
  // ran. The actives nudge is after that. A sheet still on the pre-nudge
  // list prints a second price (Grand Targhee $543k under a $527k rec).
  if (next.sellerNet) reanchorSellerNet(next)
  return next
}
