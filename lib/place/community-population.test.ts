import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AtlasTile, ListingTile } from '@/lib/data'

const getCommunityBySlug = vi.fn()
const getCommunityListings = vi.fn()
const getGeoBoundaryMapData = vi.fn()
const getListingTiles = vi.fn()
const fetchAllCityActiveSfr = vi.fn()
const loadPlaceStockTiles = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/app/actions/communities', () => ({
  getCommunityBySlug: (...args: unknown[]) => getCommunityBySlug(...args),
  getCommunityListings: (...args: unknown[]) => getCommunityListings(...args),
}))
vi.mock('@/lib/data', () => ({
  getGeoBoundaryMapData: (...args: unknown[]) => getGeoBoundaryMapData(...args),
  getListingTiles: (...args: unknown[]) => getListingTiles(...args),
  getAtlasTiles: vi.fn(),
}))
vi.mock('@/lib/kb/city-active-sfr', () => ({
  fetchAllCityActiveSfr: (...args: unknown[]) => fetchAllCityActiveSfr(...args),
}))
vi.mock('@/lib/place/place-inventory-stock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/place/place-inventory-stock')>()),
  loadPlaceStockTiles: (...args: unknown[]) => loadPlaceStockTiles(...args),
}))
// The trust rule reads the baseline; here Widgi Creek's outline awaits correction.
vi.mock('@/data/boundary-sanity-baseline.json', () => ({ default: { allowed: ['widgi-creek'] } }))

const NOW = Date.parse('2026-09-25T12:00:00Z')

/** A square outline around (-121.30, 44.05). */
const OUTLINE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-121.31, 44.04], [-121.29, 44.04], [-121.29, 44.06], [-121.31, 44.06], [-121.31, 44.04]]],
}
const INSIDE = { lat: 44.05, lng: -121.3 }
const OUTSIDE = { lat: 44.2, lng: -121.1 }

function tile(key: string, over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: key,
    listNumber: `2200${key}`,
    status: 'Active',
    listPrice: 850_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    streetNumber: '1',
    streetName: `Test ${key}`,
    streetSuffix: 'Dr',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97702',
    subdivisionName: 'Broken Top',
    subdivisionSlug: 'broken-top',
    ...INSIDE,
    photoUrl: null,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: '2026-09-01',
    modifiedAt: '2026-09-20',
    pricePerSqft: 425,
    lotSizeAcres: null,
    yearBuilt: 2001,
    garageSpaces: 2,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 10,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...over,
  } as ListingTile
}

function atlasTile(key: string, over: Partial<AtlasTile> = {}): AtlasTile {
  return {
    listingKey: key,
    listNumber: null,
    status: 'Active',
    listPrice: 700_000,
    closePrice: null,
    closeDate: null,
    onMarketDate: '2026-09-01',
    modifiedAt: '2026-09-20',
    ...INSIDE,
    city: 'Bend',
    subdivisionName: null,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    streetNumber: '9',
    streetName: `Read ${key}`,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    ...over,
  } as AtlasTile
}

beforeEach(() => {
  for (const fn of [getCommunityBySlug, getCommunityListings, getGeoBoundaryMapData, getListingTiles, fetchAllCityActiveSfr, loadPlaceStockTiles]) {
    fn.mockReset()
  }
  getCommunityListings.mockResolvedValue([])
  getListingTiles.mockResolvedValue([])
  fetchAllCityActiveSfr.mockResolvedValue([])
  loadPlaceStockTiles.mockResolvedValue([])
  getGeoBoundaryMapData.mockResolvedValue({ polygon: OUTLINE, pins: [] })
})

