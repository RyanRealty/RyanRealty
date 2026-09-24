import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Two date rules of the search DAL (Matt 2026-09-23), checked on the PostgREST
 * calls each read actually sends:
 *
 *  1. The Sold scope sorts by the close date: getListingTiles 'close-newest' =
 *     close_date DESC NULLS LAST, 'close-oldest' its mirror, both then
 *     listing_key ASC; and the Node comparator that orders a chunked
 *     (> 300 key) union agrees.
 *  2. "New in the last N days" means newly LISTED: domMax (getListingTiles)
 *     and the registry `dom` range (searchListingsAll) filter
 *     on_market_date >= now - N days, never `dom <= N` (dom is
 *     listings."DaysOnMarket", frozen at the row's last sync).
 */
type Call = [string, unknown[]]

const state = vi.hoisted(() => ({
  calls: [] as [string, unknown[]][],
  rows: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({
  unstable_cache: <A extends unknown[], T>(fn: (...args: A) => Promise<T>) => fn,
}))

vi.mock('@/lib/data/client', () => {
  // A chainable stand-in for the PostgREST builder: every method is recorded
  // and returns the builder; awaiting it yields the queued rows.
  const builder: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; count: number; error: null }) => unknown) =>
            Promise.resolve({ data: state.rows, count: state.rows.length, error: null }).then(resolve)
        }
        return (...args: unknown[]) => {
          state.calls.push([String(prop), args])
          return builder
        }
      },
    },
  )
  return { supabaseAnon: () => ({ from: () => builder }) }
})

import { getListingTiles } from './getListingTiles'
import { searchListingsAll } from './searchListingsAll'
import { listedWithinDaysCutoff } from './searchPredicates'

const bbox = { west: -122, south: 43, east: -120, north: 45 }
const orders = () => state.calls.filter(([m]) => m === 'order').map(([, args]) => args)
const onColumn = (column: string) => state.calls.filter(([, args]) => args[0] === column)

const row = (listing_key: string, close_date: string | null) => ({
  listing_key,
  standard_status: 'Closed',
  close_date,
  on_market_date: '2026-01-01T00:00:00+00:00',
})

beforeEach(() => {
  state.calls.length = 0
  state.rows = []
})

describe('getListingTiles close-date sorts (Sold scope)', () => {
  it('close-newest orders by close_date DESC NULLS LAST, then listing_key', async () => {
    await getListingTiles({ status: 'closed', sort: 'close-newest', bbox })
    expect(orders()).toEqual([
      ['close_date', { ascending: false, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
  })

  it('close-oldest is its mirror', async () => {
    await getListingTiles({ status: 'closed', sort: 'close-oldest', bbox })
    expect(orders()).toEqual([
      ['close_date', { ascending: true, nullsFirst: false }],
      ['listing_key', { ascending: true, nullsFirst: false }],
    ])
  })

  it('a chunked read (over 300 keys) orders the union the same way', async () => {
    const keys = Array.from({ length: 301 }, (_, i) => `K${String(i).padStart(3, '0')}`)
    state.rows = [
      row('K-NULL', null),
      row('K-JULY', '2026-07-10T00:00:00+00:00'),
      row('K-TIE-B', '2026-09-22T00:00:00+00:00'),
      row('K-SEPT', '2026-09-23T00:00:00+00:00'),
      row('K-TIE-A', '2026-09-22T00:00:00+00:00'),
    ]
    // Each of the two chunks returns the same five rows; the union holds ten.
    const newest = await getListingTiles({ status: 'closed', sort: 'close-newest', listingKeys: keys, limit: 10 })
    expect(newest.map((t) => t.listingKey)).toEqual([
      'K-SEPT', 'K-SEPT',
      'K-TIE-A', 'K-TIE-A',
      'K-TIE-B', 'K-TIE-B',
      'K-JULY', 'K-JULY',
      'K-NULL', 'K-NULL',
    ])
    const oldest = await getListingTiles({ status: 'closed', sort: 'close-oldest', listingKeys: keys, limit: 10 })
    expect(oldest.map((t) => t.listingKey)).toEqual([
      'K-JULY', 'K-JULY',
      'K-TIE-A', 'K-TIE-A',
      'K-TIE-B', 'K-TIE-B',
      'K-SEPT', 'K-SEPT',
      'K-NULL', 'K-NULL',
    ])
  })
})

describe('"new in the last N days" means newly LISTED', () => {
  it('the cutoff is exactly N days before now', () => {
    const now = Date.parse('2026-09-24T02:00:00.000Z')
    expect(listedWithinDaysCutoff(7, now)).toBe('2026-09-17T02:00:00.000Z')
    expect(listedWithinDaysCutoff(30, now)).toBe('2026-08-25T02:00:00.000Z')
  })

  it('getListingTiles domMax filters on_market_date, never dom', async () => {
    const before = Date.now()
    await getListingTiles({ status: 'active', domMax: 7, bbox })
    const after = Date.now()
    expect(onColumn('dom')).toEqual([])
    const omd = onColumn('on_market_date')
    expect(omd).toHaveLength(1)
    const [method, [, cutoff]] = omd[0] as Call
    expect(method).toBe('gte')
    const ms = Date.parse(cutoff as string)
    expect(ms).toBeGreaterThanOrEqual(before - 7 * 86_400_000)
    expect(ms).toBeLessThanOrEqual(after - 7 * 86_400_000)
  })

  it('searchListingsAll (the registry dom range, ?daysOnMarket) filters on_market_date, never dom', async () => {
    const before = Date.now()
    await searchListingsAll({ status: 'active', domMax: 30, bbox })
    const after = Date.now()
    expect(onColumn('dom')).toEqual([])
    const filters = onColumn('on_market_date').filter(([m]) => m !== 'order')
    expect(filters).toHaveLength(1)
    const [method, [, cutoff]] = filters[0] as Call
    expect(method).toBe('gte')
    const ms = Date.parse(cutoff as string)
    expect(ms).toBeGreaterThanOrEqual(before - 30 * 86_400_000)
    expect(ms).toBeLessThanOrEqual(after - 30 * 86_400_000)
  })

  it('no new-listings filter, no on_market_date predicate', async () => {
    await searchListingsAll({ status: 'active', bbox })
    expect(onColumn('on_market_date').filter(([m]) => m !== 'order')).toEqual([])
    await getListingTiles({ status: 'active', bbox })
    expect(onColumn('on_market_date').filter(([m]) => m !== 'order')).toEqual([])
  })
})
