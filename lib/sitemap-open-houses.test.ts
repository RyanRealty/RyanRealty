/**
 * /open-houses/{city} in the sitemap (2026-10-14).
 *
 * deploy:verify 9fa63fa7a: "SITEMAP URL HEALTH FAILED (2 of 400):
 * /open-houses/brothers and /open-houses/black-butte-ranch: meta robots noindex,
 * follow on a sitemap URL". The page noindexes a city with no open house in the
 * canonical window; the sitemap listed the URL for every site city and every
 * city with an active listing. A sitemap lists only indexable canonical URLs, so
 * a city URL is emitted only when the shared decision (the one the page's
 * generateMetadata calls) says the page is index,follow.
 *
 * Seams: the database path is taken with a stub Supabase URL, every other leg
 * is mocked to empty, and the two DAL reads the decision runs on
 * (getUpcomingOpenHouses, getListingTiles) are the only inputs. No network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dal = vi.hoisted(() => ({
  getAllNeighborhoodsWithCity: vi.fn(),
  getUpcomingOpenHouses: vi.fn(),
  getListingTiles: vi.fn(),
}))
const paginate = vi.hoisted(() => ({
  fetchAllRows: vi.fn(),
  fetchPagedRows: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/data', () => dal)
vi.mock('@/lib/supabase/paginate', () => paginate)
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({
  getIndexableSubdivisions: vi.fn(async () => []),
}))
vi.mock('@/lib/seo/getBrowsePairDecision', () => ({
  getBrowsePairSitemapPaths: vi.fn(async () => []),
}))
vi.mock('@/lib/seo/getSearchMatrixEntries', () => ({
  getSearchMatrixSitemapEntries: vi.fn(async () => []),
  getMatrixCityPresetDecisionSet: vi.fn(async () => null),
  matrixCityPresetNoIndexFromSet: vi.fn(() => false),
}))
vi.mock('@/lib/data/geo/getOutOfAreaCities', () => ({
  getOutOfAreaCitySitemapEntries: vi.fn(async () => []),
}))
vi.mock('@/lib/data/sitemap/getListingSitemapRows', () => ({
  getListingSitemapRows: vi.fn(async () => []),
}))
vi.mock('@/lib/data/market-report/editions', () => ({
  listPublishedEditions: vi.fn(async () => []),
}))

import { buildAllUrls } from '../app/sitemap'

const BASE = 'https://example.com'
const NOW = new Date('2026-10-14T19:00:00Z')

/** The active-listing cities the `cities` leg reads from listing_search_mv. */
let activeCities: string[] = []

function openHouse(listingKey: string) {
  return {
    id: `${listingKey}-2026-10-17-10:00:00`,
    open_house_key: `${listingKey}-2026-10-17`,
    listing_key: listingKey,
    event_date: '2026-10-17',
    start_time: '10:00:00',
    end_time: '12:00:00',
    host_agent_name: null,
    remarks: null,
    rsvp_count: 0,
  }
}

function tile(listingKey: string, city: string) {
  return { listingKey, listNumber: null, city, streetNumber: '1', streetName: 'Pine', listPrice: 600_000 }
}

/** The region has one open house per [listingKey, city] pair given. */
function regionHas(...homes: Array<[listingKey: string, city: string]>) {
  dal.getUpcomingOpenHouses.mockResolvedValue(homes.map(([key]) => openHouse(key)))
  dal.getListingTiles.mockResolvedValue(homes.map(([key, city]) => tile(key, city)))
}

async function urlsOf(): Promise<string[]> {
  const entries = await buildAllUrls(BASE, NOW)
  return entries.map((e) => e.url)
}

const cityOpenHouseUrls = (urls: string[]) => urls.filter((u) => /\/open-houses\/[^/]+$/.test(u))

let logSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
const saved = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  budget: process.env.SITEMAP_BUILD_BUDGET_MS,
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.invalid'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key'
  delete process.env.SITEMAP_BUILD_BUDGET_MS
  activeCities = ['Bend', 'Redmond', 'Brothers', 'Black Butte Ranch']
  dal.getAllNeighborhoodsWithCity.mockReset().mockResolvedValue([])
  dal.getUpcomingOpenHouses.mockReset().mockResolvedValue([])
  dal.getListingTiles.mockReset().mockResolvedValue([])
  paginate.fetchPagedRows.mockReset()
  paginate.fetchAllRows.mockReset().mockImplementation(async (_sb: unknown, table: string) =>
    table === 'listing_search_mv' ? activeCities.map((city) => ({ city })) : [],
  )
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
  warnSpy.mockRestore()
  errorSpy.mockRestore()
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  restore('NEXT_PUBLIC_SUPABASE_URL', saved.url)
  restore('NEXT_PUBLIC_SUPABASE_ANON_KEY', saved.key)
  restore('SITEMAP_BUILD_BUDGET_MS', saved.budget)
  vi.useRealTimers()
})

