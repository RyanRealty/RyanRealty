import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndexableSubdivision } from '@/lib/data/subdivisions/subdivision-index'

/*
 * The subdivision URLs in buildAllUrls (2026-10-14).
 *
 * Production, 23:10Z: /sitemaps/geo.xml listed /homes-for-sale/la-pine/black-bear-meadows
 * and /homes-for-sale/bend/lazy-river-west. Their pages serve rel=canonical to
 * /subdivisions/black-bear-meadows and /subdivisions/lazy-river-west. 69 of the 225
 * browse pairs in the file did, and the file held no /subdivisions/{slug} URL at all,
 * although llms-subdivisions.txt (the same getIndexableSubdivisions set) listed 2,950.
 * The build had judged the pairs without the plat set, and the page fails open on
 * that where the sitemap must not.
 *
 * The rule held here: a sitemap lists the URL the page is canonical at. A pair whose
 * page canonicalizes to /subdivisions/{slug} goes out as that URL, once; a
 * self-canonical pair is unchanged; and when the plat set cannot be read the build
 * submits no pair it cannot prove self-canonical.
 *
 * buildAllUrls and getBrowsePairSitemapPaths run for real. Only IO is faked: the
 * three plat reads and the legs that do not matter here.
 */

const inventory = vi.fn()
const indexable = vi.fn<() => Promise<IndexableSubdivision[]>>()
const platCounts = vi.fn()

vi.mock('@/lib/data/subdivisions/getSubdivisionCityInventory', () => ({ getSubdivisionCityInventory: () => inventory() }))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({ getIndexableSubdivisions: () => indexable() }))
vi.mock('@/lib/data/subdivisions/getPlatClosedCounts', () => ({ getPlatClosedCounts: () => platCounts() }))

vi.mock('@/lib/data/listings/getSearchMatrixInventory', () => ({
  getSearchMatrixInventory: async () => [],
  getSubdivisionLifetimeCounts: async () => [],
  getSubdivisionDescriptionKeys: async () => [],
  getMatrixNeighborhoods: async () => [],
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/supabase/paginate', () => ({
  fetchAllRows: async (_sb: unknown, table: string) =>
    table === 'listing_search_mv' ? [{ city: 'Bend' }, { city: 'La Pine' }] : [],
}))
vi.mock('@/lib/data', () => ({ getAllNeighborhoodsWithCity: async () => [] }))
vi.mock('@/lib/data/geo/getOutOfAreaCities', () => ({ getOutOfAreaCitySitemapEntries: async () => [] }))
vi.mock('@/lib/data/sitemap/getListingSitemapRows', () => ({ getListingSitemapRows: async () => [] }))
vi.mock('@/lib/data/market-report/editions', () => ({ listPublishedEditions: async () => [] }))
vi.mock('@/app/open-houses/_v3/oh-index', () => ({ openHouseCitySlugsWithEvents: async () => null }))

import { buildAllUrls } from '@/app/sitemap'

const BASE = 'https://ryan-realty.com'
const NOW = new Date('2026-10-14T23:10:00Z')

const row = (standard_status: string, n: number) => ({ subdivision_name: 'x', standard_status, n })

// Two pairs whose page canonicalizes to the plat (la-pine/black-bear-meadows, bend/lazy-river-west),
// one across a word break (bend/deschutes-riverwoods), and one self-canonical pair (bend/river-bend-estate).
const MV = [
  { cityLower: 'la pine', subdivisionName: 'Black Bear Meadows', rows: [row('Closed', 31), row('Active', 5)] },
  { cityLower: 'bend', subdivisionName: 'Lazy River West', rows: [row('Closed', 18), row('Active', 3)] },
  { cityLower: 'bend', subdivisionName: 'Deschutes RiverWoods', rows: [row('Closed', 3046), row('Active', 16)] },
  { cityLower: 'bend', subdivisionName: 'River Bend Estate', rows: [row('Closed', 22), row('Active', 4)] },
]
const PLATS = [
  { slug: 'black-bear-meadows', label: 'Black Bear Meadows', topCityLower: 'la pine' },
  { slug: 'lazy-river-west', label: 'Lazy River West', topCityLower: 'bend' },
  { slug: 'deschutes-river-woods', label: 'Deschutes River Woods', topCityLower: 'bend' },
  // A plat that is indexable but not this pair's place (another city): bend/river-bend-estate stays self-canonical.
  { slug: 'river-bend-estate', label: 'River Bend Estate', topCityLower: 'redmond' },
]
const INDEXABLE: IndexableSubdivision[] = [
  ...PLATS.map((p, i) => ({
    slug: p.slug,
    name: p.label,
    citySlug: p.topCityLower.replace(' ', '-'),
    closedCount: 20 + i,
  })),
  // An indexable plat no browse pair twins to: still submitted, by the plat leg.
  { slug: 'awbrey-glen', name: 'Awbrey Glen', citySlug: 'bend', closedCount: 55 },
]

