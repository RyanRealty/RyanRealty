import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import { BUY_ALERTS_DIAL_LIMIT, BUY_ALERTS_DIAL_SUB_TYPE, buyAlertsDialItems } from './buy-alerts-dial'

const NOW = Date.parse('2026-10-14T18:00:00Z')

function tile(partial: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'k1',
    listNumber: '220222277',
    status: 'Active',
    listPrice: 695_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1_800,
    streetNumber: '2732',
    streetName: 'NW Ordway',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97703',
    subdivisionName: 'Awbrey Butte',
    subdivisionSlug: 'awbrey-butte',
    lat: 44.07,
    lng: -121.33,
    photoUrl: 'https://cdn.photos.sparkplatform.com/or/abc-o.jpg',
    propertyType: 'A',
    propertySubType: BUY_ALERTS_DIAL_SUB_TYPE,
    onMarketDate: '2026-10-12T00:00:00Z',
    modifiedAt: '2026-10-13T00:00:00Z',
    pricePerSqft: 386,
    lotSizeAcres: 0.2,
    yearBuilt: 1998,
    garageSpaces: 2,
    poolYn: false,
    hasVirtualTour: false,
    tourUrl: null,
    dom: 2,
    priceDropCount: 0,
    addressSlug: null,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  }
}

describe('buyAlertsDialItems', () => {
  it('turns a priced, photographed, addressed tile into a dial row with its door', () => {
    const [row] = buyAlertsDialItems([tile()], NOW)
    expect(row).toBeDefined()
    expect(row?.listingKey).toBe('k1')
    expect(row?.price).toBe(695_000)
    expect(row?.addressLine).toBe('2732 NW Ordway Ave')
    expect(row?.cityLine).toBe('Bend 97703')
    expect(row?.href).toMatch(/^\//)
    expect(row?.photoUrl).toContain('sparkplatform')
    expect(row?.badges?.some((b) => b.kind === 'new')).toBe(true)
    expect(row?.propertySubType).toBe(BUY_ALERTS_DIAL_SUB_TYPE)
  })

  it('drops a tile with no price, no photo, or no street rather than defaulting one', () => {
    expect(buyAlertsDialItems([tile({ listPrice: null })], NOW)).toEqual([])
    expect(buyAlertsDialItems([tile({ photoUrl: null })], NOW)).toEqual([])
    expect(buyAlertsDialItems([tile({ streetNumber: null, streetName: null, streetSuffix: null })], NOW)).toEqual([])
  })

  it('drops a lease rate and a duplicate key, and holds the limit', () => {
    expect(buyAlertsDialItems([tile({ propertyType: 'G' })], NOW)).toEqual([])
    const twice = buyAlertsDialItems([tile(), tile()], NOW)
    expect(twice).toHaveLength(1)
    const many = Array.from({ length: BUY_ALERTS_DIAL_LIMIT + 5 }, (_, i) => tile({ listingKey: `k${i}` }))
    expect(buyAlertsDialItems(many, NOW)).toHaveLength(BUY_ALERTS_DIAL_LIMIT)
  })
})
