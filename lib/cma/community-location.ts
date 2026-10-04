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
  /**
   * Every recorded plat polygon that contains the point, smallest or not.
   * Membership is read from these slugs. The MLS subdivision string is not.
   */
  containingPlatSlugs?: readonly string[] | null
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
  const recorded = communitySlugForRecordedPlats([
    ...(address.containingPlatSlugs ?? []),
    ...(address.platSlug ? [address.platSlug] : []),
  ])
  if (recorded) return recorded
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

const ORDINAL_WORD = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth'
const ORDINAL_ADDITION_TAIL = new RegExp(`-(?:\\d+(?:st|nd|rd|th)|${ORDINAL_WORD})-addition$`)
const PHASE_TAIL = /-(?:phase|phases|unit|units|stage|stages)(?:-.+)?$/
const BARE_ADDITION_TAIL = /-addition$/

/**
 * Parent community of one recorded plat, from the plat slug the county filed.
 * A phase or an addition belongs to the name those words were added to.
 * A plat that is not a phase or an addition is a subdivision, not a parent
 * community. One token left after the strip ("park-addition") is the plat's
 * own name, not a parent. The MLS subdivision string is not an input.
 * Remarks are not an input. No community is named here.
 */
export function recordedPlatCommunityKey(slug: string | null | undefined): string | null {
  const raw = slug?.trim().toLowerCase() ?? ''
  if (!raw) return null
  let stem = raw
  if (PHASE_TAIL.test(stem)) stem = stem.replace(PHASE_TAIL, '')
  else if (ORDINAL_ADDITION_TAIL.test(stem)) stem = stem.replace(ORDINAL_ADDITION_TAIL, '')
  else if (BARE_ADDITION_TAIL.test(stem)) stem = stem.replace(BARE_ADDITION_TAIL, '')
  else return null
  if (!stem || stem === raw) return null
  const tokens = stem.split('-').filter(Boolean)
  if (tokens.length < 2) return null
  return stem
}

/**
 * The community whose recorded plats contain this point.
 * Every containing plat is read. The smallest plat does not hide a larger
 * one, and a different MLS name does not remove membership. Null when none
 * of the plats is a phase or an addition of a parent community.
 */
export function communitySlugForRecordedPlats(platSlugs: readonly string[] | null | undefined): string | null {
  if (!platSlugs?.length) return null
  const keys = new Set<string>()
  for (const slug of platSlugs) {
    const key = recordedPlatCommunityKey(slug)
    if (key) keys.add(key)
  }
  if (keys.size === 0) return null
  if (keys.size === 1) return [...keys][0]!
  return [...keys].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!
}