async function emitted(): Promise<string[]> {
  const entries = await buildAllUrls(BASE, NOW)
  return entries.map((e) => new URL(e.url).pathname)
}
const once = (paths: string[], path: string) => paths.filter((p) => p === path).length

let envBefore: Record<string, string | undefined>
beforeEach(() => {
  inventory.mockReset().mockResolvedValue(MV)
  platCounts.mockReset().mockResolvedValue(PLATS)
  indexable.mockReset().mockResolvedValue(INDEXABLE)
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
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = envBefore.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envBefore.key
  process.env.NEXT_PUBLIC_SITE_URL = envBefore.site
})

describe('a pair whose page canonicalizes to /subdivisions/{slug} is submitted as that URL', () => {
  it('lists the plat page once, and the pair never', async () => {
    const paths = await emitted()
    for (const slug of ['black-bear-meadows', 'lazy-river-west', 'deschutes-river-woods']) {
      expect(once(paths, `/subdivisions/${slug}`), slug).toBe(1)
    }
    expect(paths).not.toContain('/homes-for-sale/la-pine/black-bear-meadows')
    expect(paths).not.toContain('/homes-for-sale/bend/lazy-river-west')
    // Across a word break: neither spelling of the pair, only the plat the county recorded.
    expect(paths).not.toContain('/homes-for-sale/bend/deschutes-riverwoods')
    expect(paths).not.toContain('/homes-for-sale/bend/deschutes-river-woods')
  })

  it('leaves a self-canonical pair unchanged, and still lists the plat pages nothing twins to', async () => {
    const paths = await emitted()
    expect(once(paths, '/homes-for-sale/bend/river-bend-estate')).toBe(1)
    expect(once(paths, '/subdivisions/awbrey-glen')).toBe(1)
  })

  it('reads the indexable plat set once per build and judges the pairs against that same set', async () => {
    await emitted()
    expect(indexable).toHaveBeenCalledTimes(1)
  })
})

describe('an unreadable plat set (the failure behind 69 twin URLs in geo.xml) fails closed', () => {
  beforeEach(() => {
    indexable.mockResolvedValue([]) // getIndexableSubdivisions answers [] when its read failed
  })

  it('submits no browse pair it cannot prove self-canonical, and no plat twin as itself', async () => {
    const paths = await emitted()
    const pairs = paths.filter((p) => /^\/homes-for-sale\/(bend|la-pine)\/[a-z0-9-]+$/.test(p) && !/-\d{6,}$/.test(p))
    // Cities' own hubs and presets are not pairs; no area slug of the MV may appear.
    for (const area of ['black-bear-meadows', 'lazy-river-west', 'deschutes-riverwoods', 'river-bend-estate']) {
      expect(pairs.filter((p) => p.endsWith(`/${area}`)), area).toEqual([])
    }
    expect(paths.filter((p) => /^\/subdivisions\/[^/]+$/.test(p))).toEqual([])
  })

  it('names the failed read in the log instead of failing silently', async () => {
    await emitted()
    const lines = vi.mocked(console.error).mock.calls.map((c) => String(c[0]))
    expect(lines.some((l) => l.includes('browse pairs withheld'))).toBe(true)
    expect(lines.some((l) => l.includes('indexable plat set empty'))).toBe(true)
  })
})