describe('THE SWITCH: communityPopulationPlan', () => {
  it('is recorded plats only by default (Matt 2026-09-25)', async () => {
    const { COMMUNITY_FOR_SALE_SCOPE } = await import('./community-population')
    expect(COMMUNITY_FOR_SALE_SCOPE).toBe('outline')
  })

  it('outline plus MLS names (the pre-2026-09-25 homes list) reads both parts', async () => {
    const { communityPopulationPlan } = await import('./community-population')
    expect(communityPopulationPlan({ scope: 'outline-and-mls-names', outlineTrusted: true, fieldFromOutline: false })).toEqual({
      readOutline: true,
      includeNames: true,
      includeField: true,
    })
  })

  it('outline only drops the MLS names and a name-derived Field', async () => {
    const { communityPopulationPlan } = await import('./community-population')
    expect(communityPopulationPlan({ scope: 'outline', outlineTrusted: true, fieldFromOutline: false })).toEqual({
      readOutline: true,
      includeNames: false,
      includeField: false,
    })
    // A Field built from the outline's own pins IS the outline.
    expect(communityPopulationPlan({ scope: 'outline', outlineTrusted: true, fieldFromOutline: true }).includeField).toBe(true)
  })

  it('a community with no trusted outline is counted by its names under either setting', async () => {
    const { communityPopulationPlan } = await import('./community-population')
    for (const scope of ['outline', 'outline-and-mls-names'] as const) {
      expect(communityPopulationPlan({ scope, outlineTrusted: false, fieldFromOutline: false })).toEqual({
        readOutline: false,
        includeNames: true,
        includeField: true,
      })
    }
  })
})

describe('for sale is status Active, a sale', () => {
  it('keeps Active sales and drops under contract, pending and commercial leases', async () => {
    const { communityForSaleKeys } = await import('./community-population')
    const keys = communityForSaleKeys([
      tile('a'),
      tile('auc', { status: 'Active Under Contract' }),
      tile('p', { status: 'Pending' }),
      tile('lease', { propertyType: 'G', propertySubType: 'Commercial Lease' }),
      tile('a'),
    ])
    expect(keys).toEqual(['a'])
  })

  it('draws only on-market listings that have a coordinate', async () => {
    const { communityAtlasTiles } = await import('./community-population')
    const drawn = communityAtlasTiles([
      tile('a'),
      tile('auc', { status: 'Active Under Contract' }),
      tile('closed', { status: 'Closed' }),
      tile('nocoord', { lat: null, lng: null }),
    ])
    expect(drawn.map((t) => t.listingKey)).toEqual(['a', 'auc'])
    expect(drawn[0]).toMatchObject({ lat: INSIDE.lat, lng: INSIDE.lng, status: 'Active', listPrice: 850_000 })
  })
})

