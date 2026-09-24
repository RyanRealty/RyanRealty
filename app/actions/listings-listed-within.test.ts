import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "Listed in the last N days" reaches the Sold list (2026-09-24). The browse
 * bar writes the registry dom range as ?daysOnMarket=N, and the browse page
 * (/search/..., app/search/[...slug]/page-filters.ts) passes it to
 * getListingsWithAdvanced as `daysOnMarket`. On-market scopes folded it into
 * the MV read; the Sold scope rides search_listings_advanced, whose call read
 * only `newListingsDays`, so ?statusFilter=closed&daysOnMarket=7 showed every
 * sold home under a "7 days" chip. It now sends the tighter of the two as
 * p_new_listings_days, which the RPC reads as the on-market date within N days
 * (newly LISTED, Matt 2026-09-23).
 */
const rpc = vi.hoisted(() =>
  vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: [], error: null })),
)

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))
vi.mock('@/lib/data', () => ({
  getListingTiles: vi.fn(async () => []),
  getListingTilesCount: vi.fn(async () => 0),
  searchListingsAll: vi.fn(async () => ({ rows: [], totalCount: 0, capped: false, countIsExact: true })),
  pickSearchFeatureFilters: () => ({}),
}))

const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'
})
afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key
})
beforeEach(() => rpc.mockClear())

const sentDays = () => {
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc.mock.calls[0][0]).toBe('search_listings_advanced')
  return rpc.mock.calls[0][1].p_new_listings_days
}

describe('the Sold scope sends "listed in the last N days" to the RPC', () => {
  it('daysOnMarket alone (the browse bar) becomes p_new_listings_days', async () => {
    const { getListingsWithAdvanced } = await import('./listings')
    await getListingsWithAdvanced({ city: 'Bend', statusFilter: 'closed', daysOnMarket: 7 })
    expect(sentDays()).toBe(7)
    expect(rpc.mock.calls[0][1].p_status_filter).toBe('closed')
  })

  it('with both spellings the tighter ceiling wins', async () => {
    const { getListingsWithAdvanced } = await import('./listings')
    await getListingsWithAdvanced({ statusFilter: 'closed', daysOnMarket: 30, newListingsDays: 14 })
    expect(sentDays()).toBe(14)
    rpc.mockClear()
    await getListingsWithAdvanced({ statusFilter: 'closed', daysOnMarket: 3, newListingsDays: 14 })
    expect(sentDays()).toBe(3)
  })

  it('whole days only (the parameter is an integer); nothing when neither is set', async () => {
    const { getListingsAdvanced } = await import('./listings')
    await getListingsAdvanced({ statusFilter: 'closed', daysOnMarket: 7.4 })
    expect(sentDays()).toBe(7)
    rpc.mockClear()
    await getListingsAdvanced({ statusFilter: 'closed' })
    expect(sentDays()).toBeNull()
    rpc.mockClear()
    await getListingsAdvanced({ statusFilter: 'closed', daysOnMarket: 0 })
    expect(sentDays()).toBeNull()
  })

  it('a keyword search with a days ceiling keeps the full RPC, which honors it', async () => {
    const { getListingsAdvanced } = await import('./listings')
    await getListingsAdvanced({ statusFilter: 'active', keywords: 'shop', daysOnMarket: 7 })
    // Not search_keyword_listings: that RPC has no days parameter.
    expect(sentDays()).toBe(7)
  })
})
