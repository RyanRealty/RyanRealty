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
 * Size, year built, bedrooms, bathrooms, lot size, and recency come after
 * that. Each of those adds less than one location step, so a same-subdivision
 * sale outweighs a similar-size sale from only the neighborhood, and an
 * adjacent-subdivision sale sits between those two. A 4-bedroom in the same
 * subdivision still counts for a 3-bedroom subject. The extra bedroom lowers
 * the weight more than one bath apart does. Neither removes the sale, and
 * neither lets an adjacent sale pass it.
 *
 * Within about 350 square feet, within 5 years, and within one bath is the
 * close match, and it weighs more than a home outside those bands. A full
 * match on size, year, subdivision, bedrooms, bathrooms, and lot weighs more
 * than an adjacent sale with an extra bedroom.
 *
 * Recency follows the market path that already moved the sale price to today.
 * A quiet index, under about 1% a month, keeps a 12-month sale of the same
 * house nearly as heavy as its 3-month twin. A market that is actually
 * running, a path that reversed, a capped path, or no index at all keeps the
 * 3-month half-life: a 6-month sale carries about a quarter of the recency
 * of a fresh close. Pending and active sales never enter this weight.
 */

import { normSubdivision } from '@/lib/pricing/classes'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { REGIME_MONTHLY_CUT } from '@/lib/pricing/market-path'
import { saleSetsThePrice } from '@/lib/pricing/price-set'

export type ClosedCompWeightInput = {
  subjectSqft: number
  saleSqft: number
  monthsSinceClose: number
  subjectBeds?: number | null
  saleBeds?: number | null
  subjectBaths?: number | null
  saleBaths?: number | null
  subjectYearBuilt?: number | null
  saleYearBuilt?: number | null
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
  /** Closed-sale days on market. Exactly 0 weighs nothing. Unknown still weighs. */
  saleDomTotal?: number | null
  /**
   * The path that moved this sale's price to the as-of date. Absent, not from
   * the index, reversed, or capped keeps the 3-month half-life.
   */
  marketPathSource?: 'index' | 'none' | null
  /** Average monthly index rate over this sale's own span. */
  marketMonthlyRate?: number | null
  /** The index turned around between the sale and today. */
  marketReversed?: boolean | null
  /** The move was capped, or an upward city move was refused. Not a flat market. */
  marketCapped?: boolean | null
}

/** Months for recency to halve when the market is running, or the index is missing. */
export const CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS = 3

/**
 * A quiet index stretches the half-life this far. A 12-month sale of the same
 * house still counts. It does not catch a fresh close.
 */
const CALM_RECENCY_HALF_LIFE_MONTHS = 36

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

/** Living area this close still counts as the same size for weight. */
export const SQFT_CLOSE_BAND = 350

/** Year built this close still counts as the same age for weight. */
export const AGE_CLOSE_YEARS = 5

/** A lot this close, by share of the subject's lot or by acres, still matches. */
export const LOT_CLOSE_RATIO = 0.25
export const LOT_CLOSE_ACRES = 0.05

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
  if (tier.startsWith('adjacent-sub') || tier.startsWith('pocket-')) {
    return 'adjacent-subdivision'
  }
  if (
    tier.startsWith('closer-sub') ||
    tier.startsWith('neighborhood-') ||
    tier.startsWith('community-') ||
    tier.startsWith('like-community')
  ) {
    return 'neighborhood-or-community'
  }
  return 'wider'
}

/** One whole bedroom apart still counts. It weighs less than one bath apart. */
const BED_ONE_APART = 0.85
/**
 * One whole bath apart is still the close match: same subdivision, within
 * about 350 square feet, and within 5 years. It weighs more than an extra
 * bedroom and less than the same bath count.
 */
const BATH_ONE_APART = 0.9

/** Whole rooms. A missing count is not a mismatch. One apart still weighs. */
function roomProximity(
  subject: number | null | undefined,
  sale: number | null | undefined,
  oneApart: number,
): number {
  if (subject == null || sale == null) return 1
  if (!Number.isFinite(subject) || !Number.isFinite(sale) || subject <= 0 || sale <= 0) return 1
  const gap = Math.abs(Math.floor(subject) - Math.floor(sale))
  if (gap === 0) return 1
  if (gap === 1) return oneApart
  return 0.7
}

function yearBuilt(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const year = Math.floor(value)
  if (year < 1800 || year > 2100) return null
  return year
}

/**
 * Within 5 years is the same age, and a closer year still weighs a little
 * more. The sixth year steps down. Unknown year does not lower the weight.
 */
function ageProximity(subjectYear: number | null | undefined, saleYear: number | null | undefined): number {
  const subject = yearBuilt(subjectYear)
  const sale = yearBuilt(saleYear)
  if (subject == null || sale == null) return 1
  const gap = Math.abs(subject - sale)
  if (gap <= AGE_CLOSE_YEARS) return 1 - 0.04 * (gap / AGE_CLOSE_YEARS)
  if (gap <= 15) return 0.85
  return 0.7
}

