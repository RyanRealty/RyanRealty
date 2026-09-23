import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import {
  PLACE_STOCK_HEADINGS,
  placeStockIsForSale,
  placeStockSectionKey,
  placeStockSectionsFromTiles,
  unionListingTiles,
} from './place-inventory-stock'

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 579_995,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Parkside',
    streetSuffix: 'Pl',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Parkside Place Phase 1',
    subdivisionSlug: 'parkside-place-phase-1',
    lat: 44.05,
    lng: -121.25,
    photoUrl: 'https://cdn.example/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 2026,
    garageSpaces: 2,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-parkside-pl',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Parkside Place Phase 1',
    ...over,
  }
}

describe('placeStockSectionKey', () => {
  it('maps Matt\'s four buyer buckets', () => {
    expect(placeStockSectionKey('A', 'Single Family Residence')).toBe('sfr')
    expect(placeStockSectionKey('A', 'Manufactured On Land')).toBe('sfr')
    expect(placeStockSectionKey('C', 'Duplex')).toBe('multifamily')
    expect(placeStockSectionKey('A', 'Townhouse')).toBe('attached')
    expect(placeStockSectionKey('A', 'Condominium')).toBe('attached')
    expect(placeStockSectionKey('D', 'Residential Lots')).toBe('land')
    expect(placeStockSectionKey('E', 'Farm')).toBe('land')
  })

  it('gives commercial and business listings their own section (Matt 2026-09-23)', () => {
    expect(placeStockSectionKey('F', 'Office')).toBe('commercial')
    expect(placeStockSectionKey('F', null)).toBe('commercial')
    expect(placeStockSectionKey('H', null)).toBe('commercial')
    expect(placeStockSectionKey('C', 'Quadruplex')).toBe('multifamily')
    expect(placeStockSectionKey('C', null)).toBe('multifamily')
  })
})

describe('placeStockSectionsFromTiles', () => {
  it('omits empty type sections and keeps every live listing', () => {
    const sections = placeStockSectionsFromTiles([
      tile({ listingKey: 'sfr-1' }),
      tile({
        listingKey: 'th-1',
        listNumber: '220000002',
        propertySubType: 'Townhouse',
        listPrice: 419_995,
      }),
      tile({
        listingKey: 'land-1',
        listNumber: '220000003',
        propertyType: 'D',
        propertySubType: 'Residential Lots',
        beds: null,
        baths: null,
        sqft: null,
        listPrice: 225_000,
      }),
    ])
    expect(sections.map((s) => s.key)).toEqual(['sfr', 'attached', 'land'])
    expect(sections.find((s) => s.key === 'multifamily')).toBeUndefined()
    expect(sections.find((s) => s.key === 'sfr')?.heading).toBe(PLACE_STOCK_HEADINGS.sfr)
    expect(sections.find((s) => s.key === 'attached')?.rows).toHaveLength(1)
    expect(sections.find((s) => s.key === 'land')?.countLabel).toBe('1 for sale')
  })

  it('keeps an unpriced home and puts a commercial listing in its own section', () => {
    const sections = placeStockSectionsFromTiles([
      tile({ listingKey: 'ask-withheld', listPrice: null }),
      tile({
        listingKey: 'office-1',
        listNumber: '220000009',
        propertyType: 'F',
        propertySubType: 'Office',
        listPrice: 410_000,
      }),
    ])
    expect(sections.find((s) => s.key === 'sfr')?.rows.map((row) => row.listingKey)).toEqual(['ask-withheld'])
    expect(sections.find((s) => s.key === 'sfr')?.rows[0]?.price).toBeNull()
    expect(sections.find((s) => s.key === 'commercial')?.rows).toHaveLength(1)
    expect(sections.find((s) => s.key === 'commercial')?.heading).toBe('Commercial property')
    expect(sections.find((s) => s.key === 'other')).toBeUndefined()
  })

  it('orders every live type: houses, multi-family, attached, land, commercial', () => {
    const sections = placeStockSectionsFromTiles([
      tile({ listingKey: 'office-1', propertyType: 'F', propertySubType: null }),
      tile({ listingKey: 'lot-1', propertyType: 'D', propertySubType: 'Residential Lots' }),
      tile({ listingKey: 'duplex-1', propertyType: 'C', propertySubType: 'Duplex' }),
      tile({ listingKey: 'sfr-1' }),
      tile({ listingKey: 'condo-1', propertySubType: 'Condominium' }),
    ])
    expect(sections.map((s) => s.key)).toEqual(['sfr', 'multifamily', 'attached', 'land', 'commercial'])
  })

  it('leaves a commercial lease out of the for-sale stock (MLS G: ListPrice is rent)', () => {
    // 671 Greenwood Avenue, Bend, 2026-09-23: three Active 'G' rows at
    // $1.30 to $1.40 printed as "Single-family homes ... for sale" on
    // /subdivisions/center-addition-to-bend, because an unmapped type code
    // falls to 'sfr'. A lease is not for sale; it has no place in these
    // counts or carousels.
    const sections = placeStockSectionsFromTiles([
      tile({ listingKey: 'lease-1', propertyType: 'G', propertySubType: null, listPrice: 1.3 }),
      tile({ listingKey: 'sale-1', propertyType: 'F', propertySubType: null, listPrice: 650_000 }),
      tile({ listingKey: 'sfr-1' }),
    ])
    const keys = sections.flatMap((s) => s.rows.map((row) => row.listingKey))
    expect(keys).not.toContain('lease-1')
    expect(sections.find((s) => s.key === 'sfr')?.countLabel).toBe('1 for sale')
    expect(sections.find((s) => s.key === 'commercial')?.rows.map((row) => row.listingKey)).toEqual(['sale-1'])
    expect(placeStockIsForSale('G')).toBe(false)
    expect(placeStockIsForSale('g')).toBe(false)
    expect(placeStockIsForSale('F')).toBe(true)
    expect(placeStockIsForSale(null)).toBe(true)
  })

  it('marks an under-contract listing Pending and leaves an active one unmarked', () => {
    const [section] = placeStockSectionsFromTiles([
      tile({ listingKey: 'auc-1', status: 'Active Under Contract' }),
      tile({ listingKey: 'act-1', status: 'Active' }),
    ])
    expect(section?.rows.map((row) => row.statusLabel)).toEqual(['Pending', null])
  })

  it('dedupes unioned tiles by listing key', () => {
    const a = tile({ listingKey: 'one' })
    expect(unionListingTiles([a], [a, tile({ listingKey: 'two' })]).map((t) => t.listingKey)).toEqual([
      'one',
      'two',
    ])
  })
})
