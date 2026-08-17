import { describe, expect, it } from 'vitest'
import { blogRelatedHomeRows } from './blog-related-homes'
import type { ListingTile } from '@/lib/data/types/listing'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 1_199_500,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Sage',
    streetSuffix: 'Ln',
    city: 'Powell Butte',
    citySlug: 'powell-butte',
    postalCode: '97753',
    subdivisionName: 'Brasada Ranch',
    subdivisionSlug: 'brasada-ranch',
    lat: null,
    lng: null,
    photoUrl: null,
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
    boundaryCity: 'Powell Butte',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Brasada Ranch',
    ...partial,
  }
}

describe('blogRelatedHomeRows', () => {
  it('prints the exact ask and drops rows without a street or price', () => {
    const rows = blogRelatedHomeRows([
      tile({ listingKey: 'keep' }),
      tile({ listingKey: 'no-street', streetNumber: null, streetName: null, streetSuffix: null }),
      tile({ listingKey: 'no-price', listPrice: null }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe('$1,199,500')
    expect(rows[0]?.what).toBe('12 Sage Ln')
    expect(rows[0]?.href).toContain('220000001')
  })
})
