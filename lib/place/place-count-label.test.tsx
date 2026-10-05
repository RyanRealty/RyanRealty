/**
 * ONE "FOR SALE" ON A PLACE PAGE (SITE-193, 2026-09-24).
 *
 * /cities/bend printed "700 for sale" on the map and "705 for sale" on the
 * homes under it: the same 700 Active listings, plus 5 Active Under Contract
 * that the map drew as pending and the homes block counted for sale. Both now
 * read publicCountState. These tests hold the map's for-sale count and the
 * homes block's for-sale count equal over one population, whatever mix of
 * statuses it carries.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ListingTile } from '@/lib/data'
import { PUBLIC_ACTIVE_STATUSES, publicCountState } from '@/lib/listing-status-public'
import { placeHomesCount, placeHomesCountLabel } from './place-count-label'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/data', () => ({ getAtlasTiles: vi.fn(), getListingTiles: vi.fn() }))

const NOW = Date.parse('2026-09-24T12:00:00Z')

function tile(i: number, status: string, over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: `k-${i}`,
    listNumber: `2202${String(i).padStart(5, '0')}`,
    status,
    listPrice: 500_000 + i * 1000,
    closePrice: status === 'Closed' ? 490_000 : null,
    closeDate: status === 'Closed' ? '2026-09-20' : null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: String(100 + i),
    streetName: 'Greenwood',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Center Addition to Bend',
    subdivisionSlug: 'center-addition-to-bend',
    lat: 44.06,
    lng: -121.3,
    photoUrl: null,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: '2026-09-01T00:00:00Z',
    modifiedAt: null,
    pricePerSqft: 300,
    lotSizeAcres: null,
    yearBuilt: 2000,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: `${100 + i}-greenwood-ave`,
    ...over,
  } as ListingTile
}

/** A place's population: what the map reads (every status) inside one boundary. */
const POPULATION: ListingTile[] = [
  tile(1, 'Active'),
  tile(2, 'Active'),
  tile(3, 'Active'),
  tile(4, 'Active Under Contract'),
  tile(5, 'Active Under Contract', { propertySubType: 'Condominium' }),
  tile(6, 'Pending'),
  tile(7, 'Closed'),
  // Commercial leases: drawn on no map and counted for sale nowhere.
  tile(8, 'Active', { propertyType: 'G', propertySubType: null, listPrice: 1.4 }),
  tile(9, 'Active Under Contract', { propertyType: 'G', propertySubType: null, listPrice: 2500 }),
]

/** What the homes block holds: the publicly active slice of the same population (listing_boundary_xref_mv). */
const HOMES_POPULATION = POPULATION.filter((t) => (PUBLIC_ACTIVE_STATUSES as string[]).includes(t.status))

