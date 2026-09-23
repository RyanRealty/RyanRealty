/**
 * The served shape of /llms.txt and /llms-subdivisions.txt (AEO-2 / AEO-4,
 * visibility audit 2026-09-22), rendered through the real route handlers with
 * the DAL reads stubbed. Lives in lib/site because vitest's unit project does
 * not include app/llms.txt/.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The routes read NEXT_PUBLIC_SITE_URL at module load; pin the canonical host.
vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ryan-realty.com')

const PLATS = Array.from({ length: 40 }, (_, i) => ({ slug: `plat-${i}`, name: `Plat ${i}`, citySlug: 'bend' }))

vi.mock('@/lib/data', () => ({
  getRecentBlogPosts: vi.fn(async () => [
    { title: 'Closing Costs for Home Buyers in Bend, Oregon', slug: 'closing-costs-buyers-bend-oregon' },
    { title: 'A new post', slug: 'a-new-post' },
  ]),
  getPublishedGuides: vi.fn(async () => [{ title: 'Bend Housing Market Snapshot', slug: 'bend-housing-market-guide' }]),
  listMarketReports: vi.fn(async () => [{ title: 'Bend weekly', slug: 'bend-weekly' }]),
  getAllNeighborhoodsWithCity: vi.fn(async () => [
    { name: 'Awbrey Butte', slug: 'awbrey-butte', cities: { name: 'Bend', slug: 'bend' } },
  ]),
  getEventsForIndex: () => ({ upcoming: [], anchors: [] }),
  getVenuesForIndex: () => ({ music: [], performingArts: [] }),
  getTrailsForIndex: () => ({ hiking: [], biking: [] }),
}))
vi.mock('@/lib/data/subdivisions/getIndexableSubdivisions', () => ({
  getIndexableSubdivisions: vi.fn(async () => PLATS),
}))

async function render(path: 'llms' | 'subs'): Promise<string> {
  const mod =
    path === 'llms' ? await import('@/app/llms.txt/route') : await import('@/app/llms-subdivisions.txt/route')
  return (await mod.GET()).text()
}

function urls(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.match(/https?:\/\/[^\s)]+/)?.[0])
    .filter((u): u is string => Boolean(u))
}

describe('/llms.txt shape (AEO-4)', () => {
  let body = ''
  beforeEach(async () => {
    body = await render('llms')
  })

  it('leads with the brokerage and puts the plat list behind a linked secondary file', () => {
    const headings = body.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3))
    expect(headings.slice(0, 4)).toEqual(['Brokerage', 'Listings', 'Homes by type', 'Market Data'])
    expect(headings[headings.length - 1]).toBe('Optional')
    expect(headings).not.toContain('Subdivisions')
    expect(body).not.toContain('/subdivisions/plat-')
    expect(body).toContain('- Subdivisions (40 pages, one link each): https://ryan-realty.com/llms-subdivisions.txt')
  })

  it('lists every URL once', () => {
    const list = urls(body).map((u) => u.replace(/\/$/, ''))
    const dupes = list.filter((u, i) => list.indexOf(u) !== i)
    expect(dupes).toEqual([])
    expect(body.match(/closing-costs-buyers-bend-oregon/g)).toHaveLength(1)
    expect(body.match(/\/refer-a-client/g)).toHaveLength(1)
    expect(body.match(/ryan-realty\.com\/sell\b(?!\/)/g)).toHaveLength(1)
  })

  it('lists the city type pages with one-line descriptions and no hop URL', () => {
    expect(body).toContain(
      '- [Single-family homes in Bend](https://ryan-realty.com/cities/bend/types/single-family): Single-family homes for sale in Bend, Oregon, from the regional MLS, with list prices, photos, and a map.',
    )
    expect(body).not.toContain('/homes-for-sale/bend/northwest-crossing')
    expect(body).toContain('- [About Ryan Realty](https://ryan-realty.com/about): ')
  })

  it('keeps the dynamic families (guides, blog, reports, neighborhoods)', () => {
    expect(body).toContain('https://ryan-realty.com/blog/bend-housing-market-guide')
    expect(body).toContain('https://ryan-realty.com/blog/a-new-post')
    expect(body).toContain('https://ryan-realty.com/housing-market/reports/bend-weekly')
    expect(body).toContain('https://ryan-realty.com/cities/bend/awbrey-butte')
  })
})

describe('/llms-subdivisions.txt (AEO-4)', () => {
  it('serves the plat lines the main file used to carry, and links back', async () => {
    const body = await render('subs')
    expect(body).toContain('https://ryan-realty.com/llms.txt')
    expect(body.match(/\/subdivisions\/plat-/g)).toHaveLength(40)
  })
})
