/**
 * The one community / resort door a listing page may print.
 *
 * Registry communities only (Brasada Ranch, Tetherow, Broken Top, Sunriver,
 * Eagle Crest, and the rest of data/resort-communities.json). Ordinary plats
 * stay on their subdivision door. The live /communities/<public-slug> href
 * comes from communityPublicPairForPlace so a rebrand (pronghorn →
 * juniper-preserve) never ships the 308 hop as the link.
 *
 * Anchor text is the site's place heading: "{Name} homes for sale".
 */

import { communityPublicPairForPlace } from '@/lib/communities/community-public-pair'
import { placeHomesForSaleHeading } from '@/lib/site/place-homes-heading'
import {
  isPermitGluedPlatSlug,
  isVisitorPlaceNoiseLabel,
  isVisitorPlaceNoiseSlug,
} from '@/lib/site/visitor-place-noise'

export type ListingCommunityDoorInput = {
  slug?: string | null
  label?: string | null
  href?: string | null
}

export type ListingCommunityDoor = {
  href: string
  name: string
  anchor: string
}

export function listingCommunityDoor(
  input: ListingCommunityDoorInput | null | undefined,
): ListingCommunityDoor | null {
  if (!input) return null
  const pair = communityPublicPairForPlace({ slug: input.slug, name: input.label })
  const href = (pair?.href ?? input.href ?? '').trim()
  const name = (pair?.displayName ?? input.label ?? '').trim()
  if (!href.startsWith('/communities/') || !name) return null
  if (isVisitorPlaceNoiseLabel(name)) return null
  if (isVisitorPlaceNoiseSlug(input.slug) || isPermitGluedPlatSlug(input.slug ?? '')) return null
  return { href, name, anchor: placeHomesForSaleHeading(name) }
}
