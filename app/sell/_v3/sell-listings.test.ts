import { describe, expect, it } from 'vitest'
import type { PriceDropTile } from '@/lib/data'
import { sellListingRows, SHOWN_LISTINGS } from './sell-listings'

function tile(partial: Partial<PriceDropTile> & { ListingKey: string }): PriceDropTile {
  return {
    ListNumber: '220000001',
    ListPrice: 750_000,
    OriginalListPrice: 750_000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1850,
    StreetNumber: '12',
    StreetName: 'Pine',
    StreetSuffix: 'Rd',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97701',
    SubdivisionName: null,
    PhotoURL: 'https://img.example/house.jpg',
    StandardStatus: 'Active',
    OnMarketDate: null,
    CloseDate: null,
    ClosePrice: null,
    ListAgentName: null,
    ListOfficeName: 'Ryan Realty LLC',
    has_virtual_tour: null,
    virtual_tour_url: null,
    year_built: null,
    price_per_sqft: null,
    lot_size_acres: null,
    garage_spaces: null,
    pool_yn: null,
    estimated_monthly_piti: null,
    price_drop_count: null,
    DaysOnMarket: null,
    total_price_change_pct: null,
    ...partial,
  }
}

describe('sellListingRows', () => {
  it('prints photo, price, beds, baths, sqft, street', () => {
    const rows = sellListingRows([tile({ ListingKey: 'abc' })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      what: '12 Pine Rd',
      when: 'Bend',
      detail: '3 bd · 2 ba · 1,850 sqft',
      media: { src: 'https://img.example/house.jpg' },
    })
    expect(String(rows[0]!.value)).toMatch(/\$/)
    expect(rows[0]!.href).toContain('220000001')
  })

  it('drops rows without a street or a price', () => {
    const rows = sellListingRows([
      tile({ ListingKey: 'no-street', StreetNumber: null, StreetName: null, StreetSuffix: null }),
      tile({ ListingKey: 'no-price', ListPrice: null }),
      tile({ ListingKey: 'ok' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('ok')
  })

  it(`caps at ${SHOWN_LISTINGS} house rows`, () => {
    const listings = Array.from({ length: SHOWN_LISTINGS + 3 }, (_, i) =>
      tile({ ListingKey: `k${i}`, ListNumber: `22000000${i}` }),
    )
    expect(sellListingRows(listings)).toHaveLength(SHOWN_LISTINGS)
  })
})
