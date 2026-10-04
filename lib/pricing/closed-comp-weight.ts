/**
 * Recommended price weights the sales the picker kept. A closer match weighs
 * more. A looser match stays in the set. It is not dropped because it weighs
 * less.
 *
 * Location is the primary order, and it has been the search order for a long
 * time. It is not a new rule. Heaviest first:
 *   1. same subdivision
 *   2. adjacent subdivisions
 *   3. the neighborhood or community
 * Size and bedrooms come after that. Recency comes after those. Each of those
 * adds less than one location step, so a same-subdivision sale outweighs a
 * similar-size sale from only the neighborhood, and an adjacent-subdivision
 * sale sits between those two.
 *
 * Recency half-life is still ~3 months when location is the same: a 6-month-old
 * sale carries about a quarter of the recency of a fresh close. Pending and
 * active sales never enter this weight.
 */

import { normSubdivision } from '@/lib/pricing/classes'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { saleSetsThePrice } from '@/lib/pricing/price-set'

export type ClosedCompWeightInput = {
  subjectSqft: number
  saleSqft: number
  monthsSinceClose: number
  subjectBeds?: number | null
  saleBeds?: number | null
  subjectSubdivision?: string | null
  saleSubdivision?: string | null
  selectionTier?: string | null
  ownPlat?: boolean | null
  /** Set when the caller already classified the sale. Wins over the fields above. */
  locationMatch?: LocationMatch | null
  /** Community whose boundary contains the address. Not the MLS plat name. */
  subjectCommunity?: string | null
  saleCommunity?: string | null
  subjectCommunityLocated?: boolean
  saleCommunityLocated?: boolean
  subjectLotAcres?: number | null
  saleLotAcres?: number | null
  /** See PriceSetSale.fillShortSet. Alone, an outside sale still weighs 0. */
  fillShortSet?: boolean
}

/** Months for recency to halve, inside one location step. */
export const CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS = 3

/**
 * No single closed sale may carry more than this share of the weighted
 * recommendation after renormalization. Nugget / Marshmallow shapes hit
 * 75%+ on one recent similar sale; 40% still prefers the recent sale
 * without letting it own the number. The cap never drops a sale.
 */
export const CLOSED_COMP_WEIGHT_SHARE_CAP = 0.4

/**
 * Location steps. Size, bedrooms, and recency are scaled into the open
 * interval below 1, so they cannot reorder these three.
 */
export const LOCATION_MATCH_WEIGHT = {
  'same-subdivision': 3,
  'adjacent-subdivision': 2,
  'neighborhood-or-community': 1,
  wider: 0,
} as const

export type LocationMatch = keyof typeof LOCATION_MATCH_WEIGHT

/** Less than one location step. A perfect secondary match cannot cross a class. */
export const LOCATION_SECONDARY_SPAN = 0.99

/** Cap raw shares, then renormalize. Equal shares when nothing is usable. */
export function capClosedCompShares(raw: readonly number[]): number[] {
  const n = raw.length
  if (n === 0) return []
  const positive = raw.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const total = positive.reduce((sum, w) => sum + w, 0)
  let shares = total <= 0 ? raw.map(() => 1 / n) : positive.map((w) => w / total)
  const cap = CLOSED_COMP_WEIGHT_SHARE_CAP
  if (n === 1) return [1]
  // Two sales cannot share a 40% cap without inverting rank. Nugget and
  // Marshmallow concentrated at 4+ sales; the two-sale contract still pulls
  // toward the closer match.
  if (n < 3) {
    const sum = shares.reduce((a, b) => a + b, 0)
    return sum > 0 ? shares.map((s) => s / sum) : shares.map(() => 1 / n)
  }
  const floorCap = Math.max(cap, 1 / n)
  for (let iter = 0; iter < 12; iter++) {
    const overIdx = shares.map((s, i) => (s > floorCap + 1e-12 ? i : -1)).filter((i) => i >= 0)
    if (overIdx.length === 0) break
    let excess = 0
    const next = shares.map((s) => {
      if (s > floorCap) {
        excess += s - floorCap
        return floorCap
      }
      return s
    })
    // A sale that weighed nothing does not receive the excess. The cap trims
    // a heavy sale; it does not hand that share to a sale that does not set
    // the price.
    const roomIdx = next.map((s, i) => (positive[i]! > 0 && s < floorCap ? i : -1)).filter((i) => i >= 0)
    const room = roomIdx.reduce((sum, i) => sum + (floorCap - next[i]!), 0)
    if (room <= 0 || excess <= 0) {
      shares = next
      break
    }
    for (const i of roomIdx) {
      next[i] = next[i]! + (excess * (floorCap - next[i]!)) / room
    }
    shares = next
  }
  const sum = shares.reduce((a, b) => a + b, 0)
  return sum > 0 ? shares.map((s) => s / sum) : shares.map(() => 1 / n)
}

/**
 * Same subdivision, then adjacent subdivisions, then the neighborhood or
 * community. A pocket sale in another plat is the adjacent step: the ladder
 * walks that street cluster after the subject's own plat and before the
 * neighborhood. Anything past the community is wider and weighs less.
 */
