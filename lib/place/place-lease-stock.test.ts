import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from './place-inventory-stock'
import {
  PLACE_LEASE_HEADING,
  loadPlaceLeaseSection,
  placeLeaseSectionFromTiles,
  placeLeaseTiles,
} from './place-lease-stock'

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
    streetName: 'Greenwood',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Center Addition to Bend',
    subdivisionSlug: 'center-addition-to-bend',
    lat: 44.06,
    lng: -121.3,
    photoUrl: 'https://cdn.example/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 1950,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-greenwood-ave',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Center Addition to Bend',
    ...over,
  }
}

// The founding case (2026-09-23): three 671 Greenwood Avenue leases printed as
// "Single-family homes ... for sale" on /subdivisions/center-addition-to-bend.
const LEASE_140 = tile({
  listingKey: '20260514121750306188000000',
  streetNumber: '671',
  listPrice: 1.4,
  propertyType: 'G',
  propertySubType: null,
  beds: null,
  baths: null,
  pricePerSqft: null,
})
const LEASE_130 = tile({ ...LEASE_140, listingKey: '20260514115056270451000000', listPrice: 1.3 })
const LEASE_NO_UNIT = tile({ ...LEASE_140, listingKey: '20251113222631250705000000', listPrice: 1.2 })
const HOUSE = tile({ listingKey: 'sfr-1' })
const OFFICE_SALE = tile({ listingKey: 'office-1', propertyType: 'F', propertySubType: 'Office', beds: null, baths: null })

const UNITS = {
  '20260514121750306188000000': '$/SF/Mo',
  '20260514115056270451000000': '$/SF/Mo',
  '20251113222631250705000000': null,
}

describe('placeLeaseTiles', () => {
  it('keeps only commercial leases, each once, in the order given', () => {
    const picked = placeLeaseTiles([HOUSE, LEASE_140, OFFICE_SALE, LEASE_130, LEASE_140])
    expect(picked.map((t) => t.listingKey)).toEqual([LEASE_140.listingKey, LEASE_130.listingKey])
  })

  it('finds nothing in a place with no lease', () => {
    expect(placeLeaseTiles([HOUSE, OFFICE_SALE])).toEqual([])
  })
})

describe('placeLeaseSectionFromTiles', () => {
  it('is null when the place has no active lease, so no section renders', () => {
    expect(placeLeaseSectionFromTiles([HOUSE, OFFICE_SALE], UNITS)).toBeNull()
  })

  it('lists the leases under "Commercial space for lease", counted for lease, never for sale', () => {
    const section = placeLeaseSectionFromTiles([HOUSE, LEASE_140, LEASE_130, OFFICE_SALE], UNITS)!
    expect(section.key).toBe('lease')
    expect(section.heading).toBe(PLACE_LEASE_HEADING)
    expect(section.heading).toBe('Commercial space for lease')
    expect(section.countLabel).toBe('2 for lease')
    expect(section.countLabel).not.toMatch(/sale/)
    expect(section.rows.map((r) => r.listingKey)).toEqual([LEASE_140.listingKey, LEASE_130.listingKey])
  })

  it('carries each lease its own rent unit, and null when the feed gives none', () => {
    const section = placeLeaseSectionFromTiles([LEASE_140, LEASE_NO_UNIT], UNITS)!
    expect(section.rows[0]!.leaseRateOption).toBe('$/SF/Mo')
    expect(section.rows[0]!.price).toBe(1.4)
    expect(section.rows[1]!.leaseRateOption).toBeNull()
  })

  it('reads a unit that is missing from the lookup as null, not as the neighbour\'s', () => {
    const section = placeLeaseSectionFromTiles([LEASE_140], {})!
    expect(section.rows[0]!.leaseRateOption).toBeNull()
  })

  it('leaves the for-sale sections exactly as they were: the lease is in neither', () => {
    const tiles = [HOUSE, LEASE_140, LEASE_130, OFFICE_SALE]
    const forSale = placeStockSectionsFromTiles(tiles)
    const saleKeys = forSale.flatMap((s) => s.rows.map((r) => r.listingKey))
    expect(saleKeys).toEqual(['sfr-1', 'office-1'])
    expect(forSale.find((s) => s.key === 'sfr')!.countLabel).toBe('1 for sale')
    const lease = placeLeaseSectionFromTiles(tiles, UNITS)!
    expect(lease.rows.some((r) => saleKeys.includes(r.listingKey))).toBe(false)
  })
})

describe('loadPlaceLeaseSection', () => {
  it('reads nothing and returns null for a place with no lease', async () => {
    await expect(loadPlaceLeaseSection([HOUSE, OFFICE_SALE])).resolves.toBeNull()
  })
})
