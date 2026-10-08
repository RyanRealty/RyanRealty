import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 3037 Purcell (2026-10-07): 2124 Carrie closed 2026-10-05 and was in listings
 * (the hero chart, the Silver Sage box) but not in sale_pricing_facts, whose
 * keyset sweep had not reached the end of the keyspace since 2026-09-29. The
 * catch-up finds every recent close with no facts row and rebuilds it with the
 * facts SQL before the pool is read.
 */

type Row = Record<string, unknown>
type Filter = { op: string; col: string; val: unknown }

const state = vi.hoisted(() => ({
  listings: [] as Row[],
  facts: new Set<string>(),
  factsError: null as string | null,
  refreshCalls: [] as string[][],
  refreshThrows: false,
}))

function applies(row: Row, f: Filter): boolean {
  const v = row[f.col]
  switch (f.op) {
    case 'eq':
      return v === f.val
    case 'gt':
      return Number(v) > Number(f.val)
    case 'gte':
      return typeof v === 'string' && typeof f.val === 'string' ? v >= f.val : Number(v) >= Number(f.val)
    case 'lte':
      return Number(v) <= Number(f.val)
    case 'in':
      return (f.val as unknown[]).includes(v)
    default:
      return true
  }
}

function query(table: string) {
  const filters: Filter[] = []
  let range: [number, number] | null = null
  const b = {
    select: () => b,
    eq: (col: string, val: unknown) => (filters.push({ op: 'eq', col, val }), b),
    gt: (col: string, val: unknown) => (filters.push({ op: 'gt', col, val }), b),
    gte: (col: string, val: unknown) => (filters.push({ op: 'gte', col, val }), b),
    lte: (col: string, val: unknown) => (filters.push({ op: 'lte', col, val }), b),
    in: (col: string, val: unknown[]) => (filters.push({ op: 'in', col, val }), b),
    order: () => b,
    range: (from: number, to: number) => ((range = [from, to]), b),
    then: (resolve: (v: { data: unknown; error: { message: string } | null }) => unknown) => {
      if (table === 'sale_pricing_facts') {
        if (state.factsError) return Promise.resolve(resolve({ data: null, error: { message: state.factsError } }))
        const keys = (filters.find((f) => f.col === 'listing_key')?.val ?? []) as string[]
        return Promise.resolve(
          resolve({ data: keys.filter((k) => state.facts.has(k)).map((k) => ({ listing_key: k })), error: null }),
        )
      }
      const rows = state.listings.filter((r) => filters.every((f) => applies(r, f)))
      const page = range ? rows.slice(range[0], range[1] + 1) : rows
      return Promise.resolve(resolve({ data: page, error: null }))
    },
  }
  return b
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (t: string) => query(t) }),
}))
vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  refreshSalePricingFactsForKeys: vi.fn(async (keys: string[]) => {
    state.refreshCalls.push(keys)
    if (state.refreshThrows) throw new Error('rpc down')
    for (const k of keys) state.facts.add(k)
    return { refreshed: keys, skipped: [], failed: [] }
  }),
}))

import {
  catchUpRecentPricingFacts,
  closeDayBefore,
  isPricingFactsCity,
  missingFactKeys,
} from '@/lib/data/pricing/facts'

