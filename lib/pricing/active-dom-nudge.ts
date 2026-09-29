/**
 * Matt 2026-09-17: high-DOM sitting actives may pull Recommended DOWN
 * within the closed-comp band only. Never outside the band. No story-adj.
 *
 * Market cool / no false hope: stronger pull when similar homes sit.
 *
 * - high DOM = 60+ days on market
 * - sitting active = Active + high DOM (ask need not be above band high)
 * - overpriced active (ask above band high + high DOM) also qualifies
 * - actives still do not *set* Recommended (closed comps own the band)
 * - pending high-DOM (60+) = letter signal only — never sets Recommended,
 *   never nudges (actives may still nudge in-band)
 */

export const HIGH_DOM_ACTIVE_DAYS = 60

/** Fraction of the gap toward band low to pull (Matt stronger cool pull). */
export const HIGH_DOM_NUDGE_PULL = 0.75

/**
 * Cap on the pull, as a fraction of the recommendation. Canter's contract
 * pull is $701k to $682k, about 2.7 percent, so the cap has to clear that.
 * A 3 percent cap stops Oakside's weighted $485k from being dragged to $448k.
 */
export const HIGH_DOM_NUDGE_MAX_DROP = 0.03

/** A sale under this share of the weight is not pocket closed-sale support. */
export const POCKET_SUPPORT_MIN_WEIGHT_SHARE = 0.05

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
 * Sitting active: Active + 60+ DOM. Market cool signal even when ask is
 * inside or below the closed band (homes sitting while earlier closeds look hot).
 */
export function isHighDomSittingActive(rival: ActiveDomNudgeRival): boolean {
  if (!/^active$/i.test(rival.status.trim())) return false
  const dom = rival.daysOnMarket
  return dom != null && dom >= HIGH_DOM_ACTIVE_DAYS && rival.listPrice > 0
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
  /**
   * Lowest meaningful-weight pocket (or same-subdivision) adjusted close.
   * The nudge never pulls Recommended below this. Closed sales own the price.
   */
  pocketClosedSupport?: number | null
}

const POCKET_TIER = /^(pocket-|subdivision-|own-street-)/

/**
 * The lowest adjusted price among pocket / same-subdivision sales that carry
 * at least ~5% of the weight. A 1.6% comp does not set the floor.
 */
export function pocketClosedSupportPrice(
  comps: readonly {
    adjustedPrice?: number | null
    weight?: number | null
    subdivision?: string | null
    selectionTier?: string | null
  }[],
  subjectSubdivision?: string | null,
): number | null {
  const priced = comps.filter((c) => (c.adjustedPrice ?? 0) > 0 && (c.weight ?? 0) > 0)
  if (priced.length === 0) return null
  const total = priced.reduce((sum, c) => sum + (c.weight as number), 0)
  if (!(total > 0)) return null
  const meaningful = priced.filter((c) => (c.weight as number) / total >= POCKET_SUPPORT_MIN_WEIGHT_SHARE)
  const pool0 = meaningful.length > 0 ? meaningful : priced
  const sub = (subjectSubdivision ?? '').trim().toLowerCase()
  const pocket = pool0.filter((c) => {
    const tier = c.selectionTier ?? ''
    const same = sub.length > 0 && (c.subdivision ?? '').trim().toLowerCase() === sub
    return same || POCKET_TIER.test(tier)
  })
  const pool = pocket.length > 0 ? pocket : pool0
  return Math.min(...pool.map((c) => c.adjustedPrice as number))
}

export type ActiveDomNudgeResult = {
  recommended: number
  nudged: boolean
  signalCount: number
  reason: string | null
}

/**
 * Pull Recommended toward the closed band low when sitting high-DOM actives
 * are present. Stronger cool pull (HIGH_DOM_NUDGE_PULL). Clamp to band always.
 *
 * Bound: the pull is 75% of the way to the band low, but never more than
 * HIGH_DOM_NUDGE_MAX_DROP of the recommendation, and never below
 * pocketClosedSupport. Closed sales that carry the price are the floor.
 * Canter's $701k to $682k move is about 2.7% and stays inside both bounds.
 * Oakside must not be pulled under the Meridian adjusted sales.
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

  const signals = input.actives.filter(isHighDomSittingActive)
  if (signals.length === 0) {
    return { recommended: rec, nudged: false, signalCount: 0, reason: null }
  }

  const support = input.pocketClosedSupport
  const supportFloor =
    support != null && Number.isFinite(support) && support > 0 ? Math.min(rec, Math.max(lo, support)) : lo
  const pulledRaw = rec - HIGH_DOM_NUDGE_PULL * (rec - lo)
  const dropCap = rec * HIGH_DOM_NUDGE_MAX_DROP
  const cappedPull = Math.max(pulledRaw, rec - dropCap)
  const bounded = Math.max(supportFloor, Math.min(rec, Math.min(hi, cappedPull)))
  let next = round1000(bounded)
  // Rounding must not step under pocket support or under the band.
  if (next < supportFloor) next = Math.min(rec, Math.ceil(supportFloor / 1000) * 1000)
  if (next < lo) next = Math.max(lo, next)
  next = Math.min(hi, Math.max(lo, next))
  if (next >= rec) {
    return { recommended: rec, nudged: false, signalCount: signals.length, reason: null }
  }

  return {
    recommended: next,
    nudged: true,
    signalCount: signals.length,
    reason: `Sitting high-DOM (≥${HIGH_DOM_ACTIVE_DAYS} days) actives pulled Recommended down within the closed band ($${lo.toLocaleString('en-US')} to $${hi.toLocaleString('en-US')}).`,
  }
}
