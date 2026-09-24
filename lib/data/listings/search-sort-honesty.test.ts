import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A sort menu may only name an order the list is in (2026-09-24). Checked on
 * the PostgREST reads each DAL actually sends:
 *
 *  1. The tile read (listing_tile_mv: the Sold split view, the map pins)
 *     honors every search sort. Price per sq ft orders by price_per_sqft; it
 *     used to fall back to "Recently sold" while the menu named $/sq ft.
 *  2. Year built sorts placeholder years (0, 9999 in the MLS feed) with the
 *     unknown ones, last, on both the tile read and listing_search_mv (the
 *     for-sale split view), as search_listings_advanced always has: two ranged
 *     reads, plausible years in year order, then the rest by listing_key.
 */

type Response = { data?: Record<string, unknown>[] | null; count?: number | null }
type Query = { calls: [string, unknown[]][] }

const state = vi.hoisted(() => ({
  queries: [] as { calls: [string, unknown[]][] }[],
  responses: [] as { data?: Record<string, unknown>[] | null; count?: number | null }[],
}))

vi.mock('next/cache', () => ({
  unstable_cache: <A extends unknown[], T>(fn: (...args: A) => Promise<T>) => fn,
}))

vi.mock('@/lib/data/client', () => {
  // One recorded, chainable PostgREST stand-in per from(); awaiting it yields
  // the next queued response (rows and count).
  const newBuilder = (query: Query): object => {
    const builder: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const next: Response = state.responses.shift() ?? { data: [], count: 0 }
            const data = next.data ?? []
            return (resolve: (v: { data: unknown; count: number; error: null }) => unknown) =>
              Promise.resolve({ data, count: next.count ?? data.length, error: null }).then(resolve)
          }
          return (...args: unknown[]) => {
            query.calls.push([String(prop), args])
            return builder
          }
        },
      },
    )
    return builder
  }
  return {
    supabaseAnon: () => ({
      from: (table: string) => {
        const query: Query = { calls: [['from', [table]]] }
        state.queries.push(query)
        return newBuilder(query)
      },
    }),
  }
})

import { getListingTiles } from './getListingTiles'
import { searchListingsAll } from './searchListingsAll'
import { YEAR_BUILT_UNKNOWN_OR } from '@/lib/search/search-sort-order'

const bbox = { west: -122, south: 43, east: -120, north: 45 }
const ordersOf = (q: Query) => q.calls.filter(([m]) => m === 'order').map(([, a]) => a)
const callsOf = (q: Query, method: string) => q.calls.filter(([m]) => m === method).map(([, a]) => a)

const tile = (listing_key: string, year_built: number | null, price_per_sqft: number | null = null) => ({
  listing_key,
  standard_status: 'Closed',
  year_built,
  price_per_sqft,
  close_date: '2026-09-01T00:00:00+00:00',
})

beforeEach(() => {
  state.queries.length = 0
  state.responses.length = 0
})

