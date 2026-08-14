import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { zipFieldCaption, zipFieldItems } from './zip-constants'

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

describe('zipFieldCaption', () => {
  it('names the listed set and omits an empty set', () => {
    expect(zipFieldCaption('97702', 408)).toBe('408 homes in 97702')
    expect(zipFieldCaption('97702', 1)).toBe('1 home in 97702')
    expect(zipFieldCaption('97702', 0)).toBeNull()
  })
})

describe('zipFieldItems', () => {
  it('keeps a priced home that has no photograph', () => {
    const items = zipFieldItems([tile({ listingKey: 'a', photoUrl: null })], '97702')
    expect(items).toHaveLength(1)
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[0]?.title).toBe('100 Main St')
  })

  it('drops a home with no list price', () => {
    expect(zipFieldItems([tile({ listingKey: 'a', listPrice: null })], '97702')).toEqual([])
  })
})