describe('the map and the homes list count ONE population', () => {
  /**
   * The fixture is Broken Top's shape: listings inside the recorded outline,
   * one the MLS files under the community's name just outside it, one under
   * contract, one lease, and a Pending and a close that only the boundary's own
   * read carries. The map's "for sale" (the Atlas's active dots) and the homes
   * list's for-sale rows must be the same keys.
   */
  async function counts(population: ListingTile[], boundaryRead: AtlasTile[], opts: { samePopulation: boolean }) {
    const { communityAtlasTiles, communityForSaleKeys } = await import('./community-population')
    const { atlasScopeTiles, atlasDotsFromTiles } = await import('@/lib/atlas/build-place-atlas')
    const { placeStockSectionsFromTiles } = await import('@/lib/place/place-inventory-stock')
    const scope = opts.samePopulation
      ? { boundary: OUTLINE, onMarket: communityAtlasTiles(population) }
      : { boundary: OUTLINE }
    const { tiles } = atlasScopeTiles(boundaryRead, scope)
    const mapForSale = atlasDotsFromTiles(tiles, NOW).filter((d) => d.s === 'active').map((d) => d.k).sort()
    const byKey = new Map(population.map((t) => [t.listingKey, t]))
    const homesForSale = placeStockSectionsFromTiles(population)
      .flatMap((section) => section.rows)
      .filter((row) => byKey.get(row.listingKey)?.status === 'Active')
      .map((row) => row.listingKey)
      .sort()
    return { mapForSale, homesForSale, forSaleKeys: communityForSaleKeys(population).sort() }
  }

  const population = [
    tile('in-1'),
    tile('in-2', { propertySubType: 'Townhouse' }),
    tile('name-outside', { ...OUTSIDE }),
    tile('auc', { status: 'Active Under Contract' }),
    tile('lease', { propertyType: 'G', propertySubType: 'Commercial Lease' }),
  ]
  // What the Atlas read of the cities holds inside and around the outline.
  const boundaryRead = [
    atlasTile('in-1'),
    atlasTile('in-2', { propertySubType: 'Townhouse' }),
    atlasTile('neighbour-inside-not-listed'),
    atlasTile('pending-inside', { status: 'Pending' }),
    atlasTile('closed-inside', { status: 'Closed', closePrice: 690_000, closeDate: '2026-09-20T00:00:00Z' }),
    atlasTile('name-outside', { ...OUTSIDE }),
  ]

  it('prints the same for-sale count on the map and over the homes, from the same keys', async () => {
    const { mapForSale, homesForSale, forSaleKeys } = await counts(population, boundaryRead, { samePopulation: true })
    expect(mapForSale).toEqual(['in-1', 'in-2', 'name-outside'])
    expect(homesForSale).toEqual(mapForSale)
    expect(forSaleKeys).toEqual(mapForSale)
  })

  it('a community with no outline draws its map from the same keys: keyed scope plus the population', async () => {
    const { communityAtlasTiles } = await import('./community-population')
    const { atlasScopeTiles, atlasDotsFromTiles } = await import('@/lib/atlas/build-place-atlas')
    const named = [tile('mbv-1'), tile('mbv-2', { ...OUTSIDE }), tile('mbv-auc', { status: 'Active Under Contract' })]
    const onMarket = communityAtlasTiles(named)
    const read = [atlasTile('mbv-1'), atlasTile('not-listed'), atlasTile('mbv-2', { ...OUTSIDE })]
    const { tiles } = atlasScopeTiles(read, { listingKeys: onMarket.map((t) => t.listingKey), onMarket })
    const mapForSale = atlasDotsFromTiles(tiles, NOW).filter((d) => d.s === 'active').map((d) => d.k).sort()
    expect(mapForSale).toEqual(['mbv-1', 'mbv-2'])
  })

  it('FAILS when the map draws the boundary while the homes list reads the population (the pre-2026-09-25 page)', async () => {
    const { mapForSale, homesForSale } = await counts(population, boundaryRead, { samePopulation: false })
    expect(mapForSale).not.toEqual(homesForSale)
  })

  it('keeps the boundary\'s own pending and closes on the map, and never draws a listing twice', async () => {
    const { communityAtlasTiles } = await import('./community-population')
    const { atlasScopeTiles } = await import('@/lib/atlas/build-place-atlas')
    // The read holds in-1 as Pending (stale); the population's copy wins.
    const read = [...boundaryRead, atlasTile('in-1', { status: 'Pending' })]
    const { tiles, outside } = atlasScopeTiles(read, { boundary: OUTLINE, onMarket: communityAtlasTiles(population) })
    const keys = tiles.map((t) => t.listingKey)
    expect(keys.filter((k) => k === 'in-1')).toHaveLength(1)
    expect(tiles.find((t) => t.listingKey === 'in-1')?.status).toBe('Active')
    expect(keys).toContain('pending-inside')
    expect(keys).toContain('closed-inside')
    expect(keys).not.toContain('neighbour-inside-not-listed')
    expect(outside).toBe(1)
  })
})

