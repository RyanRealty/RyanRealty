import { describe, expect, it } from 'vitest'
import type { ListingTileRow } from '@/app/actions/listings'
import { dedupeListingRows, searchFieldItems } from './search-field-items'

function row(partial: Partial<ListingTileRow> & Pick<ListingTileRow, 'ListingKey'>): ListingTileRow {
  return {
    ListNumber: null,
    StreetNumber: '8450',
    StreetName: '1st',
    StreetSuffix: 'Street',
    City: 'Terrebonne',
    ListPrice: 525000,
    PhotoURL: 'https://example.com/door.jpg',
    Latitude: 44.35,
    Longitude: -121.18,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1800,
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    ...partial,
  } as ListingTileRow
}

describe('dedupeListingRows', () => {
  it('collapses the same ListingKey', () => {
    const a = row({ ListingKey: 'abc' })
    const b = row({ ListingKey: 'abc', ListPrice: 530000 })
    expect(dedupeListingRows([a, b])).toHaveLength(1)
  })

  it('collapses the same street, city, and ask (8450 1st Street twice)', () => {
    const a = row({ ListingKey: 'one', ListNumber: '22000001' })
    const b = row({ ListingKey: 'two', ListNumber: '22000002' })
    expect(dedupeListingRows([a, b])).toHaveLength(1)
  })

  it('keeps two different streets', () => {
    const a = row({ ListingKey: 'one', StreetName: '1st' })
    const b = row({ ListingKey: 'two', StreetName: '2nd' })
    expect(dedupeListingRows([a, b])).toHaveLength(2)
  })
})

describe('searchFieldItems', () => {
  it('maps a priced street row to a Field door with a photo', () => {
    const items = searchFieldItems([row({ ListingKey: 'abc', ListNumber: '22001111' })])
    expect(items).toHaveLength(1)
    expect(items[0].photoSrc).toBe('https://example.com/door.jpg')
    expect(items[0].title).toMatch(/8450/)
    expect(items[0].href.length).toBeGreaterThan(0)
    expect(items[0].typeKey).toBe('house')
  })

  it('drops a row with no ask', () => {
    expect(searchFieldItems([row({ ListingKey: 'abc', ListPrice: null })])).toHaveLength(0)
  })

  it('names Pending on the door when StandardStatus is pending', () => {
    const items = searchFieldItems([
      row({ ListingKey: 'abc', ListNumber: '22001111', StandardStatus: 'Pending' }),
    ])
    expect(items[0].meta).toMatch(/Pending/)
  })
})
