import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAtlasTiles = vi.fn()
const cacheKeys: string[][] = []

vi.mock('@/lib/data', () => ({ getAtlasTiles: (args: unknown) => getAtlasTiles(args) }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keyParts: string[]) => {
    cacheKeys.push(keyParts)
    return fn
  },
}))

const NOW = Date.parse('2026-09-23T12:00:00Z')

function tile(key: string, lng: number, extra: Record<string, unknown> = {}) {
  return {
    listingKey: key,
    listingId: key,
    lat: 44.05,
    lng,
    status: 'Active',
    listPrice: 500_000,
    city: 'Bend',
    subdivisionName: null,
    onMarketDate: '2026-09-20',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    streetNumber: '1',
    streetName: 'Test',
    ...extra,
  }
}

describe('atlas population cache key (visibility audit P13)', () => {
  beforeEach(() => {
    vi.resetModules()
    getAtlasTiles.mockReset()
    cacheKeys.length = 0
  })

  it('two keyed scopes in one city, and the city itself, are three different entries', async () => {
    const { atlasPopulationCacheKey } = await import('./build-place-atlas')
    const a = atlasPopulationCacheKey({ cities: ['Bend'], listingKeys: ['1', '2'] }, NOW)
    const b = atlasPopulationCacheKey({ cities: ['Bend'], listingKeys: ['3'] }, NOW)
    const city = atlasPopulationCacheKey({ cities: ['Bend'] }, NOW)
    expect(new Set([a, b, city]).size).toBe(3)
    // Order and spelling of the same scope do not split the entry.
    expect(atlasPopulationCacheKey({ cities: [' bend '], listingKeys: ['2', '1', '1'] }, NOW)).toBe(a)
  })

  it('the page and the dots route read ONE cache entry for one scope, and it carries no page text', async () => {
    const { buildPlaceAtlas, buildAtlasDots } = await import('./build-place-atlas')
    getAtlasTiles.mockResolvedValue([tile('a', -121.3), tile('b', -121.31, { subdivisionName: null, city: null })])
    const boundary: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.4, 44.0],
          [-121.2, 44.0],
          [-121.2, 44.1],
          [-121.4, 44.1],
          [-121.4, 44.0],
        ],
      ],
    }
    const page = await buildPlaceAtlas({ cities: ['Bend'], boundary, label: 'Testville' }, NOW)
    const route = await buildAtlasDots({ cities: ['Bend'], boundary }, NOW)
    expect(cacheKeys).toHaveLength(2)
    expect(cacheKeys[0]).toEqual(cacheKeys[1])
    expect(route.dots).toEqual(page.dots)
    expect(route.stamp).toBe(page.stamp)
    // The page's own name enters after the cache: in its source line and as
    // the fallback place of an event whose tile names none.
    expect(page.source).toContain('inside the recorded boundary of Testville')
    expect(JSON.stringify(route)).not.toContain('Testville')
  })

  it('events still name the tile’s own place, and fall back to the page’s name', async () => {
    const { buildPlaceAtlas } = await import('./build-place-atlas')
    getAtlasTiles.mockResolvedValue([tile('a', -121.3, { city: null })])
    const pop = await buildPlaceAtlas({ cities: ['Bend'], label: 'Central Oregon' }, NOW)
    expect(pop.events).toEqual([
      { key: 'new:a', kind: 'new', label: 'Just listed in Central Oregon, $500,000', href: expect.any(String) },
    ])
  })
})
