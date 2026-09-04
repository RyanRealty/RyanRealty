/**
 * Listing page place ladder + market geo wire labels.
 * Extracted so app/listing/[listingKey]/page.tsx stays under the file-size budget.
 */

import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import type { BoundaryGeoJSONInput } from '@/lib/data/geo/getBoundaryGeoJSON'
import { cityHref, cityNeighborhoodHref } from '@/lib/site/place-href'

const NOISE_SLUGS = new Set(['na', 'none', 'unknown', 'outside-city-limits'])

export type ListingPlaceFields = {
  city: string | null
  citySlug: string | null
  subdivisionName: string | null
  subdivisionSlug: string | null
  neighborhoodName: string | null
  neighborhoodSlug: string | null
  boundaryNeighborhood?: string | null
}

/** Pulse/stats lookup labels still use geoType 'community' for MLS plats on the wire. */
export type ListingMarketGeo = {
  geoType: 'community' | 'neighborhood' | 'city'
  geoSlug: string
  name: string
}

export function resolveListingPlaceAndMarket(listing: ListingPlaceFields): {
  placeContext: PlaceContext
  marketGeo: ListingMarketGeo | null
} {
  const placeContext = resolvePlaceContextFromListing({
    city: listing.city,
    citySlug: listing.citySlug,
    subdivisionName: listing.subdivisionName,
    subdivisionSlug: listing.subdivisionSlug,
    neighborhoodName: listing.neighborhoodName ?? listing.boundaryNeighborhood ?? null,
    neighborhoodSlug: listing.neighborhoodSlug,
  })

  const validSubdivisionSlug =
    listing.subdivisionSlug && !NOISE_SLUGS.has(listing.subdivisionSlug)
      ? listing.subdivisionSlug
      : null
  const validNeighborhoodSlug =
    listing.neighborhoodSlug && !NOISE_SLUGS.has(listing.neighborhoodSlug)
      ? listing.neighborhoodSlug
      : null

  const marketGeo: ListingMarketGeo | null = placeContext.curatedCommunity
    ? {
        geoType: 'community',
        geoSlug: placeContext.curatedCommunity.slug,
        name: placeContext.curatedCommunity.label,
      }
    : validSubdivisionSlug
      ? {
          geoType: 'community',
          geoSlug: validSubdivisionSlug,
          name: listing.subdivisionName ?? validSubdivisionSlug,
        }
      : validNeighborhoodSlug
        ? {
            geoType: 'neighborhood',
            geoSlug: validNeighborhoodSlug,
            name: listing.neighborhoodName ?? validNeighborhoodSlug,
          }
        : listing.citySlug
          ? {
              geoType: 'city',
              geoSlug: listing.citySlug,
              name: listing.city ?? listing.citySlug,
            }
          : null

  return { placeContext, marketGeo }
}

export type LeftoverListingGrain = {
  geoType: 'city' | 'neighborhood'
  geoSlug: string
  name: string
  hubHref: string
}

/**
 * Leftover-eligible listing grains, finest first.
 * A plat / subdivision slug is not leftover neighborhood. Neighborhood leftover
 * uses the listing neighborhood slug, or a curated community slug when that
 * community is itself leftover neighborhood (Tetherow). City leftover is last.
 */
