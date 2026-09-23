import { describe, expect, it } from 'vitest'
import {
  ALERT_MAX_CHARS,
  alertBody,
  canonicalHrefs,
  childCountExpectation,
  countDelta,
  evaluateGscSitemap,
  evaluateInspection,
  evaluatePageFetch,
  evaluateSitemapChild,
  evaluateSitemapIndex,
  isNoindexHeader,
  knownRedirectSources,
  pageClassOf,
  parseSitemapLocs,
  redirectDestination,
  robotsMetaContents,
  sampleByClass,
  summarizeRun,
  utcDayIndex,
  type PageFetchOutcome,
} from './checks'

const ORIGIN = 'https://ryan-realty.com'
const urlset = (paths: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
    .map((p) => `<url><loc>${ORIGIN}${p}</loc></url>`)
    .join('\n')}</urlset>`
const ok = (body: string, ms = 300) => ({ status: 200, ms, body })

describe('parsers', () => {
  it('reads <loc> values and decodes entities', () => {
    expect(parseSitemapLocs('<urlset><url><loc> https://x.com/a?b=1&amp;c=2 </loc></url><url><loc>https://x.com/b</loc></url></urlset>')).toEqual([
      'https://x.com/a?b=1&c=2',
      'https://x.com/b',
    ])
  })

  it('reads robots and googlebot metas in any attribute order', () => {
    const html = `<meta content="noindex, follow" name="robots"><meta name="googlebot" content="max-snippet:-1"><meta name="viewport" content="x">`
    expect(robotsMetaContents(html)).toEqual(['noindex, follow', 'max-snippet:-1'])
  })

  it('reads canonical hrefs in any attribute order', () => {
    expect(canonicalHrefs(`<link href="https://ryan-realty.com/a" rel="canonical"><link rel="alternate" href="/b">`)).toEqual([
      'https://ryan-realty.com/a',
    ])
  })

  it('scopes X-Robots-Tag to Googlebot', () => {
    expect(isNoindexHeader('noindex, nofollow')).toBe(true)
    expect(isNoindexHeader('googlebot: noindex')).toBe(true)
    expect(isNoindexHeader('bingbot: noindex')).toBe(false)
    expect(isNoindexHeader('unavailable_after: 25 Jun 2030 15:00:00 PST')).toBe(false)
    expect(isNoindexHeader(null)).toBe(false)
  })
})

describe('knownRedirectSources (the middleware resolvers, in middleware order)', () => {
  it('flags legacy-map sources: the /luxury-homes-bend and 301d blog cases live on 2026-09-23', () => {
    expect(knownRedirectSources(['/luxury-homes-bend', '/blog/tetherow-resort-living-real-estate', '/about'])).toEqual([
      { path: '/luxury-homes-bend', to: '/homes-for-sale/bend?minPrice=1500000' },
      { path: '/blog/tetherow-resort-living-real-estate', to: '/communities/tetherow' },
    ])
  })

  it('flags pre-render hops and the Bend new-construction twin', () => {
    expect(redirectDestination('/communities/bend-broken-top')).toBe('/communities/broken-top')
    expect(redirectDestination('/homes-for-sale/bend/new-construction')).toBe('/new-construction')
  })

  it('does not invent a neighborhood-twin redirect: larkspur answered 200 self-canonical on 2026-09-23', () => {
    expect(redirectDestination('/homes-for-sale/bend/larkspur')).toBeNull()
    // Only the twins the legacy map carries redirect.
    expect(redirectDestination('/homes-for-sale/bend/awbrey-butte')).toBe('/cities/bend/awbrey-butte')
    expect(redirectDestination('/subdivisions/awbrey-village-phase-1')).toBeNull()
  })
})

describe('sampleByClass', () => {
  it('classes by child and route shape, pooling one-segment pages', () => {
    expect(pageClassOf('geo', '/subdivisions/x')).toBe('geo:/subdivisions/*')
    expect(pageClassOf('listings', '/homes-for-sale/bend/sub/1-main-220000001')).toBe('listings:/homes-for-sale/*/*/*')
    expect(pageClassOf('core', '/about')).toBe('core:/*')
    expect(pageClassOf('core', '/')).toBe('core:/')
  })

  const entries = Array.from({ length: 95 }, (_, i) => ({
    url: `${ORIGIN}/subdivisions/s${String(i).padStart(3, '0')}`,
    child: 'geo',
  })).concat([{ url: `${ORIGIN}/about`, child: 'core' }])

  it('takes perClass evenly spaced URLs that span the class, and all of a small class', () => {
    const s = sampleByClass(entries, 0, 10)
    const subs = s.filter((x) => x.cls === 'geo:/subdivisions/*').map((x) => x.path)
    expect(subs).toHaveLength(10)
    // step = floor(95/10) = 9, day 0 -> offset 0
    expect(subs[0]).toBe('/subdivisions/s000')
    expect(subs[9]).toBe('/subdivisions/s081')
    expect(s.filter((x) => x.cls === 'core:/*').map((x) => x.path)).toEqual(['/about'])
  })

  it('is deterministic per day and rotates across days until every URL is visited', () => {
    expect(sampleByClass(entries, 7, 10)).toEqual(sampleByClass(entries, 7, 10))
    const visited = new Set<string>()
    for (let d = 0; d < 9; d++) for (const x of sampleByClass(entries, d, 10)) visited.add(x.path)
    // 9 days x 10 picks covers 90 of the 95 plats (the 5 past 9*10 are the remainder), plus /about.
    expect(visited.size).toBe(91)
    expect(sampleByClass(entries, 1, 10).find((x) => x.cls === 'geo:/subdivisions/*')?.path).toBe('/subdivisions/s001')
  })

  it('never samples one path twice even when two children list it', () => {
    const dup = [
      { url: `${ORIGIN}/x/y`, child: 'geo' },
      { url: `${ORIGIN}/x/y`, child: 'core' },
    ]
    expect(sampleByClass(dup, 0, 10)).toHaveLength(1)
  })

  it('keys the rotation on the UTC calendar day', () => {
    expect(utcDayIndex(new Date('2026-09-23T00:00:01Z'))).toBe(utcDayIndex(new Date('2026-09-23T23:59:59Z')))
    expect(utcDayIndex(new Date('2026-09-24T00:00:00Z')) - utcDayIndex(new Date('2026-09-23T12:00:00Z'))).toBe(1)
  })
})

describe('evaluateSitemapIndex', () => {
  const expected = ['core', 'geo'].map((c) => `${ORIGIN}/sitemaps/${c}.xml`)
  const index = (locs: string[]) => `<sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`

  it('passes a fast index listing every class', () => {
    const c = evaluateSitemapIndex({ path: '/sitemap.xml', fetch: ok(index(expected)), expectedChildUrls: expected, crossChildDuplicates: 0 })
    expect(c.status).toBe('pass')
  })

  it('fails a missing child, a slow answer, and cross-child duplicates', () => {
    const c = evaluateSitemapIndex({
      path: '/sitemap.xml',
      fetch: ok(index([expected[0]]), 25_000),
      expectedChildUrls: expected,
      crossChildDuplicates: 3,
    })
    expect(c.status).toBe('fail')
    expect(c.failures).toEqual([
      '/sitemap.xml took 25000 ms, over the 20000 ms budget',
      `sitemap index is missing 1 child sitemap(s): ${ORIGIN}/sitemaps/geo.xml`,
      '3 URL(s) are listed by more than one child sitemap',
    ])
  })

  it('fails the 2026-08-02 shape: a 504 after the function ceiling', () => {
    const c = evaluateSitemapIndex({
      path: '/sitemap.xml',
      fetch: { status: 504, ms: 300_600, body: 'An error occurred' },
      expectedChildUrls: expected,
      crossChildDuplicates: 0,
    })
    expect(c.failures[0]).toBe('/sitemap.xml returned HTTP 504')
  })
})

describe('evaluateSitemapChild', () => {
  const base = { path: '/sitemaps/core.xml', origin: ORIGIN }

  it('passes a clean child inside tolerance of yesterday', () => {
    const paths = Array.from({ length: 100 }, (_, i) => `/p${i}`)
    const c = evaluateSitemapChild({ ...base, fetch: ok(urlset(paths)), expected: { count: 103, source: 'crawl probe 2026-09-22' } })
    expect(c.status).toBe('pass')
    expect(c.data).toMatchObject({ urlCount: 100, expectedCount: 103, deltaPct: -2.9 })
  })

  it('fails the 0dbf2f1cc shape: 18% of rows silently dropped', () => {
    const paths = Array.from({ length: 82 }, (_, i) => `/p${i}`)
    const c = evaluateSitemapChild({ ...base, fetch: ok(urlset(paths)), expected: { count: 100, source: 'crawl probe 2026-09-22' } })
    expect(c.failures).toEqual(['/sitemaps/core.xml lists 82 URLs, -18.0% from the expected 100 (crawl probe 2026-09-22)'])
  })

  it('fails duplicates, off-host locs and redirect sources (core.xml on 2026-09-23 carried the first and third)', () => {
    const xml = urlset(['/cities/bend', '/cities/bend', '/luxury-homes-bend']).replace(
      '</urlset>',
      '<url><loc>https://www.ryan-realty.com/x</loc></url></urlset>',
    )
    const c = evaluateSitemapChild({ ...base, fetch: ok(xml), expected: null })
    expect(c.status).toBe('fail')
    expect(c.failures).toEqual([
      '1 duplicate URL(s) in /sitemaps/core.xml (first: /cities/bend)',
      `1 URL(s) in /sitemaps/core.xml are not on ${ORIGIN} (first: https://www.ryan-realty.com/x)`,
      '1 redirect source(s) in /sitemaps/core.xml (first: /luxury-homes-bend -> /homes-for-sale/bend?minPrice=1500000)',
    ])
    expect(c.data.expectedSource).toBe('no baseline: no earlier probe count and no Search Console count from the last 2 days')
  })

  it('fails an empty urlset and a non-200', () => {
    expect(evaluateSitemapChild({ ...base, fetch: ok(urlset([])), expected: null }).failures).toEqual([
      '/sitemaps/core.xml lists no URLs',
    ])
    expect(
      evaluateSitemapChild({ ...base, fetch: { status: 0, ms: 60_000, body: '', error: 'no answer within 60000 ms' }, expected: null }).failures,
    ).toEqual(['/sitemaps/core.xml did not answer (no answer within 60000 ms)'])
  })

  it('computes the delta only against a real expectation', () => {
    expect(countDelta(105, 100)).toBeCloseTo(0.05)
    expect(countDelta(105, null)).toBeNull()
    expect(countDelta(105, 0)).toBeNull()
  })
})

