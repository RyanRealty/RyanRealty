import { describe, expect, it } from 'vitest'
import { dedupeListingTilesByStreet } from './dedupeListingTilesByStreet'
import type { ListingTile } from '@/lib/data/types/listing'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listingKey: partial.listingKey,
    listNumber: partial.listNumber ?? null,
    status: 'Active',
    listPrice: null,
    closePrice: null,
    closeDate: null,
    beds: null,
    baths: null,
    sqft: null,
    streetNumber: partial.streetNumber ?? '114',
    streetName: partial.streetName ?? 'Delaware',
    streetSuffix: partial.streetSuffix ?? 'Avenue',
    city: partial.city ?? 'Bend',
    citySlug: 'bend',
    postalCode: partial.postalCode ?? '97703',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: null,
    propertyType: null,
    propertySubType: null,
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: null,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  }
}

describe('dedupeListingTilesByStreet', () => {
  it('keeps one card when two ListingKeys share a street line', () => {
    const rows = dedupeListingTilesByStreet([
      tile({ listingKey: 'A', listNumber: '220212067' }),
      tile({ listingKey: 'B', listNumber: '220299999' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.listingKey).toBe('A')
  })

  it('keeps both when street lines differ', () => {
    const rows = dedupeListingTilesByStreet([
      tile({ listingKey: 'A', streetNumber: '114' }),
      tile({ listingKey: 'B', streetNumber: '225' }),
    ])
    expect(rows).toHaveLength(2)
  })
})
