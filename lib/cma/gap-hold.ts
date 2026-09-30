/**
 * A built CMA whose recommendation is more than 15% under the last ask, or
 * any amount above the last ask, stays with Matt. It is not queued and it is
 * not sent.
 *
 * Exactly 15% under is not a hold. A missing ask or a missing recommendation
 * is not a hold: this rule does not invent a price, and it is not an 80% floor.
 */

export type RecommendationGapHold =
  | { hold: false }
  | { hold: true; reason: string }

export function recommendationGapHold(
  recommended: number | null | undefined,
  lastAsk: number | null | undefined,
): RecommendationGapHold {
  if (recommended == null || lastAsk == null) return { hold: false }
  if (!Number.isFinite(recommended) || !Number.isFinite(lastAsk)) return { hold: false }
  if (!(recommended > 0) || !(lastAsk > 0)) return { hold: false }
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
  return { hold: false }
}