describe('childCountExpectation', () => {
  const now = new Date('2026-09-23T11:55:00Z')
  const gsc = (lastDownloaded: string | null, submitted = '867') => ({ lastDownloaded, contents: [{ submitted, indexed: '0' }] })

  it("holds today's count to the probe's own last answered count first", () => {
    expect(childCountExpectation({ count: 748, date: '2026-09-22' }, gsc('2026-09-23T01:00:00Z'), now)).toEqual({
      count: 748,
      source: 'crawl probe 2026-09-22',
    })
  })

  it('falls back to a Search Console count Google downloaded inside two days', () => {
    expect(childCountExpectation(undefined, gsc('2026-09-22T06:00:00Z', '4850'), now)).toEqual({
      count: 4850,
      source: 'Search Console submitted count, downloaded 2026-09-22',
    })
  })

  it('judges nothing against a stale, missing or empty Search Console count', () => {
    // matrix.xml on 2026-09-23: 748 served against 867 downloaded 2026-09-20.
    expect(childCountExpectation(undefined, gsc('2026-09-20T12:00:00Z'), now)).toBeNull()
    expect(childCountExpectation(undefined, gsc(null), now)).toBeNull()
    expect(childCountExpectation(undefined, gsc('2026-09-23T01:00:00Z', '0'), now)).toBeNull()
    expect(childCountExpectation(undefined, undefined, now)).toBeNull()
  })
})

