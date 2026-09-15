import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ListingTile } from '@/lib/data/types/listing'
import { composeInvestListings, investListingFacts, investTypeLabel } from './invest-listings'

function tile(partial: Partial<ListingTile> & { listingKey: string }): ListingTile {
  return {
    listNumber: partial.listNumber ?? partial.listingKey,
    status: 'Active',
    listPrice: 450000,
    closePrice: null,
    closeDate: null,
    beds: 4,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Pine',
    streetSuffix: 'Rd',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: 'https://example.com/p.jpg',
    propertyType: 'C',
    propertySubType: 'Duplex',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 250,
    lotSizeAcres: null,
    yearBuilt: 1998,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 12,
    priceDropCount: null,
    addressSlug: '12-pine-rd',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  } as ListingTile
}

describe('composeInvestListings', () => {
  it('keeps price, address, beds, baths, and size', () => {
    const rows = composeInvestListings([
      [tile({ listingKey: 'mf-1' })],
      [tile({ listingKey: 'land-1', propertyType: 'D', beds: null, baths: null, sqft: null, lotSizeAcres: 2.5 })],
    ])
    expect(rows[0]?.price).toBe('$450,000')
    expect(rows[0]?.address).toContain('Pine')
    expect(rows[0]?.beds).toBe('4 bd')
    expect(rows[0]?.baths).toBe('2 ba')
    expect(rows[0]?.size).toBe('1,800 sqft')
    expect(investListingFacts(rows[0]!)).toContain('bd')
    expect(rows[1]?.size).toBe('2.50 acres')
    expect(investTypeLabel(tile({ listingKey: 'x', propertyType: 'D' }))).toBe('Lot')
  })

  it('drops a tile with no price or no street', () => {
    expect(
      composeInvestListings([
        [
          tile({ listingKey: 'no-price', listPrice: null }),
          tile({ listingKey: 'no-street', streetNumber: null, streetName: null, streetSuffix: null }),
        ],
      ]),
    ).toEqual([])
  })

  it('interleaves types instead of dumping one bucket', () => {
    const mf = [1, 2, 3, 4].map((n) => tile({ listingKey: `mf-${n}` }))
    const lots = [1, 2, 3, 4].map((n) =>
      tile({ listingKey: `lot-${n}`, propertyType: 'D', beds: null, baths: null }),
    )
    const rows = composeInvestListings([mf, lots])
    expect(rows.map((r) => r.listingKey)).toEqual([
      'mf-1',
      'lot-1',
      'mf-2',
      'lot-2',
      'mf-3',
      'lot-3',
      'mf-4',
      'lot-4',
    ])
  })
})

describe('invest catalog import (Tip Ready route scan)', () => {
  it('imports the shadcn table from the installed source', () => {
    const src = readFileSync(new URL('./InvestTables.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from '@\/components\/ui\/table'/)
  })
})
