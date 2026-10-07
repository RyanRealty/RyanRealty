/**
 * A built CMA that stays with Matt. It is not queued and it is not sent.
 *
 * Three cases, one gate:
 *   1. The recommendation is more than 15% under the last ask, or any amount
 *      above it (SKILL.md rule 3). Exactly 15% under is not a hold. A missing
 *      ask or a missing recommendation is not a hold: this rule does not
 *      invent a price, and it is not an 80% floor.
 *   2. The build itself recorded an ask-in-band hold (`pricing.hold`, written
 *      by lib/cma/build.ts): the subject's last failed ask sits inside the
 *      trimmed band the recommendation reads from, so the letter's reason
 *      that the ask was too high does not hold (rule 22, Matt 2026-10-07).
 *   3. The live backstop for rows built before that field: an expired home
 *      whose ask sits inside the stored band, inclusive at both ends. Scoped
 *      to origin 'expired' because rule 16's thesis is about a home that did
 *      not sell; an FSBO's current ask inside the band is information, not a
 *      hold.
 *
 * None of these can be acknowledged through. The search is never widened or
 * reshaped to move the band away from the ask.
 */

import { buildPricingReview } from '@/lib/pricing/review'
import type { CmaPricing, CmaPricingAuditVerdict } from '@/lib/cma/types'

export const ASK_IN_BAND_KIND = 'ask-in-band' as const
export type CmaHoldKind = typeof ASK_IN_BAND_KIND

export const ASK_IN_BAND_REASON_PLAIN =
  'The last ask sits inside the sales range the recommendation reads from. It stays with you. It was not queued and it was not sent.'

export type RecommendationGapHold =
  | { hold: false }
  | { hold: true; reason: string }

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/** The reason Matt reads in the queue, with the three dollar figures. No em dash. */
export function askInBandReason(ask: number, low: number, high: number): string {
  const lo = Math.min(low, high)
  const hi = Math.max(low, high)
  return (
    `The last ask of ${usd(ask)} sits inside the sales range of ${usd(lo)} to ${usd(hi)} the recommendation reads from. ` +
    "The home did not sell at a price the sales support, so the letter's reason that the ask was too high does not hold. " +
    'It stays with you. It was not queued and it was not sent.'
  )
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

/**
 * Rule 22: the last failed ask inside the trimmed band, inclusive at both
 * ends. Null, non-finite or non-positive input is not a hold.
 */
export function askInBandHold(
  lastAsk: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): RecommendationGapHold {
  if (!positive(lastAsk) || !positive(low) || !positive(high)) return { hold: false }
  const lo = Math.min(low, high)
  const hi = Math.max(low, high)
  if (lo <= lastAsk && lastAsk <= hi) return { hold: true, reason: askInBandReason(lastAsk, lo, hi) }
  return { hold: false }
}

/**
 * The hold as lib/cma/build.ts writes it after the pin: the last failed ask
 * (the pricer's, else the subject's when the cycle failed) inside the printed
 * band of an expired home. Mutates `pricing` in place, as the build does, and
 * is the one copy the dry run and the tests run too.
 */
export function applyAskInBandHold(
  pricing: CmaPricing,
  args: { lastCycleFailed: boolean; lastListPrice: number | null | undefined; auditVerdict: CmaPricingAuditVerdict },
): CmaPricing {
  const askForHold = pricing.failedAsk ?? (args.lastCycleFailed ? (args.lastListPrice ?? null) : null)
  const bandHold = args.lastCycleFailed
    ? askInBandHold(askForHold, pricing.valueLow, pricing.valueHigh)
    : ({ hold: false } as const)
  if (!bandHold.hold) return pricing
  pricing.hold = {
    kind: ASK_IN_BAND_KIND,
    ask: askForHold!,
    bandLow: pricing.valueLow,
    bandHigh: pricing.valueHigh,
    reason: bandHold.reason,
  }
  pricing.needsReview = true
  pricing.reviewReason = [pricing.reviewReason, bandHold.reason].filter(Boolean).join(' ')
  pricing.review = buildPricingReview({
    needsReview: true,
    reviewReason: pricing.reviewReason,
    clamp: pricing.clamp ?? null,
    auditVerdict: args.auditVerdict,
  })
  return pricing
}

export function recommendationGapHold(
  recommended: number | null | undefined,
  lastAsk: number | null | undefined,
  band?: {
    low: number | null
    high: number | null
    /** The build's own verdict, stored on the row. Wins over the live check. */
    holdKind?: string | null
    /**
     * True when the build wrote a verdict at all (build_summary carries the
     * hold_kind key). The live backstop below is for rows built before it.
     */
    holdDecided?: boolean | null
    origin?: 'expired' | 'fsbo' | string | null
  } | null,
): RecommendationGapHold {
  // FIRST: the stored hold. The build measured pricing.failedAsk against the
  // band it printed, so the row is held whatever the live numbers say. The
  // dollars are restated only when the row's own ask and band agree with the
  // verdict; otherwise the plain reason, never a sentence the numbers refute.
  if (band?.holdKind === ASK_IN_BAND_KIND) {
    const live = askInBandHold(lastAsk, band.low, band.high)
    return { hold: true, reason: live.hold ? live.reason : ASK_IN_BAND_REASON_PLAIN }
  }
  // SECOND: rule 3, unchanged.
  if (recommended != null && lastAsk != null) {
    if (
      Number.isFinite(recommended) &&
      Number.isFinite(lastAsk) &&
      recommended > 0 &&
      lastAsk > 0
    ) {
      if (recommended > lastAsk) {
        return {
          hold: true,
          reason:
            'The recommendation is above the last ask. It stays with you. It was not queued and it was not sent.',
        }
      }
      // More than 15% under. Equal to 85% of the ask is still inside the band.
      if (recommended < lastAsk * 0.85) {
        return {
          hold: true,
          reason:
            'The recommendation is more than 15% under the last ask. It stays with you. It was not queued and it was not sent.',
        }
      }
    }
  }
  // THIRD: the live backstop for rows built before pricing.hold landed,
  // scoped to an expired home. A build that decided no hold is not
  // second-guessed on the row's own numbers.
  if (band?.origin === 'expired' && band.holdDecided !== true) {
    return askInBandHold(lastAsk, band.low, band.high)
  }
  return { hold: false }
}
