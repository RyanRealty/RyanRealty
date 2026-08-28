import { describe, expect, it } from 'vitest'
import type { BrokerSaleTile } from '@/lib/data'
import { publishOwnClosingRows } from './sale-rows'

function sale(overrides: Partial<BrokerSaleTile> = {}): BrokerSaleTile {
  return {
    ListingKey: 'key-1',
    ListNumber: '220000001',
    ListPrice: 500000,
    OriginalListPrice: 500000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1800,
    StreetNumber: '100',
    StreetName: 'Main',
    StreetSuffix: 'St',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97701',
    SubdivisionName: 'Northwest Crossing',
    PhotoURL: 'https://example.com/photo.jpg',
    StandardStatus: 'Closed',
    OnMarketDate: '2025-01-01',
    CloseDate: '2025-06-01',
    ClosePrice: 495000,
    ListAgentName: 'Matt Ryan',
    ListOfficeName: 'Ryan Realty',
    has_virtual_tour: false,
    virtual_tour_url: null,
    year_built: 2012,
    price_per_sqft: 275,
    lot_size_acres: 0.2,
    garage_spaces: 2,
    pool_yn: false,
    estimated_monthly_piti: null,
    price_drop_count: 0,
    DaysOnMarket: 20,
    total_price_change_pct: 0,
    saleSide: 'listed',
    ...overrides,
  }
}

describe('publishOwnClosingRows', () => {
  it('keeps the published count equal to every mapped 977-zip row', () => {
    const sales = [
      sale({ ListingKey: 'listed-1', ListNumber: '1', PhotoURL: 'https://example.com/a.jpg' }),
      sale({
        ListingKey: 'buyer-1',
        ListNumber: '2',
        saleSide: 'represented-buyer',
        PhotoURL: null,
      }),
      sale({ ListingKey: 'ashland', ListNumber: '3', PostalCode: '97520', City: 'Ashland' }),
      sale({ ListingKey: 'no-price', ListNumber: '4', ClosePrice: null, ListPrice: null }),
    ]

    const rows = publishOwnClosingRows(sales)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.id)).toEqual(['listed-1', 'buyer-1'])
    expect(rows.some((row) => !row.media?.src)).toBe(true)
  })

  it('does not slice a 19-closing set down to 9 rows', () => {
    const sales = Array.from({ length: 19 }, (_, index) =>
      sale({
        ListingKey: `close-${index + 1}`,
        ListNumber: String(220000000 + index),
        PhotoURL: index < 9 ? `https://example.com/${index}.jpg` : null,
      }),
    )

    const rows = publishOwnClosingRows(sales)
    expect(rows).toHaveLength(19)
    expect(rows.filter((row) => row.media?.src)).toHaveLength(9)
  })

  it('withholds placeholder street number 0 on the ledger line', () => {
    const [row] = publishOwnClosingRows([
      sale({
        ListingKey: 'moonshadow',
        StreetNumber: '0',
        StreetName: 'Moonshadow',
        StreetSuffix: 'Court',
      }),
    ])
    expect(row?.what).toBe('Moonshadow Court, Bend')
  })
})