describe('sitemap /open-houses/{city}', () => {
  it('lists a city with an open house in the window and leaves out the cities without one', async () => {
    regionHas(['L1', 'Bend'])

    const urls = await urlsOf()

    expect(urls).toContain(`${BASE}/open-houses/bend`)
    // The two the live deploy:verify flagged, and a site city with none this week.
    expect(urls).not.toContain(`${BASE}/open-houses/brothers`)
    expect(urls).not.toContain(`${BASE}/open-houses/black-butte-ranch`)
    expect(urls).not.toContain(`${BASE}/open-houses/redmond`)
    expect(cityOpenHouseUrls(urls)).toEqual([`${BASE}/open-houses/bend`])
  })

  it('lists a service-area city that is not a seeded site city once it has an open house', async () => {
    regionHas(['L1', 'Black Butte Ranch'], ['L2', 'Redmond'])

    const urls = await urlsOf()

    expect(urls).toContain(`${BASE}/open-houses/black-butte-ranch`)
    expect(urls).toContain(`${BASE}/open-houses/redmond`)
    expect(urls).not.toContain(`${BASE}/open-houses/brothers`)
    expect(urls).not.toContain(`${BASE}/open-houses/bend`)
  })

  it('lists a seeded site city even when the active-city read has no row for it', async () => {
    activeCities = ['Bend']
    regionHas(['L1', 'Sisters'])

    expect(await urlsOf()).toContain(`${BASE}/open-houses/sisters`)
  })

  it('does not list a city that only an out-of-scope tile names', async () => {
    // Medford is not a site city and not in the Central Oregon scope.
    regionHas(['L1', 'Medford'])

    expect(cityOpenHouseUrls(await urlsOf())).toEqual([])
  })

  it('keeps the hub and the rest of the sitemap, and lists each URL once', async () => {
    regionHas(['L1', 'Bend'])

    const urls = await urlsOf()

    expect(urls).toContain(`${BASE}/open-houses`)
    expect(urls).toContain(`${BASE}/cities/bend`)
    expect(urls).toContain(`${BASE}/homes-for-sale/bend`)
    expect(urls).toContain(`${BASE}/price-drops/bend`)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('reads the region once for the whole sitemap, whatever the number of cities', async () => {
    regionHas(['L1', 'Bend'], ['L2', 'Redmond'], ['L3', 'Sisters'])

    await urlsOf()

    expect(dal.getUpcomingOpenHouses).toHaveBeenCalledTimes(1)
    expect(dal.getListingTiles).toHaveBeenCalledTimes(1)
    // The region read, never a per-city one.
    expect(dal.getUpcomingOpenHouses.mock.calls[0]?.[0]).not.toHaveProperty('city')
  })

  it('lists no city URL when the open-house read fails, and the rest is unaffected', async () => {
    dal.getUpcomingOpenHouses.mockRejectedValue(new Error('statement timeout'))

    const urls = await urlsOf()

    expect(cityOpenHouseUrls(urls)).toEqual([])
    expect(urls).toContain(`${BASE}/open-houses`)
    expect(urls).toContain(`${BASE}/cities/bend`)
    expect(urls).toContain(`${BASE}/homes-for-sale/redmond`)
  })

  it('lists no city URL when the tile read fails', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([openHouse('L1')])
    dal.getListingTiles.mockRejectedValue(new Error('tiles down'))

    const urls = await urlsOf()

    expect(cityOpenHouseUrls(urls)).toEqual([])
    expect(urls).toContain(`${BASE}/cities/bend`)
  })

  it('lists no city URL when the read comes back empty (it resolves to [] on a failed read)', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([])

    expect(cityOpenHouseUrls(await urlsOf())).toEqual([])
  })

  it('lists no city URL when the read overruns its leg, and the rest is unaffected', async () => {
    dal.getUpcomingOpenHouses.mockReturnValue(new Promise(() => {}))
    // The shared deadline floors a leg at one second.
    process.env.SITEMAP_BUILD_BUDGET_MS = '1'

    const urls = await urlsOf()

    expect(cityOpenHouseUrls(urls)).toEqual([])
    expect(urls).toContain(`${BASE}/open-houses`)
    expect(urls).toContain(`${BASE}/cities/bend`)
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('sitemap:open-house-cities')
  }, 15_000)

  it('lists no city URL on the no-database path, and still lists the hub', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    regionHas(['L1', 'Bend'])

    const urls = await urlsOf()

    expect(cityOpenHouseUrls(urls)).toEqual([])
    expect(urls).toContain(`${BASE}/open-houses`)
    expect(dal.getUpcomingOpenHouses).not.toHaveBeenCalled()
  })
})
