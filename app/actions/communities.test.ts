import { beforeEach, describe, expect, it, vi } from 'vitest'

// SITE-214: a registered community survives the junk-slug guard when every
// database read answers empty (what an outage degrades to), and a slug the
// registry does not name still returns null.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/data/cache/next-cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/app/actions/banners', () => ({
  getBannerUrl: async () => null,
  getBannersBatch: async () => ({}),
  getOrCreatePlaceBanner: async () => ({ url: null }),
}))
vi.mock('@/app/actions/market-stats', () => ({
  getMarketStatsForCity: async () => ({ count: 0 }),
  getMarketStatsForSubdivision: async () => ({
    count: 0,
    medianListPrice: null,
    avgDom: null,
    closedLast12Months: 0,
  }),
}))
const flagState = vi.hoisted(() => ({
  rows: [] as Array<{ entity_key: string; is_resort: boolean }>,
  listSubdivisionsWithFlags: vi.fn(async () => []),
}))
vi.mock('@/app/actions/subdivision-flags', () => ({ listSubdivisionsWithFlags: flagState.listSubdivisionsWithFlags }))
vi.mock('@/app/actions/listings', () => ({ getBrowseCities: async () => [] }))
vi.mock('@/lib/kb/registry-resort-public-figures', () => ({
  getRegistryResortPublicFigures: async () => new Map(),
}))
vi.mock('@/lib/data', () => ({
  getCommunityHeroUrlsBySlug: async () => ({}),
  getGeoSnapshot: async () => null,
  getCommunityListings: async () => [],
  getCommunityDetailByName: async () => null,
  getAllSubdivisionFlags: async () => flagState.rows,
}))

import { getCommunityBySlug } from './communities'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  flagState.rows = []
  flagState.listSubdivisionsWithFlags.mockClear()
})

describe('getCommunityBySlug with every database read empty', () => {
  it.each(['brasada-ranch', 'tetherow', 'black-butte-ranch', 'juniper-preserve'])(
    'keeps registered community %s',
    async (slug) => {
      const c = await getCommunityBySlug(slug)
      expect(c).not.toBeNull()
      expect(c?.isResort).toBe(true)
      expect(c?.activeCount).toBeNull()
      expect(c?.medianPrice).toBeNull()
    },
  )

  it('names a registered community from the registry when the row is missing', async () => {
    const c = await getCommunityBySlug('juniper-preserve')
    expect(c?.name).toBe('Juniper Preserve')
  })

  it('still returns null for a slug the registry does not name', async () => {
    expect(await getCommunityBySlug('bend-industrial')).toBeNull()
    expect(await getCommunityBySlug('not-a-place')).toBeNull()
  })
})

// 2026-10-14: the resort decision reads the flag rows, never the admin
// resort-communities list (every community snapshot merged with the flags),
// which cost 2.4 to 5.2 s cold and pushed the community head past its 8 s
// build cap. The rule is the list's own: a flags row for the key decides,
// else the registry.
describe('the resort decision reads one flag row, not the admin list', () => {
  it('a detail read never calls listSubdivisionsWithFlags', async () => {
    await getCommunityBySlug('tetherow')
    expect(flagState.listSubdivisionsWithFlags).not.toHaveBeenCalled()
  })

  it('a flags row marks an unregistered community resort, which also clears the junk-slug guard', async () => {
    flagState.rows = [{ entity_key: 'bend:industrial', is_resort: true }]
    const c = await getCommunityBySlug('bend-industrial')
    expect(c).not.toBeNull()
    expect(c?.isResort).toBe(true)
  })

  it('a flags row set false leaves a registered community resort by the registry', async () => {
    flagState.rows = [{ entity_key: 'bend:tetherow', is_resort: false }]
    expect((await getCommunityBySlug('tetherow'))?.isResort).toBe(true)
  })
})
