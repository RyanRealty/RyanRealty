import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchMatrixInventoryRow } from '@/lib/data/listings/getSearchMatrixInventory'

/*
 * The /homes-for-sale/{city}/{preset} family in buildAllUrls (2026-10-14).
 *
 * Production, 16:05Z: /sitemaps/matrix.xml served 808 URLs because the matrix
 * inventory read hit a statement timeout. 69 of 400 sampled sitemap URLs were
 * then pages the site itself refuses to index: verified-thin presets that serve
 * noindex (mitchell/farms, sunriver/river-view, ashwood/pending, metolius/luxury,
 * post/businesses) and redmond/commercial, which canonicalizes to
 * /cities/redmond/types/commercial. The rule held here: the sitemap never
 * submits a URL its page serves noindex or canonicalizes elsewhere, and a slow
 * or failed read never flips that.
 *
 * buildAllUrls runs for real. Only IO is faked: the matrix inventory DAL (the
 * read that failed), and every other leg returns empty. No network, no Supabase.
 */

const inventory = vi.fn<() => Promise<SearchMatrixInventoryRow[] | null>>()
vi.mock('@/lib/data/listings/getSearchMatrixInventory', () => ({
  getSearchMatrixInventory: () => inventory(),
  getSubdivisionLifetimeCounts: async () => [],
  getSubdivisionDescriptionKeys: async () => [],
  getMatrixNeighborhoods: async () => [],
}))

// The cities leg: every Central Oregon city the live matrix.xml carried 3-segment rows for.
const CITIES = [
  'Ashwood', 'Bend', 'Black Butte Ranch', 'Brothers', 'Camp Sherman', 'Culver', 'La Pine', 'Madras', 'Metolius',
  'Mitchell', 'Paulina', 'Post', 'Powell Butte', 'Prineville', 'Redmond', 'Sisters', 'Sunriver', 'Terrebonne',
]
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/supabase/paginate', () => ({
  fetchAllRows: async (_sb: unknown, table: string) =>
    table === 'listing_search_mv' ? CITIES.map((city) => ({ city })) : [],
}))
vi.mock('@/lib/data', () => ({ getAllNeighborhoodsWithCity: async () => [] }))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({ getIndexableSubdivisions: async () => [] }))
vi.mock('@/lib/seo/getBrowsePairDecision', () => ({ getBrowsePairSitemapPaths: async () => [] }))
vi.mock('@/lib/data/geo/getOutOfAreaCities', () => ({ getOutOfAreaCitySitemapEntries: async () => [] }))
vi.mock('@/lib/data/sitemap/getListingSitemapRows', () => ({ getListingSitemapRows: async () => [] }))
vi.mock('@/lib/data/market-report/editions', () => ({ listPublishedEditions: async () => [] }))
vi.mock('@/app/open-houses/_v3/oh-index', () => ({ openHouseCitySlugsWithEvents: async () => null }))

import { buildAllUrls } from '@/app/sitemap'
import { getIndexablePresetSlugs } from '@/lib/search-presets'
import { isBendNewConstructionSearchTwinPath } from '@/lib/routing/bend-new-construction-search-twin'
import { cityEntityKey } from '@/lib/slug'
import {
  getMatrixCityPresetDecisionSet,
  matrixCityPresetNoIndexFromSet,
} from '@/lib/seo/getSearchMatrixEntries'
import {
  cityPresetTypeTwin,
  isPlaceTypePresetSlug,
  placeTypeSitemapPaths,
  presetNeedsVerifiedDecision,
} from '@/lib/seo/place-type-twin'

const BASE = 'https://ryan-realty.com'
const NOW = new Date('2026-10-14T16:05:00Z')