export function leftoverListingGrains(
  listing: ListingPlaceFields,
  marketGeo: ListingMarketGeo | null,
): LeftoverListingGrain[] {
  const grains: LeftoverListingGrain[] = []
  const seen = new Set<string>()
  const push = (grain: LeftoverListingGrain) => {
    const key = `${grain.geoType}:${grain.geoSlug}`
    if (seen.has(key) || !grain.geoSlug || NOISE_SLUGS.has(grain.geoSlug)) return
    seen.add(key)
    grains.push(grain)
  }

  const neighborhoodSlug =
    listing.neighborhoodSlug && !NOISE_SLUGS.has(listing.neighborhoodSlug)
      ? listing.neighborhoodSlug
      : null
  if (neighborhoodSlug) {
    push({
      geoType: 'neighborhood',
      geoSlug: neighborhoodSlug,
      name: listing.neighborhoodName ?? listing.boundaryNeighborhood ?? neighborhoodSlug,
      // One hop (lib/site/place-href): the two-segment path 308s for a registry
      // community, and a bare city slug 308s when it is out of area.
      hubHref:
        (listing.citySlug
          ? cityNeighborhoodHref(listing.citySlug, neighborhoodSlug)
          : cityHref(neighborhoodSlug)) ?? `/cities/${neighborhoodSlug}`,
    })
  } else if (
    marketGeo?.geoType === 'community' &&
    marketGeo.geoSlug &&
    !NOISE_SLUGS.has(marketGeo.geoSlug)
  ) {
    push({
      geoType: 'neighborhood',
      geoSlug: marketGeo.geoSlug,
      name: marketGeo.name,
      hubHref: `/communities/${marketGeo.geoSlug}`,
    })
  }

  if (listing.citySlug) {
    push({
      geoType: 'city',
      geoSlug: listing.citySlug,
      name: listing.city ?? listing.citySlug,
      hubHref: cityHref(listing.citySlug) ?? `/cities/${listing.citySlug}`,
    })
  }

  return grains
}

/** Finest leftover place door for inventory in this listing's boundary. */
export function listingInventoryDoor(placeContext: PlaceContext): { href: string; name: string } | null {
  const node =
    placeContext.neighborhood ??
    placeContext.curatedCommunity ??
    placeContext.subdivision ??
    placeContext.city
  if (!node?.href || !node.label) return null
  return { href: `${node.href}#homes`, name: node.label }
}

/** GIS polygon lookups, finest first. Never invent a hull. */
export function listingBoundaryAttempts(
  listing: ListingPlaceFields,
  placeContext: PlaceContext,
): BoundaryGeoJSONInput[] {
  const seen = new Set<string>()
  const out: BoundaryGeoJSONInput[] = []
  const push = (geoType: BoundaryGeoJSONInput['geoType'], geoSlug: string | null | undefined) => {
    const slug = geoSlug?.trim()
    if (!slug || NOISE_SLUGS.has(slug)) return
    const key = `${geoType}:${slug}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ geoType, geoSlug: slug })
  }
  push('neighborhood', placeContext.neighborhood?.slug ?? listing.neighborhoodSlug)
  push('neighborhood', placeContext.curatedCommunity?.slug)
  push('subdivision', placeContext.curatedCommunity?.slug)
  push('subdivision', placeContext.subdivision?.slug ?? listing.subdivisionSlug)
  push('city', placeContext.city?.slug ?? listing.citySlug)
  return out
}

export type ListingAtlasFrameIntent =
  | { grain: 'neighborhood'; slug: string; name: string }
  | { grain: 'community'; slug: string; name: string }
  | { grain: 'city'; slug: string | null; name: string }

/**
 * Finest place the listing atlas should frame. A city-neighborhood (Awbrey
 * Butte) outranks a curated community (NorthWest Crossing) outranks the city.
 * A raw MLS plat is not a frame: the map would be one lot-line, not the
 * place the buyer is shopping.
 */
export function listingAtlasFrameIntent(input: {
  city: string
  citySlug: string | null
  cityName: string | null
  neighborhoodSlug: string | null
  neighborhoodName: string | null
  communitySlug: string | null
  communityName: string | null
}): ListingAtlasFrameIntent {
  const neighborhoodSlug =
    input.neighborhoodSlug && !NOISE_SLUGS.has(input.neighborhoodSlug)
      ? input.neighborhoodSlug
      : null
  if (
    input.citySlug &&
    neighborhoodSlug &&
    input.neighborhoodName &&
    hasCityNeighborhoodPages(input.citySlug)
  ) {
    return {
      grain: 'neighborhood',
      slug: neighborhoodSlug,
      name: input.neighborhoodName,
    }
  }
  const communitySlug =
    input.communitySlug && !NOISE_SLUGS.has(input.communitySlug) ? input.communitySlug : null
  if (communitySlug && input.communityName) {
    return { grain: 'community', slug: communitySlug, name: input.communityName }
  }
  return {
    grain: 'city',
    slug: input.citySlug,
    name: input.cityName ?? input.city,
  }
}

export function listingAtlasHeadline(frameName: string): string {
  const name = frameName.trim()
  return name ? `Here's what else is selling in ${name}` : "Here's what else is selling nearby"
}
