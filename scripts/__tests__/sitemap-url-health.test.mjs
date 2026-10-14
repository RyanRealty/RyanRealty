import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  IMPORTANT_PUBLIC_PATHS,
  PRIORITY_SITEMAP_URLS,
  auditRobotsImportantPaths,
  auditRobotsSource,
  auditSitemapUrlHealth,
  extractIndexLocs,
  extractUrlsetLocs,
  robotsRuleBlocksPath,
  runSitemapUrlHealth,
  sampleEven,
  takeSitemapTargets,
} from '../lib/sitemap-url-health.mjs'

const O = 'https://ryan-realty.com'
const PAGE = `${O}/communities/tetherow`

describe('robotsRuleBlocksPath', () => {
  it('does not block /communities when only /admin/ is disallowed', () => {
    const g = { agents: ['*'], allow: ['/'], disallow: ['/admin/', '/api/'] }
    expect(robotsRuleBlocksPath(g, '/communities/tetherow')).toBe(false)
    expect(robotsRuleBlocksPath(g, '/api/og')).toBe(true)
  })

  it('lets a longer Allow beat /api/ for /api/og', () => {
    const g = { agents: ['*'], allow: ['/', '/api/og'], disallow: ['/admin/', '/api/'] }
    expect(robotsRuleBlocksPath(g, '/api/og')).toBe(false)
    expect(robotsRuleBlocksPath(g, '/api/cron/x')).toBe(true)
  })

  it('blocks a public path when Disallow / wins', () => {
    const g = { agents: ['*'], allow: [], disallow: ['/'] }
    expect(robotsRuleBlocksPath(g, '/communities')).toBe(true)
  })
})

describe('auditRobotsImportantPaths', () => {
  const ok = `User-Agent: *\nAllow: /\nAllow: /api/og\nDisallow: /admin/\nDisallow: /api/\n\nUser-Agent: Googlebot\nAllow: /\nDisallow: /admin/\n\nSitemap: ${O}/sitemap.xml\n`

  it('passes the live robots shape', () => {
    expect(auditRobotsImportantPaths(ok)).toEqual([])
  })

  it('fails when a named crawler is handed a blanket Disallow /', () => {
    const txt = `User-Agent: Googlebot\nDisallow: /\n\nSitemap: ${O}/sitemap.xml\n`
    const fails = auditRobotsImportantPaths(txt)
    expect(fails.some((f) => f.includes('Googlebot') && f.includes('/communities'))).toBe(true)
  })

  it('fails when /homes-for-sale is disallowed', () => {
    const txt = `User-Agent: *\nAllow: /\nDisallow: /homes-for-sale\n`
    expect(auditRobotsImportantPaths(txt).join()).toMatch(/\/homes-for-sale/)
  })
})

describe('auditSitemapUrlHealth', () => {
  it('passes a 200 with a self canonical on ryan-realty.com', () => {
    expect(
      auditSitemapUrlHealth(PAGE, {
        status: 200,
        canonical: PAGE,
        robots: 'index, follow',
        xRobotsTag: null,
        location: null,
      }),
    ).toEqual([])
  })

  it('fails a cacheable noindex 200, a foreign host, and a non-self canonical', () => {
    const noindex = auditSitemapUrlHealth(PAGE, {
      status: 200,
      canonical: PAGE,
      robots: 'noindex, follow',
      xRobotsTag: null,
      location: null,
    }).join()
    expect(noindex).toMatch(/noindex/)

    const host = auditSitemapUrlHealth(PAGE, {
      status: 200,
      canonical: 'https://ryanrealty.vercel.app/communities/tetherow',
      robots: null,
      xRobotsTag: null,
      location: null,
    }).join()
    expect(host).toMatch(/canonical host/)
    expect(host).toMatch(/not self-referencing/)

    const http = auditSitemapUrlHealth(PAGE, {
      status: 200,
      canonical: 'http://ryan-realty.com/communities/tetherow',
      robots: null,
      xRobotsTag: null,
      location: null,
    }).join()
    expect(http).toMatch(/canonical host/)
  })

  it('fails a soft 200 that is actually a redirect or a 5xx', () => {
    expect(
      auditSitemapUrlHealth(PAGE, {
        status: 308,
        canonical: null,
        robots: null,
        xRobotsTag: null,
        location: `${O}/communities/tetherow-resort`,
      }).join(),
    ).toMatch(/redirects/)
    expect(
      auditSitemapUrlHealth(PAGE, {
        status: 503,
        canonical: null,
        robots: null,
        xRobotsTag: null,
        location: null,
      }).join(),
    ).toMatch(/HTTP 503/)
  })

  it('fails a sitemap loc on the Vercel alias', () => {
    expect(
      auditSitemapUrlHealth('https://ryanrealty.vercel.app/communities/tetherow', {
        status: 200,
        canonical: PAGE,
        robots: null,
        xRobotsTag: null,
        location: null,
      }).join(),
    ).toMatch(/sitemap lists/)
  })
})

