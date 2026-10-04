/**
 * Community membership is where the address sits, for every community.
 *
 * It is not the MLS SubdivisionName, and it is not a mention of the community
 * in the remarks. A sale belongs when its lat/lng is inside the subject's
 * community boundary, or inside a plat that sits in that community, even if
 * the MLS plat name is different. One rule for every community. No named
 * exception.
 *
 * When the point has not been tested against a boundary, the recorded-plat
 * registry alias remains the fallback so a resort sale is not treated as
 * ordinary while geometry is missing. A tested point that sits in no
 * community does not fall back to the name, and remarks are never read.
 */
import { communitySlugForSubdivision, isResortCommunity, resortSlugForSubdivision } from '@/lib/cma/resort-guard'

export type CommunityAddress = {
  /** Community boundary that contains this lat/lng. */
  communitySlug?: string | null
  /**
   * True after lat/lng was tested against community boundaries.
   * A tested address with no communitySlug is outside every community.
   * The MLS name is not membership.
   */
  communityLocated?: boolean
  /** Recorded plat the lat/lng sits in. */
  platSlug?: string | null
  subdivisionSlug?: string | null
  subdivision?: string | null
}

function platOf(address: CommunityAddress): string | null {
  const plat = address.platSlug ?? address.subdivisionSlug ?? null
  const trimmed = plat?.trim()
  return trimmed ? trimmed : null
}

/**
 * The community whose boundary contains this address.
 * Remarks are not an input. The MLS subdivision string is used only when the
 * point was never tested.
 */
export function communityForAddress(
  address: CommunityAddress,
  memberPlatToCommunity?: ReadonlyMap<string, string> | null,
): string | null {
  const located = address.communitySlug?.trim()
  if (located) return located
  const plat = platOf(address)
  if (plat && memberPlatToCommunity?.has(plat)) return memberPlatToCommunity.get(plat) ?? null
  if (address.communityLocated) return null
  return communitySlugForSubdivision(address.subdivision)
}

export function memberPlatMap(
  communitySlug: string | null,
  memberPlats: readonly string[] | null | undefined,
): Map<string, string> | null {
  if (!communitySlug || !memberPlats?.length) return null
  const map = new Map<string, string>()
  for (const plat of memberPlats) {
    const key = plat.trim()
    if (key) map.set(key, communitySlug)
  }
  return map.size > 0 ? map : null
}

/**
 * True when the sale's address is inside the subject's community.
 * A different MLS subdivision name does not remove it. Remarks cannot add it.
 */
export function saleInsideSubjectCommunity(
  subject: CommunityAddress & { communityMemberPlats?: readonly string[] | null },
  sale: CommunityAddress,
): boolean {
  const subjectCommunity = communityForAddress(subject)
  if (!subjectCommunity) return false
  const map = memberPlatMap(subjectCommunity, subject.communityMemberPlats)
  return communityForAddress(sale, map) === subjectCommunity
}

/**
 * Resort pairs: same resort community, or neither in one.
 * A tested lat/lng replaces the MLS name. An untested name still uses the
 * registry alias so a missing geometry read does not let a resort sale through.
 */
export function resortMembershipCompatible(
  subject: CommunityAddress,
  sale: CommunityAddress,
): boolean {
  const subjectResort = subject.communityLocated
    ? (isResortCommunity(subject.communitySlug) ? subject.communitySlug ?? null : null)
    : resortSlugForSubdivision(subject.subdivision)
  const saleResort = sale.communityLocated
    ? (isResortCommunity(sale.communitySlug) ? sale.communitySlug ?? null : null)
    : resortSlugForSubdivision(sale.subdivision)
  return subjectResort === saleResort
}

/**
 * Recorded plats that are a community's outline when no neighborhood polygon
 * is stored. A point inside any plat in a group is inside that community.
 * The MLS subdivision string is not an input. Remarks are not an input.
 */
const OUTLINE_PLAT_GROUPS: ReadonlyArray<{ community: string; plats: readonly string[] }> = [
  {
    community: 'bend-golf-club',
    plats: ['bend-golf-club-addition', 'bend-golf-club-2nd-addition'],
  },
]

/**
 * The community whose recorded-plat outline contains this address.
 * Null when none of the plats the point sits in is an outline plat.
 */
export function communitySlugForOutlinePlats(platSlugs: readonly string[] | null | undefined): string | null {
  if (!platSlugs?.length) return null
  const have = new Set(platSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  if (have.size === 0) return null
  for (const group of OUTLINE_PLAT_GROUPS) {
    if (group.plats.some((plat) => have.has(plat))) return group.community
  }
  return null
}