describe('evaluatePageFetch', () => {
  const page = (over: Partial<PageFetchOutcome> & { html?: string } = {}): PageFetchOutcome => ({
    url: `${ORIGIN}/subdivisions/x`,
    path: '/subdivisions/x',
    cls: 'geo:/subdivisions/*',
    status: 200,
    ms: 900,
    ttfbMs: 400,
    body: over.html ?? `<head><link rel="canonical" href="${ORIGIN}/subdivisions/x"><meta name="robots" content="index, follow"></head>`,
    headers: { 'x-vercel-cache': 'HIT' },
    ...over,
  })

  it('passes a fast, indexable, self-canonical 200', () => {
    const c = evaluatePageFetch(page())
    expect(c.status).toBe('pass')
    expect(c.data).toMatchObject({ canonicalMatches: true, cache: 'HIT', robots: 'index, follow' })
  })

  it('fails the SEO-2 shape: HTTP 500 under crawler concurrency', () => {
    expect(evaluatePageFetch(page({ status: 500, ms: 6170, html: '500: Internal Server Error.' })).failures).toEqual([
      'HTTP 500',
      'slow: 6170 ms (over 5000 ms)',
    ])
  })

  it('fails the SEO-9 shape: a 200 that carries noindex', () => {
    const c = evaluatePageFetch(page({ html: '<meta name="robots" content="noindex, follow"><title>Page not found</title>' }))
    expect(c.failures).toEqual(['noindex on a sitemapped URL (meta robots "noindex, follow")'])
  })

  it('fails a foreign canonical and conflicting canonicals, but not a trailing-slash variant', () => {
    expect(evaluatePageFetch(page({ html: `<link rel="canonical" href="${ORIGIN}/subdivisions/y">` })).failures).toEqual([
      `canonical points elsewhere: ${ORIGIN}/subdivisions/y`,
    ])
    expect(
      evaluatePageFetch(page({ html: `<link rel="canonical" href="${ORIGIN}/a"><link rel="canonical" href="${ORIGIN}/b">` })).failures[0],
    ).toMatch(/^conflicting canonicals/)
    expect(evaluatePageFetch(page({ html: `<link rel="canonical" href="${ORIGIN}/subdivisions/x/">` })).status).toBe('pass')
  })

  it('fails a redirect and names where it goes', () => {
    const c = evaluatePageFetch(page({ status: 308, html: '', headers: { location: '/homes-for-sale/bend' } }))
    expect(c.failures).toEqual(['redirects (HTTP 308 to /homes-for-sale/bend)'])
  })

  it('records a missing canonical without failing it', () => {
    const c = evaluatePageFetch(page({ html: '<title>x</title>' }))
    expect(c.status).toBe('pass')
    expect(c.data.canonicalMatches).toBeNull()
  })
})

