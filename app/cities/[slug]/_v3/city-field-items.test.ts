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

  it('attaches a Field type from the MLS subtype', () => {
    const items = cityFieldItems([
      tile({ listingKey: 'condo', propertySubType: 'Condominium' }),
    ])
    expect(items[0]?.typeKey).toBe('condo')
    expect(items[0]?.typeLabel).toBe('Condo')
  })
})

describe('cityFieldCaption', () => {
  it('names the city on the listed-set count', () => {
    expect(cityFieldCaption({ cityName: 'Bend', count: 248 })).toBe('homes in Bend')
    expect(cityFieldCaption({ cityName: 'Redmond', count: 1 })).toBe('home in Redmond')
  })

  it('prints nothing for an empty set', () => {
    expect(cityFieldCaption({ cityName: 'Bend', count: 0 })).toBeNull()
  })
})
