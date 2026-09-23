import { describe, expect, it } from 'vitest'
import { gtmBootstrapScript } from '@/lib/analytics/gtm-bootstrap'
import { GOOGLEBOT_UA, runCrawlProbe, toCrawlProbeRows } from './run'
import type { GscClient } from './gsc'

const ORIGIN = 'https://ryan-realty.com'
const CLASSES = ['core', 'geo', 'listings', 'matrix', 'content']

type Route = { status?: number; body?: string; headers?: Record<string, string>; delayMs?: number; throws?: boolean }

function fakeFetch(routes: Record<string, Route>, seen: Array<{ url: string; ua: string | null; redirect?: string }>) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    seen.push({ url, ua: headers.get('user-agent'), redirect: init?.redirect })
    const r = routes[url] ?? { status: 404, body: 'not found' }
    if (r.throws) throw new TypeError('fetch failed')
    if (r.delayMs) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, r.delayMs)
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      })
    }
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers })
  }) as typeof fetch
}

const urlset = (paths: string[]) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${ORIGIN}${p}</loc></url>`).join('')}</urlset>`
const index = `<sitemapindex>${CLASSES.map((c) => `<sitemap><loc>${ORIGIN}/sitemaps/${c}.xml</loc></sitemap>`).join('')}</sitemapindex>`
const goodPage = (path: string) =>
  `<html><head><link rel="canonical" href="${ORIGIN}${path}"><meta name="robots" content="index, follow"></head><body>ok</body></html>`

function healthySite(): Record<string, Route> {
  const children: Record<string, string[]> = {
    core: ['/', '/about', '/cities/bend'],
    geo: ['/subdivisions/a', '/subdivisions/b'],
    listings: ['/homes-for-sale/bend/1-main-220000001'],
    matrix: ['/homes-for-sale/bend/under-500k'],
    content: ['/blog/x'],
  }
  const routes: Record<string, Route> = {
    [`${ORIGIN}/sitemap.xml`]: { body: index },
    [`${ORIGIN}/`]: { body: `<html><head><script>${gtmBootstrapScript('home', 'GTM-TEST123')}</script></head></html>` },
  }
  for (const [c, paths] of Object.entries(children)) {
    routes[`${ORIGIN}/sitemaps/${c}.xml`] = { body: urlset(paths) }
    for (const p of paths) if (p !== '/') routes[`${ORIGIN}${p}`] = { body: goodPage(p), headers: { 'x-vercel-cache': 'HIT' } }
  }
  return routes
}

const gscClient = (over: Partial<GscClient> = {}): GscClient => ({
  siteUrl: `${ORIGIN}/`,
  listSitemaps: async () => [
    {
      path: `${ORIGIN}/sitemap.xml`,
      isSitemapsIndex: true,
      lastDownloaded: '2026-09-22T22:00:00Z',
      errors: '0',
      contents: [{ type: 'web', submitted: '8', indexed: '0' }],
    },
  ],
  inspect: async () => ({ verdict: 'PASS', coverageState: 'Submitted and indexed', pageFetchState: 'SUCCESSFUL' }),
  ...over,
})

const now = new Date('2026-09-23T11:55:00Z')

