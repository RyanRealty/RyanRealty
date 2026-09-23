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

function drop(at = '2026-08-20T00:00:00.000Z') {
  return { previousPrice: 525000, newPrice: 500000, at }
}

describe('homeRailRows', () => {
  const hrefs = {
    nowMs: Date.now(),
    regionalHref: '/homes-for-sale?view=list',
    bendHref: '/homes-for-sale/bend',
    priceCutsHref: '/price-drops',
    newHref: '/homes-for-sale?view=list&sort=newest',
    priceDrops: new Map([
      ['d', drop()],
      ['e', drop()],
      ['f', drop()],
    ]),
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

  // 2026-09-08 evaluator: 3027 Polarstar Avenue led both the nearby rail and the
  // price-cuts rail, so the page opened with the same photograph twice. On a
  // real pool (HOME_TILE_FETCH is 3,000) every house now leads exactly one shelf.
  it('never shows one house on two shelves', () => {
    const tiles = Array.from({ length: 40 }, (_, i) =>
      tile({
        listingKey: `k${i}`,
        city: 'Bend',
        streetNumber: String(300 + i),
        priceDropCount: i % 4 === 0 ? 1 : 0,
        // Only the first eight are inside the seven-day window.
        onMarketDate: new Date(Date.now() - (i < 8 ? 1 : 40) * 86_400_000).toISOString(),
      }),
    )
    const priceDrops = new Map(
      tiles.filter((_, i) => i % 4 === 0).map((t) => [t.listingKey, drop()]),
    )
    const rows = homeRailRows(tiles, { ...hrefs, priceDrops })
    expect(rows.map((r) => r.heading)).toEqual([
      'Homes in Bend and nearby',
      'Price cuts',
      'New this week',
    ])
    const keys = rows.flatMap((r) => r.cards.map((c: HomeRailCard) => c.listingKey))
    expect(new Set(keys).size).toBe(keys.length)
    // The narrower claim keeps the house: a cut listing stays on Price cuts.
    const cutRow = rows.find((r) => r.heading === 'Price cuts')!
    expect(cutRow.cards.every((c) => Number(c.listingKey.slice(1)) % 4 === 0)).toBe(true)
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

  it('omits a commercial lease (PropertyType G) — its ListPrice is rent, not a home for sale', () => {
    // The homepage rails pull every active tile with no property-type filter.
    // A photographed, priced 'G' row used to earn a card under "Homes for
    // sale" / "Homes in Bend and nearby" even though its ListPrice is a rent
    // rate (verified live 2026-09-23: 671 Greenwood Avenue, Bend, list_price
    // 1.3-1.4). §0: a lease is not for sale.
    const tiles = [
      tile({ listingKey: 'lease', propertyType: 'G', propertySubType: null, listPrice: 1.3 }),
      tile({ listingKey: 'sfr', streetNumber: '101' }),
    ]
    const rows = homeRailRows(tiles, hrefs)
    const keys = rows.flatMap((r) => r.cards.map((c: HomeRailCard) => c.listingKey))
    expect(keys).toEqual(['sfr'])
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
      priceDrops: new Map([['oh3', drop()]]),
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
