import { describe, expect, it } from 'vitest'
import { publishBrokerClosingRows } from './sale-rows'
import type { BrokerSaleTile } from '@/lib/data'

function sale(overrides: Partial<BrokerSaleTile>): BrokerSaleTile {
  return {
    ListingKey: 'k1',
    ListNumber: '220000001',
    ListPrice: 500000,
    OriginalListPrice: 500000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1800,
    StreetNumber: '12',
    StreetName: 'Pine',
    StreetSuffix: 'St',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97702',
    SubdivisionName: null,
    PhotoURL: null,
    StandardStatus: 'Closed',
    OnMarketDate: '2026-01-01',
    CloseDate: '2026-03-01',
    ClosePrice: 495000,
    ListAgentName: 'Matt Ryan',
    ListOfficeName: 'Ryan Realty LLC',
    has_virtual_tour: false,
    virtual_tour_url: null,
    year_built: 1998,
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

describe('publishBrokerClosingRows', () => {
  it('keeps a 977 closing that has no photo so the stat matches the table', () => {
    const rows = publishBrokerClosingRows([sale({ PhotoURL: null }), sale({ ListingKey: 'k2', PostalCode: '97520' })])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.what).toBeTruthy()
    expect(rows[0]?.media).toBeUndefined()
  })
})
