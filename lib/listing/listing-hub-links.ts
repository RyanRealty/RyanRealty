/**
 * Listing page doors to the city inventory hub and the community hub.
 *
 * Breadcrumb already climbs city → community (listingPlaceTrail). These are
 * the exact-match text links under the price strip. Community resolution is
 * listingCommunityDoor (PR #513) so this file does not invent a second door.
 *
 * City hubs are the five /homes-for-sale/{city} pages. A listing in an
 * out-of-area city does not get a city inventory door. When city and community
 * would print the same exact-match phrase (Sunriver), the community hub wins.
 */
import { listingCommunityDoor, type ListingCommunityDoor } from './listing-community-door'
import { cityHubForLabel, cityHubForSlug } from '@/lib/site/homes-for-sale-by-area'

export type ListingHubDoor = ListingCommunityDoor

export type ListingHubLinks = {
  city: ListingHubDoor | null
  community: ListingHubDoor | null
}

export function listingHubLinks(input: {
  city?: { slug?: string | null; label?: string | null } | null
  community?: { slug?: string | null; label?: string | null; href?: string | null } | null
}): ListingHubLinks | null {
  const community = listingCommunityDoor(input.community)
  const cityHub =
    cityHubForSlug(input.city?.slug) ?? cityHubForLabel(input.city?.label) ?? null
  const city: ListingHubDoor | null = cityHub
    ? { href: cityHub.href, name: cityHub.label, anchor: cityHub.anchor }
    : null

  if (city && community && city.anchor === community.anchor) {
    return { city: null, community }
  }
  if (!city && !community) return null
  return { city, community }
}

export function listingHubLinkList(links: ListingHubLinks | null): ListingHubDoor[] {
  if (!links) return []
  return [links.city, links.community].filter((door): door is ListingHubDoor => door != null)
}
