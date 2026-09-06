import { describe, expect, it } from 'vitest'
import { homeRailRows, type HomeRailCard } from './home-rail-items'
import type { ListingTile } from '@/lib/data/types/listing'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: null,
    status: 'Active',
    listPrice: 500000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1600,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: 44.05,
    lng: -121.3,
    photoUrl: 'https://cdn.example/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: new Date().toISOString(),
    modifiedAt: null,
    pricePerSqft: 300,
    lotSizeAcres: null,
    yearBuilt: 2000,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: false,
    tourUrl: null,
    dom: 3,
    priceDropCount: 0,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  }
}

describe('homeRailRows', () => {
  const hrefs = {
    nowMs: Date.now(),
    regionalHref: '/homes-for-sale?view=list',
    bendHref: '/homes-for-sale/bend',
    priceCutsHref: '/price-drops',
    newHref: '/homes-for-sale?view=list&sort=newest',
  }

  it('builds a Bend-area rail and honest extra rows when data exists', () => {
    const tiles = [
      tile({ listingKey: 'a', city: 'Bend' }),
      tile({ listingKey: 'b', city: 'Bend', streetNumber: '101' }),
      tile({ listingKey: 'c', city: 'Redmond', streetNumber: '102' }),
      tile({ listingKey: 'd', city: 'Bend', streetNumber: '103', priceDropCount: 1 }),
      tile({ listingKey: 'e', city: 'Bend', streetNumber: '104', priceDropCount: 2 }),
      tile({ listingKey: 'f', city: 'Sisters', streetNumber: '105', priceDropCount: 1 }),
    ]
    const rows = homeRailRows(tiles, hrefs)
    expect(rows[0]?.heading).toBe('Homes in Bend and nearby')
    expect(rows[0]?.cards.length).toBeGreaterThanOrEqual(3)
    expect(rows.some((r) => r.heading === 'Price cuts')).toBe(true)
    expect(rows.some((r) => r.heading === 'Homes for You')).toBe(false)
  })

  it('omits photoless or priceless tiles', () => {
    const tiles = [
      tile({ listingKey: 'a', photoUrl: null }),
      tile({ listingKey: 'b', listPrice: null }),
      tile({ listingKey: 'c' }),
    ]
    const rows = homeRailRows(tiles, hrefs)
    const keys = rows.flatMap((r) => r.cards.map((c: HomeRailCard) => c.listingKey))
    expect(keys).toEqual(['c'])
  })

  it('passes open-house labels through publishListingCardBadges', () => {
    const tiles = [
      tile({ listingKey: 'oh1', city: 'Bend', streetNumber: '200' }),
      tile({ listingKey: 'oh2', city: 'Bend', streetNumber: '201' }),
      tile({ listingKey: 'oh3', city: 'Bend', streetNumber: '202', priceDropCount: 1 }),
    ]
    const rows = homeRailRows(tiles, {
      ...hrefs,
      openHouseLabels: { oh1: 'Open Sat 1pm', oh3: 'Open Sun' },
    })
    const byKey = Object.fromEntries(
      rows.flatMap((r) => r.cards.map((c) => [c.listingKey, c])),
    )
    expect(byKey.oh1?.badges.some((b) => b.kind === 'open' && b.label === 'Open Sat 1pm')).toBe(
      true,
    )
    expect(byKey.oh3?.badges.some((b) => b.kind === 'drop')).toBe(true)
    expect(byKey.oh3?.badges.some((b) => b.kind === 'open' && b.label === 'Open Sun')).toBe(true)
  })
})
