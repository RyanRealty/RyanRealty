import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import { cityFieldItems, cityFieldPool } from './city-field-items'
import { cityFaceFieldCaption } from './city-face'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    listPrice: 500000,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    photoUrl: null,
    lat: 44.05,
    lng: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: null,
    ...partial,
  } as ListingTile
}

describe('cityFieldItems', () => {
  it('keeps a priced addressed home that has no photograph', () => {
    const items = cityFieldItems([tile({ listingKey: 'a', photoUrl: null })])
    expect(items).toHaveLength(1)
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[0]?.title).toBe('100 Main St, Bend')
  })

  it('prints Moonshadow Court without a leading 0', () => {
    const items = cityFieldItems([
      tile({ listingKey: 'moon', streetNumber: '0', streetName: 'Moonshadow', streetSuffix: 'Court' }),
    ])
    expect(items[0]?.title).toBe('Moonshadow Court, Bend')
  })

  it('drops a home with no list price or no street', () => {
    expect(cityFieldItems([tile({ listingKey: 'a', listPrice: null })])).toEqual([])
    expect(cityFieldItems([tile({ listingKey: 'b', streetNumber: null, streetName: null, streetSuffix: null })])).toEqual(
      [],
    )
  })

  it('passes a photograph through when the tile has one', () => {
    const items = cityFieldItems([tile({ listingKey: 'a', photoUrl: 'https://img.example/house.jpg' })])
    expect(items[0]?.photoSrc).toBe('https://img.example/house.jpg')
    expect(items[0]?.meta).toBe('3 bd · 2 ba · 1,800 sqft')
  })
})

describe('cityFaceFieldCaption', () => {
  it('names the listed set and the one MoS verdict', () => {
    expect(
      cityFaceFieldCaption({
        cityName: 'Bend',
        count: 248,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBe('The 248 newest listings in Bend · 3.6 months of supply · a seller\'s market')
  })

  it('omits a verdict when MoS is absent', () => {
    expect(
      cityFaceFieldCaption({
        cityName: 'Bend',
        count: 12,
        mosLabel: null,
        verdictKind: 'unknown',
        verdictLabel: 'unknown',
      }),
    ).toBe('The 12 newest listings in Bend')
  })

  it('prints nothing for an empty set', () => {
    expect(
      cityFaceFieldCaption({
        cityName: 'Bend',
        count: 0,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBeNull()
  })
})

describe('cityFieldPool', () => {
  it('classifies types and interleaves so a house-heavy feed cannot hide a lot', () => {
    const tiles = [
      tile({ listingKey: 'h1', propertySubType: 'Single Family Residence' }),
      tile({ listingKey: 'h2', propertySubType: 'Single Family Residence', streetNumber: '101' }),
      tile({ listingKey: 'c1', propertySubType: 'Condominium', streetNumber: '200' }),
      tile({ listingKey: 'l1', propertySubType: 'Residential Lots', streetNumber: '300' }),
    ]
    const items = cityFieldPool(tiles, 3)
    expect(items.map((item) => item.typeKey)).toEqual(['house', 'condo', 'land'])
    expect(items[0]?.typeLabel).toBe('House')
  })
})
