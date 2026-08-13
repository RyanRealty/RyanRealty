import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import { homeFieldItems } from '@/app/_v3/home-field-items'

function tile(over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'K1',
    listNumber: '220111111',
    status: 'Active',
    listPrice: 625000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '123',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: 44.05,
    lng: -121.31,
    photoUrl: 'https://cdn.resize.sparkplatform.com/example.jpg',
    propertyType: 'A',
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
    ...over,
  }
}

describe('homeFieldItems', () => {
  it('keeps photographed priced homes and drops tiles with no photo', () => {
    const items = homeFieldItems(
      [
        tile(),
        tile({ listingKey: 'K2', listNumber: '220111112', photoUrl: null }),
        tile({ listingKey: 'K3', listNumber: '220111113', listPrice: null }),
      ],
      9,
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.photoSrc).toContain('sparkplatform.com')
    expect(items[0]?.href).toContain('220111111')
    expect(items[0]?.href).toMatch(/^\//)
  })
})
