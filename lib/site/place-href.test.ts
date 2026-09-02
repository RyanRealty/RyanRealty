import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cityHref,
  cityNeighborhoodHref,
  hasCityNeighborhoodPages,
  subdivisionHref,
} from '@/lib/site/place-href'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { resolvePreRenderHop } from '@/lib/routing/pre-render-hops'

const middleware = readFileSync(resolve('middleware.ts'), 'utf8')
const nextConfig = readFileSync(resolve('next.config.ts'), 'utf8')

describe('cityHref', () => {
  it('sends a service-area city to /cities and an out-of-area city to /oregon', () => {
    expect(cityHref('bend')).toBe('/cities/bend')
    expect(cityHref('la-pine')).toBe('/cities/la-pine')
    expect(cityHref('medford')).toBe('/oregon/medford')
    expect(cityHref('klamath-falls')).toBe('/oregon/klamath-falls')
    expect(cityHref('chiloquin')).toBe('/oregon/chiloquin')
  })

  it('returns null rather than a dead door when there is no slug', () => {
    for (const empty of ['', '   ', null, undefined]) {
      expect(cityHref(empty)).toBeNull()
    }
  })

  it('normalizes the slug the way middleware does before it routes', () => {
    expect(cityHref('  Medford ')).toBe('/oregon/medford')
    expect(cityHref('BEND')).toBe('/cities/bend')
  })

  it('mirrors middleware.ts: the service-area set picks the shape', () => {
    // Asserted against middleware's own source so a change to the routing rule
    // surfaces here rather than as a redirect in shipped HTML.
    expect(middleware).toContain(
      'if (!CENTRAL_OREGON_CITY_SLUGS.has(slug)) return `/oregon/${encodeURIComponent(slug)}`',
    )
    expect(middleware).toContain(
      'if (CENTRAL_OREGON_CITY_SLUGS.has(slug)) return `/cities/${encodeURIComponent(slug)}`',
    )
    for (const slug of CENTRAL_OREGON_CITY_SLUGS) {
      const href = cityHref(slug)
      expect(href, slug).not.toBeNull()
      // Never /oregon/<service-area-slug>, which 308s straight back.
      expect(href!.startsWith('/oregon/'), slug).toBe(false)
    }
  })

  it('answers every per-slug /cities redirect in next.config.ts', () => {
    const rules = [
      ...nextConfig.matchAll(/source:\s*'(\/cities\/[^'\n]+)'\s*,\s*destination:\s*'([^'\n]+)'/g),
    ]
      .map(([, source, destination]) => ({ source, destination }))
      .filter(({ source }) => /^\/cities\/[a-z0-9-]+$/.test(source))
    // A zero-row result would mean the regex stopped matching the config's
    // shape, not that the config stopped redirecting — fail rather than pass.
    expect(rules.length).toBeGreaterThan(0)
    for (const { source, destination } of rules) {
      const slug = source.slice('/cities/'.length)
      expect(cityHref(slug), `${source} still built as its own redirecting path`).toBe(destination)
      expect(hasCityNeighborhoodPages(slug), source).toBe(false)
    }
  })
})

describe('hasCityNeighborhoodPages', () => {
  it('is true only for cities whose own page is /cities/<slug>', () => {
    expect(hasCityNeighborhoodPages('bend')).toBe(true)
    expect(hasCityNeighborhoodPages('redmond')).toBe(true)
    expect(hasCityNeighborhoodPages('medford')).toBe(false)
    expect(hasCityNeighborhoodPages(null)).toBe(false)
  })
})

describe('cityNeighborhoodHref', () => {
  it('keeps a Bend district on its two-segment page', () => {
    expect(cityNeighborhoodHref('bend', 'awbrey-butte')).toBe('/cities/bend/awbrey-butte')
  })

  it('lands a registry community on its own page instead of the 308', () => {
    expect(cityNeighborhoodHref('bend', 'northwest-crossing')).toBe('/communities/northwest-crossing')
    expect(cityNeighborhoodHref('redmond', 'eagle-crest')).toBe('/communities/eagle-crest')
  })

  it('falls back to the city door where no neighborhood pages exist', () => {
    expect(cityNeighborhoodHref('medford', 'somewhere')).toBe('/oregon/medford')
  })

  it('returns null without both slugs', () => {
    expect(cityNeighborhoodHref('bend', null)).toBeNull()
    expect(cityNeighborhoodHref(null, 'awbrey-butte')).toBeNull()
  })
})

describe('subdivisionHref', () => {
  it('passes a real plat slug through', () => {
    expect(subdivisionHref('awbrey-glen-homesites-ph-1')).toBe('/subdivisions/awbrey-glen-homesites-ph-1')
  })

  it('lands a marketing-area slug on the page that holds it', () => {
    const hopped = resolvePreRenderHop('/subdivisions/awbrey-butte')
    expect(hopped, 'fixture slug no longer hops — pick another marketing area').not.toBeNull()
    expect(subdivisionHref('awbrey-butte')).toBe(hopped)
  })

  it('returns null without a slug', () => {
    expect(subdivisionHref(null)).toBeNull()
  })
})

describe('no door this module builds is itself a pre-render hop', () => {
  it('every built path is settled', () => {
    const built = [
      cityHref('bend'),
      cityHref('medford'),
      cityHref('crooked-river-ranch'),
      cityNeighborhoodHref('bend', 'awbrey-butte'),
      cityNeighborhoodHref('bend', 'northwest-crossing'),
      subdivisionHref('awbrey-butte'),
    ].filter((p): p is string => p != null)
    for (const path of built) {
      expect(resolvePreRenderHop(path), path).toBeNull()
    }
  })
})
