import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Sold scope's tile reads order by the close date (Matt 2026-09-23): on a
 * sold view `newest` is most recently SOLD, `oldest` its mirror, price sorts
 * unchanged, and every for-sale scope keeps newest LISTED. This drives the two
 * listing_tile_mv actions a Sold search reaches (the split view's
 * getViewportListings and the ?view=map pins' getListingsForMap) and records
 * the sort each one hands the tile DAL.
 */
const { getListingTiles, getListingTilesCount, attachListingCardExtras } = vi.hoisted(() => ({
  getListingTiles: vi.fn(async (_filter: Record<string, unknown>) => [] as unknown[]),
  getListingTilesCount: vi.fn(async () => 0),
  attachListingCardExtras: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/data', () => ({
  getListingTiles,
  getListingTilesCount,
  attachListingCardExtras,
}))

const bounds = { west: -122, south: 43.5, east: -120.8, north: 44.6 }

async function viewportSortFor(statusFilter: 'closed' | 'active' | 'active_and_pending', sort?: string) {
  const { getViewportListings } = await import('./listings')
  getListingTiles.mockClear()
  await getViewportListings({
    bounds,
    statusFilter,
    sort: sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | undefined,
  })
  expect(getListingTiles).toHaveBeenCalledTimes(1)
  return getListingTiles.mock.calls[0][0]
}

describe('getViewportListings (split view): the Sold scope sorts by the close date', () => {
  beforeEach(() => getListingTiles.mockClear())

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
})
