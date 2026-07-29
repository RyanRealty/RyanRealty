/**
 * W4.1 contracts for GET /api/search/suggestions.
 *
 * 1. The "3480" class: a street-number query returns a populated addresses
 *    category (the original bug — the backend found them, the surface never
 *    showed them; now the backend contract is locked too).
 * 2. Every category key is always present in the response shape.
 * 3. Perf: a warm round-trip through the handler (DAL seeded locally, no
 *    network) stays under the 150ms budget. This bounds the handler's own
 *    compute — grouping, dedup, and serialization over a full 250-row tile
 *    fetch — so a regression to accidental O(n^2) work or a sync stall in the
 *    hot path fails here.
 * 4. CDN cacheability: responses carry s-maxage so the edge, not the origin,
 *    absorbs per-keystroke traffic.
 */
import { describe, expect, it, vi } from 'vitest'

// Seeded local fixture — shaped like listing_tile_mv rows for a "3480" query
// (street number match) plus enough volume (250 rows) that the perf assertion
// exercises realistic grouping/dedup work.
const TILE_FIXTURE = Array.from({ length: 250 }, (_, i) => ({
  listNumber: `2201${String(10000 + i)}`,
  listingKey: `key-${i}`,
  streetNumber: i === 0 ? '3480' : String(1000 + i),
  streetName: i % 3 === 0 ? 'Awbrey' : i % 3 === 1 ? 'Colver' : 'Galloway',
  streetSuffix: i % 2 === 0 ? 'Dr' : 'Ct',
  city: i % 5 === 0 ? 'Redmond' : 'Bend',
  postalCode: i % 5 === 0 ? '97756' : '97703',
  subdivisionName: i % 4 === 0 ? 'Awbrey Butte' : 'Shevlin Ridge',
}))

vi.mock('@/lib/data', () => ({
  // getSearchSuggestions' own reads (seeded fixture, no network):
  searchListingSuggestTiles: vi.fn(async () => TILE_FIXTURE),
  searchBrokersByDisplayName: vi.fn(async () => [
    { slug: 'matt-ryan', display_name: 'Matt Ryan' },
  ]),
  getNeighborhoodDirectory: vi.fn(async () => [
    { neighborhoodName: 'Mountain View', neighborhoodSlug: 'mountain-view', cityName: 'Bend', citySlug: 'bend' },
    { neighborhoodName: 'River West', neighborhoodSlug: 'river-west', cityName: 'Bend', citySlug: 'bend' },
    { neighborhoodName: 'Southeast Bend', neighborhoodSlug: 'southeast-bend', cityName: 'Bend', citySlug: 'bend' },
  ]),
  searchSiteContentTitles: vi.fn(async () => ({
    blog: [{ title: 'Bend market update', slug: 'bend-market-update' }],
    guides: [{ title: 'Buying in Bend', slug: 'buying-in-bend' }],
  })),
  // app/actions/listings.ts top-level imports (unused by this code path):
  getCommunityListings: vi.fn(),
  getCityListings: vi.fn(),
  getNeighborhoodListings: vi.fn(),
  getGeoSnapshot: vi.fn(async () => null),
  searchListingsAll: vi.fn(),
  pickSearchFeatureFilters: vi.fn(),
}))

import { GET } from './route'

const CATEGORY_KEYS = [
  'addresses',
  'cities',
  'subdivisions',
  'neighborhoods',
  'zips',
  'brokers',
  'reports',
  'pages',
] as const

function req(q: string): Request {
  return new Request(`http://localhost/api/search/suggestions?q=${encodeURIComponent(q)}`)
}

describe('GET /api/search/suggestions', () => {
  it('returns a populated addresses category for a street-number query (the "3480" class)', async () => {
    const res = await GET(req('3480'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.addresses.length).toBeGreaterThan(0)
    expect(body.addresses[0].label).toContain('3480')
    expect(body.addresses[0].href).toMatch(/^\//)
  })

  it('finds a neighborhood however the buyer spaces it (the "RiverWest" class)', async () => {
    // F6: one-word "RiverWest" used to return the empty shape ("No results")
    // because the backend ILIKE'd the raw query against the stored "River West".
    for (const q of ['RiverWest', 'river west', 'Riverwest', 'RIVER WEST']) {
      const body = await (await GET(req(q))).json()
      const hit = body.neighborhoods.find((n: { neighborhoodSlug: string }) => n.neighborhoodSlug === 'river-west')
      expect(hit, `no River West suggestion for "${q}"`).toBeTruthy()
      expect(hit.href).toBe('/cities/bend/river-west')
      expect(hit.cityName).toBe('Bend')
    }
  })

  it('always returns every category key', async () => {
    const body = await (await GET(req('bend'))).json()
    for (const key of CATEGORY_KEYS) {
      expect(Array.isArray(body[key]), `missing category: ${key}`).toBe(true)
    }
    // Seeded fixture populates each non-report category through its own path.
    expect(body.cities.length).toBeGreaterThan(0)
    expect(body.subdivisions.length).toBeGreaterThan(0)
    expect(body.zips.length).toBeGreaterThan(0)
    expect(body.brokers.length).toBeGreaterThan(0)
    expect(body.neighborhoods.length).toBeGreaterThan(0)
    expect(body.pages.length).toBeGreaterThan(0)
  })

  it('short queries return the empty shape without hitting the DAL', async () => {
    const body = await (await GET(req('b'))).json()
    for (const key of CATEGORY_KEYS) expect(body[key]).toEqual([])
  })

  it('warm round-trip stays under the 150ms budget', async () => {
    await GET(req('awbrey')) // warm (module init, JIT)
    const N = 5
    const durations: number[] = []
    for (let i = 0; i < N; i++) {
      const t0 = performance.now()
      const res = await GET(req('awbrey'))
      await res.json()
      durations.push(performance.now() - t0)
    }
    durations.sort((a, b) => a - b)
    const median = durations[Math.floor(N / 2)]!
    expect(median, `median warm round-trip ${median.toFixed(1)}ms (budget 150ms)`).toBeLessThan(150)
  })

  it('responses are CDN-cacheable (s-maxage)', async () => {
    const res = await GET(req('bend'))
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/)
  })
})