function acres(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

/**
 * Within a quarter of the subject's lot, or 0.05 acres, is the same lot, and
 * a closer lot still weighs a little more. Past that the factor falls. A
 * missing lot does not lower the weight.
 */
const LOT_BAND_EDGE = 0.96

function lotProximity(subjectLot: number | null | undefined, saleLot: number | null | undefined): number {
  const subject = acres(subjectLot)
  const sale = acres(saleLot)
  if (subject == null || sale == null) return 1
  const gap = Math.abs(subject - sale)
  const rel = gap / subject
  const bandT = Math.min(rel / LOT_CLOSE_RATIO, gap / LOT_CLOSE_ACRES)
  if (bandT <= 1) return 1 - (1 - LOT_BAND_EDGE) * bandT
  const over = Math.max(0, rel - LOT_CLOSE_RATIO)
  return LOT_BAND_EDGE / (1 + 1.5 * over)
}

/**
 * Within 350 square feet is the same size: the factor stays high, and a
 * closer living area still weighs a little more. Past 350 it falls, so a
 * home about twice that far does not pull like a same-size sale. One square
 * foot across the line does not jump.
 */
const SQFT_BAND_EDGE = 0.92
const SQFT_PAST_SLOPE = 2.5

function sizeProximity(subjectSqft: number, saleSqft: number): number {
  if (!(subjectSqft > 0) || !(saleSqft > 0)) return 1
  const gap = Math.abs(subjectSqft - saleSqft)
  if (gap <= SQFT_CLOSE_BAND) return 1 - (1 - SQFT_BAND_EDGE) * (gap / SQFT_CLOSE_BAND)
  const past = (gap - SQFT_CLOSE_BAND) / subjectSqft
  return SQFT_BAND_EDGE / (1 + SQFT_PAST_SLOPE * past)
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
 * Age of the sale, after the index has already moved its price.
 * A quiet index stretches the half-life. A running market, a reversal, a
 * capped path, or no index keeps the 3-month half-life.
 */
function recencyFactor(months: number, input: ClosedCompWeightInput): number {
  const indexed =
    input.marketPathSource === 'index' && input.marketReversed !== true && input.marketCapped !== true
  const rate = Math.abs(Number(input.marketMonthlyRate) || 0)
  if (!indexed || rate > REGIME_MONTHLY_CUT) {
    return Math.pow(0.5, months / CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS)
  }
  const t = rate / REGIME_MONTHLY_CUT
  const halfLife =
    CALM_RECENCY_HALF_LIFE_MONTHS +
    (CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS - CALM_RECENCY_HALF_LIFE_MONTHS) * t
  return Math.pow(0.5, months / halfLife)
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
      saleDomTotal: input.saleDomTotal,
    })
  ) {
    return 0
  }
  const months = Math.max(0, Number(input.monthsSinceClose) || 0)
  const subjectSqft = Number(input.subjectSqft) || 0
  const saleSqft = Number(input.saleSqft) || 0
  const size = sizeProximity(subjectSqft, saleSqft)
  const recency = recencyFactor(months, input)
  const secondary =
    size *
    roomProximity(input.subjectBeds, input.saleBeds, BED_ONE_APART) *
    roomProximity(input.subjectBaths, input.saleBaths, BATH_ONE_APART) *
    ageProximity(input.subjectYearBuilt, input.saleYearBuilt) *
    lotProximity(input.subjectLotAcres, input.saleLotAcres) *
    recency
  // No location class: keep the similarity product, and do not invent a step.
  if (!locationFieldsPresent(input)) return +secondary.toFixed(4)
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
  baths?: number | null
  yearBuilt?: number | null
  lotAcres?: number | null
  subdivision?: string | null
  communitySlug?: string | null
  communityLocated?: boolean
  ownPlat?: boolean | null
  selectionTier?: string | null
  monthsSinceClose?: number | null
  marketPathSource?: 'index' | 'none' | null
  marketMonthlyRate?: number | null
  marketReversed?: boolean | null
  marketCapped?: boolean | null
  domTotal?: number | null
}>(
  subject: {
    sqft?: number | null
    beds?: number | null
    baths?: number | null
    yearBuilt?: number | null
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
      subjectBaths: subject.baths,
      saleBaths: comp.baths,
      subjectYearBuilt: subject.yearBuilt,
      saleYearBuilt: comp.yearBuilt,
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
      marketPathSource: comp.marketPathSource,
      marketMonthlyRate: comp.marketMonthlyRate,
      marketReversed: comp.marketReversed,
      marketCapped: comp.marketCapped,
      fillShortSet: true,
      saleDomTotal: comp.domTotal,
    })
    if (!(weight > 0)) return comp
    // The letter prints this same object. A copy would let the price count
    // the sale while the page still shows a weight of zero.
    comp.weight = weight
    return comp
  })
}

