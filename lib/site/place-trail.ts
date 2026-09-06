/**
 * Place-page trails. City is the parent. Never Home, never Homes for sale,
 * never a Cities or Communities index crumb. Doors come from place-href so
 * they land on /cities, /communities, /subdivisions — not /homes-for-sale.
 */
import { getPlaceLinks } from '@/lib/place-links'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { cityHref, cityNeighborhoodHref, subdivisionHref } from '@/lib/site/place-href'

export type PlaceCrumb = {
  label: string
  href?: string
}

export type PlaceTrailNode = {
  label: string
  slug: string
}

function samePlace(a: PlaceTrailNode, b: PlaceTrailNode): boolean {
  return (
    a.slug === b.slug || a.label.trim().toLowerCase() === b.label.trim().toLowerCase()
  )
}

export function communityHref(slug: string | null | undefined): string | null {
  const s = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
  if (!s) return null
  return getPlaceLinks({ type: 'community', slug: s }).placeUrl
}

function pushUnique(trail: PlaceCrumb[], label: string, href?: string | null): void {
  const name = label.trim()
  if (!name) return
  const door = href?.trim() || undefined
  const last = trail[trail.length - 1]
  if (last && last.label.trim().toLowerCase() === name.toLowerCase() && last.href === door) {
    return
  }
  if (door && trail.some((c) => c.href === door)) return
  trail.push(door ? { label: name, href: door } : { label: name })
}

/** City page: the city is the parent. No Home, no Cities index. */
export function cityPageTrail(cityName: string): PlaceCrumb[] {
  const label = cityName.trim()
  return label ? [{ label }] : []
}

/** Neighborhood page: city landing → neighborhood name. */
export function neighborhoodPageTrail(
  city: PlaceTrailNode | null | undefined,
  neighborhoodName: string,
): PlaceCrumb[] {
  const trail: PlaceCrumb[] = []
  if (city) {
    const href = cityHref(city.slug)
    if (href) pushUnique(trail, city.label, href)
  }
  const name = neighborhoodName.trim()
  if (name) trail.push({ label: name })
  return trail
}

/** Community page: city landing → community name. No Home, no Communities index. */
export function communityPageTrail(
  city: PlaceTrailNode | null | undefined,
  communityName: string,
): PlaceCrumb[] {
  const trail: PlaceCrumb[] = []
  if (city) {
    const href = cityHref(city.slug)
    if (href) pushUnique(trail, city.label, href)
  }
  const name = communityName.trim()
  if (name) trail.push({ label: name })
  return trail
}

/** Subdivision page: city landing → community if it has one → subdivision name. */
export function subdivisionPageTrail(
  city: PlaceTrailNode | null | undefined,
  community: PlaceTrailNode | null | undefined,
  subdivisionName: string,
): PlaceCrumb[] {
  const trail: PlaceCrumb[] = []
  if (city) {
    const href = cityHref(city.slug)
    if (href) pushUnique(trail, city.label, href)
  }
  if (community && !(city && samePlace(city, community))) {
    const href = communityHref(community.slug)
    if (href) pushUnique(trail, community.label, href)
  }
  const name = subdivisionName.trim()
  if (name) trail.push({ label: name })
  return trail
}

/**
 * Listing: city landing → neighborhood if any → planned community if any →
 * subdivision if any → address (no href).
 */
export function listingPlaceTrail(input: {
  city?: PlaceTrailNode | null
  neighborhood?: PlaceTrailNode | null
  community?: PlaceTrailNode | null
  subdivision?: PlaceTrailNode | null
  address: string
}): PlaceCrumb[] {
  const trail: PlaceCrumb[] = []
  const city = input.city
  const cityUrl = city ? cityHref(city.slug) : null
  if (city && cityUrl) pushUnique(trail, city.label, cityUrl)

  const community = input.community
  const neighborhood =
    input.neighborhood && community && samePlace(input.neighborhood, community)
      ? null
      : input.neighborhood
  if (neighborhood && !(city && samePlace(city, neighborhood))) {
    const href = city
      ? cityNeighborhoodHref(city.slug, neighborhood.slug)
      : communityHref(neighborhood.slug)
    if (href) pushUnique(trail, neighborhood.label, href)
  }

  if (community && !(city && samePlace(city, community))) {
    // Resort registry → /communities. Alias-only parents (Stevens Ranch) have
    // no community page; use the subdivision door so the crumb does not 404.
    const href = getResortCommunityBySlug(community.slug)
      ? communityHref(community.slug)
      : subdivisionHref(community.slug)
    if (href) pushUnique(trail, community.label, href)
  }

  const subdivision =
    input.subdivision && community && samePlace(input.subdivision, community)
      ? null
      : input.subdivision
  if (subdivision && !(city && samePlace(city, subdivision))) {
    const href = subdivisionHref(subdivision.slug)
    if (href) pushUnique(trail, subdivision.label, href)
  }

  const address = input.address.trim()
  if (address) trail.push({ label: address })
  return trail
}
