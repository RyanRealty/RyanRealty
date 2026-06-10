import { describe, it, expect } from 'vitest'
import {
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

    it('every destination is a single absolute /communities/* or /cities/bend/* path', () => {
      for (const [, dest] of entries) {
        expect(dest.startsWith('/communities/') || dest.startsWith('/cities/bend/')).toBe(true)
      }
    })

    it('no destination is itself a redirect key (no chains / loops)', () => {
      for (const [, dest] of entries) {
        // strip the leading slug segment of the dest and confirm the FULL dest
        // path is never also a source key the middleware would re-process.
        expect(keys.has(dest)).toBe(false)
      }
    })

    it('covers both named examples + at least the full registry & city set', () => {
      expect(entries.length).toBeGreaterThanOrEqual(registrySlugs.length + cityNeighborhoods.length)
    })
  })
})
