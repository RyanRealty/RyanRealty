import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BEND_NEW_CONSTRUCTION_CANONICAL_PATH,
  BEND_NEW_CONSTRUCTION_SEARCH_TWIN_PATH,
  hasBendNewConstructionSearchFacet,
  isBendNewConstructionSearchTwin,
  isBendNewConstructionSearchTwinPath,
  isBendNewConstructionSearchTwinSlug,
  resolveBendNewConstructionSearchTwinHop,
} from './bend-new-construction-search-twin'

function src(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('Bend new-construction search twin (SITE-179)', () => {
  it('names the two URLs', () => {
    expect(BEND_NEW_CONSTRUCTION_SEARCH_TWIN_PATH).toBe('/homes-for-sale/bend/new-construction')
    expect(BEND_NEW_CONSTRUCTION_CANONICAL_PATH).toBe('/new-construction')
    expect(src('lib/site/bend-new-construction.ts')).toContain(
      "export const BEND_NEW_CONSTRUCTION_PATH = '/new-construction'",
    )
  })

  it('hops the exact Bend preset path, including trailing slash and camera params', () => {
    expect(resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/new-construction')).toBe(
      '/new-construction',
    )
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/new-construction/'),
    ).toBe('/new-construction')
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/Bend/New-Construction'),
    ).toBe('/new-construction')
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/new-construction', {
        view: 'map',
        bbox: '1,2,3,4',
        page: '2',
        sort: 'price_desc',
        perPage: '24',
      }),
    ).toBe('/new-construction')
    expect(
      isBendNewConstructionSearchTwinSlug(['bend', 'new-construction'], { view: 'split' }),
    ).toBe(true)
  })

  it('does not hop a faceted NC URL, another city, or a 3-segment combo', () => {
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/new-construction', {
        minPrice: '500000',
      }),
    ).toBeNull()
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/new-construction', {
        beds: '3',
      }),
    ).toBeNull()
    expect(
      resolveBendNewConstructionSearchTwinHop(
        '/homes-for-sale/bend/new-construction',
        new URLSearchParams('maxPrice=900000'),
      ),
    ).toBeNull()
    expect(resolveBendNewConstructionSearchTwinHop('/homes-for-sale/redmond/new-construction')).toBeNull()
    expect(resolveBendNewConstructionSearchTwinHop('/homes-for-sale/new-construction')).toBeNull()
    expect(
      resolveBendNewConstructionSearchTwinHop('/homes-for-sale/bend/stevens-ranch/new-construction'),
    ).toBeNull()
    expect(resolveBendNewConstructionSearchTwinHop('/new-construction')).toBeNull()
    expect(isBendNewConstructionSearchTwinSlug(['bend', 'new-construction', 'x'])).toBe(false)
    expect(isBendNewConstructionSearchTwinSlug(['redmond', 'new-construction'])).toBe(false)
    expect(hasBendNewConstructionSearchFacet({ beds: '4' })).toBe(true)
    expect(hasBendNewConstructionSearchFacet({ view: 'map' })).toBe(false)
    expect(isBendNewConstructionSearchTwinPath('/homes-for-sale/bend/condos')).toBe(false)
    expect(isBendNewConstructionSearchTwin('/homes-for-sale/bend/new-construction', { baths: '2' })).toBe(
      false,
    )
  })

  it('wires a real 308 in middleware, canonical+noindex in search metadata, and sitemap omit', () => {
    const mw = src('middleware.ts')
    expect(mw).toMatch(/resolveBendNewConstructionSearchTwinHop\(/)
    expect(mw).toMatch(/NextResponse\.redirect\(redirectUrl, 308\)/)

    const meta = src('app/search/[...slug]/search-metadata.ts')
    expect(meta).toMatch(/isBendNewConstructionSearchTwinSlug\(/)
    expect(meta).toMatch(/BEND_NEW_CONSTRUCTION_CANONICAL_PATH/)
    expect(meta).toMatch(/index:\s*false,\s*follow:\s*true/)

    const sitemap = src('app/sitemap.ts')
    expect(sitemap).toMatch(/isBendNewConstructionSearchTwinPath\(/)
    expect(sitemap).toMatch(/\$\{baseUrl\}\/new-construction/)

    const page = src('app/search/[...slug]/page.tsx')
    expect(page).not.toMatch(/\bpermanentRedirect\(/)
    expect(page).toMatch(/alternates:\s*\{\s*canonical:\s*canonicalUrl\s*\}/)
  })
})
