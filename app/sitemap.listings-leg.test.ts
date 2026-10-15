import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListingSitemapRow } from '@/lib/data/sitemap/listing-sitemap-path'

/*
 * The class universe skips the listing leg (2026-10-14).
 *
 * lib/sitemap-class-rows.ts builds one universe for core, geo, matrix and
 * content. Every listing URL classifies as 'listings', and that class is read
 * straight from getListingSitemapRows without the universe, so the universe's
 * listing leg was read and thrown away on every build. In production it was
 * also the slowest leg (13-28s on 2026-10-14) and, until the on-market index
 * landed, a 3.6s full key-index walk retried up to four times per build.
 *
 * buildAllUrls runs for real; only IO is faked.
 */

const listingRows = vi.fn<() => Promise<ListingSitemapRow[]>>()
vi.mock('@/lib/data/sitemap/getListingSitemapRows', () => ({ getListingSitemapRows: () => listingRows() }))
vi.mock('@/lib/data/listings/getSearchMatrixInventory', () => ({
  getSearchMatrixInventory: async () => [],
  getSubdivisionLifetimeCounts: async () => [],
  getSubdivisionDescriptionKeys: async () => [],
  getMatrixNeighborhoods: async () => [],
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/supabase/paginate', () => ({
  fetchAllRows: async (_sb: unknown, table: string) =>
    table === 'listing_search_mv' ? [{ city: 'Bend' }, { city: 'Redmond' }] : [],
}))
vi.mock('@/lib/data', () => ({ getAllNeighborhoodsWithCity: async () => [] }))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({ getIndexableSubdivisions: async () => [] }))
vi.mock('@/lib/seo/getBrowsePairDecision', () => ({ getBrowsePairSitemapPaths: async () => [] }))
vi.mock('@/lib/data/geo/getOutOfAreaCities', () => ({ getOutOfAreaCitySitemapEntries: async () => [] }))
vi.mock('@/lib/data/market-report/editions', () => ({ listPublishedEditions: async () => [] }))
vi.mock('@/app/open-houses/_v3/oh-index', () => ({ openHouseCitySlugsWithEvents: async () => null }))

import { buildAllUrls } from '@/app/sitemap'
import { classifySitemapUrl } from '@/lib/data/sitemap/classify'
import { getIndexablePresetSlugs } from '@/lib/search-presets'

const BASE = 'https://ryan-realty.com'
const NOW = new Date('2026-10-14T16:05:00Z')

// A real listing-detail path shape (lib/data/sitemap/listing-sitemap-path.ts).
const LISTING: ListingSitemapRow = {
  listingKey: '20260721161730408210000000',
  path: '/homes-for-sale/bend/20339-jack-benny-220225832',
  lastModified: '2026-10-01T00:00:00.000Z',
  imageUrl: null,
}

const presetSlugs = new Set(getIndexablePresetSlugs())
const pathsOf = (entries: Awaited<ReturnType<typeof buildAllUrls>>) => entries.map((e) => new URL(e.url).pathname)

let envBefore: Record<string, string | undefined>
beforeEach(() => {
  listingRows.mockReset()
  listingRows.mockResolvedValue([LISTING])
  envBefore = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    site: process.env.NEXT_PUBLIC_SITE_URL,
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.invalid'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.NEXT_PUBLIC_SITE_URL = BASE
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = envBefore.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envBefore.key
  process.env.NEXT_PUBLIC_SITE_URL = envBefore.site
})

describe('buildAllUrls listing leg', () => {
  it('the monolith default still reads and lists listings', async () => {
    const paths = pathsOf(await buildAllUrls(BASE, NOW))
    expect(listingRows).toHaveBeenCalledTimes(1)
    expect(paths).toContain(LISTING.path)
  })

  it('listings: false never reads listings, and every non-listing URL is unchanged', async () => {
    const full = pathsOf(await buildAllUrls(BASE, NOW))
    listingRows.mockClear()
    const universe = pathsOf(await buildAllUrls(BASE, NOW, { listings: false }))

    expect(listingRows).not.toHaveBeenCalled()
    expect(universe).not.toContain(LISTING.path)
    // What core, geo, matrix and content keep from the full build is exactly
    // what the class universe now emits: the only URLs it drops are 'listings'.
    const kept = full.filter((p) => classifySitemapUrl(`${BASE}${p}`, presetSlugs) !== 'listings')
    expect([...universe].sort()).toEqual([...kept].sort())
    expect(universe.length).toBeGreaterThan(50)
  })

  it('a listing URL never lands in a universe class', () => {
    expect(classifySitemapUrl(`${BASE}${LISTING.path}`, presetSlugs)).toBe('listings')
  })
})