describe('Search Console evaluators', () => {
  const now = new Date('2026-09-23T12:00:00Z')

  it('never records the deprecated indexed field as a number', () => {
    const c = evaluateGscSitemap(
      {
        path: `${ORIGIN}/sitemaps/geo.xml`,
        lastDownloaded: '2026-09-22T22:01:58.889Z',
        errors: '0',
        warnings: '0',
        contents: [{ type: 'web', submitted: '4850', indexed: '0' }],
      },
      4712,
      now,
    )
    expect(c.status).toBe('pass')
    expect(c.data).toMatchObject({ submitted: 4850, indexed: null, liveCount: 4712, liveVsSubmittedPct: -2.8 })
  })

  it('fails errors and a sitemap Google stopped downloading', () => {
    const c = evaluateGscSitemap(
      { path: `${ORIGIN}/sitemaps/matrix.xml`, lastDownloaded: '2026-08-01T00:00:00Z', errors: '2', contents: [] },
      null,
      now,
    )
    expect(c.failures).toEqual([
      'Search Console reports 2 error(s) on /sitemaps/matrix.xml',
      'Google last downloaded /sitemaps/matrix.xml 53 days ago',
    ])
  })

  it('fails what Google could not fetch, records indexed without failing on it', () => {
    const bad = evaluateInspection('/subdivisions/x', 'geo:/subdivisions/*', {
      verdict: 'FAIL',
      coverageState: 'Server error (5xx)',
      pageFetchState: 'SERVER_ERROR',
      lastCrawlTime: '2026-09-20T04:00:00Z',
    })
    expect(bad.failures).toEqual(["Google's last fetch (2026-09-20): SERVER_ERROR"])
    // Google held a 2026-09-12 noindex for /homes-for-sale/bend while it served
    // index,follow on 2026-09-23: recorded for the loop, not failed.
    const held = evaluateInspection('/homes-for-sale/bend', 'core:/homes-for-sale/*', {
      verdict: 'NEUTRAL',
      coverageState: 'Excluded by ‘noindex’ tag',
      pageFetchState: 'SUCCESSFUL',
      indexingState: 'BLOCKED_BY_META_TAG',
      lastCrawlTime: '2026-09-12T07:03:56Z',
    })
    expect(held.status).toBe('pass')
    expect(held.data).toMatchObject({ indexed: false, googleSawNoindex: true })
    expect(summarizeRun([held], {}).data.inspection).toEqual({ inspected: 1, indexed: 0, googleHoldsNoindex: ['/homes-for-sale/bend'] })
    const notYet = evaluateInspection('/subdivisions/y', 'geo:/subdivisions/*', {
      verdict: 'NEUTRAL',
      coverageState: 'Crawled - currently not indexed',
      pageFetchState: 'SUCCESSFUL',
    })
    expect(notYet.status).toBe('pass')
    expect(notYet.data.indexed).toBe(false)
    expect(evaluateInspection('/z', 'c', null, 'quota').failures).toEqual(['Search Console inspection failed: quota'])
  })
})

