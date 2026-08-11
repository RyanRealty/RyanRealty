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
