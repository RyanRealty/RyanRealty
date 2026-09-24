import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Sold scope's tile reads order by the close date (Matt 2026-09-23): on a
 * sold view `newest` is most recently SOLD, `oldest` its mirror, price sorts
 * unchanged, and every for-sale scope keeps newest LISTED. This drives the two
 * listing_tile_mv actions a Sold search reaches (the split view's
 * getViewportListings and the ?view=map pins' getListingsForMap) and records
 * the sort each one hands the tile DAL.
 */
const { getListingTiles, getListingTilesOrThrow, getListingTilesCount, attachListingCardExtras } = vi.hoisted(() => ({
  // The map pins' read (getListingsForMap).
  getListingTiles: vi.fn(async (_filter: Record<string, unknown>) => [] as unknown[]),
  // The split view's read (getViewportListings): rejects on failure.
  getListingTilesOrThrow: vi.fn(async (_filter: Record<string, unknown>) => [] as unknown[]),
  getListingTilesCount: vi.fn(async () => 0),
  attachListingCardExtras: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/data', () => ({
  getListingTiles,
  getListingTilesOrThrow,
  getListingTilesCount,
  attachListingCardExtras,
  // app/actions/search.ts (getViewportSearch) imports these; the Sold scope never calls them.
  searchListingsAll: vi.fn(),
  searchListingsAllCount: vi.fn(),
  pickSearchFeatureFilters: () => ({}),
}))

const bounds = { west: -122, south: 43.5, east: -120.8, north: 44.6 }

async function viewportSortFor(statusFilter: 'closed' | 'active' | 'active_and_pending', sort?: string) {
  const { getViewportListings } = await import('./listings')
  getListingTilesOrThrow.mockClear()
  await getViewportListings({
    bounds,
    statusFilter,
    sort: sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | undefined,
  })
  expect(getListingTilesOrThrow).toHaveBeenCalledTimes(1)
  return getListingTilesOrThrow.mock.calls[0][0]
}

describe('getViewportListings (split view): the Sold scope sorts by the close date', () => {
  beforeEach(() => getListingTilesOrThrow.mockClear())

  it('newest on Sold is most recently sold; oldest is its mirror', async () => {
    expect((await viewportSortFor('closed', 'newest')).sort).toBe('close-newest')
    expect((await viewportSortFor('closed')).sort).toBe('close-newest')
    expect((await viewportSortFor('closed', 'oldest')).sort).toBe('close-oldest')
    expect((await viewportSortFor('closed', 'newest')).status).toBe('closed')
  })

  it('price sorts are the same on Sold as for sale', async () => {
    expect((await viewportSortFor('closed', 'price_asc')).sort).toBe('price-asc')
    expect((await viewportSortFor('closed', 'price_desc')).sort).toBe('price-desc')
    expect((await viewportSortFor('active', 'price_asc')).sort).toBe('price-asc')
  })

  it('for-sale scopes keep newest LISTED', async () => {
    expect((await viewportSortFor('active', 'newest')).sort).toBe('listed-newest')
    expect((await viewportSortFor('active_and_pending')).sort).toBe('listed-newest')
    expect((await viewportSortFor('active', 'oldest')).sort).toBe('listed-oldest')
  })
})

describe('getListingsForMap (?view=map pins): which homes make the pin cap', () => {
  it('Sold pins are the most recently sold; for-sale pins the newest listed', async () => {
    const { getListingsForMap } = await import('./listings')
    getListingTiles.mockClear()
    await getListingsForMap({ statusFilter: 'closed' })
    expect(getListingTiles.mock.calls[0][0]).toMatchObject({ status: 'closed', sort: 'close-newest' })
    getListingTiles.mockClear()
    await getListingsForMap({ statusFilter: 'active' })
    expect(getListingTiles.mock.calls[0][0]).toMatchObject({ status: 'active', sort: 'listed-newest' })
  })

  it('the sort the map view names decides the pins, on either scope', async () => {
    const { getListingsForMap } = await import('./listings')
    getListingTiles.mockClear()
    await getListingsForMap({ statusFilter: 'closed', sort: 'price_desc' })
    expect(getListingTiles.mock.calls[0][0]).toMatchObject({ status: 'closed', sort: 'price-desc' })
    getListingTiles.mockClear()
    await getListingsForMap({ statusFilter: 'active', sort: 'year_newest' })
    expect(getListingTiles.mock.calls[0][0]).toMatchObject({ status: 'active', sort: 'year-newest' })
  })
})

describe('the Sold split view is in the order its menu names (2026-09-24)', () => {
  it('price per sq ft and year built reach the tile read as themselves, not as "Recently sold"', async () => {
    expect((await viewportSortFor('closed', 'price_per_sqft_asc')).sort).toBe('ppsf-asc')
    expect((await viewportSortFor('closed', 'price_per_sqft_desc')).sort).toBe('ppsf-desc')
    expect((await viewportSortFor('closed', 'year_newest')).sort).toBe('year-newest')
    expect((await viewportSortFor('closed', 'year_oldest')).sort).toBe('year-oldest')
  })

  it('getViewportSearch hands the Sold read the search sort unchanged', async () => {
    const { getViewportSearch } = await import('./search')
    for (const [sort, tileSort] of [
      ['price_per_sqft_desc', 'ppsf-desc'],
      ['year_oldest', 'year-oldest'],
      ['priceAsc', 'price-asc'],
      ['oldest', 'close-oldest'],
      [undefined, 'close-newest'],
    ] as const) {
      getListingTilesOrThrow.mockClear()
      await getViewportSearch({ status: 'Sold', sort }, bounds, null)
      expect(getListingTilesOrThrow.mock.calls[0][0]).toMatchObject({ status: 'closed', sort: tileSort })
    }
  })
})

describe('the split view answers inside its budget; a count it could not wait for is a floor', () => {
  const tiles = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ listingKey: `K${i}`, listNumber: `L${i}`, status: 'Closed' }))

  afterEach(() => {
    vi.useRealTimers()
    getListingTilesCount.mockReset()
    getListingTilesCount.mockImplementation(async () => 0)
  })

  it('the exact count, when it comes back, is the count', async () => {
    const { getViewportListings } = await import('./listings')
    getListingTilesOrThrow.mockImplementationOnce(async () => tiles(501))
    getListingTilesCount.mockImplementationOnce(async () => 177_269)
    const res = await getViewportListings({ bounds, statusFilter: 'closed' })
    expect(res).toMatchObject({ totalCount: 177_269, capped: false, countIsExact: true })
    expect(res.listings).toHaveLength(500)
  })

  it('a count that has not come back by the answer time leaves a floor, flagged as one', async () => {
    vi.useFakeTimers()
    const { getViewportListings } = await import('./listings')
    getListingTilesOrThrow.mockImplementationOnce(async () => tiles(501))
    getListingTilesCount.mockImplementationOnce(() => new Promise<number>(() => {}))
    const pending = getViewportListings({ bounds, statusFilter: 'closed' })
    await vi.advanceTimersByTimeAsync(3_000)
    const res = await pending
    // 501 rows are in hand, so "at least 501" is true; it is never shown as a count.
    expect(res).toMatchObject({ totalCount: 501, capped: true, countIsExact: false })
  })

  it('a frame that fits under the cap needs no count and is exact', async () => {
    const { getViewportListings } = await import('./listings')
    getListingTilesOrThrow.mockImplementationOnce(async () => tiles(12))
    getListingTilesCount.mockClear()
    const res = await getViewportListings({ bounds, statusFilter: 'closed' })
    expect(getListingTilesCount).not.toHaveBeenCalled()
    expect(res).toMatchObject({ totalCount: 12, capped: false, countIsExact: true })
  })

  it('a row read that fails rejects, so the view says "Search delayed", never "0 homes"', async () => {
    const { getViewportListings } = await import('./listings')
    const { getViewportSearch } = await import('./search')
    const timeout = async () => {
      throw new Error('[getListingTiles] supabase error: canceling statement due to statement timeout')
    }
    getListingTilesOrThrow.mockImplementationOnce(timeout)
    await expect(getViewportListings({ bounds, statusFilter: 'closed' })).rejects.toThrow('statement timeout')
    getListingTilesOrThrow.mockImplementationOnce(timeout)
    await expect(getViewportSearch({ status: 'Sold' }, bounds, null)).rejects.toThrow('statement timeout')
  })
})