describe('extract sitemap locs', () => {
  it('reads the index children and urlset entries', () => {
    expect(
      extractIndexLocs(
        `<sitemapindex><sitemap><loc>${O}/sitemaps/geo.xml</loc></sitemap></sitemapindex>`,
      ),
    ).toEqual([`${O}/sitemaps/geo.xml`])
    expect(extractUrlsetLocs(`<urlset><url><loc>${PAGE}</loc></url></urlset>`)).toEqual([PAGE])
  })
})

describe('auditRobotsSource (app/robots.ts)', () => {
  it('passes the committed robots.ts', () => {
    const src = readFileSync(new URL('../../app/robots.ts', import.meta.url), 'utf8')
    expect(auditRobotsSource(src)).toEqual([])
  })

  it('fails a wildcard Disallow / and a dropped PUBLIC_ALLOW', () => {
    expect(auditRobotsSource("const PUBLIC_ALLOW = ['/']\ndisallow: ['/']").join()).toMatch(
      /PUBLIC_ALLOW|Disallow/,
    )
  })
})

describe('runSitemapUrlHealth (mocked fetch)', () => {
  it('checks every loc and robots important paths', async () => {
    const pages = new Map([
      [
        `${O}/robots.txt`,
        {
          status: 200,
          text: `User-Agent: *\nAllow: /\nAllow: /api/og\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${O}/sitemap.xml\n`,
        },
      ],
      [
        `${O}/sitemap.xml`,
        {
          status: 200,
          text: `<sitemapindex><sitemap><loc>${O}/sitemaps/geo.xml</loc></sitemap></sitemapindex>`,
        },
      ],
      [
        `${O}/sitemaps/geo.xml`,
        { status: 200, text: `<urlset><url><loc>${PAGE}</loc></url></urlset>` },
      ],
      [
        PAGE,
        {
          status: 200,
          text: `<html><head><title>Tetherow homes for sale | Ryan Realty</title><link rel="canonical" href="${PAGE}"/><meta name="robots" content="index, follow"/></head><body><h1>Tetherow</h1></body></html>`,
        },
      ],
    ])
    const fetchImpl = async (url) => {
      const hit = pages.get(url)
      if (!hit) return { status: 404, headers: new Headers(), text: async () => '' }
      return { status: hit.status, headers: new Headers(), text: async () => hit.text }
    }
    const r = await runSitemapUrlHealth(O, { ua: 'test', fetchImpl, retryDelayMs: 0 })
    expect(r.fails).toEqual([])
    expect(r.checked).toBe(1)
  })

  it('fails a sitemap URL that rendered the old listings-did-not-load 200', async () => {
    const pages = new Map([
      [`${O}/robots.txt`, { status: 200, text: `User-Agent: *\nAllow: /\nDisallow: /admin/\n` }],
      [
        `${O}/sitemap.xml`,
        {
          status: 200,
          text: `<sitemapindex><sitemap><loc>${O}/sitemaps/geo.xml</loc></sitemap></sitemapindex>`,
        },
      ],
      [
        `${O}/sitemaps/geo.xml`,
        { status: 200, text: `<urlset><url><loc>${PAGE}</loc></url></urlset>` },
      ],
      [
        PAGE,
        {
          status: 200,
          text: `<html><head><title>Tetherow | Ryan Realty</title><meta name="robots" content="noindex"/><link rel="canonical" href="${PAGE}"/></head><body><h1>The live homes for Tetherow did not load just now.</h1></body></html>`,
        },
      ],
    ])
    const fetchImpl = async (url) => {
      const hit = pages.get(url)
      return { status: hit?.status ?? 404, headers: new Headers(), text: async () => hit?.text ?? '' }
    }
    const r = await runSitemapUrlHealth(O, { ua: 'test', fetchImpl })
    expect(r.fails.join()).toMatch(/noindex/)
  })
})

