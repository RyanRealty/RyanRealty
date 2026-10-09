/**
 * What may set a recommended price (SKILL.md rule 20).
 *
 * A sale sets the price when it is the subject's own plat, or when it sits in
 * the subject's community. Community membership is the location of the address
 * (lib/cma/community-location.ts), not the MLS subdivision string and not a
 * remark. A sale from another community never sets the price, however short
 * the set is (Matt 2026-10-07). Neither does a clearly different size (more
 * than PRICE_SET_SQFT_BAND, 25%, larger or smaller, wherever the search found
 * it: Matt 2026-10-08) or a clearly different product (a cottage versus
 * acreage). A different plat that is not the subject's community is that
 * different community, not a neighbor that still prices the home.
 *
 * Both walks (lib/pricing/match.ts, lib/cma/comps.ts) apply this test at
 * admission: a sale that fails it is not admitted, does not count toward the
 * five, and the search walks past it in the same order. Under five sales that
 * set the price the build is a comp shortage. There is no fill.
 *
 * An adjacent sale with no community on either side still sets the price.
 * The search order is unchanged. This only decides which sales may move the
 * number.
 *
 * A recommended price under every sale that set it, or above every one of
 * them, is not a price. The set is wrong, or the result is a hold.
 */
import { communityForAddress } from '@/lib/cma/community-location'
import { lotCompatible, normSubdivision } from '@/lib/pricing/classes'
import { PLAT_SQFT_BAND, PRICING_MIN_COMPS } from '@/lib/pricing/ladder'

export type PriceSetSale = {
  ownPlat?: boolean | null
  subjectSubdivision?: string | null
  saleSubdivision?: string | null
  subjectCommunity?: string | null
  saleCommunity?: string | null
  subjectCommunityLocated?: boolean
  saleCommunityLocated?: boolean
  subjectSqft?: number | null
  saleSqft?: number | null
  subjectLotAcres?: number | null
  saleLotAcres?: number | null
}

/**
 * THE ONE SIZE LIMIT FOR ANY SALE THAT SETS THE PRICE (Matt 2026-10-08, "25%
 * everywhere"): a sale more than 25% larger or smaller than the subject never
 * sets the price, wherever the search found it. 2382 Jackson (2,016 sqft) was
 * priced with 2225 Indigo (2 bed, 1,393 sqft, 30.9% smaller), admitted on a
 * wider rung at full weight because this test read the 35% search band; under
 * the ruling it never sets the price.
 *
 * The same number as the plat rungs' band (PLAT_SQFT_BAND), defined once. The
 * wider rungs (PLAT_WIDE_SQFT_BAND, the touching-plat, next-row and community
 * rungs, the listings ladder's LOCATION_SQFT_BAND) still SEARCH past it; a
 * sale they read between 25% and their band passes the rung's walls and is
 * refused here at the door, counted as not setting, never weighed.
 */
export const PRICE_SET_SQFT_BAND = PLAT_SQFT_BAND

/**
 * Living area more than PRICE_SET_SQFT_BAND off the subject's, measured on the
 * subject. Exactly 25% still sets the price; 25.1% does not. Unknown size is
 * not "clearly different".
 */
export function clearlyDifferentSize(
  subjectSqft: number | null | undefined,
  saleSqft: number | null | undefined,
): boolean {
  const subject = Number(subjectSqft)
  const sale = Number(saleSqft)
  if (!(subject > 0) || !(sale > 0)) return false
  return Math.abs(subject - sale) / subject > PRICE_SET_SQFT_BAND
}

/** Cottage versus acreage, when both lot sizes are known. Unknown fails open. */
export function clearlyDifferentProduct(
  subjectLotAcres: number | null | undefined,
  saleLotAcres: number | null | undefined,
): boolean {
  if (subjectLotAcres == null || saleLotAcres == null) return false
  return !lotCompatible(subjectLotAcres, saleLotAcres)
}

function communityOf(input: {
  community?: string | null
  communityLocated?: boolean
  subdivision?: string | null
}): string | null {
  return communityForAddress({
    communitySlug: input.community,
    communityLocated: input.communityLocated,
    subdivision: input.subdivision,
  })
}

export type PriceSetRefusalCode = 'size' | 'product' | 'community'