function row(overrides: Partial<SearchMatrixInventoryRow> = {}): SearchMatrixInventoryRow {
  return {
    standard_status: 'Active',
    list_price: 450_000,
    city_lower: 'redmond',
    subdivision_lower: null,
    boundary_neighborhood: null,
    property_type: 'A',
    property_sub_type: 'Single Family Residence',
    year_built: 2005,
    lot_size_acres: 0.2,
    pool_yn: false,
    fireplace_yn: false,
    waterfront_yn: false,
    view_types: null,
    hoa_amenities: null,
    parking_features: null,
    ...overrides,
  }
}

/**
 * Redmond carries real depth in several presets (including four commercial
 * listings, the type preset whose page canonicalizes to /cities/redmond/types/commercial).
 * Each failing city from the incident has one home and nothing matching its
 * preset: a VERIFIED zero, which the page noindexes.
 */
function healthyInventory(): SearchMatrixInventoryRow[] {
  const thinCities = ['mitchell', 'sunriver', 'ashwood', 'metolius', 'post']
  return [
    ...Array.from({ length: 5 }, () => row()),
    ...Array.from({ length: 4 }, () => row({ property_type: 'F', property_sub_type: 'Retail' })),
    ...Array.from({ length: 4 }, () => row({ city_lower: 'bend' })),
    ...thinCities.map((city_lower) => row({ city_lower })),
  ]
}

const INCIDENT_URLS = [
  '/homes-for-sale/mitchell/farms',
  '/homes-for-sale/sunriver/river-view',
  '/homes-for-sale/ashwood/pending',
  '/homes-for-sale/metolius/luxury',
  '/homes-for-sale/post/businesses',
  '/homes-for-sale/redmond/commercial',
]

const CITY_PRESET_URL = /^\/homes-for-sale\/[a-z0-9-]+\/[a-z0-9-]+$/

async function emitted(): Promise<string[]> {
  const entries = await buildAllUrls(BASE, NOW)
  return entries.map((e) => new URL(e.url).pathname)
}

const cityPresetPaths = (paths: string[]) => paths.filter((p) => CITY_PRESET_URL.test(p))

let envBefore: Record<string, string | undefined>
beforeEach(() => {
  inventory.mockReset()
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

/**
 * The loop as it stood before 2026-10-14, kept verbatim as the reference the
 * happy path must still equal. Same inputs, same order of rules.
 */
function legacyCityPresetPaths(
  cities: string[],
  decision: Awaited<ReturnType<typeof getMatrixCityPresetDecisionSet>>,
): string[] {
  const out: string[] = []
  for (const city of cities) {
    const key = cityEntityKey(city)
    for (const preset of getIndexablePresetSlugs()) {
      if (matrixCityPresetNoIndexFromSet(decision, key, preset)) continue
      if (isBendNewConstructionSearchTwinPath(`/homes-for-sale/${key}/${preset}`)) continue
      if (cityPresetTypeTwin(key, preset, decision?.positiveCityPresets ?? null)) continue
      out.push(`/homes-for-sale/${key}/${preset}`)
    }
  }
  return out
}

describe('a good decision emits exactly what it emitted before', () => {
  it('the city x preset URLs equal the pre-change loop over the same decision', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const decision = await getMatrixCityPresetDecisionSet()
    expect(decision).not.toBeNull()

    const paths = cityPresetPaths(await emitted())
    const expected = legacyCityPresetPaths(CITIES, decision)
    expect([...new Set(paths)].sort()).toEqual([...new Set(expected)].sort())
    // Not vacuous: the loop is emitting real combinations.
    expect(paths.length).toBeGreaterThan(300)
  })

  it('submits no verified-thin preset and no preset the page canonicalizes to a type page', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const paths = await emitted()
    for (const url of INCIDENT_URLS) expect(paths, url).not.toContain(url)
    // The type page is the one submitted instead of its preset twin.
    expect(paths).toContain('/cities/redmond/types/commercial')
    expect(paths).toContain('/cities/redmond/types/single-family')
    // A city x preset with real depth stays.
    expect(paths).toContain('/homes-for-sale/redmond/under-1m')
  })
})

