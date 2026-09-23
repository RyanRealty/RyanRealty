/**
 * app/search/[...slug]/search-metadata.ts, end to end from the URL segments through
 * resolveSlug and the shared browse-pair decision (visibility audit
 * 2026-09-22: SEO-1, SEO-6, EXP-2, EXP-4, EXP-6; gsc-trend-5). The data reads
 * are mocked at the DAL boundary; everything between the URL and the robots
 * tag runs for real.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const activeNames: Record<string, string> = {}

vi.mock('@/app/actions/listings', () => ({
  getCityFromSlug: async (slug: string) =>
    ({ bend: 'Bend', prineville: 'Prineville', sisters: 'Sisters', redmond: 'Redmond' } as Record<string, string>)[slug] ?? null,
  getSubdivisionNameFromSlug: async (city: string, slug: string) => activeNames[`${city}/${slug}`] ?? null,
  getNeighborhoodNameForCitySlug: async (city: string, slug: string) =>
    city === 'bend' && slug === 'awbrey-butte' ? 'Awbrey Butte' : null,
}))
vi.mock('@/app/actions/banners', () => ({ getBannerUrl: async () => null }))
vi.mock('@/app/actions/subdivision-descriptions', () => ({ getSubdivisionDescription: async () => null }))

const matrix = { positiveCityPresets: new Set<string>(), positivePaths: new Set<string>() }
vi.mock('@/lib/seo/getSearchMatrixEntries', async () => {
  const twin = await import('@/lib/seo/place-type-twin')
  return {
    resolveMatrixNoIndex: async () => false,
    resolvePresetTypeTwinPath: async (slug: string[], preset: string | null) => {
      if (!preset) return null
      if (slug.length === 2) return twin.cityPresetTypeTwin(slug[0]!, preset, matrix.positiveCityPresets)
      if (slug.length === 3) return twin.communityPresetTypeTwin(slug[0]!, slug[1]!, preset, matrix.positivePaths)
      return null
    },
  }
})

const row = (standard_status: string, n: number) => ({ subdivision_name: 'x', standard_status, n })
const inventory = vi.fn()
vi.mock('@/lib/data/subdivisions/getSubdivisionCityInventory', () => ({
  getSubdivisionCityInventory: () => inventory(),
}))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({
  getIndexableSubdivisions: async () => [{ slug: 'boulevard', name: 'Boulevard', citySlug: 'bend', closedCount: 40 }],
}))
vi.mock('@/lib/data/subdivisions/getPlatClosedCounts', () => ({
  getPlatClosedCounts: async () => [
    { slug: 'boulevard', label: 'Boulevard', topCityLower: 'bend' },
    // A recorded plat the MLS never files a listing under (refused, with a door).
    { slug: 'south-bend-vacation-plat', label: 'South Bend Vacation Plat', topCityLower: 'bend' },
  ],
}))

import { buildSearchSlugMetadata } from '@/app/search/[...slug]/search-metadata'

async function meta(slug: string[], sp: Record<string, string> = {}) {
  return buildSearchSlugMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) })
}

const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl
})

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://ryan-realty.com'
  inventory.mockReset().mockResolvedValue([
    { cityLower: 'bend', subdivisionName: 'Cambria', rows: [row('Closed', 22)] },
    { cityLower: 'bend', subdivisionName: 'Boulevard', rows: [row('Closed', 40)] },
    { cityLower: 'bend', subdivisionName: 'Amundson', rows: [row('Closed', 7)] },
    { cityLower: 'bend', subdivisionName: 'Cascade Vill Mob HP', rows: [row('Closed', 93), row('Active', 6)] },
  ])
  matrix.positiveCityPresets = new Set()
  matrix.positivePaths = new Set()
  for (const k of Object.keys(activeNames)) delete activeNames[k]
})

describe('SEO-1: a made-up area fails CLOSED', () => {
  it.each([
    [['bend', 'p1-fixagent-garbage-91']],
    [['prineville', 'p1-no-such-place']],
    [['sisters', 'phantom-ranch-xyz', 'under-500k']],
  ])('%j -> noindex,follow, honest title, no canonical, no invented name', async (slug) => {
    const { canonicalUrl, metadata } = await meta(slug)
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.title).toBe('No area at this address')
    expect(canonicalUrl).toBeNull()
    expect(JSON.stringify(metadata)).not.toMatch(/Garbage|No Such Place|Phantom Ranch/)
  })

  it('a recorded plat slug with no MLS pair refuses too, but names the plat instead of "no area"', async () => {
    const { canonicalUrl, metadata } = await meta(['bend', 'south-bend-vacation-plat'])
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.title).toBe('South Bend Vacation Plat has its own page')
    expect(canonicalUrl).toBeNull()
  })

  it('a real pair still indexes with its own canonical and name', async () => {
    const { canonicalUrl, metadata } = await meta(['bend', 'cambria'])
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.title).toBe('Cambria homes for sale')
    expect(canonicalUrl).toBe('https://ryan-realty.com/homes-for-sale/bend/cambria')
  })

  it('a neighborhood and a preset are areas too (never refused)', async () => {
    expect((await meta(['bend', 'awbrey-butte'])).metadata.robots).toEqual({ index: true, follow: true })
    expect((await meta(['bend', 'under-500k'])).metadata.robots).toEqual({ index: true, follow: true })
  })
})

describe('EXP-4 / SEO-6 / EXP-2: the shared decision drives robots and canonical', () => {
  it('a plat twin points its canonical at /subdivisions/{slug}', async () => {
    const { canonicalUrl, metadata } = await meta(['bend', 'boulevard'])
    expect(canonicalUrl).toBe('https://ryan-realty.com/subdivisions/boulevard')
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it('a pair with no homes for sale and under 10 sales is noindex,follow', async () => {
    const { canonicalUrl, metadata } = await meta(['bend', 'amundson'])
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(canonicalUrl).toBe('https://ryan-realty.com/homes-for-sale/bend/amundson')
  })

  it('an MLS code is noindex and never printed', async () => {
    const { metadata } = await meta(['bend', 'cascade-vill-mob-hp'])
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.title).toBe('Homes for sale in an MLS-coded area of Bend')
    expect(JSON.stringify(metadata)).not.toMatch(/Cascade Vill/i)
  })
})

describe('EXP-6: a type preset with inventory canonicalizes to its type page', () => {
  it('city type preset -> /cities/{city}/types/{type}', async () => {
    matrix.positiveCityPresets = new Set(['/homes-for-sale/bend/single-family'])
    const { canonicalUrl, metadata } = await meta(['bend', 'single-family'])
    expect(canonicalUrl).toBe('https://ryan-realty.com/cities/bend/types/single-family')
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it('no verified inventory -> the preset keeps its own canonical', async () => {
    const { canonicalUrl } = await meta(['bend', 'single-family'])
    expect(canonicalUrl).toBe('https://ryan-realty.com/homes-for-sale/bend/single-family')
  })
})

describe('gsc-trend-5: the map camera never flips the city page to noindex', () => {
  it('/homes-for-sale/bend?bbox=… (written by the map on first settle) stays index,follow and canonical to the clean URL', async () => {
    const { canonicalUrl, metadata } = await meta(['bend'], { bbox: '-121.4,44.0,-121.2,44.1' })
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.title).toBe('Bend homes for sale')
    expect(canonicalUrl).toBe('https://ryan-realty.com/homes-for-sale/bend')
  })

  it('a real filter variant still noindexes', async () => {
    const { metadata } = await meta(['bend'], { minPrice: '800000' })
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })
})