describe('runCrawlProbe', () => {
  it('passes a healthy site end to end and fetches as Googlebot without following redirects', async () => {
    const seen: Array<{ url: string; ua: string | null; redirect?: string }> = []
    const r = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(healthySite(), seen),
      gsc: gscClient(),
      gtmContainerId: 'GTM-TEST123',
    })
    expect(r.checks.filter((c) => c.status === 'fail').map((c) => `${c.metric} ${c.surface}: ${c.failures.join('; ')}`)).toEqual([])
    expect(r.summary.status).toBe('pass')
    expect(r.alert).toBeNull()
    expect(r.date).toBe('2026-09-23')
    const sitemapFetches = seen.filter((s) => s.url.includes('sitemap'))
    expect(sitemapFetches.every((s) => s.ua === GOOGLEBOT_UA && s.redirect === 'manual')).toBe(true)
    // Every sampled page is a sitemapped URL.
    const pageChecks = r.checks.filter((c) => c.metric === 'page_fetch')
    expect(pageChecks.map((c) => c.surface).sort()).toEqual(
      ['/', '/about', '/blog/x', '/cities/bend', '/homes-for-sale/bend/1-main-220000001', '/homes-for-sale/bend/under-500k', '/subdivisions/a', '/subdivisions/b'].sort(),
    )
  })

  it('fails and alerts on the historical break shapes', async () => {
    const routes = healthySite()
    routes[`${ORIGIN}/sitemaps/geo.xml`] = { status: 504, body: 'An error occurred with your deployment' }
    routes[`${ORIGIN}/sitemaps/core.xml`] = { body: urlset(['/', '/about', '/about', '/cities/bend', '/luxury-homes-bend']) }
    routes[`${ORIGIN}/cities/bend`] = { status: 500, body: '500: Internal Server Error.' }
    routes[`${ORIGIN}/`] = {
      body: `<html><head><script>(function(){w.push({'gtm.start':}});j.src='https://www.googletagmanager.com/gtm.js?id='+i})()</script></head></html>`,
    }
    const r = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(routes, []),
      baseline: new Map([['/sitemaps/listings.xml', { count: 10, date: '2026-09-22' }]]),
      gsc: gscClient(),
      gtmContainerId: 'GTM-TEST123',
    })
    const fail = (metric: string, surface: string) => r.checks.find((c) => c.metric === metric && c.surface === surface)
    expect(fail('sitemap_child', '/sitemaps/geo.xml')?.failures[0]).toBe('/sitemaps/geo.xml returned HTTP 504')
    expect(fail('sitemap_child', '/sitemaps/core.xml')?.failures).toEqual([
      '1 duplicate URL(s) in /sitemaps/core.xml (first: /about)',
      '1 redirect source(s) in /sitemaps/core.xml (first: /luxury-homes-bend -> /homes-for-sale/bend/luxury)',
    ])
    // listings.xml lists 1 URL against yesterday's 10.
    expect(fail('sitemap_child', '/sitemaps/listings.xml')?.failures[0]).toMatch(/lists 1 URLs, -90\.0% from the expected 10 \(crawl probe 2026-09-22\)/)
    expect(fail('page_fetch', '/cities/bend')?.failures).toEqual(['HTTP 500'])
    expect(fail('homepage_scripts', '/')?.failures).toContain('GTM loader does not parse, so gtm.js never loads')
    expect(r.summary.status).toBe('fail')
    expect(r.alert).toMatch(/^Crawl probe: \d+ of \d+ checks failed\./)
    // /cities/bend 500s and the sitemapped redirect source 404s here.
    expect(r.alert).toMatch(/Pages: 2 of \d+ sampled failed \(1 5xx, 1 4xx\)/)
  })

  it('uses Search Console submitted counts as the first-run expectation', async () => {
    const r = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(healthySite(), []),
      gsc: gscClient({
        listSitemaps: async () => [
          { path: `${ORIGIN}/sitemaps/geo.xml`, lastDownloaded: '2026-09-22T00:00:00Z', errors: '0', contents: [{ submitted: '40', indexed: '0' }] },
        ],
      }),
      gtmContainerId: 'GTM-TEST123',
    })
    const geo = r.checks.find((c) => c.metric === 'sitemap_child' && c.surface === '/sitemaps/geo.xml')!
    expect(geo.data.expectedSource).toBe('Search Console submitted count, downloaded 2026-09-22')
    expect(geo.failures[0]).toMatch(/lists 2 URLs, -95\.0% from the expected 40/)
    // The four children GSC does not know (no index submitted) are flagged.
    expect(r.checks.filter((c) => c.metric === 'gsc_sitemap' && c.failures[0]?.includes('is not submitted')).map((c) => c.surface).sort()).toEqual([
      '/sitemaps/content.xml',
      '/sitemaps/core.xml',
      '/sitemaps/listings.xml',
      '/sitemaps/matrix.xml',
    ])
  })

  it('records a Search Console outage as one failed check instead of throwing', async () => {
    const r = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(healthySite(), []),
      gsc: gscClient({
        listSitemaps: async () => {
          throw new Error('invalid_grant')
        },
        inspect: async () => {
          throw new Error('quota exceeded')
        },
      }),
      gtmContainerId: 'GTM-TEST123',
    })
    expect(r.checks.find((c) => c.metric === 'gsc_sitemap')?.failures).toEqual(['Search Console sitemap list unreadable: invalid_grant'])
    expect(r.checks.filter((c) => c.metric === 'gsc_inspection').every((c) => c.failures[0] === 'Search Console inspection failed: quota exceeded')).toBe(true)
  })

  it('retries a network error once, times out a hung page, and stops launching at the deadline', async () => {
    const routes = healthySite()
    routes[`${ORIGIN}/about`] = { throws: true }
    routes[`${ORIGIN}/subdivisions/a`] = { delayMs: 200 }
    const seen: Array<{ url: string; ua: string | null }> = []
    const r = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(routes, seen),
      gsc: null,
      gtmContainerId: 'GTM-TEST123',
      pageAbortMs: 50,
    })
    expect(seen.filter((s) => s.url === `${ORIGIN}/about`)).toHaveLength(2)
    expect(r.checks.find((c) => c.metric === 'page_fetch' && c.surface === '/about')?.failures[0]).toBe('no response (fetch failed)')
    expect(r.checks.find((c) => c.metric === 'page_fetch' && c.surface === '/subdivisions/a')?.failures[0]).toBe('no response (no answer within 50 ms)')

    const stopped = await runCrawlProbe({
      origin: ORIGIN,
      now,
      fetchImpl: fakeFetch(healthySite(), []),
      gsc: null,
      deadlineMs: 0,
    })
    expect(stopped.checks.filter((c) => c.metric === 'page_fetch')).toHaveLength(0)
    expect(stopped.summary.data.deadlineHit).toBe(true)
  })

  it('maps every check plus the summary to one site_signal row, 1 for pass and 0 for fail', async () => {
    const r = await runCrawlProbe({ origin: ORIGIN, now, fetchImpl: fakeFetch(healthySite(), []), gsc: null })
    const rows = toCrawlProbeRows(r)
    expect(rows).toHaveLength(r.checks.length + 1)
    expect(rows[0]).toMatchObject({ date: '2026-09-23', surface: '', metric: 'run' })
    const keys = rows.map((x) => `${x.surface}|${x.metric}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const row of rows) {
      expect(row.value).toBe(row.metadata.status === 'pass' ? 1 : 0)
    }
  })
})
