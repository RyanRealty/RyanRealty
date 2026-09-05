import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import {
  listingSimilarDedupe,
  listingSimilarInPlace,
  listingSimilarRail,
  listingTileToRow,
  SIMILAR_RAIL_CAP,
} from './listing-similar'

function tile(over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: '220221963',
    listNumber: '220221963',
    status: 'Active',
    listPrice: 749_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '60320',
    streetName: 'Sage Stone',
    streetSuffix: 'Loop',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97702',
    subdivisionName: 'Stonegate',
    subdivisionSlug: 'stonegate',
    lat: 44.0,
    lng: -121.2,
    photoUrl: '/photo.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 416,
    lotSizeAcres: 0.2,
    yearBuilt: 2018,
    garageSpaces: 2,
    poolYn: false,
    hasVirtualTour: false,
    tourUrl: null,
    dom: 12,
    priceDropCount: 0,
    addressSlug: null,
    boundaryCity: 'Bend',
    boundaryNeighborhood: 'Southeast Bend',
    boundarySubdivision: 'Stonegate',
    ...over,
  }
}

describe('listingTileToRow', () => {
  it('keeps the published street and the ranking tile href fields', () => {
    const row = listingTileToRow(tile())
    expect(row.addressLine).toMatch(/60320/)
    expect(row.addressLine).toMatch(/Sage Stone/)
    expect(row.cityLine).toBe('Bend · Stonegate')
    expect(row.propertySubType).toBe('Single Family Residence')
    expect(row.href).toMatch(/220221963/)
  })
})

describe('listingSimilarRail', () => {
  it('caps the rail', () => {
    const tiles = Array.from({ length: 14 }, (_, i) =>
      tile({ listingKey: `k${i}`, listNumber: `n${i}` }),
    )
    expect(listingSimilarRail(tiles)).toHaveLength(SIMILAR_RAIL_CAP)
  })
})

describe('listingSimilarInPlace', () => {
  it('keeps the named place and drops another city', () => {
    const kept = listingSimilarInPlace(
      [
        tile({ listingKey: 'a', subdivisionName: 'NorthWest Crossing' }),
        tile({ listingKey: 'b', subdivisionName: 'Caldera Springs', boundarySubdivision: 'Caldera Springs' }),
      ],
      ['NorthWest Crossing'],
    )
    expect(kept.map((t) => t.listingKey)).toEqual(['a'])
  })
})

describe('listingSimilarDedupe', () => {
  it('drops a second listing at the same street', () => {
    const kept = listingSimilarDedupe([
      tile({ listingKey: '1', listNumber: '1', listPrice: 475_000 }),
      tile({ listingKey: '2', listNumber: '2', listPrice: 439_500 }),
    ])
    expect(kept).toHaveLength(1)
  })
})