describe('runSitemapUrlHealth: what a pass covered (deploy-defect filer)', () => {
  const urls = [`${O}/a`, `${O}/b`, `${O}/c`, `${O}/d`]
  const healthy = (u) => `<html><head><link rel="canonical" href="${u}"/><meta name="robots" content="index, follow"/></head><body></body></html>`
  const fetchImpl = async (url) => {
    const text = (() => {
      if (url === `${O}/robots.txt`) return `User-Agent: *\nAllow: /\nAllow: /api/og\nDisallow: /admin/\n`
      if (url === `${O}/sitemap.xml`) return `<sitemapindex><sitemap><loc>${O}/sitemaps/geo.xml</loc></sitemap></sitemapindex>`
      if (url === `${O}/sitemaps/geo.xml`) return `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`
      return urls.includes(url) ? healthy(url) : ''
    })()
    return { status: text ? 200 : 404, headers: new Headers(), text: async () => text }
  }

  it('returns the pathnames it fetched and every pathname the sitemaps list', async () => {
    const r = await runSitemapUrlHealth(O, { ua: 'test', fetchImpl, retryDelayMs: 0 })
    expect(r.fails).toEqual([])
    expect(r.listedPaths).toEqual(['/a', '/b', '/c', '/d'])
    expect(r.checkedPaths).toEqual(['/a', '/b', '/c', '/d'])
  })

  it('walks the priorityUrls an open deploy-found node names even under the cap', async () => {
    const capped = await runSitemapUrlHealth(O, { ua: 'test', fetchImpl, retryDelayMs: 0, maxUrls: 2 })
    expect(capped.checkedPaths).toEqual(['/a', '/c'])
    const r = await runSitemapUrlHealth(O, { ua: 'test', fetchImpl, retryDelayMs: 0, maxUrls: 2, priorityUrls: [`${O}/d`, `${O}/not-in-the-sitemap`] })
    expect(r.checked).toBe(2)
    expect(r.checkedPaths).toContain('/d')
    expect(r.checkedPaths).not.toContain('/not-in-the-sitemap')
    expect(r.listedPaths).toHaveLength(4)
  })
})

describe('takeSitemapTargets', () => {
  it('walks every loc when the cap is unset', () => {
    expect(takeSitemapTargets([['a', 'b'], ['c']], Infinity)).toEqual(['a', 'b', 'c'])
  })

  it('samples each sitemap instead of only the first file', () => {
    const core = Array.from({ length: 20 }, (_, i) => `${O}/core/${i}`)
    const geo = Array.from({ length: 20 }, (_, i) => `${O}/geo/${i}`)
    const picked = takeSitemapTargets([core, geo], 8)
    expect(picked).toHaveLength(8)
    expect(picked.some((u) => u.includes('/core/'))).toBe(true)
    expect(picked.some((u) => u.includes('/geo/'))).toBe(true)
  })

  it('keeps priority community URLs in a capped walk', () => {
    const core = [`${O}/`, `${O}/communities/tetherow`, `${O}/other`]
    const listings = Array.from({ length: 50 }, (_, i) => `${O}/homes-for-sale/x/${i}`)
    const picked = takeSitemapTargets([core, listings], 6, PRIORITY_SITEMAP_URLS)
    expect(picked).toContain(`${O}/communities/tetherow`)
    expect(picked).toContain(`${O}/`)
  })

  it('spaces a sample across a long list', () => {
    expect(sampleEven(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual(['a', 'c', 'e'])
  })
})

describe('IMPORTANT_PUBLIC_PATHS', () => {
  it('covers the place, listing, sitemap and OG doors', () => {
    expect(IMPORTANT_PUBLIC_PATHS).toEqual(expect.arrayContaining([
      '/',
      '/communities/tetherow',
      '/homes-for-sale',
      '/sitemaps/geo.xml',
      '/llms.txt',
      '/api/og',
    ]))
  })
})