/**
 * The sentence the letter prints beside a sale that does not set the price.
 * The renderer prints `reason` and does not recompute it (SKILL §0.3 rule 29).
 */
export type PriceSetRefusal = {
  code: PriceSetRefusalCode
  reason: string
}

/** A sale rule 20 refused, named, so a later page can print the recorded reason. */
export type NotSettingSale = {
  listingKey: string
  listNumber: string | null
  address: string
  code: PriceSetRefusalCode
  reason: string
}

/**
 * A printed sale the price-set decision would still allow, that this letter
 * neither seated nor set aside. The letter says this once beside it.
 */
export const UNSEATED_PRINT_REASON = 'not one of the sales that set this price'

export function notSettingSaleFrom(
  sale: { listingKey: string; listNumber?: string | null; address: string },
  refusal: PriceSetRefusal,
): NotSettingSale {
  return {
    listingKey: sale.listingKey,
    listNumber: sale.listNumber ?? null,
    address: sale.address,
    code: refusal.code,
    reason: refusal.reason,
  }
}

/**
 * Whole percent, except just past the 25% line, where a rounded 25 would say
 * the sale is inside the band. 1,574 against 1,201 is 31%.
 */
function percentOffLabel(subjectSqft: number, saleSqft: number): string {
  const hundred = (Math.abs(saleSqft - subjectSqft) / subjectSqft) * 100
  const whole = Math.round(hundred)
  if (whole > 25) return String(whole)
  const tenths = Math.ceil(hundred * 10 - 1e-9) / 10
  const text = tenths.toFixed(1)
  return text.endsWith('.0') ? text.slice(0, -2) : text
}

