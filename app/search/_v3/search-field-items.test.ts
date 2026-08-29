import { describe, expect, it } from 'vitest'
import type { ListingTileRow } from '@/app/actions/listings'
import { searchFieldItemId, searchFieldItems, searchFieldPins } from './search-field-items'

function row(over: Partial<ListingTileRow> = {}): ListingTileRow {
  return {
    ListingKey: 'key-1',
    ListNumber: '220000001',
    ListPrice: 525000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    StreetNumber: '100',
    StreetName: 'Oregon',
    StreetSuffix: 'Ave',
    City: 'Redmond',
    State: 'OR',
    PostalCode: '97756',
    SubdivisionName: null,
    PhotoURL: 'https://example.com/photo.jpg',
    Latitude: 44.27,
    Longitude: -121.17,
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    ...over,
  }
}

describe('searchFieldItems', () => {
  it('maps a priced address to a Field row with Amboqia-ready price label', () => {
    const items = searchFieldItems([row()])
    expect(items).toHaveLength(1)
    expect(items[0].priceLabel).toBe('$525,000')
    expect(items[0].typeKey).toBe('house')
    expect(items[0].id).toBe('220000001')
    expect(searchFieldItemId(row())).toBe('220000001')
  })

  it('keeps a photoless inventory row and drops a commercial lease ask', () => {
    const items = searchFieldItems([
      row({ PhotoURL: null, ListNumber: '220000002' }),
      row({
        ListNumber: '220000003',
        PropertyType: 'G',
        PropertySubType: null,
        ListPrice: 3,
      }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('220000002')
    expect(items[0].photoSrc).toBeUndefined()
  })

  it('pins only rows that carry coordinates', () => {
    const items = searchFieldItems([
      row(),
      row({ ListNumber: '220000004', Latitude: null, Longitude: null }),
    ])
    expect(items).toHaveLength(2)
    expect(searchFieldPins(items)).toHaveLength(1)
  })
})
