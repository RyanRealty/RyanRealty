import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase, type Chain } from '@/test/fake-supabase-chain'

let answer: (chain: Chain) => unknown = () => ({ data: [], error: null })
const fake = fakeSupabase((c) => answer(c))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fake.client }))
vi.mock('@/lib/data/cache/next-cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { getWebsiteMarkets, summarizeMarkets, summarizeSearches } = await import('./getWebsiteMarkets')

describe('summarizeMarkets', () => {
  it('counts views, listing views and visits per town, local first by views', () => {
    const r = summarizeMarkets([
      { session_id: 's1', page_url: 'https://ryan-realty.com/homes-for-sale/bend' },
      { session_id: 's1', page_url: 'https://ryan-realty.com/homes-for-sale/bend/larkspur/20606-daisy-220227756' },
      { session_id: 's2', page_url: 'https://ryan-realty.com/cities/bend' },
      { session_id: 's3', page_url: 'https://ryan-realty.com/homes-for-sale/medford/4131-griffin-creek-220218237' },
      { session_id: 's3', page_url: 'https://ryan-realty.com/blog/x' },
      { session_id: 's4', page_url: null },
    ])
    expect(r.pageViews).toBe(6)
    expect(r.marketViews).toBe(4)
    expect(r.rows).toEqual([
      { citySlug: 'bend', city: 'Bend', local: true, views: 3, listingViews: 1, visitors: 2 },
      { citySlug: 'medford', city: 'Medford', local: false, views: 1, listingViews: 1, visitors: 1 },
    ])
  })
})

describe('summarizeSearches', () => {
  it('groups what was typed, case-insensitively, and skips rows with no term kept', () => {
    expect(
      summarizeSearches([
        { metadata: { query: 'Bend' } },
        { metadata: { query: ' bend ' } },
        { metadata: { term: 'Awbrey Glen' } },
        { metadata: null },
        { metadata: { query: 7 } },
      ]),
    ).toEqual([
      { term: 'Bend', searches: 2 },
      { term: 'Awbrey Glen', searches: 1 },
    ])
  })
})

describe('getWebsiteMarkets — the read', () => {
  it('leaves automation out in the query, through the session join', async () => {
    fake.chains.length = 0
    answer = (c) => {
      const isSearch = c.calls.some((k) => k.method === 'eq' && k.args[0] === 'event_type' && k.args[1] === 'search')
      return isSearch
        ? { data: [{ metadata: { query: 'Sisters' } }], error: null }
        : { data: [{ session_id: 'a', page_url: '/homes-for-sale/sisters' }], error: null }
    }
    const m = await getWebsiteMarkets({ startIso: '2026-10-07T00:00:00.000Z', endIso: '2026-10-13T23:59:59.999Z' })
    expect(m.unreadable).toBe(false)
    expect(m.rows[0]).toMatchObject({ city: 'Sisters', views: 1 })
    expect(m.searches).toEqual([{ term: 'Sisters', searches: 1 }])
    expect(m.searchEvents).toBe(1)
    for (const c of fake.chains) {
      expect(c.table).toBe('visitor_events')
      expect(String(c.calls.find((k) => k.method === 'select')?.args[0])).toContain('visitor_sessions!inner(is_automated)')
      expect(c.calls).toContainEqual({ method: 'eq', args: ['visitor_sessions.is_automated', false] })
    }
  })

  it('says it could not read instead of returning zeros', async () => {
    answer = () => ({ data: null, error: { message: 'boom' } })
    const m = await getWebsiteMarkets({ startIso: '2026-10-07T00:00:00.000Z', endIso: '2026-10-13T23:59:59.999Z' })
    expect(m.unreadable).toBe(true)
    expect(m.rows).toEqual([])
  })
})