function sqftLabel(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** "1,574 sq ft, 31% larger than this home; sales more than 25% larger or smaller do not set the price" */
export function sizeRefusalReason(subjectSqft: number, saleSqft: number): string {
  const direction = saleSqft > subjectSqft ? 'larger' : 'smaller'
  return `${sqftLabel(saleSqft)} sq ft, ${percentOffLabel(subjectSqft, saleSqft)}% ${direction} than this home; sales more than 25% larger or smaller do not set the price`
}

function acreText(n: number): string {
  const rounded = Math.round(n * 100) / 100
  const body = Number.isInteger(rounded) ? String(rounded) : String(rounded)
  return `${body} ${rounded === 1 ? 'acre' : 'acres'}`
}

export function productRefusalReason(subjectLotAcres: number, saleLotAcres: number): string {
  return `${acreText(saleLotAcres)} against this home's ${acreText(subjectLotAcres)}; a cottage and an acreage property do not set each other's price`
}

export function communityRefusalReason(): string {
  return 'a different community than this home; a sale in another community does not set the price'
}

/**
 * Why this sale does not move the recommended price, or null when it may.
 * The same branches as the admission test, in the same order. Remarks are
 * not an input. The letter prints `reason` and does not recompute the gap.
 */
export function priceSetRefusal(input: PriceSetSale): PriceSetRefusal | null {
  const subjectSqft = Number(input.subjectSqft)
  const saleSqft = Number(input.saleSqft)
  if (clearlyDifferentSize(input.subjectSqft, input.saleSqft)) {
    return { code: 'size', reason: sizeRefusalReason(subjectSqft, saleSqft) }
  }
  if (clearlyDifferentProduct(input.subjectLotAcres, input.saleLotAcres)) {
    return {
      code: 'product',
      reason: productRefusalReason(Number(input.subjectLotAcres), Number(input.saleLotAcres)),
    }
  }

  // The selector's own-plat decision (the recorded polygon first) wins.
  if (input.ownPlat === true) return null

  const subjectCommunity = communityOf({
    community: input.subjectCommunity,
    communityLocated: input.subjectCommunityLocated,
    subdivision: input.subjectSubdivision,
  })
  const saleCommunity = communityOf({
    community: input.saleCommunity,
    communityLocated: input.saleCommunityLocated,
    subdivision: input.saleSubdivision,
  })
  const subjectKnown = input.subjectCommunityLocated === true || subjectCommunity != null
  const saleKnown = input.saleCommunityLocated === true || saleCommunity != null
  // Both outside every community, or inside the same one.
  const communityAgrees = subjectCommunity === saleCommunity

  // A SHARED MLS NAME IS THE SAME PLAT ONLY WHEN IT IS A REAL NAME AND THE
  // COMMUNITY LINE AGREES (review, 2026-10-07). 'N/A', 'None', 'Not In
  // Subdivision' and '-' name no plat (realSubdivisionName, the one sentinel
  // list), so two of them are not a match. And a raw name match never carries
  // a sale across the community line: 'N/A' against 'N/A' once let a sale
  // inside Tetherow set the price for a home outside it, on the widened rungs
  // of both ladders. With the line agreeing, the test below returns the same
  // answer; the branch is kept so the same-plat reading stays explicit, and a
  // wall added to this function goes above it, never below.
  const subjectName = normSubdivision(input.subjectSubdivision)
  const saleName = normSubdivision(input.saleSubdivision)
  if (subjectName != null && subjectName === saleName && communityAgrees) return null

  // One side is in a community the other is not, or they are different
  // communities. A short set does not change this: the sale never sets the
  // price, the walk goes past it, and under five setters the build is a comp
  // shortage. Size and product were refused above.
  if ((subjectKnown || saleKnown) && !communityAgrees) {
    return { code: 'community', reason: communityRefusalReason() }
  }
  return null
}

/**
 * True when this sale may move the recommended price.
 * Remarks are not an input. One decision with priceSetRefusal.
 */
export function saleSetsThePrice(input: PriceSetSale): boolean {
  return priceSetRefusal(input) == null
}

/**
 * 'under' or 'over' when the recommended price sits outside every sale that
 * set it. Null when it sits with those sales, or when there is nothing to compare.
 */

/**
 * Why pricing returned nothing. Missing living area and a set with fewer than
 * five sales that set the price (PRICING_MIN_COMPS) are different failures.
 * The second one used to be reported as the first.
 */
export function pricingFailureMessage(
  subject: { sqft?: number | null },
  adjusted: readonly { weight?: number | null }[],
  opts: { afterAudit?: boolean } = {},
): string {
  const where = opts.afterAudit ? ' after audit' : ''
  const sqft = subject.sqft ?? 0
  if (!(sqft > 0)) return `Pricing could not be computed${where} (subject sqft missing).`
  const weighted = adjusted.filter((c) => (c.weight ?? 0) > 0).length
  if (weighted < PRICING_MIN_COMPS) {
    return `Pricing could not be computed${where} (${weighted} of ${adjusted.length} comps set the price, and this home needs ${PRICING_MIN_COMPS}).`
  }
  return `Pricing could not be computed${where} (the recommended price sits outside the sales that set it).`
}

/** Same grid as priceRoundingStep in lib/pricing/estimate.ts. Kept here so this file does not import the pricer. */
function pricingUnit(n: number): number {
  return Math.abs(n) >= 1_000_000 ? 5_000 : 1_000
}

/**
 * THE BAND AS THE READER SEES IT: the low rounded down and the high rounded up
 * onto the pricing unit, the way the pricer prints the range
 * (lib/pricing/estimate.ts roundPriceDown / roundPriceUp). The pin puts the
 * exact sale back on the band ($893,412), and the reader still sees $893,000.
 *
 * One boundary for every test of an ask against the band: the failed-ask cap
 * (an ask below the band, lib/cma/expired-audit.ts) and the ask-in-band hold
 * (rule 22, lib/cma/gap-hold.ts) read this, so an ask on the printed low is
 * inside, inclusive, and never falls between the two (review, 2026-10-07).
 */
export function printedBandBounds(low: number, high: number): { low: number; high: number } {
  const lo = Math.min(low, high)
  const hi = Math.max(low, high)
  return {
    low: Math.floor(lo / pricingUnit(lo)) * pricingUnit(lo),
    high: Math.ceil(hi / pricingUnit(hi)) * pricingUnit(hi),
  }
}

export function recommendationOutsideSaleSet(
  recommended: number | null | undefined,
  salePrices: readonly number[],
): 'under' | 'over' | null {
  if (recommended == null || !Number.isFinite(recommended) || !(recommended > 0)) return null
  const prices = salePrices.filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length === 0) return null
  // The cover rounds a sale outward onto the pricing unit. A recommendation
  // on that same step is that sale. It is not a price outside the set.
  const bounds = printedBandBounds(Math.min(...prices), Math.max(...prices))
  if (recommended < bounds.low) return 'under'
  if (recommended > bounds.high) return 'over'
  return null
}
