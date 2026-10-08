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
 *   3. The live backstop for rows whose build did not measure the ask
 *      against the band (built before that field, or with no failed cycle,
 *      ask or band at build time): an expired home whose ask sits inside the
 *      stored band, inclusive at both ends. Scoped
 *      to origin 'expired' because rule 16's thesis is about a home that did
 *      not sell; an FSBO's current ask inside the band is information, not a
 *      hold.
 *   4. The build recorded an ask-below-band hold: the failed-ask ceiling
 *      pulled the recommendation under every sale that set it (rule 20), and
 *      Matt has not decided how to treat those homes.
 *
 * None of these can be acknowledged through. The search is never widened or
 * reshaped to move the band away from the ask.
 */

import { printedBandBounds } from '@/lib/pricing/price-set'
import { buildPricingReview } from '@/lib/pricing/review'
import type { CmaPricing, CmaPricingAuditVerdict } from '@/lib/cma/types'

export const ASK_IN_BAND_KIND = 'ask-in-band' as const
/**
 * The failed-ask ceiling pulled the recommendation under every sale that set
 * it (20676 Wild Rose: ask $599,900, recommendation $593,000, band $610,150 to
 * $678,983; 915 Saginaw failed at pricing for the same reason). Rule 20 says a
 * price outside the sales that set it is not a price, and Matt has not decided
 * how to treat these homes, so the build completes and the document waits for
 * him. Same mechanism as the ask-in-band hold: stored on the row, never
 * acknowledged through, refused at every approve and send path.
 */
export const ASK_BELOW_BAND_KIND = 'ask-below-band' as const
export type CmaHoldKind = typeof ASK_IN_BAND_KIND | typeof ASK_BELOW_BAND_KIND

/** True for a hold kind the build writes. Anything else on a row is not a hold. */
export function isCmaHoldKind(v: unknown): v is CmaHoldKind {
  return v === ASK_IN_BAND_KIND || v === ASK_BELOW_BAND_KIND
}

/** The hold kind a stored build summary carries (build_summary.hold_kind), or null. */
export function storedHoldKind(summary: unknown): CmaHoldKind | null {
  const kind = (summary as { hold_kind?: unknown } | null | undefined)?.hold_kind
  return isCmaHoldKind(kind) ? kind : null
}

/**
 * The build decided the hold: it stored one, or it measured an ask against a
 * band and found none (build_summary.hold_measured). The send gates run the
 * live backstop on every row this is false for.
 */
export function storedHoldDecided(summary: unknown): boolean {
  if (summary == null || typeof summary !== 'object') return false
  return storedHoldKind(summary) != null || (summary as { hold_measured?: unknown }).hold_measured === true
}

export const ASK_IN_BAND_REASON_PLAIN =
  'The last ask sits inside the sales range the recommendation reads from. It stays with you. It was not queued and it was not sent.'

export const ASK_BELOW_BAND_REASON_PLAIN =
  'The recommended price sits under the sales range because the last ask did not sell and the price was pulled under it. A price under every sale that set it has not been approved. It stays with you. It was not queued and it was not sent.'

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

