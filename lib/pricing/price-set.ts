/**
 * What may set a recommended price.
 *
 * A sale sets the price when it is the subject's own plat, or when it sits in
 * the subject's community. Community membership is the location of the address
 * (lib/cma/community-location.ts), not the MLS subdivision string and not a
 * remark. A different community does not set the price while the plat already has
 * three sales that do. Neither does a clearly different size (past the one
 * living-area cutoff) or a clearly different product (a cottage versus
 * acreage). A different plat that is not the subject's community is that
 * different community, not a neighbor that still prices the home.
 *
 * When the plat and its community supplied fewer than three sales, the next
 * rung was already admitted. Those admitted sales set the price too. The
 * tighter sale stays. Size and product still refuse. The caller passes
 * fillShortSet for that case only (lib/pricing/closed-comp-weight.ts).
 *
 * An adjacent sale with no community on either side still sets the price.
 * The search order is unchanged. This only decides which kept sales move the
 * number.
 *
 * A recommended price under every sale that set it, or above every one of
 * them, is not a price. The set is wrong, or the result is a hold.
 */
import { communityForAddress } from '@/lib/cma/community-location'
import { lotCompatible } from '@/lib/pricing/classes'
import { PLAT_WIDE_SQFT_BAND, PRICING_MIN_COMPS } from '@/lib/pricing/ladder'

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
  /**
   * The kept set is already short of three sales that set the price, and this
   * sale was admitted on a later rung. Skip the community wall. Size and
   * product still refuse.
   */
  fillShortSet?: boolean
}

/** Living area past the picker's wide cutoff. Unknown size is not "clearly different". */
export function clearlyDifferentSize(
  subjectSqft: number | null | undefined,
  saleSqft: number | null | undefined,
): boolean {
  const subject = Number(subjectSqft)
  const sale = Number(saleSqft)
  if (!(subject > 0) || !(sale > 0)) return false
  return Math.abs(subject - sale) / subject > PLAT_WIDE_SQFT_BAND
}

/** Cottage versus acreage, when both lot sizes are known. Unknown fails open. */
export function clearlyDifferentProduct(
  subjectLotAcres: number | null | undefined,
  saleLotAcres: number | null | undefined,
): boolean {
  if (subjectLotAcres == null || saleLotAcres == null) return false
  return !lotCompatible(subjectLotAcres, saleLotAcres)
}

function normName(value: string | null | undefined): string | null {
  const s = value?.trim().toLowerCase()
  return s ? s : null
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

/**
 * True when this sale may move the recommended price.
 * Remarks are not an input.
 */
export function saleSetsThePrice(input: PriceSetSale): boolean {
  if (clearlyDifferentSize(input.subjectSqft, input.saleSqft)) return false
  if (clearlyDifferentProduct(input.subjectLotAcres, input.saleLotAcres)) return false

  const subjectName = normName(input.subjectSubdivision)
  const saleName = normName(input.saleSubdivision)
  const samePlat = input.ownPlat === true || (subjectName != null && subjectName === saleName)
  if (samePlat) return true

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
  // One side is in a community the other is not, or they are different communities.
  // A short set does not make the plat stand alone: a sale the next rung
  // already admitted still sets the price. Size and product were refused above.
  if ((subjectKnown || saleKnown) && subjectCommunity !== saleCommunity && !input.fillShortSet) return false
  return true
}

/**
 * 'under' or 'over' when the recommended price sits outside every sale that
 * set it. Null when it sits with those sales, or when there is nothing to compare.
 */

/**
 * Why pricing returned nothing. Missing living area and a set with fewer than
 * three sales that set the price are different failures. The second one used
 * to be reported as the first.
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

/**
 * The rows the letter prints. Once three sales set the price, a sale that
 * does not is not in the table. A shorter set is returned whole so the
 * minimum can still fail the build instead of padding the page.
 */
export function compsTheLetterPrints<T extends { weight?: number | null }>(comps: readonly T[]): T[] {
  const setters = comps.filter((c) => (c.weight ?? 0) > 0)
  if (setters.length >= PRICING_MIN_COMPS) return setters
  return [...comps]
}

/**
 * The source rows for the next price. A repair that starts over from the
 * wider set puts a sale the price did not use back in the table at weight zero.
 */
export function sourceSalesTheLetterKeeps<T extends { listingKey: string }>(
  source: readonly T[],
  priced: readonly { listingKey: string; weight?: number | null }[],
): T[] {
  const keep = new Set(compsTheLetterPrints(priced).map((c) => c.listingKey))
  return source.filter((c) => keep.has(c.listingKey))
}

export function recommendationOutsideSaleSet(
  recommended: number | null | undefined,
  salePrices: readonly number[],
): 'under' | 'over' | null {
  if (recommended == null || !Number.isFinite(recommended) || !(recommended > 0)) return null
  const prices = salePrices.filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length === 0) return null
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  if (recommended < low) return 'under'
  if (recommended > high) return 'over'
  return null
}