describe('an unknown decision (the matrix inventory read failed) no longer fails open', () => {
  it('omits the incident URLs, and every preset that needs a verified decision', async () => {
    inventory.mockResolvedValue(null) // getSearchMatrixInventory logs the timeout and returns null
    const paths = await emitted()

    for (const url of INCIDENT_URLS) expect(paths, url).not.toContain(url)
    const presets = cityPresetPaths(paths).map((p) => p.split('/')[3]!)
    expect(presets.filter((slug) => presetNeedsVerifiedDecision(slug))).toEqual([])
    // No type preset, so no twin, and no type page either (it needs a verified count).
    expect(presets.filter((slug) => isPlaceTypePresetSlug(slug))).toEqual([])
    expect(paths.filter((p) => /\/types\//.test(p))).toEqual([])
    // Four-segment matrix: omitted, as it always was on a null read.
    expect(paths.filter((p) => /^\/homes-for-sale\/[^/]+\/[^/]+\/[^/]+$/.test(p))).toEqual([])
    // The omission names itself in the runtime log.
    const line = vi.mocked(console.warn).mock.calls.map((c) => String(c[0])).find((m) => m.includes('matrix-city-preset-decision unresolved'))
    expect(line).toBeDefined()
    expect(line).toMatch(/omitted \d+ city x preset URLs/)
  })

  it('keeps the presets the page serves index whatever the matrix says (no decision needed)', async () => {
    inventory.mockResolvedValue(null)
    const paths = cityPresetPaths(await emitted())
    const noDecision = getIndexablePresetSlugs().filter((slug) => !presetNeedsVerifiedDecision(slug))
    expect(noDecision.length).toBeGreaterThan(0)
    // Every city carries every decision-free preset (the self-city search pages
    // leave only the plain /homes-for-sale/{city} URL, never a preset URL).
    for (const city of CITIES) {
      for (const slug of noDecision) {
        expect(paths, `${city}/${slug}`).toContain(`/homes-for-sale/${cityEntityKey(city)}/${slug}`)
      }
    }
    expect(paths.length).toBe(CITIES.length * noDecision.length)
  })

  it('never emits a city x preset URL the page would noindex or canonicalize under the verified decision', async () => {
    // What the sitemap emits while the decision is unknown, judged by what the
    // page decides once it IS known (the warm matrix the page reads).
    inventory.mockResolvedValue(null)
    const whileUnknown = cityPresetPaths(await emitted())
    inventory.mockResolvedValue(healthyInventory())
    const verified = await getMatrixCityPresetDecisionSet()
    expect(verified).not.toBeNull()
    for (const path of whileUnknown) {
      const [, , city, preset] = path.split('/')
      expect(matrixCityPresetNoIndexFromSet(verified, city!, preset!), path).toBe(false)
      expect(cityPresetTypeTwin(city!, preset!, verified!.positiveCityPresets), path).toBeNull()
    }
    expect(placeTypeSitemapPaths(CITIES.map(cityEntityKey), null)).toEqual([])
  })
})

describe('presetNeedsVerifiedDecision covers every preset the matrix can enumerate', () => {
  it('no preset in the real city x preset key space is treated as decision-free', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const decision = await getMatrixCityPresetDecisionSet()
    expect(decision).not.toBeNull()
    const enumerated = [...decision!.cityPresetKeys].map((k) => k.split('/')[3]!)
    expect(enumerated.length).toBeGreaterThan(0)
    for (const slug of new Set(enumerated)) expect(presetNeedsVerifiedDecision(slug), slug).toBe(true)
    // And the converse the sitemap leans on: a preset with no decision never
    // appears in the key space, so the page can only serve it index.
    for (const slug of getIndexablePresetSlugs().filter((s) => !presetNeedsVerifiedDecision(s))) {
      expect(enumerated, slug).not.toContain(slug)
    }
  })
})
