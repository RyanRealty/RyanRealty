/**
 * The sitemap smoke must actually fail.
 *
 * SITE-54: on 2026-09-09 /sitemaps/geo.xml returned 504 twice on production and
 * core.xml twice more, while the deploy was READY, `/` answered 200 and the
 * build telemetry was green. deploy:verify now probes every sitemap class, and
 * a check that cannot be shown to fail is not a check — these cases drive it
 * with a stub fetch through each way the route family has actually died.
 */

import { describe, expect, it } from 'vitest'
import { probeSitemapClasses, SITEMAP_SMOKE_FIRST_WAVE, SITEMAP_SMOKE_PATHS } from './sitemap-smoke.mjs'
import { CI_PROBE_USER_AGENT } from './ci-probe-ua.mjs'

const URLSET = '<?xml version="1.0"?><urlset><url><loc>https://ryan-realty.com/subdivisions/golf-homes-at-tetherow</loc></url></urlset>'
const INDEX = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://ryan-realty.com/sitemaps/geo.xml</loc></sitemap></sitemapindex>'
const EMPTY_URLSET = '<?xml version="1.0"?><urlset>\n\n</urlset>'

function stubFetch(handler) {
  return async (url) => {
    const path = new URL(url).pathname
    const { status, body } = handler(path)
    return { status, text: async () => body }
  }
}

const allGood = stubFetch((path) => ({
  status: 200,
  body: path === '/sitemap.xml' ? INDEX : URLSET,
}))

describe('probeSitemapClasses', () => {
  it('passes when every sitemap is a 200 carrying entries', async () => {
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: allGood,
    })
    expect(ok).toBe(true)
    expect(results.map((r) => r.path)).toEqual([...SITEMAP_SMOKE_PATHS])
    expect(results.every((r) => r.entries > 0)).toBe(true)
  })

  it('covers the index and all five classes', () => {
    expect(SITEMAP_SMOKE_PATHS).toEqual([
      '/sitemap.xml',
      '/sitemaps/core.xml',
      '/sitemaps/geo.xml',
      '/sitemaps/content.xml',
      '/sitemaps/listings.xml',
      '/sitemaps/matrix.xml',
    ])
  })

  it('FAILS on the 504 that actually happened to geo.xml', async () => {
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: stubFetch((path) =>
        path === '/sitemaps/geo.xml'
          ? { status: 504, body: 'Task timed out after 300 seconds' }
          : { status: 200, body: path === '/sitemap.xml' ? INDEX : URLSET },
      ),
    })
    expect(ok).toBe(false)
    expect(results.find((r) => r.path === '/sitemaps/geo.xml')?.status).toBe(504)
  })

  it('FAILS on a 200 that serves an empty urlset', async () => {
    // The documented failure mode of this route family: the universe build
    // throws, the class caches [], and the response is a well-formed 200 that
    // tells Google there is nothing to crawl.
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: stubFetch((path) =>
        path === '/sitemaps/listings.xml'
          ? { status: 200, body: EMPTY_URLSET }
          : { status: 200, body: path === '/sitemap.xml' ? INDEX : URLSET },
      ),
    })
    expect(ok).toBe(false)
    const listings = results.find((r) => r.path === '/sitemaps/listings.xml')
    expect(listings?.status).toBe(200)
    expect(listings?.entries).toBe(0)
  })

  it('FAILS when a class never answers at all', async () => {
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: async (url) => {
        if (new URL(url).pathname === '/sitemaps/matrix.xml') throw new Error('The operation was aborted due to timeout')
        return { status: 200, body: URLSET }
      },
    })
    expect(ok).toBe(false)
    const matrix = results.find((r) => r.path === '/sitemaps/matrix.xml')
    expect(matrix?.status).toBeNull()
    expect(matrix?.error).toMatch(/timeout/i)
  })

  it('sends the shared CI probe UA, so the bot screen does not 403 it', async () => {
    const seen = []
    await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: async (url, init) => {
        seen.push(init.headers['user-agent'])
        return { status: 200, body: URLSET }
      },
    })
    expect(new Set(seen)).toEqual(new Set([CI_PROBE_USER_AGENT]))
  })
})

describe('probeSitemapClasses asks in two waves (2026-10-14)', () => {
  it('asks for geo, content and matrix only after core has answered', async () => {
    // Four cold instances building the same url universe at once ran the
    // search-matrix inventory read four times (Supabase edge log, 16:05Z).
    const events = []
    const fetchImpl = async (url) => {
      const path = new URL(url).pathname
      events.push(`ask ${path}`)
      await new Promise((r) => setTimeout(r, path === '/sitemaps/core.xml' ? 20 : 1))
      events.push(`answer ${path}`)
      return { status: 200, text: async () => (path === '/sitemap.xml' ? INDEX : URLSET) }
    }
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', { fetchImpl })
    expect(ok).toBe(true)
    const coreAnswered = events.indexOf('answer /sitemaps/core.xml')
    for (const later of ['/sitemaps/geo.xml', '/sitemaps/content.xml', '/sitemaps/matrix.xml']) {
      expect(events.indexOf(`ask ${later}`)).toBeGreaterThan(coreAnswered)
    }
    for (const first of SITEMAP_SMOKE_FIRST_WAVE) {
      expect(events.indexOf(`ask ${first}`)).toBeLessThan(coreAnswered)
    }
    // Results still come back in the published order.
    expect(results.map((r) => r.path)).toEqual([...SITEMAP_SMOKE_PATHS])
  })

  it('still reports a second-wave class that fails', async () => {
    const { ok, results } = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: stubFetch((path) =>
        path === '/sitemaps/matrix.xml'
          ? { status: 504, body: 'Task timed out after 300 seconds' }
          : { status: 200, body: path === '/sitemap.xml' ? INDEX : URLSET },
      ),
    })
    expect(ok).toBe(false)
    expect(results.find((r) => r.path === '/sitemaps/matrix.xml')?.status).toBe(504)
  })
})
