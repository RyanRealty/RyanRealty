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
vi.mock('@/app/actions/subdivision-flags', () => ({ listSubdivisionsWithFlags: async () => [] }))
vi.mock('@/app/actions/listings', () => ({ getBrowseCities: async () => [] }))
vi.mock('@/lib/kb/registry-resort-public-figures', () => ({
  getRegistryResortPublicFigures: async () => new Map(),
}))
vi.mock('@/lib/data', () => ({
  getCommunityHeroUrlsBySlug: async () => ({}),
  getGeoSnapshot: async () => null,
  getCommunityListings: async () => [],
  getCommunityDetailByName: async () => null,
}))

import { getCommunityBySlug } from './communities'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
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
