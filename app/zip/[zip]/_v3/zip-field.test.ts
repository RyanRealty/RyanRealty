import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import {
  neighborhoodName,
  zipFieldCaption,
  zipOpeningCaption,
  zipFieldItems,
  zipItemListEntries,
  zipMasonryItems,
} from './zip-constants'

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

  it('opening caption reprints the claim count, never a second inventory', () => {
    expect(zipOpeningCaption('97702', 198, 'detached single-family homes')).toBe(
      '198 detached single-family homes for sale in 97702. Atlas marks and the photographs are this set.',
    )
    expect(zipOpeningCaption('97702', 0, 'homes')).toBeNull()
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

describe('neighborhoodName', () => {
  it('drops Undesignated and other visitor-place noise', () => {
    expect(neighborhoodName('Undesignated')).toBeNull()
    expect(neighborhoodName('undesignated')).toBeNull()
    expect(neighborhoodName('Awbrey Butte')).toBe('Awbrey Butte')
  })
})

describe('zipMasonryItems', () => {
  it('keeps price, address, and beds/baths/sqft on photographed cards', () => {
    const items = zipMasonryItems(
      [tile({ listingKey: 'a', photoUrl: 'https://cdn.example/photo.jpg' })],
      '97702',
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.priceLabel).toBeTruthy()
    expect(items[0]?.title).toMatch(/Main/)
    expect(items[0]?.meta).toMatch(/3 bd/)
    expect(items[0]?.photoSrc).not.toMatch(/320x240/)
    expect(items[0]?.imageHeight).toBeGreaterThan(160)
  })
})

describe('zipItemListEntries', () => {
  it('names price + address + facts for the crawlable ItemList', () => {
    const items = zipMasonryItems(
      [tile({ listingKey: 'a', photoUrl: 'https://cdn.example/photo.jpg' })],
      '97702',
    )
    const entries = zipItemListEntries(items)
    expect(entries[0]?.name).toMatch(/Main/)
    expect(entries[0]?.url).toBeTruthy()
  })
})