describe('a shape drawn on the Sold split view: the in-shape count is exact only over a whole read', () => {
  // Every tile sits in the west half of `bounds`; the shape covers that half.
  const westTiles = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      listingKey: `K${i}`,
      listNumber: `L${i}`,
      status: 'Closed',
      lat: 44.0 + (i % 50) / 1000,
      lng: -121.8 + (i % 50) / 1000,
    }))
  const westHalf = {
    include: [
      {
        type: 'polygon' as const,
        coords: [
          [-122, 43.5],
          [-121.4, 43.5],
          [-121.4, 44.6],
          [-122, 44.6],
        ] as [number, number][],
      },
    ],
  }

  afterEach(() => {
    getListingTilesCount.mockReset()
    getListingTilesCount.mockImplementation(async () => 0)
  })

  it('the bbox read held every row: the in-shape count is the count', async () => {
    const { getViewportSearch } = await import('./search')
    getListingTilesOrThrow.mockImplementationOnce(async () => westTiles(40))
    const res = await getViewportSearch({ status: 'Sold' }, bounds, westHalf)
    expect(res).toMatchObject({ totalCount: 40, capped: false, countIsExact: true })
  })

  it('the bbox read stopped at the cap: the in-shape count is a floor, even with the bbox count in hand', async () => {
    const { getViewportSearch } = await import('./search')
    getListingTilesOrThrow.mockImplementationOnce(async () => westTiles(501))
    // The bbox's exact count came back (so getViewportListings says capped:
    // false), but only 500 of its 2,000 rows were read.
    getListingTilesCount.mockImplementationOnce(async () => 2_000)
    const res = await getViewportSearch({ status: 'Sold' }, bounds, westHalf)
    expect(res.listings).toHaveLength(500)
    expect(res).toMatchObject({ totalCount: 500, capped: true, countIsExact: false })
  })
})