describe('summarizeRun + alertBody', () => {
  it('counts failures by kind and writes a short owner alert', () => {
    const checks = [
      evaluatePageFetch({ url: `${ORIGIN}/a/b`, path: '/a/b', cls: 'geo:/a/*', status: 500, ms: 100, ttfbMs: 100, body: '' }),
      evaluatePageFetch({ url: `${ORIGIN}/a/c`, path: '/a/c', cls: 'geo:/a/*', status: 200, ms: 100, ttfbMs: 100, body: '' }),
      evaluateSitemapChild({
        path: '/sitemaps/geo.xml',
        fetch: { status: 504, ms: 300_000, body: '' },
        origin: ORIGIN,
        expected: null,
      }),
    ]
    const summary = summarizeRun(checks, {})
    expect(summary.status).toBe('fail')
    expect(summary.data).toMatchObject({ checks: 3, failed: 2 })
    expect((summary.data.pageFetch as Record<string, number>).http5xx).toBe(1)
    const body = alertBody(summary, checks)!
    expect(body.split('\n')).toEqual([
      'Crawl probe: 2 of 3 checks failed.',
      '/sitemaps/geo.xml returned HTTP 504',
      'Pages: 1 of 2 sampled failed (1 5xx). First: /a/b',
    ])
    expect(alertBody(summarizeRun([checks[1]], {}), [checks[1]])).toBeNull()
  })

  it('fits the alert queue on whole lines, keeping the totals line', () => {
    // Six failing children with long paths plus a 400-character inspection error.
    const checks = Array.from({ length: 6 }, (_, i) =>
      evaluateSitemapChild({
        path: `/sitemaps/${'x'.repeat(120)}-${i}.xml`,
        fetch: { status: 500, ms: 100, body: '' },
        origin: ORIGIN,
        expected: null,
      }),
    )
    const pages = evaluatePageFetch({ url: `${ORIGIN}/p`, path: '/p', cls: 'core:/*', status: 500, ms: 100, ttfbMs: 100, body: '' })
    const all = [...checks, pages, evaluateInspection('/q', 'core:/*', null, 'q'.repeat(400))]
    const body = alertBody(summarizeRun(all, {}), all)!
    expect(body.length).toBeLessThanOrEqual(ALERT_MAX_CHARS)
    const lines = body.split('\n')
    expect(lines[0]).toBe('Crawl probe: 8 of 8 checks failed.')
    expect(lines.every((l) => !l.endsWith('...'))).toBe(true)
    // The 400-character inspection line did not fit and was dropped whole.
    expect(body).not.toContain('qqqq')
    expect(lines.some((l) => l.startsWith('Pages: 1 of 1 sampled failed'))).toBe(true)
  })
})
