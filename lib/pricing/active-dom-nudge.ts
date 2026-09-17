/**
 * Matt 2026-09-17: high-DOM overpriced actives may nudge Recommended DOWN
 * within the closed-comp band only. Never outside the band. No story-adj.
 *
 * - high DOM = 60+ days on market
 * - overpriced = current ask above closed-comp / Recommended band high
 * - actives still do not *set* Recommended (closed comps own the band)
 * - pending high-DOM (60+) = letter signal only — never sets Recommended,
 *   never nudges (actives may still nudge in-band)
 */

export const HIGH_DOM_ACTIVE_DAYS = 60

export type ActiveDomNudgeRival = {
  status: string
  listPrice: number
  daysOnMarket: number | null
}

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000
}

/** Active ask above the closed-comp (Recommended) band high, sitting 60+ DOM. */
export function isHighDomOverpricedActive(
  rival: ActiveDomNudgeRival,
  closedBandHigh: number,
): boolean {
  if (!/^active$/i.test(rival.status.trim())) return false
  const dom = rival.daysOnMarket
  if (dom == null || !(dom >= HIGH_DOM_ACTIVE_DAYS)) return false
  if (!(rival.listPrice > 0) || !(closedBandHigh > 0)) return false
  return rival.listPrice > closedBandHigh
}

/**
 * Pending sitting 60+ DOM — letter/competition signal only.
 * Never qualifies for Recommended nudge (actives may still nudge in-band).
 */
export function isHighDomPendingLetterSignal(rival: ActiveDomNudgeRival): boolean {
  if (!/^pending$/i.test(rival.status.trim())) return false
  const dom = rival.daysOnMarket
  return dom != null && dom >= HIGH_DOM_ACTIVE_DAYS
}

export type ActiveDomNudgeInput = {
  recommended: number
  /** Closed-comp evidence / Recommended band low. */
  bandLow: number
  /** Closed-comp evidence / Recommended band high. */
  bandHigh: number
  actives: readonly ActiveDomNudgeRival[]
}

export type ActiveDomNudgeResult = {
  recommended: number
  nudged: boolean
  signalCount: number
  reason: string | null
}

/**
 * Pull Recommended halfway toward the closed band low when a high-DOM
 * overpriced active is present. Clamp to [bandLow, bandHigh] always.
 */
export function nudgeRecommendedDownForHighDomActives(
  input: ActiveDomNudgeInput,
): ActiveDomNudgeResult {
  const lo = Math.min(input.bandLow, input.bandHigh)
  const hi = Math.max(input.bandLow, input.bandHigh)
  const rec = input.recommended
  if (!(rec > 0) || !(lo > 0) || !(hi > 0) || lo > hi) {
    return { recommended: rec, nudged: false, signalCount: 0, reason: null }
  }

  const signals = input.actives.filter((a) => isHighDomOverpricedActive(a, hi))
  if (signals.length === 0) {
    return { recommended: rec, nudged: false, signalCount: 0, reason: null }
  }

  // Halfway toward the closed-comp low — a nudge, not a slam to the floor.
  const pulled = round1000(rec - 0.5 * (rec - lo))
  const next = Math.max(lo, Math.min(hi, Math.min(rec, pulled)))
  if (next >= rec) {
    return { recommended: rec, nudged: false, signalCount: signals.length, reason: null }
  }

  return {
    recommended: next,
    nudged: true,
    signalCount: signals.length,
    reason: `High-DOM (≥${HIGH_DOM_ACTIVE_DAYS} days) active ask above the closed-comp high nudged Recommended down within the closed band ($${lo.toLocaleString('en-US')}–$${hi.toLocaleString('en-US')}).`,
  }
}
