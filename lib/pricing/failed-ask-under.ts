/**
 * An expired, canceled, or withdrawn listing did not sell at its last ask.
 * That ask was too high. The comps still set the price. This step only
 * moves the recommendation when those comps land on the ask or above it.
 *
 * The step under the ask is small and comes from facts already on the
 * listing:
 * - No days on market and no original ask: one thousand dollars under.
 *   That is a pricing step, not a percent.
 * - Days on market or an original ask: 1 percent under, plus more as
 *   days on market approach 120.
 * - No price cut, when the original ask is already on the subject and
 *   did not come down, adds up to 2 percent more (3 percent at 120 days).
 * - A price cut, or no original ask to judge a cut by, adds at most half
 *   a percent more (1.5 percent at 120 days).
 *
 * The pull never reaches the separate hold, which is more than 15 percent
 * under the last ask. Exactly 15 percent under is not a hold, and this
 * step stays inside 3 percent. A recommendation the comps already put
 * under the ask is returned unchanged.
 */

export const FAILED_ASK_BARE_STEP = 1000
export const FAILED_ASK_PULL_MIN = 0.01
export const FAILED_ASK_PULL_DOM_DAYS = 120
export const FAILED_ASK_PULL_NO_CUT_EXTRA = 0.02
export const FAILED_ASK_PULL_CUT_EXTRA = 0.005
/** The deepest this pull goes. Inside the 15 percent hold line. */
export const FAILED_ASK_PULL_MAX = 0.03

export type FailedAskPullFacts = {
  daysOnMarket?: number | null
  originalListPrice?: number | null
}

function finitePositive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

/**
 * Share to sit under the failed ask, or null when the listing has neither
 * days on market nor an original ask. Null means the bare thousand-dollar step.
 */
export function failedAskPullShare(ask: number, facts: FailedAskPullFacts = {}): number | null {
  if (!(ask > 0)) return null
  const domOk =
    facts.daysOnMarket != null && Number.isFinite(facts.daysOnMarket) && facts.daysOnMarket >= 0
  const originalOk = finitePositive(facts.originalListPrice)
  if (!domOk && !originalOk) return null
  const cut = originalOk && facts.originalListPrice! >= ask + FAILED_ASK_BARE_STEP
  const noCut = originalOk && !cut
  const domShare = domOk ? Math.min(facts.daysOnMarket! / FAILED_ASK_PULL_DOM_DAYS, 1) : 0
  // A missing original ask is not "no price cut." Only a known original
  // that did not come down earns the larger extra. A known cut, or an
  // unknown original, earns the smaller one.
  const extra = noCut ? FAILED_ASK_PULL_NO_CUT_EXTRA : FAILED_ASK_PULL_CUT_EXTRA
  return Math.min(FAILED_ASK_PULL_MAX, FAILED_ASK_PULL_MIN + extra * domShare)
}

/** A list price strictly under `ask`. Does not look at the comp price. */
export function priceUnderFailedAsk(ask: number, facts: FailedAskPullFacts = {}): number {
  if (!(ask > 0) || !Number.isFinite(ask)) return ask
  const share = failedAskPullShare(ask, facts)
  let next =
    share == null ? ask - FAILED_ASK_BARE_STEP : Math.floor((ask * (1 - share)) / 1000) * 1000
  if (!(next < ask)) next = ask - FAILED_ASK_BARE_STEP
  const deepest = Math.floor((ask * (1 - FAILED_ASK_PULL_MAX)) / 1000) * 1000
  if (deepest > 0 && deepest < ask && next < deepest) next = deepest
  if (!(next > 0) || !(next < ask)) next = Math.max(1, ask - 1)
  return next
}

/**
 * The recommended price after a failed listing. Comps under the ask stay.
 * Comps at or above the ask move to `priceUnderFailedAsk`.
 */
export function recommendedAfterFailedAsk(args: {
  recommended: number
  lastAsk: number
  facts?: FailedAskPullFacts
}): number {
  const recommended = args.recommended
  const lastAsk = args.lastAsk
  if (!(recommended > 0) || !(lastAsk > 0)) return recommended
  if (recommended < lastAsk) return recommended
  return priceUnderFailedAsk(lastAsk, args.facts ?? {})
}
