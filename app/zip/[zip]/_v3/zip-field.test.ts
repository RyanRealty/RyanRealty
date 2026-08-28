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
  it('names the listed set, states the preview cap, and omits an empty set', () => {
    // 'listings', not 'homes' (2026-08-27): the set can include fractional shares.
    // The cap clause appears only when the page shows fewer than the total
    // (2026-08-27 mobile audit: 382 rows + 382 markers were unusable at 390px).
    expect(zipFieldCaption('97702', 408, 24)).toBe(
      '408 active single-family listings in 97702 · the 24 highest-priced below',
    )
    expect(zipFieldCaption('97702', 1, 1)).toBe('1 active single-family listing in 97702')
    expect(zipFieldCaption('97702', 24, 24)).toBe('24 active single-family listings in 97702')
    expect(zipFieldCaption('97702', 0, 0)).toBeNull()
  })
})

describe('zipFieldItems', () => {
  it('keeps a priced home that has no photograph', () => {
    const items = zipFieldItems([tile({ listingKey: 'a', photoUrl: null })], '97702')
    expect(items).toHaveLength(1)
    expect(items[0]?.photoSrc).toBeUndefined()
    // Card titles carry the city (Matt 2026-08-27, publishCardAddress).
    expect(items[0]?.title).toBe('100 Main St, Bend')
  })

  it('drops a home with no list price', () => {
    expect(zipFieldItems([tile({ listingKey: 'a', listPrice: null })], '97702')).toEqual([])
  })
})