// 2124 Carrie's key, close day, price and size are the listings row read 2026-10-07.
// The map point is illustrative, not the home's.
const PURCELL = { latitude: 44.0745, longitude: -121.2667 }
function closed(over: Row): Row {
  return {
    ListingKey: 'K',
    City: 'Bend',
    Latitude: PURCELL.latitude,
    Longitude: PURCELL.longitude,
    CloseDate: '2026-10-05',
    StandardStatus: 'Closed',
    PropertyType: 'A',
    ClosePrice: 559000,
    TotalLivingAreaSqFt: 1558,
    ...over,
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
  state.listings = []
  state.facts = new Set()
  state.factsError = null
  state.refreshCalls = []
  state.refreshThrows = false
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

describe('missingFactKeys', () => {
  it('keeps order, drops present keys and repeats', () => {
    expect(missingFactKeys(['a', 'b', 'a', 'c', ''], new Set(['b']))).toEqual(['a', 'c'])
  })
})

describe('isPricingFactsCity', () => {
  it('admits the facts SQL cities, any case, and nothing else', () => {
    expect(isPricingFactsCity(' bend ')).toBe(true)
    expect(isPricingFactsCity('La Pine')).toBe(true)
    expect(isPricingFactsCity('Ashland')).toBe(false)
    expect(isPricingFactsCity(null)).toBe(false)
  })
})

describe('closeDayBefore', () => {
  it('counts calendar days back from the as-of day', () => {
    expect(closeDayBefore('2026-10-07', 90)).toBe('2026-07-09')
    expect(closeDayBefore('2026-10-07T21:41:37.706Z', 1)).toBe('2026-10-06')
  })
})

describe('catchUpRecentPricingFacts', () => {
  it('rebuilds the recent close the facts table lacks (2124 Carrie) and leaves the ones it holds', async () => {
    state.listings = [
      closed({ ListingKey: '20260728231643861137000000' }),
      closed({ ListingKey: '20260820163832072941000000', CloseDate: '2026-09-28' }),
      // Older than the window: the sweep's business, not the catch-up's.
      closed({ ListingKey: '20200227032110399204000000', CloseDate: '2005-09-21' }),
    ]
    state.facts = new Set(['20260820163832072941000000', '20200227032110399204000000'])
    const out = await catchUpRecentPricingFacts({
      since: '2026-07-09',
      cities: ['Bend'],
      near: { ...PURCELL, radiusMiles: 3 },
    })
    expect(out.checked).toBe(2)
    expect(out.missing).toEqual(['20260728231643861137000000'])
    expect(out.refreshed).toEqual(['20260728231643861137000000'])
    expect(out.deferred).toEqual([])
    expect(out.error).toBeNull()
    expect(state.refreshCalls).toEqual([['20260728231643861137000000']])
  })

  it('takes the nearest missing closes first and defers past the cap', async () => {
    state.listings = [
      closed({ ListingKey: 'far', Latitude: PURCELL.latitude + 0.03 }),
      closed({ ListingKey: 'near', Latitude: PURCELL.latitude + 0.001 }),
      closed({ ListingKey: 'city-only', Latitude: 44.2, Longitude: -121.5 }),
    ]
    const out = await catchUpRecentPricingFacts({
      since: '2026-07-09',
      cities: ['Bend'],
      near: { ...PURCELL, radiusMiles: 3 },
      maxRefresh: 2,
    })
    expect(out.missing).toEqual(['near', 'far', 'city-only'])
    expect(out.refreshed).toEqual(['near', 'far'])
    expect(out.deferred).toEqual(['city-only'])
  })

  it('never refreshes a close outside the facts cities or the facts filter', async () => {
    state.listings = [
      closed({ ListingKey: 'ashland', City: 'Ashland' }),
      closed({ ListingKey: 'land', PropertyType: 'D' }),
      closed({ ListingKey: 'tiny', TotalLivingAreaSqFt: 200 }),
      closed({ ListingKey: 'pending', StandardStatus: 'Pending' }),
    ]
    const out = await catchUpRecentPricingFacts({ since: '2026-07-09', near: { ...PURCELL, radiusMiles: 3 } })
    expect(out.checked).toBe(0)
    expect(state.refreshCalls).toEqual([])
  })

  it('refreshes nothing when the facts read fails, and says so', async () => {
    state.listings = [closed({ ListingKey: 'x' })]
    state.factsError = 'timeout'
    const out = await catchUpRecentPricingFacts({ since: '2026-07-09', cities: ['Bend'] })
    expect(out.error).toMatch(/facts read: timeout/)
    expect(out.missing).toEqual([])
    expect(state.refreshCalls).toEqual([])
  })

  it('reports a failed refresh as deferred instead of throwing', async () => {
    state.listings = [closed({ ListingKey: 'x' })]
    state.refreshThrows = true
    const out = await catchUpRecentPricingFacts({ since: '2026-07-09', cities: ['Bend'] })
    expect(out.refreshed).toEqual([])
    expect(out.deferred).toEqual(['x'])
    expect(out.error).toMatch(/refresh: rpc down/)
  })

  it('is a no-op without database credentials', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    state.listings = [closed({ ListingKey: 'x' })]
    const out = await catchUpRecentPricingFacts({ since: '2026-07-09', cities: ['Bend'] })
    expect(out.checked).toBe(0)
    expect(state.refreshCalls).toEqual([])
  })
})

describe('catchUpRecentPricingFacts never throws', () => {
  it('turns a rejected read into an error the trace can carry', async () => {
    state.listings = [closed({ ListingKey: 'x' })]
    const svc = await import('@/lib/supabase/service')
    const spy = vi.spyOn(svc, 'createServiceClient').mockImplementation(() => {
      throw new Error('socket hang up')
    })
    const out = await catchUpRecentPricingFacts({ since: '2026-07-09', cities: ['Bend'] })
    expect(out.error).toBe('socket hang up')
    expect(out.refreshed).toEqual([])
    spy.mockRestore()
  })
})
