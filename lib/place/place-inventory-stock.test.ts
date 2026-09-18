import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import {
  PLACE_STOCK_HEADINGS,
  placeStockSectionKey,
  placeStockSectionsFromTiles,
  unionListingTiles,
} from './place-inventory-stock'

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 579_995,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Parkside',
    streetSuffix: 'Pl',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Parkside Place Phase 1',
    subdivisionSlug: 'parkside-place-phase-1',
    lat: 44.05,
    lng: -121.25,
    photoUrl: 'https://cdn.example/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 2026,
    garageSpaces: 2,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-parkside-pl',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Parkside Place Phase 1',
    ...over,
  }
}

describe('placeStockSectionKey', () => {
  it('maps Matt\'s four buyer buckets', () => {
    expect(placeStockSectionKey('A', 'Single Family Residence')).toBe('sfr')
    expect(placeStockSectionKey('A', 'Manufactured On Land')).toBe('sfr')
    expect(placeStockSectionKey('C', 'Duplex')).toBe('multifamily')
    expect(placeStockSectionKey('A', 'Townhouse')).toBe('attached')
    expect(placeStockSectionKey('A', 'Condominium')).toBe('attached')
    expect(placeStockSectionKey('D', 'Residential Lots')).toBe('land')
    expect(placeStockSectionKey('E', 'Farm')).toBe('land')
    expect(placeStockSectionKey('F', 'Office')).toBeNull()
  })
})

describe('placeStockSectionsFromTiles', () => {
  it('omits empty type sections and keeps every live listing', () => {
    const sections = placeStockSectionsFromTiles([
      tile({ listingKey: 'sfr-1' }),
      tile({
        listingKey: 'th-1',
        listNumber: '220000002',
        propertySubType: 'Townhouse',
        listPrice: 419_995,
      }),
      tile({
        listingKey: 'land-1',
        listNumber: '220000003',
        propertyType: 'D',
        propertySubType: 'Residential Lots',
        beds: null,
        baths: null,
        sqft: null,
        listPrice: 225_000,
      }),
    ])
    expect(sections.map((s) => s.key)).toEqual(['sfr', 'attached', 'land'])
    expect(sections.find((s) => s.key === 'multifamily')).toBeUndefined()
    expect(sections.find((s) => s.key === 'sfr')?.heading).toBe(PLACE_STOCK_HEADINGS.sfr)
    expect(sections.find((s) => s.key === 'attached')?.rows).toHaveLength(1)
    expect(sections.find((s) => s.key === 'land')?.countLabel).toBe('1 for sale')
  })

  it('dedupes unioned tiles by listing key', () => {
    const a = tile({ listingKey: 'one' })
    expect(unionListingTiles([a], [a, tile({ listingKey: 'two' })]).map((t) => t.listingKey)).toEqual([
      'one',
      'two',
    ])
  })
})