describe('getCommunityPopulation: keying and trust', () => {
  it('reads Juniper Preserve\'s outline from the row stored as pronghorn, for the map and the homes alike', async () => {
    getCommunityBySlug.mockResolvedValue({ city: 'Bend', citySlug: 'bend', subdivision: 'Pronghorn', name: 'Pronghorn' })
    getGeoBoundaryMapData.mockResolvedValue({ polygon: OUTLINE, pins: [{ listingKey: 'pin-1' }] })
    loadPlaceStockTiles.mockResolvedValue([tile('pin-1', { subdivisionName: 'Pronghorn' })])
    const { getCommunityPopulation } = await import('./community-population')
    const population = await getCommunityPopulation('juniper-preserve')
    expect(getGeoBoundaryMapData).toHaveBeenCalledWith({ geoType: 'neighborhood', geoSlug: 'pronghorn' })
    expect(loadPlaceStockTiles.mock.calls[0]?.[0]).toMatchObject({
      boundary: { geoType: 'neighborhood', geoSlug: 'pronghorn' },
    })
    expect(loadPlaceStockTiles.mock.calls[0]?.[0].listingKeys).toContain('pin-1')
    expect(population?.outlineSlug).toBe('pronghorn')
    expect(population?.outline).toEqual(OUTLINE)
    expect(population?.forSaleKeys).toEqual(['pin-1'])
    expect(population?.atlasTiles.map((t) => t.listingKey)).toEqual(['pin-1'])
    expect(population?.complete).toBe(true)
  })

  it('an untrusted outline is read by nothing: no map, no outline keys in the homes list', async () => {
    getCommunityBySlug.mockResolvedValue({ city: 'Bend', citySlug: 'bend', subdivision: 'Widgi Creek', name: 'Widgi Creek' })
    const { getCommunityPopulation } = await import('./community-population')
    const population = await getCommunityPopulation('widgi-creek')
    expect(getGeoBoundaryMapData).not.toHaveBeenCalled()
    const stock = loadPlaceStockTiles.mock.calls[0]?.[0]
    expect(stock.boundary).toBeNull()
    expect(stock.subdivisionNames).toEqual(expect.arrayContaining(['Widgi Creek', 'PointsWest', 'Elkai Woods', 'Milepost 1']))
    expect(population?.outline).toBeNull()
    expect(population?.outlineTrusted).toBe(false)
  })

  it('with a trusted outline the default reads the outline alone; the name-inclusive scope adds the names', async () => {
    getCommunityBySlug.mockResolvedValue({ city: 'Bend', citySlug: 'bend', subdivision: 'Broken Top', name: 'Broken Top' })
    getGeoBoundaryMapData.mockResolvedValue({ polygon: OUTLINE, pins: [{ listingKey: 'in-1' }] })
    fetchAllCityActiveSfr.mockResolvedValue([tile('in-1'), tile('name-outside', { ...OUTSIDE })])
    const { getCommunityPopulation } = await import('./community-population')

    const recorded = await getCommunityPopulation('broken-top')
    const outlineOnly = loadPlaceStockTiles.mock.calls[0]?.[0]
    expect(outlineOnly.subdivisionNames).toEqual([])
    expect(outlineOnly.listingKeys).toEqual(['in-1'])
    expect(outlineOnly.boundary).toEqual({ geoType: 'neighborhood', geoSlug: 'broken-top' })
    expect(recorded?.countsMlsNames).toBe(false)
    // The alias-aware Field is still measured (the page's knowledge rows read
    // it) but it is not listed.
    expect(recorded?.aliasAwareCount).toBe(2)

    loadPlaceStockTiles.mockClear()
    const named = await getCommunityPopulation('broken-top', 'outline-and-mls-names')
    const both = loadPlaceStockTiles.mock.calls[0]?.[0]
    expect(both.subdivisionNames).toContain('Broken Top')
    expect(both.listingKeys).toEqual(expect.arrayContaining(['in-1', 'name-outside']))
    expect(both.boundary).toEqual({ geoType: 'neighborhood', geoSlug: 'broken-top' })
    expect(named?.countsMlsNames).toBe(true)
  })

  it('a community with no outline row is counted by its MLS names, and says so', async () => {
    getCommunityBySlug.mockResolvedValue({ city: 'Bend', citySlug: 'bend', subdivision: 'Mt Bachelor Village', name: 'Mt Bachelor Village' })
    getGeoBoundaryMapData.mockResolvedValue({ polygon: null, pins: [] })
    loadPlaceStockTiles.mockResolvedValue([tile('mbv-1', { subdivisionName: 'Mt Bachelor Village' })])
    const { getCommunityPopulation } = await import('./community-population')
    const population = await getCommunityPopulation('mt-bachelor-village')
    const stock = loadPlaceStockTiles.mock.calls[0]?.[0]
    expect(stock.boundary).toBeNull()
    expect(stock.subdivisionNames).toContain('Mt Bachelor Village')
    expect(population?.outline).toBeNull()
    expect(population?.countsMlsNames).toBe(true)
    expect(population?.forSaleKeys).toEqual(['mbv-1'])
    expect(population?.atlasTiles.map((t) => t.listingKey)).toEqual(['mbv-1'])
  })

  it('a read that times out marks the population incomplete, never empty-and-complete', async () => {
    vi.useFakeTimers()
    try {
      getCommunityBySlug.mockResolvedValue({ city: 'Bend', citySlug: 'bend', subdivision: 'Broken Top', name: 'Broken Top' })
      loadPlaceStockTiles.mockReturnValue(new Promise(() => {}))
      const { getCommunityPopulation } = await import('./community-population')
      const pending = getCommunityPopulation('broken-top')
      await vi.advanceTimersByTimeAsync(60_000)
      const population = await pending
      expect(population?.complete).toBe(false)
      expect(population?.tiles).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a slug that names no community has no population', async () => {
    getCommunityBySlug.mockResolvedValue(null)
    const { getCommunityPopulation } = await import('./community-population')
    expect(await getCommunityPopulation('no-such-place')).toBeNull()
  })
})
