import { describe, expect, it } from 'vitest'
import {
  brokerageOfficeNames,
  chooseBrokerageRows,
  sortBrokerageListings,
  type PriceDropTile,
} from './getPriceDropTiles'

function tile(over: Partial<PriceDropTile> = {}): PriceDropTile {
  return {
    ListingKey: 'k1',
    ListNumber: '220215931',
    ListPrice: 1_095_000,
    OriginalListPrice: 1_095_000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 2100,
    StreetNumber: '19496',
    StreetName: 'Tumalo Reservoir',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97703',
    SubdivisionName: null,
    PhotoURL: '/house.jpg',
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
    ...over,
  }
}

describe('brokerageOfficeNames', () => {
  it('adds the LLC form so an exact office match finds Ryan Realty LLC', () => {
    expect(brokerageOfficeNames('Ryan Realty')).toEqual(['Ryan Realty', 'Ryan Realty LLC'])
  })

  it('does not double LLC when the office name already has it', () => {
    expect(brokerageOfficeNames('Ryan Realty LLC')).toEqual(['Ryan Realty LLC'])
  })
})

describe('chooseBrokerageRows', () => {
  it('keeps the second shape when the first shape is empty', () => {
    const pending = tile({ ListingKey: 'k2', ListNumber: '220225317', StandardStatus: 'Pending' })
    expect(chooseBrokerageRows([], [pending])).toEqual([pending])
  })

  it('claims empty only when both shapes are empty', () => {
    expect(chooseBrokerageRows([], [])).toEqual([])
  })
})

describe('sortBrokerageListings', () => {
  it('puts Active ahead of Pending', () => {
    const pending = tile({ ListingKey: 'p', StandardStatus: 'Pending' })
    const active = tile({ ListingKey: 'a', StandardStatus: 'Active' })
    expect(sortBrokerageListings([pending, active]).map((row) => row.ListingKey)).toEqual(['a', 'p'])
  })
})
