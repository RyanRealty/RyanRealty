import { describe, it, expect } from 'vitest'
import {
  resolveNeighborhoodAliasRedirect,
  resolveSubdivisionAreaRedirect,
  subdivisionAreaRedirectEntries,
} from './subdivision-area-redirects'
import resortRegistry from '@/data/resort-communities.json'
import bendPolygons from '@/data/bend/bend-neighborhood-polygons.json'

/**
 * Contract: a MARKETING-level slug under /subdivisions/* must resolve to its
 * canonical home so middleware can issue a hard 308 (instead of the page
 * soft-404ing as a hollow 200). A real PLAT slug, or a slug with no confirmed
 * home, must resolve to null (pass through to the page).
 *
 * Pinned rules:
 *   - resort/area registry slug      → /communities/<slug>
 *   - City-of-Bend tier:'city' name  → /cities/bend/<route_slug>
 *   - both bare + 'bend-' prefixed forms resolve identically
 *   - tier:'community' polygons NOT in the registry → null (no confirmed home)
 *   - real plat / junk / empty       → null
 */

const registrySlugs = (resortRegistry.communities as Array<{ slug: string; city_slug: string }>)
const cityNeighborhoods = (bendPolygons.communities as Array<{ tier: string; slug: string; route_slug: string }>)
  .filter((e) => e.tier === 'city')
const excludedCommunityPolygons = (bendPolygons.communities as Array<{ tier: string; slug: string; route_slug: string }>)
  .filter((e) => e.tier === 'community' && !registrySlugs.some((r) => r.slug === e.slug))

describe('resolveSubdivisionAreaRedirect', () => {
  describe('the two named examples (the bug report)', () => {
    it('awbrey-butte (Bend neighborhood) → /cities/bend/awbrey-butte', () => {
      expect(resolveSubdivisionAreaRedirect('awbrey-butte')).toBe('/cities/bend/awbrey-butte')
    })
    it('tetherow (resort community) → /communities/tetherow', () => {
      expect(resolveSubdivisionAreaRedirect('tetherow')).toBe('/communities/tetherow')
    })
  })

  describe('bare + city-prefixed forms resolve identically', () => {
    it('bend-awbrey-butte → /cities/bend/awbrey-butte', () => {
      expect(resolveSubdivisionAreaRedirect('bend-awbrey-butte')).toBe('/cities/bend/awbrey-butte')
    })
    it('bend-tetherow → /communities/tetherow', () => {
      expect(resolveSubdivisionAreaRedirect('bend-tetherow')).toBe('/communities/tetherow')
    })
    it('trims + lowercases', () => {
      expect(resolveSubdivisionAreaRedirect('  Awbrey-Butte  ')).toBe('/cities/bend/awbrey-butte')
      expect(resolveSubdivisionAreaRedirect('TETHEROW')).toBe('/communities/tetherow')
    })
    it('tolerates a trailing slash', () => {
      expect(resolveSubdivisionAreaRedirect('tetherow/')).toBe('/communities/tetherow')
    })
  })

  describe('every registry community resolves to /communities/<slug>', () => {
    it.each(registrySlugs.map((c) => c.slug))('%s', (slug) => {
      expect(resolveSubdivisionAreaRedirect(slug)).toBe(`/communities/${slug}`)
    })
  })

  describe('every City-of-Bend neighborhood resolves to /cities/bend/<route_slug>', () => {
    it.each(cityNeighborhoods.map((e) => [e.route_slug, e.slug] as const))(
      '%s (+ %s)',
      (routeSlug, prefixedSlug) => {
        const dest = `/cities/bend/${routeSlug}`
        expect(resolveSubdivisionAreaRedirect(routeSlug)).toBe(dest)
        expect(resolveSubdivisionAreaRedirect(prefixedSlug)).toBe(dest)
      },
    )
  })

  describe('null (pass through to the page — must NOT redirect)', () => {
    it('a real PLAT slug is never redirected', () => {
      expect(resolveSubdivisionAreaRedirect('tetherow-phase-1')).toBeNull()
      expect(resolveSubdivisionAreaRedirect('awbrey-butte-homesites-phase-eight')).toBeNull()
    })
    it('a community-tier polygon with no confirmed home is excluded', () => {
      // Guard the test itself — if the registry ever absorbs all of these the
      // exclusion set is empty and there is nothing to assert.
      expect(excludedCommunityPolygons.length).toBeGreaterThan(0)
      for (const e of excludedCommunityPolygons) {
        expect(resolveSubdivisionAreaRedirect(e.slug)).toBeNull()
      }
    })
    it('junk / empty / whitespace', () => {
      expect(resolveSubdivisionAreaRedirect('totally-made-up-phase-9')).toBeNull()
      expect(resolveSubdivisionAreaRedirect('')).toBeNull()
      expect(resolveSubdivisionAreaRedirect('   ')).toBeNull()
    })
  })

  describe('map integrity (no loops, single-hop, valid destinations)', () => {
    const entries = subdivisionAreaRedirectEntries()
    const keys = new Set(entries.map(([k]) => k))

    // /subdivisions/* and /homes-for-sale/* joined the allowed destinations on
    // 2026-08-26. A marketing AREA name goes to a community or city page, but a
    // plat ALIAS has to land on the plat itself — the county records The Farm as
    // "Farm (the)", slug farm-the — or, when the MLS name spans several plats
    // (Shevlin Bluffs is three), on the browse pair that carries all of them.
    it('every destination is a single absolute path in the allowed set', () => {
      const ALLOWED = ['/communities/', '/cities/bend/', '/subdivisions/', '/homes-for-sale/']
      for (const [, dest] of entries) {
        expect(ALLOWED.some((p) => dest.startsWith(p))).toBe(true)
        expect(dest.split('?')[0].endsWith('/')).toBe(false)
      }
    })

    it('no destination is itself a redirect key (no chains / loops)', () => {
      for (const [, dest] of entries) {
        // The FULL dest path is never a source key.
        expect(keys.has(dest)).toBe(false)
        // And — the case that matters now that /subdivisions/* is a legal
        // destination — the dest's own SLUG is never a key either, or the
        // middleware would 308 the hop it just served into a second hop.
        if (dest.startsWith('/subdivisions/')) {
          expect(keys.has(dest.slice('/subdivisions/'.length))).toBe(false)
        }
      }
    })

    it('covers both named examples + at least the full registry & city set', () => {
      expect(entries.length).toBeGreaterThanOrEqual(registrySlugs.length + cityNeighborhoods.length)
    })
  })
})

describe('resolveNeighborhoodAliasRedirect', () => {
  it('Awbrey Butte 308s to the live city report', () => {
    expect(resolveNeighborhoodAliasRedirect('awbrey-butte')).toBe('/cities/bend/awbrey-butte')
  })

  it('every City-of-Bend district maps to /cities/bend/{slug}', () => {
    for (const e of cityNeighborhoods) {
      expect(resolveNeighborhoodAliasRedirect(e.route_slug)).toBe(`/cities/bend/${e.route_slug}`)
    }
  })

  it('tetherow stays null — it is a resort, not a neighborhood', () => {
    expect(resolveNeighborhoodAliasRedirect('tetherow')).toBeNull()
    expect(resolveNeighborhoodAliasRedirect('bend-tetherow')).toBeNull()
  })

  it('junk stays null', () => {
    expect(resolveNeighborhoodAliasRedirect('not-a-real-place-xyz')).toBeNull()
    expect(resolveNeighborhoodAliasRedirect('')).toBeNull()
  })
})
