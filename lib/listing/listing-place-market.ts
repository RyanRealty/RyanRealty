/**
 * Listing page place ladder + market geo wire labels.
 * Extracted so app/listing/[listingKey]/page.tsx stays under the file-size budget.
 */

import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'

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
      hubHref: listing.citySlug
        ? `/cities/${listing.citySlug}/${neighborhoodSlug}`
        : `/cities/${neighborhoodSlug}`,
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
      hubHref: `/cities/${listing.citySlug}`,
    })
  }

  return grains
}
