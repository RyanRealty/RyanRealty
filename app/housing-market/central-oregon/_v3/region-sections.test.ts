import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { REGION_JARGON_RE } from './region-figures'
import { buildForSaleLedger, regionHomesForSaleDoors } from './region-sections'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 749_500,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1_840,
    streetNumber: '123',
    streetName: 'Deschutes',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/800x600/true/photo.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 407,
    lotSizeAcres: null,
    yearBuilt: 2012,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: null,
    priceDropCount: null,
    addressSlug: '123-deschutes-ave',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  }
}

describe('buildForSaleLedger', () => {
  it('prints price, street, beds, baths, and sqft on every kept row', () => {
    const { rows, source } = buildForSaleLedger([tile({ listingKey: 'one' })])
    expect(rows).toHaveLength(1)
    expect(String(rows[0]?.what)).toContain('Deschutes')
    expect(String(rows[0]?.value)).toContain('749,500')
    expect(String(rows[0]?.detail)).toBe('3 bd · 2 ba · 1,840 sqft')
    expect(String(rows[0]?.when)).toBe('Bend')
    expect(rows[0]?.media?.src).toContain('800x600')
    expect(source).not.toMatch(REGION_JARGON_RE)
    expect(source).not.toMatch(/homes for sale across/i)
  })

  it('drops a tile that is only a photo — no invented house facts', () => {
    const { rows } = buildForSaleLedger([
      tile({ listingKey: 'bare', listPrice: null, beds: null, baths: null, sqft: null, streetName: null }),
    ])
    expect(rows).toHaveLength(0)
  })

  it('caps at six houses', () => {
    const tiles = Array.from({ length: 9 }, (_, i) =>
      tile({ listingKey: `k${i}`, listNumber: `22000000${i}` }),
    )
    expect(buildForSaleLedger(tiles).rows).toHaveLength(6)
  })
})

describe('regionHomesForSaleDoors', () => {
  it('names each covered city as a crawlable browse door', () => {
    const doors = regionHomesForSaleDoors()
    expect(doors.some((door) => door.url === '/homes-for-sale/bend')).toBe(true)
    expect(doors.some((door) => door.name === 'Bend homes for sale')).toBe(true)
    expect(doors).toHaveLength(8)
  })
})
