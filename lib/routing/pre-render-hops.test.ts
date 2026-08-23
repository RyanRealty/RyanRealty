/**
 * The single entry point middleware.ts calls before render. Two properties
 * matter and neither is visible in a code review:
 *
 *   1. NO LOOPS. Every destination must be a fixed point — resolving it again
 *      returns null — or the edge 308s forever.
 *   2. NO COLLATERAL. A live route that merely shares a prefix must pass
 *      straight through; the whole point of putting the hop above the render is
 *      that nothing downstream gets a second chance to say no.
 */

import { describe, it, expect } from 'vitest'
import { PRE_RENDER_HOPS, PRE_RENDER_HOP_ROUTES, resolvePreRenderHop } from './pre-render-hops'
import { enumerateCanonicalCommunityRedirects } from '@/lib/communities/canonical-community-slug'

describe('resolvePreRenderHop', () => {
  it('claims each family and names the page route it supersedes', () => {
    expect(PRE_RENDER_HOP_ROUTES).toEqual(
      expect.arrayContaining([
        '/communities/[slug]',
        '/subdivisions/[slug]',
        '/cities/[slug]/[neighborhoodSlug]',
        '/neighborhoods/[slug]',
        '/reports/[slug]/[geoName]',
        '/housing-market/reports/[slug]/[geoName]',
      ]),
    )
    expect(PRE_RENDER_HOPS.every((h) => h.routes.length > 0 && h.id.length > 0)).toBe(true)
  })

  it('resolves each family in one hop', () => {
    expect(resolvePreRenderHop('/communities/bend-broken-top')).toBe('/communities/broken-top')
    expect(resolvePreRenderHop('/communities/bend-crosswater')).toBe('/communities/crosswater')
    expect(resolvePreRenderHop('/subdivisions/tetherow')).toBe('/communities/tetherow')
    expect(resolvePreRenderHop('/cities/sunriver/sunriver')).toBe('/communities/sunriver')
    expect(resolvePreRenderHop('/cities/bend/northwest-crossing')).toBe(
      '/communities/northwest-crossing',
    )
    expect(resolvePreRenderHop('/neighborhoods/awbrey-butte')).toBe('/cities/bend/awbrey-butte')
    expect(resolvePreRenderHop('/reports/city/Bend')).toBe('/housing-market/bend')
    expect(resolvePreRenderHop('/housing-market/reports/city/Bend')).toBe('/housing-market/bend')
  })

  it('decodes a percent-encoded segment', () => {
    expect(resolvePreRenderHop('/communities/bend%2Dbroken%2Dtop')).toBe('/communities/broken-top')
    expect(resolvePreRenderHop('/housing-market/reports/city/La%20Pine')).toBe('/housing-market/la-pine')
  })

  it('never loops — every destination is a fixed point', () => {
    const destinations = new Set<string>()
    for (const { from } of enumerateCanonicalCommunityRedirects()) {
      const dest = resolvePreRenderHop(`/communities/${from}`)
      if (dest) destinations.add(dest)
    }
    for (const p of [
      '/subdivisions/tetherow',
      '/subdivisions/awbrey-butte',
      '/neighborhoods/awbrey-butte',
      '/cities/sunriver/sunriver',
      '/cities/bend/northwest-crossing',
      '/reports/city/Bend',
      '/reports/community/Tetherow',
      '/housing-market/reports/city/Redmond',
    ]) {
      const dest = resolvePreRenderHop(p)
      if (dest) destinations.add(dest)
    }
    expect(destinations.size).toBeGreaterThan(5)
    for (const dest of destinations) expect(resolvePreRenderHop(dest)).toBeNull()
  })

  it('passes live routes through untouched', () => {
    for (const p of [
      '/',
      '/communities',
      '/communities/tetherow',
      '/communities/bend-three-rivers',
      '/communities/bend-awbrey-butte',
      '/subdivisions',
      '/subdivisions/tetherow-phase-1',
      '/neighborhoods',
      '/cities/bend/awbrey-butte',
      '/housing-market',
      '/housing-market/bend',
      '/housing-market/reports',
      '/housing-market/reports/weekly-2026-05-24',
      '/housing-market/reports/archive/bend',
      '/reports/sales/bend/2026',
      '/homes-for-sale/bend',
      '/listing/by-key/20200228140308644050000000',
    ]) {
      expect(resolvePreRenderHop(p)).toBeNull()
    }
  })
})
