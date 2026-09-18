/**
 * Place-page trails. City is the parent. Never Home, never Homes for sale,
 * never a Cities or Communities index crumb. Doors come from place-href so
 * they land on /cities, /communities, /subdivisions — not /homes-for-sale.
 */
import { getPlaceLinks } from '@/lib/place-links'
import {
  getResortCommunityBySlug,
  getResortCommunityBySubdivisionName,
  isVerifiedRegistryChild,
} from '@/lib/data/communities/registry'
import { cityHref, cityNeighborhoodHref, subdivisionHref } from '@/lib/site/place-href'
import {
  isPermitGluedPlatSlug,
  isVisitorPlaceNoiseLabel,
  isVisitorPlaceNoiseSlug,
} from '@/lib/site/visitor-place-noise'

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

function visitorPlaceNode(node: PlaceTrailNode | null | undefined): PlaceTrailNode | null {
  if (!node) return null
  if (isVisitorPlaceNoiseLabel(node.label) || isVisitorPlaceNoiseSlug(node.slug)) return null
  return node
}

function pushUnique(trail: PlaceCrumb[], label: string, href?: string | null): void {
  const name = label.trim()
  if (!name || isVisitorPlaceNoiseLabel(name)) return
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

/**
 * Community page: city landing → community name. No Home, no Communities index.
 *
 * A community that IS its own town gets ONE crumb. Sunriver's city is Sunriver,
 * so the trail rendered "Sunriver / Sunriver" — a parent link and a current page
 * with the same name, which tells a visitor nothing and reads as a rendering
 * fault (seen on /communities/sunriver, 2026-09-08). `subdivisionPageTrail`
 * already drops a repeated middle crumb through `samePlace`; this is the same
 * rule one level up, and the crumb that survives is the CURRENT page rather than
 * a link away from it.
 */
export function communityPageTrail(
  city: PlaceTrailNode | null | undefined,
  communityName: string,
): PlaceCrumb[] {
  const trail: PlaceCrumb[] = []
  const name = communityName.trim()
  if (city && !(name && samePlace(city, { label: name, slug: '' }))) {
    const href = cityHref(city.slug)
    if (href) pushUnique(trail, city.label, href)
  }
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
 * Listing: city landing → neighborhood only when it is a proven ancestor
 * of the community (or when there is no community) → planned community if
 * any → subdivision if any → address (no href).
 *
 * Neighborhood and community are peers unless the resort registry lists
 * the community as a child of the neighborhood. MLS / GIS coincidence
 * (Vandevert Ranch next to Caldera Springs) is not a parent.
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

  const communityFromPlat = (() => {
    const plat = visitorPlaceNode(input.subdivision)
    if (!plat) return null
    const parent =
      getResortCommunityBySlug(plat.slug) ??
      getResortCommunityBySubdivisionName(plat.label) ??
      getResortCommunityBySubdivisionName(plat.slug)
    if (!parent) return null
    if (samePlace(plat, { label: parent.label, slug: parent.slug })) return null
    return { label: parent.label, slug: parent.slug }
  })()
  const community = visitorPlaceNode(input.community) ?? communityFromPlat
  const neighborhoodRaw = visitorPlaceNode(input.neighborhood)
  const neighborhood =
    !neighborhoodRaw
      ? null
      : community && samePlace(neighborhoodRaw, community)
        ? null
        : community && !isVerifiedRegistryChild(neighborhoodRaw, community)
          ? null
          : neighborhoodRaw
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

  const subdivisionRaw = visitorPlaceNode(input.subdivision)
  const subdivision =
    subdivisionRaw &&
    !isPermitGluedPlatSlug(subdivisionRaw.slug) &&
    !(community && samePlace(subdivisionRaw, community))
      ? subdivisionRaw
      : null
  if (subdivision && !(city && samePlace(city, subdivision))) {
    const href = subdivisionHref(subdivision.slug)
    if (href) pushUnique(trail, subdivision.label, href)
  }

  const address = input.address.trim()
  if (address) trail.push({ label: address })
  return trail
}