/** The ask-below-band reason Matt reads in the queue: the ask, the price, the band. No em dash. */
export function askBelowBandReason(ask: number, recommended: number, low: number, high: number): string {
  const lo = Math.min(low, high)
  const hi = Math.max(low, high)
  return (
    `The recommended price of ${usd(recommended)} sits under the sales range of ${usd(lo)} to ${usd(hi)}, ` +
    `because the last ask of ${usd(ask)} did not sell and the price was pulled under that ask. ` +
    'A price under every sale that set it has not been approved. ' +
    'It stays with you. It was not queued and it was not sent.'
  )
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

/**
 * True when there is an ask and a band to measure it against. Rule 22 decides
 * nothing on a row without both, so such a row has not been measured.
 */
export function askInBandMeasurable(
  lastAsk: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): boolean {
  return positive(lastAsk) && positive(low) && positive(high)
}

/**
 * Rule 22: the last failed ask inside the trimmed band, inclusive at both
 * ends. Null, non-finite or non-positive input is not a hold.
 *
 * The band is the one the reader sees (printedBandBounds: low down, high up,
 * onto the pricing unit), the same boundary the failed-ask cap reads for an
 * ask below the band. The pin puts the exact sale back on the band, so
 * against the exact low an ask of $893,000 under a kept $893,412 sale was
 * neither below the band for the cap nor inside it here, and fell through
 * both (review, 2026-10-07). On the printed low it is inside.
 */
export function askInBandHold(
  lastAsk: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): RecommendationGapHold {
  if (!askInBandMeasurable(lastAsk, low, high)) return { hold: false }
  const band = printedBandBounds(low!, high!)
  if (band.low <= lastAsk! && lastAsk! <= band.high) {
    return { hold: true, reason: askInBandReason(lastAsk!, band.low, band.high) }
  }
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
  // Recorded either way, so the row says whether the build decided rule 22
  // or never had an ask and a band to decide it on (build_summary.hold_measured).
  // A row that did not measure goes through the live backstop at every send gate.
  pricing.askInBandMeasured =
    args.lastCycleFailed && askInBandMeasurable(askForHold, pricing.valueLow, pricing.valueHigh)
  const bandHold = pricing.askInBandMeasured
    ? askInBandHold(askForHold, pricing.valueLow, pricing.valueHigh)
    : ({ hold: false } as const)
  if (!bandHold.hold) return pricing
  const printed = printedBandBounds(pricing.valueLow, pricing.valueHigh)
  pricing.hold = {
    kind: ASK_IN_BAND_KIND,
    ask: askForHold!,
    bandLow: printed.low,
    bandHigh: printed.high,
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

/**
 * The recommendation under the printed band low (printedBandBounds), read
 * AFTER the pin. Null when there is nothing to compare.
 */
export function recommendationUnderPrintedBand(pricing: {
  recommended?: number | null
  valueLow?: number | null
  valueHigh?: number | null
}): { low: number; high: number } | null {
  if (!positive(pricing.recommended) || !positive(pricing.valueLow) || !positive(pricing.valueHigh)) return null
  const band = printedBandBounds(pricing.valueLow, pricing.valueHigh)
  return pricing.recommended < band.low ? band : null
}

/**
 * The failed-ask ceiling is what put the recommendation under the band: it
 * moved the recommended tier from a figure at or above the band low to one
 * under it. A recommendation under the band for any other reason is not this.
 */
export function failedAskPutRecommendationUnderBand(pricing: {
  recommended?: number | null
  valueLow?: number | null
  valueHigh?: number | null
  clamp?: CmaPricing['clamp']
}): boolean {
  const band = recommendationUnderPrintedBand(pricing)
  if (!band) return false
  return (pricing.clamp?.applications ?? []).some(
    (a) => a.tier === 'recommended' && a.after < a.before && a.before >= band.low,
  )
}

/**
 * THE RECOMMENDATION UNDER THE PRINTED BAND, after the pin (review,
 * 2026-10-07). When the failed-ask ceiling put it there the build completes
 * as an 'ask-below-band' hold for Matt; a row the ask-in-band hold already
 * holds stays held and gains this reason. Any other recommendation under the
 * band low is not a price, and the build fails with the reason returned here.
 * A broker override is exempt. Mutates `pricing` in place, as
 * applyAskInBandHold does.
 */
export function applyAskBelowBandHold(
  pricing: CmaPricing,
  args: { lastListPrice: number | null | undefined; auditVerdict: CmaPricingAuditVerdict },
): { ok: true } | { ok: false; error: string } {
  const band = recommendationUnderPrintedBand(pricing)
  if (!band) return { ok: true }
  // A broker override is a person choosing the number, exempt from rule 20
  // (Matt 2026-10-07): how he approves a held price, or sets his own.
  if (pricing.priceOverride != null && pricing.priceOverride > 0) return { ok: true }
  const rec = pricing.recommended
  if (!failedAskPutRecommendationUnderBand(pricing)) {
    return {
      ok: false,
      error:
        `The recommended price ${usd(rec)} sits under the sales range of ${usd(band.low)} to ${usd(band.high)}, ` +
        'and no failed-ask ceiling explains it. A price outside the sales that set it is not a price.',
    }
  }
  const ask = pricing.failedAsk ?? args.lastListPrice ?? null
  const reason = positive(ask) ? askBelowBandReason(ask, rec, band.low, band.high) : ASK_BELOW_BAND_REASON_PLAIN
  if (!pricing.hold) {
    pricing.hold = {
      kind: ASK_BELOW_BAND_KIND,
      ask: positive(ask) ? ask : 0,
      bandLow: band.low,
      bandHigh: band.high,
      recommended: rec,
      reason,
    }
  }
  pricing.needsReview = true
  if (!(pricing.reviewReason ?? '').includes(reason)) {
    pricing.reviewReason = [pricing.reviewReason, reason].filter(Boolean).join(' ')
  }
  pricing.review = buildPricingReview({
    needsReview: true,
    reviewReason: pricing.reviewReason,
    clamp: pricing.clamp ?? null,
    auditVerdict: args.auditVerdict,
  })
  return { ok: true }
}

export function recommendationGapHold(
  recommended: number | null | undefined,
  lastAsk: number | null | undefined,
  band?: {
    low: number | null
    high: number | null
    /** The build's own verdict (either hold kind), stored on the row. Wins over the live check. */
    holdKind?: string | null
    /**
     * True when the build measured the ask against the band and decided
     * (build_summary.hold_measured, lib/data/cma/unified-queue.ts
     * holdDecidedFromSummary). The live backstop below is for every row that
     * did not: built before the field, or with no ask or no band to measure.
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
  // The stored ask-below-band hold. Restated with dollars only when the row's
  // own recommendation still sits under its own band.
  if (band?.holdKind === ASK_BELOW_BAND_KIND) {
    const under =
      positive(recommended) && positive(band.low) && positive(band.high)
        ? recommendationUnderPrintedBand({ recommended, valueLow: band.low, valueHigh: band.high })
        : null
    return {
      hold: true,
      reason:
        under && positive(lastAsk) && lastAsk < under.low
          ? askBelowBandReason(lastAsk, recommended!, under.low, under.high)
          : ASK_BELOW_BAND_REASON_PLAIN,
    }
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
  // THIRD: the live backstop for rows whose build did not measure the ask
  // against the band (built before pricing.hold landed, or with no ask or no
  // band at build time), scoped to an expired home. A build that measured and
  // decided no hold is not second-guessed on the row's own numbers.
  if (band?.origin === 'expired' && band.holdDecided !== true) {
    return askInBandHold(lastAsk, band.low, band.high)
  }
  return { hold: false }
}