export function resolveLocationMatch(input: {
  subjectSubdivision?: string | null
  saleSubdivision?: string | null
  selectionTier?: string | null
  ownPlat?: boolean | null
  locationMatch?: LocationMatch | null
}): LocationMatch {
  if (input.locationMatch) return input.locationMatch
  const tier = (input.selectionTier ?? '').trim().toLowerCase()
  const subjectName = normSubdivision(input.subjectSubdivision)
  const saleName = normSubdivision(input.saleSubdivision)
  const sameName = subjectName != null && saleName != null && subjectName === saleName
  if (input.ownPlat === true || sameName || tier.startsWith('subdivision-')) {
    return 'same-subdivision'
  }
  if (tier.startsWith('adjacent-subdivision') || tier.startsWith('pocket-')) {
    return 'adjacent-subdivision'
  }
  if (
    tier.startsWith('neighborhood-') ||
    tier.startsWith('community-') ||
    tier.startsWith('like-community')
  ) {
    return 'neighborhood-or-community'
  }
  return 'wider'
}

function bedProximity(subjectBeds: number | null | undefined, saleBeds: number | null | undefined): number {
  if (subjectBeds == null || saleBeds == null) return 1
  if (!Number.isFinite(subjectBeds) || !Number.isFinite(saleBeds)) return 1
  const gap = Math.abs(Math.floor(subjectBeds) - Math.floor(saleBeds))
  if (gap === 0) return 1
  if (gap === 1) return 0.85
  return 0.7
}

function locationFieldsPresent(input: ClosedCompWeightInput): boolean {
  return (
    input.locationMatch != null ||
    input.ownPlat != null ||
    (input.selectionTier != null && input.selectionTier !== '') ||
    input.subjectSubdivision != null ||
    input.saleSubdivision != null ||
    input.subjectBeds != null ||
    input.saleBeds != null
  )
}

/**
 * Location step, then size, bedrooms, and recency inside that step.
 * Callers that pass only size and recency keep the prior size-times-recency
 * product, so a number with no location class does not grow a false step.
 */
export function closedCompWeight(input: ClosedCompWeightInput): number {
  // A sale that is a different community, or a clearly different size or product,
  // does not set the price. Weight 0 is not averaged back in by this function.
  if (
    !saleSetsThePrice({
      ownPlat: input.ownPlat,
      subjectSubdivision: input.subjectSubdivision,
      saleSubdivision: input.saleSubdivision,
      subjectCommunity: input.subjectCommunity,
      saleCommunity: input.saleCommunity,
      subjectCommunityLocated: input.subjectCommunityLocated,
      saleCommunityLocated: input.saleCommunityLocated,
      subjectSqft: input.subjectSqft,
      saleSqft: input.saleSqft,
      subjectLotAcres: input.subjectLotAcres,
      saleLotAcres: input.saleLotAcres,
      fillShortSet: input.fillShortSet,
    })
  ) {
    return 0
  }
  const months = Math.max(0, Number(input.monthsSinceClose) || 0)
  const subjectSqft = Number(input.subjectSqft) || 0
  const saleSqft = Number(input.saleSqft) || 0
  const sizeProximity =
    subjectSqft > 0 ? 1 / (1 + Math.abs(subjectSqft - saleSqft) / subjectSqft) : 1
  const recency = Math.pow(0.5, months / CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS)
  const secondary = sizeProximity * bedProximity(input.subjectBeds, input.saleBeds) * recency
  if (!locationFieldsPresent(input)) return +(sizeProximity * recency).toFixed(4)
  const base = LOCATION_MATCH_WEIGHT[resolveLocationMatch(input)]
  return +(base + LOCATION_SECONDARY_SPAN * secondary).toFixed(4)
}

/**
 * A tighter sale stays. When fewer than three kept sales set the price, the
 * next rung already admitted fills the count, and those sales set the price.
 * A sale past the living-area cutoff, or a cottage against acreage, still
 * does not. When the plat already has three, nothing here changes.
 */
export function fillShortSetWeights<T extends {
  weight: number
  sqft: number
  beds?: number | null
  lotAcres?: number | null
  subdivision?: string | null
  communitySlug?: string | null
  communityLocated?: boolean
  ownPlat?: boolean | null
  selectionTier?: string | null
  monthsSinceClose?: number | null
}>(
  subject: {
    sqft?: number | null
    beds?: number | null
    lotAcres?: number | null
    subdivision?: string | null
    communitySlug?: string | null
    communityLocated?: boolean
  },
  comps: readonly T[],
): T[] {
  const setters = comps.filter((c) => c.weight > 0).length
  if (setters >= PRICING_MIN_COMPS) return [...comps]
  return comps.map((comp) => {
    if (comp.weight > 0) return comp
    const weight = closedCompWeight({
      subjectSqft: subject.sqft ?? 0,
      saleSqft: comp.sqft,
      monthsSinceClose: comp.monthsSinceClose ?? 0,
      subjectBeds: subject.beds,
      saleBeds: comp.beds,
      subjectSubdivision: subject.subdivision,
      saleSubdivision: comp.subdivision,
      selectionTier: comp.selectionTier,
      ownPlat: comp.ownPlat,
      subjectCommunity: subject.communitySlug,
      saleCommunity: comp.communitySlug,
      subjectCommunityLocated: subject.communityLocated,
      saleCommunityLocated: comp.communityLocated,
      subjectLotAcres: subject.lotAcres,
      saleLotAcres: comp.lotAcres,
      fillShortSet: true,
    })
    return weight > 0 ? { ...comp, weight } : comp
  })
}

