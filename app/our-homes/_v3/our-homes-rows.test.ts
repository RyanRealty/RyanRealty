import { describe, expect, it } from 'vitest'
import type { PriceDropTile } from '@/lib/data'
import { ourHomesCaption, ourHomesFieldItems, ourHomesTowns } from './our-homes-rows'

function listing(over: Partial<PriceDropTile> = {}): PriceDropTile {
  return {
    ListingKey: '20260225192329433521000000',
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
    Latitude: 44.138729,
    Longitude: -121.349064,
    ...over,
  }
}

describe('ourHomesFieldItems', () => {
  it('turns an office house into a Field row with price, street, photo, and pin', () => {
    const items = ourHomesFieldItems([listing()])
    expect(items).toHaveLength(1)
    expect(items[0]?.priceLabel).toMatch(/\$1,095,000/)
    expect(items[0]?.title).toBe('19496 Tumalo Reservoir')
    expect(items[0]?.photoSrc).toBe('/house.jpg')
    expect(items[0]?.lat).toBe(44.138729)
    expect(items[0]?.lng).toBe(-121.349064)
    expect(items[0]?.href).toContain('220215931')
  })

  it('drops a home with no list price or no street', () => {
    expect(ourHomesFieldItems([listing({ ListPrice: null })])).toEqual([])
    expect(
      ourHomesFieldItems([listing({ StreetNumber: null, StreetName: null, StreetSuffix: null })]),
    ).toEqual([])
  })
})

describe('ourHomesCaption', () => {
  it('names the listed set and prints nothing for an empty set', () => {
    expect(ourHomesCaption(3)).toBe('3 homes listed by this office')
    expect(ourHomesCaption(1)).toBe('1 home listed by this office')
    expect(ourHomesCaption(0)).toBeNull()
  })
})

describe('ourHomesTowns', () => {
  it('lists each town once as a city door', () => {
    const towns = ourHomesTowns([
      listing(),
      listing({ ListingKey: 'k2', City: 'Redmond' }),
      listing({ ListingKey: 'k3', City: 'Bend' }),
    ])
    expect(towns).toEqual([
      { label: 'Bend', href: '/cities/bend' },
      { label: 'Redmond', href: '/cities/redmond' },
    ])
  })
})
