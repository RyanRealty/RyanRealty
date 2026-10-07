import { describe, expect, it } from 'vitest'
import { probeSitemapClasses } from '../lib/sitemap-smoke.mjs'

const XML = '<urlset><url><loc>https://ryan-realty.com/</loc></url></urlset>'
const ok = () => new Response(XML, { status: 200 })

describe('sitemap smoke retries a transport error once, never an HTTP status', () => {
  it('a dropped tunnel on the first read is retried and passes on the second', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      if (calls === 1) throw new TypeError('fetch failed')
      return ok()
    }
    const out = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl,
      paths: ['/sitemap.xml'],
      retryDelayMs: 0,
    })
    expect(calls).toBe(2)
    expect(out.ok).toBe(true)
    expect(out.results[0]).toMatchObject({ status: 200, entries: 1, error: null, retried: 1 })
  })

  it('a second transport error fails the class with the last error', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      throw new TypeError('fetch failed')
    }
    const out = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl,
      paths: ['/sitemaps/core.xml'],
      retryDelayMs: 0,
    })
    expect(calls).toBe(2)
    expect(out.ok).toBe(false)
    expect(out.results[0]).toMatchObject({ status: null, entries: 0, error: 'fetch failed', retried: 1 })
  })

  it('a 504 or a 403 is the platform answer and is read once', async () => {
    for (const status of [504, 403]) {
      let calls = 0
      const fetchImpl = async () => {
        calls++
        return new Response('', { status })
      }
      const out = await probeSitemapClasses('https://ryan-realty.com', {
        fetchImpl,
        paths: ['/sitemaps/geo.xml'],
        retryDelayMs: 0,
      })
      expect(calls).toBe(1)
      expect(out.ok).toBe(false)
      expect(out.results[0]).toMatchObject({ status, entries: 0, retried: 0 })
    }
  })

  it('an empty 200 still fails: entries, not status, prove the sitemap', async () => {
    const out = await probeSitemapClasses('https://ryan-realty.com', {
      fetchImpl: async () => new Response('<urlset></urlset>', { status: 200 }),
      paths: ['/sitemaps/matrix.xml'],
      retryDelayMs: 0,
    })
    expect(out.ok).toBe(false)
    expect(out.results[0]).toMatchObject({ status: 200, entries: 0, retried: 0 })
  })
})