describe('the tile read honors every search sort', () => {
  it('price per sq ft orders by price_per_sqft, nulls last, then listing_key', async () => {
    await getListingTiles({ status: 'closed', sort: 'ppsf-asc', bbox })
    expect(ordersOf(state.queries[0])).toEqual([
      ['price_per_sqft', { ascending: true, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
    state.queries.length = 0
    await getListingTiles({ status: 'closed', sort: 'ppsf-desc', bbox })
    expect(ordersOf(state.queries[0])[0]).toEqual(['price_per_sqft', { ascending: false, nullsFirst: false }])
  })

  it('year built reads plausible years in year order, then fills the page with the unknown ones', async () => {
    state.responses.push(
      { data: [tile('K-2024', 2024), tile('K-1998', 1998)] },
      { data: [tile('K-A-9999', 9999), tile('K-B-NULL', null), tile('K-C-0', 0)] },
    )
    const rows = await getListingTiles({ status: 'closed', sort: 'year-newest', bbox, limit: 5 })
    expect(rows.map((t) => t.listingKey)).toEqual(['K-2024', 'K-1998', 'K-A-9999', 'K-B-NULL', 'K-C-0'])

    const [plausible, unknown] = state.queries
    expect(callsOf(plausible, 'gte')).toContainEqual(['year_built', 1700])
    expect(callsOf(plausible, 'lte')).toContainEqual(['year_built', 2100])
    expect(ordersOf(plausible)).toEqual([
      ['year_built', { ascending: false, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
    expect(callsOf(plausible, 'range')).toEqual([[0, 4]])

    expect(callsOf(unknown, 'or')).toEqual([[YEAR_BUILT_UNKNOWN_OR]])
    expect(ordersOf(unknown)).toEqual([['listing_key', { ascending: true, nullsFirst: false }]])
    // Two plausible rows in hand: the unknown half supplies the other three.
    expect(callsOf(unknown, 'range')).toEqual([[0, 2]])
  })

  it('a full first page needs no second read', async () => {
    state.responses.push({ data: [tile('K1', 2001), tile('K2', 2000)] })
    await getListingTiles({ status: 'closed', sort: 'year-oldest', bbox, limit: 2 })
    expect(state.queries).toHaveLength(1)
    expect(ordersOf(state.queries[0])[0]).toEqual(['year_built', { ascending: true, nullsFirst: false }])
  })

  it('a page past the plausible years counts them to find where the unknown half starts', async () => {
    // offset 10: the plausible read comes back empty, the head count says 7
    // plausible homes exist, so this page is unknown-year homes 3..7.
    state.responses.push({ data: [] }, { data: [], count: 7 }, { data: [tile('K-X', null)] })
    await getListingTiles({ status: 'closed', sort: 'year-newest', bbox, limit: 5, offset: 10 })
    const [, count, unknown] = state.queries
    expect(callsOf(count, 'select')[0]).toEqual(['listing_key', { count: 'exact', head: true }])
    expect(callsOf(count, 'gte')).toContainEqual(['year_built', 1700])
    expect(callsOf(unknown, 'range')).toEqual([[3, 7]])
  })

  it('a year-built filter keeps the placeholder years it admits: "1990 or later" still ends with a 9999', async () => {
    // The count (no plausible window) counts the 9999 home, so the rows must hold it.
    state.responses.push({ data: [tile('K1', 2001)] }, { data: [tile('K-9999', 9999)] })
    const rows = await getListingTiles({ status: 'closed', sort: 'year-newest', bbox, limit: 5, yearBuiltMin: 1990 })
    expect(rows.map((t) => t.listingKey)).toEqual(['K1', 'K-9999'])
    const [plausible, unknown] = state.queries
    expect(callsOf(plausible, 'gte')).toContainEqual(['year_built', 1990])
    expect(callsOf(unknown, 'gte')).toContainEqual(['year_built', 1990])
    expect(callsOf(unknown, 'or')).toEqual([[YEAR_BUILT_UNKNOWN_OR]])
  })

  it('a chunked read (over 300 keys) sinks placeholder years in the union too', async () => {
    const keys = Array.from({ length: 301 }, (_, i) => `K${String(i).padStart(3, '0')}`)
    state.responses.push(
      { data: [tile('K-9999', 9999), tile('K-2010', 2010)] },
      { data: [tile('K-0', 0), tile('K-2020', 2020)] },
    )
    const rows = await getListingTiles({ status: 'closed', sort: 'year-newest', listingKeys: keys, limit: 10 })
    expect(rows.map((t) => t.listingKey)).toEqual(['K-2020', 'K-2010', 'K-0', 'K-9999'])
  })
})

describe('listing_search_mv (the for-sale split and list) sorts year built the same way', () => {
  it('two ranged reads, each with its exact count; the total is both', async () => {
    state.responses.push(
      { data: [tile('K-2019', 2019)], count: 1 },
      { data: [tile('K-9999', 9999), tile('K-NULL', null)], count: 40 },
    )
    const result = await searchListingsAll({ status: 'active', sort: 'year_newest', bbox, limit: 3 })
    expect(result.rows.map((t) => t.listingKey)).toEqual(['K-2019', 'K-9999', 'K-NULL'])
    expect(result.totalCount).toBe(41)

    const [plausible, unknown] = state.queries
    expect(callsOf(plausible, 'gte')).toContainEqual(['year_built', 1700])
    expect(callsOf(plausible, 'lte')).toContainEqual(['year_built', 2100])
    expect(ordersOf(plausible)).toEqual([
      ['year_built', { ascending: false, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
    expect(callsOf(unknown, 'or')).toContainEqual([YEAR_BUILT_UNKNOWN_OR])
    expect(callsOf(unknown, 'range')).toEqual([[0, 1]])
  })

  it('a page the plausible years fill still counts the unknown half, head-only', async () => {
    state.responses.push(
      { data: [tile('K1', 2020), tile('K2', 2019)], count: 90 },
      { data: [], count: 12 },
    )
    const result = await searchListingsAll({ status: 'active', sort: 'year_oldest', bbox, limit: 2 })
    expect(result.totalCount).toBe(102)
    const unknown = state.queries[1]
    expect(callsOf(unknown, 'select')[0]).toEqual(['listing_key', { count: 'exact', head: true }])
    expect(callsOf(unknown, 'range')).toEqual([])
  })

  it('every other sort is still one read', async () => {
    state.responses.push({ data: [tile('K1', 2020)], count: 1 })
    await searchListingsAll({ status: 'active', sort: 'price_per_sqft_desc', bbox, limit: 2 })
    expect(state.queries).toHaveLength(1)
  })
})