// These tests import the page's atlas and component tree inside the test.
// Alone they take about 2 s; in a pre-commit run of 200+ test files on four
// cores the first import alone passed the default 5 s and the commit failed
// on time, not on a count (2026-09-30).
describe('the map and the homes under it count "for sale" the same way', { timeout: 30_000 }, () => {
  it('holds the map key and the homes block count equal over one population', async () => {
    const { atlasDotsFromTiles } = await import('@/lib/atlas/build-place-atlas')
    const { placeStockSectionsFromTiles } = await import('./place-inventory-stock')
    // The map reads the same listings as AtlasTiles (every fixture has a
    // coordinate, which is all AtlasTile narrows).
    const dots = atlasDotsFromTiles(POPULATION as unknown as Parameters<typeof atlasDotsFromTiles>[0], NOW)
    const mapForSale = dots.filter((d) => d.s === 'active').length
    const mapPending = dots.filter((d) => d.s === 'pending').length
    const rows = placeStockSectionsFromTiles(HOMES_POPULATION).flatMap((s) => s.rows)
    const homes = placeHomesCount(rows)
    expect(mapForSale).toBe(3)
    expect(homes.forSale).toBe(mapForSale)
    // Under contract in the homes block is the still-showing part of the map's pending.
    expect(homes.underContract).toBe(2)
    expect(mapPending).toBe(3)
    expect(homes.underContract).toBeLessThanOrEqual(mapPending)
    expect(placeHomesCountLabel(rows)).toBe('3 for sale · 2 under contract, still showing')
  })

  it('classifies every status the same way on a dot and on a count', async () => {
    const { dotStatus } = await import('@/lib/atlas/build-place-atlas')
    for (const status of ['Active', 'Active Under Contract', 'Pending', 'Closed', 'Coming Soon', 'Expired', '', null]) {
      const state = publicCountState(status)
      const dot = dotStatus(status)
      expect(dot === 'active').toBe(state === 'for-sale')
      expect(dot === 'pending').toBe(state === 'under-contract')
      expect(dot === 'sold').toBe(state === 'sold')
    }
  })

  it('heads each buyer group with the same words, and a card says "Under contract", not "Pending"', async () => {
    const { placeStockSectionsFromTiles } = await import('./place-inventory-stock')
    const sections = placeStockSectionsFromTiles(HOMES_POPULATION)
    const sfr = sections.find((s) => s.key === 'sfr')!
    expect(sfr.countLabel).toBe('3 for sale · 1 under contract, still showing')
    expect(sfr.rows.find((r) => r.listingKey === 'k-4')?.statusLabel).toBe('Under contract')
    expect(sections.find((s) => s.key === 'attached')?.countLabel).toBe('1 under contract, still showing')
  })

  it('holds the door over a neighborhood or plat equal to the single-family homes under it and to the map', async () => {
    // The door reads getNeighborhoodPublicInventory / getPlatPublicInventory:
    // single-family, publicly showing. Its "homes for sale" is Active only by
    // the same classifier, so over a population of single-family houses it
    // equals the house dial's for-sale count under the map and the map's
    // for-sale house marks (SITE-193). (On a live page the house dial also
    // takes manufactured homes, a wider set the neighborhood source names.)
    const { atlasDotsFromTiles } = await import('@/lib/atlas/build-place-atlas')
    const { placeStockSectionsFromTiles } = await import('./place-inventory-stock')
    const { rollupNeighborhoodPublicInventory } = await import('@/lib/data/geo/neighborhood-public-inventory')
    const { rollupPlatPublicInventory } = await import('@/lib/data/geo/plat-public-inventory')
    const { rollupPlatFamilyInventory } = await import('@/lib/data/subdivisions/getPlatFamilyInventory')
    const sfrRows = HOMES_POPULATION.filter(
      (t) => t.propertyType === 'A' && t.propertySubType === 'Single Family Residence',
    )
    const door = rollupNeighborhoodPublicInventory(
      sfrRows.map((t) => ({
        geo_slug: 'bend-awbrey-butte',
        listing_key: t.listingKey,
        list_price: t.listPrice,
        standard_status: t.status,
      })),
    ).find((r) => r.slug === 'awbrey-butte')!
    const plat = rollupPlatPublicInventory(
      sfrRows.map((t) => ({
        listing_key: t.listingKey,
        list_price: t.listPrice,
        subdivision_lower: 'ridge at eagle crest',
        city_lower: 'redmond',
        standard_status: t.status,
      })),
      [
        {
          slug: 'ridge-at-eagle-crest',
          name: 'Ridge At Eagle Crest',
          parent: 'Eagle Crest',
          parentSlug: 'eagle-crest',
          city: 'Redmond',
          citySlug: 'redmond',
        },
      ],
    )[0]!
    const family = rollupPlatFamilyInventory(
      sfrRows.map((t) => ({
        listing_key: t.listingKey,
        geo_slug: 'x-1',
        property_type: t.propertyType,
        property_sub_type: t.propertySubType,
        list_price: t.listPrice,
        standard_status: t.status,
      })),
      '2026-09-24T00:00:00.000Z',
    )
    const sfr = placeHomesCount(placeStockSectionsFromTiles(HOMES_POPULATION).find((s) => s.key === 'sfr')!.rows)
    const mapHouses = atlasDotsFromTiles(POPULATION as unknown as Parameters<typeof atlasDotsFromTiles>[0], NOW).filter(
      (d) => d.t === 'house' && d.s === 'active',
    ).length
    expect(sfr).toEqual({ forSale: 3, underContract: 1 })
    for (const counted of [door, plat, family]) {
      expect(counted.activeCount).toBe(sfr.forSale)
      expect(counted.underContractCount).toBe(sfr.underContract)
    }
    expect(mapHouses).toBe(sfr.forSale)
  })

  it('prints the same counts in the homes block a city or community page draws', async () => {
    const { placeStockSectionsFromTiles } = await import('./place-inventory-stock')
    const { PlaceSubdivisionHomes, PlaceSubdivisionMap } = await import(
      '@/components/site/v3/PlaceSubdivisionMap.client'
    )
    const rows = placeStockSectionsFromTiles(HOMES_POPULATION).flatMap((s) => s.rows)
    const html = renderToStaticMarkup(
      <PlaceSubdivisionMap placeName="Bend" rail={[]} homes={rows} keysBySlug={{}} source="regional MLS">
        <PlaceSubdivisionHomes id="homes" />
      </PlaceSubdivisionMap>,
    )
    expect(html).toContain('>3 for sale · 2 under contract, still showing<')
    expect(html).not.toContain('5 for sale')
  })
})

describe('placeHomesCountLabel', () => {
  it('never prints "0 for sale" and says nothing for no rows', () => {
    expect(placeHomesCountLabel([])).toBeNull()
    expect(placeHomesCountLabel([{ standardStatus: 'Active Under Contract' }])).toBe('1 under contract, still showing')
    expect(placeHomesCountLabel([{ standardStatus: 'Active' }, { standardStatus: null }])).toBe('2 for sale')
  })

  it('names the population when the page asks it to (Matt 2026-10-04)', () => {
    const rows = [{ standardStatus: 'Active' }, { standardStatus: 'Active Under Contract' }]
    expect(placeHomesCountLabel(rows, 'on the map')).toBe('1 for sale on the map · 1 under contract, still showing')
    expect(placeHomesCountLabel(rows)).toBe('1 for sale · 1 under contract, still showing')
  })
})
