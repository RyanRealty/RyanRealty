import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import { cityFieldItems } from './city-field-items'
import { cityFieldCaption } from './city-sections'

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
    expect(items[0]?.title).toBe('100 Main St')
  })

  it('prints Moonshadow Court without a leading 0', () => {
    const items = cityFieldItems([
      tile({ listingKey: 'moon', streetNumber: '0', streetName: 'Moonshadow', streetSuffix: 'Court' }),
    ])
    expect(items[0]?.title).toBe('Moonshadow Court')
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

describe('cityFieldCaption', () => {
  it('names the listed set and the one MoS verdict', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 248,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBe('The 248 newest single-family listings in Bend · 3.6 months of supply · a seller\'s market')
  })

  it('omits a verdict when MoS is absent', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 12,
        mosLabel: null,
        verdictKind: 'unknown',
        verdictLabel: 'unknown',
      }),
    ).toBe('The 12 newest single-family listings in Bend')
  })

  it('prints nothing for an empty set', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 0,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBeNull()
  })
})
