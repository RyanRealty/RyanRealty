import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterRogueCityUrls } from './sitemap-guard'

const BASE = 'https://ryan-realty.com'

// The sanctioned neighborhood paths (as the sitemap records them).
const allowed = new Set<string>(['/cities/bend/larkspur', '/cities/redmond/canyon-rim'])

// Build the SAME rogue URL string four different ways — the exact vectors the
// independent verifier used to evade the source-text regex. The guard inspects
// final strings, so all four must be caught identically.
const city = 'bend'
const sub = 'awbrey-butte' // a subdivision slug — NOT a neighborhood -> the route 404s
const rogueTemplate = `${BASE}/cities/${city}/${sub}`
const rogueConcat = BASE + '/cities/' + city + '/' + sub
const rogueJoin = [BASE, 'cities', city, sub].join('/')
const b2 = BASE
const rogueAliased = `${b2}/cities/${city}/${sub}`

describe('filterRogueCityUrls (W1.3/P0.3 output-based drift backstop)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errSpy.mockRestore())

  it('drops a rogue 2-segment /cities URL however it was constructed', () => {
    for (const [label, url] of [
      ['template', rogueTemplate],
      ['concatenation', rogueConcat],
      ['Array.join', rogueJoin],
      ['aliased baseUrl', rogueAliased],
    ] as const) {
      const kept = filterRogueCityUrls([{ url }], allowed)
      expect(kept, `rogue via ${label} must be dropped`).toEqual([])
    }
    // all four are byte-identical, so this also proves construction-independence
    expect(new Set([rogueTemplate, rogueConcat, rogueJoin, rogueAliased]).size).toBe(1)
  })

  it('drops a rogue non-absolute /cities URL in every string shape a crawler resolves', () => {
    // Each of these resolves (per the WHATWG URL algorithm crawlers use) to the
    // pathname /cities/bend/awbrey-butte — a 404ing subdivision, not a neighborhood.
    for (const url of [
      '/cities/bend/awbrey-butte', // root-relative
      '/cities/bend/awbrey-butte?x=1', // + query
      '/cities/bend/awbrey-butte/', // + trailing slash
      '//ryan-realty.com/cities/bend/awbrey-butte', // protocol-relative (resolves + is crawlable)
      'cities/bend/awbrey-butte', // no leading slash
      './cities/bend/awbrey-butte', // dot-relative
      '../cities/bend/awbrey-butte', // parent-relative
      'http://example.com/cities/bend/awbrey-butte', // different host, same rogue shape
    ]) {
      expect(filterRogueCityUrls([{ url }], allowed), `must drop rogue shape: ${url}`).toEqual([])
    }
    // sanctioned neighborhood in a non-absolute shape is still kept
    expect(filterRogueCityUrls([{ url: '/cities/bend/larkspur' }], allowed).length).toBe(1)
    expect(filterRogueCityUrls([{ url: '//ryan-realty.com/cities/redmond/canyon-rim' }], allowed).length).toBe(1)
  })

  it('keeps sanctioned neighborhood URLs (both with and without a trailing slash)', () => {
    const entries = [
      { url: `${BASE}/cities/bend/larkspur` },
      { url: `${BASE}/cities/redmond/canyon-rim/` },
    ]
    expect(filterRogueCityUrls(entries, allowed).map((e) => e.url)).toEqual(entries.map((e) => e.url))
  })

  it('never touches 1-segment /cities hubs, deeper paths, or non-/cities URLs', () => {
    const entries = [
      { url: `${BASE}/cities/bend` },
      { url: `${BASE}/cities` },
      { url: `${BASE}/homes-for-sale/bend/awbrey-butte` },
      { url: `${BASE}/subdivisions/awbrey-butte` },
      { url: `${BASE}/` },
    ]
    expect(filterRogueCityUrls(entries, allowed).map((e) => e.url)).toEqual(entries.map((e) => e.url))
  })

  it('logs each drop so a regression is visible in production logs', () => {
    filterRogueCityUrls([{ url: rogueTemplate }], allowed)
    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(String(errSpy.mock.calls[0][0])).toContain('rogue 2-segment /cities')
  })
})
