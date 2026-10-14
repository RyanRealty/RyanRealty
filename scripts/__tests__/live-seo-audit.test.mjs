import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { auditDecision, auditPage, auditRobots, fetchText, overSoftShareProblems, parsePage, parseRobots } from '../lib/live-seo-audit.mjs'

const URL_ = 'https://ryan-realty.com/homes-for-sale/bend/woodridge'

function page(over = {}) {
  const head = over.head ?? `
    <title>Woodridge homes for sale in Bend | Ryan Realty</title>
    <meta name="description" content="Homes for sale in Woodridge, Bend."/>
    <link rel="canonical" href="${URL_}"/>`
  const body = over.body ?? `<h1>Woodridge homes for sale</h1>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
    <img src="/a.jpg" alt="A house"/>`
  return `<html><head>${head}</head><body>${body}</body></html>`
}

describe('auditRobots', () => {
  it('passes when every group carries the private disallows', () => {
    const txt = `User-Agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dev/\n\nUser-Agent: Googlebot\nUser-Agent: GPTBot\nAllow: /\nDisallow: /admin/\nDisallow: /dev/\n\nSitemap: https://ryan-realty.com/sitemap.xml\n`
    expect(auditRobots(txt)).toEqual([])
  })

  it('fails the 2026-10-04 shape: a named group with a bare Allow /', () => {
    const txt = `User-Agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /dev/\n\nUser-Agent: Googlebot\nAllow: /\n\nSitemap: https://ryan-realty.com/sitemap.xml\n`
    const fails = auditRobots(txt)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toContain('[Googlebot]')
  })

  it('fails without a Sitemap line', () => {
    expect(auditRobots('User-Agent: *\nDisallow: /admin/\nDisallow: /dev/\n')[0]).toContain('Sitemap')
  })

  it('groups consecutive User-Agent lines together', () => {
    const groups = parseRobots('User-Agent: A\nUser-Agent: B\nDisallow: /x\nUser-Agent: C\nAllow: /\n')
    expect(groups.map((g) => g.agents)).toEqual([['A', 'B'], ['C']])
  })
})

describe('parsePage + auditPage', () => {
  it('passes a clean page', () => {
    expect(auditPage(URL_, parsePage(page()), { isHome: false, isListing: false }).fails).toEqual([])
  })

  it('reads metadata a streamed route writes into <body>', () => {
    const html = `<html><head></head><body><svg><title>icon</title></svg>${page().replace(/<\/?html>|<\/?head>|<\/?body>/g, '')}</body></html>`
    const p = parsePage(html)
    expect(p.title).toBe('Woodridge homes for sale in Bend | Ryan Realty')
    expect(p.canonical).toBe(URL_)
  })

  it('fails a doubled brand, the live /blog shape', () => {
    const p = parsePage(page({ head: `<title>New 2026 Housing Law | Ryan Realty | Ryan Realty</title><meta name="description" content="x"/><link rel="canonical" href="${URL_}"/>` }))
    expect(auditPage(URL_, p, { isHome: false, isListing: false }).fails.join()).toContain('2x in the title')
  })

  it('fails noindex, a foreign canonical, two H1s, no breadcrumb, an img with no alt', () => {
    const p = parsePage(
      page({
        head: `<title>T | Ryan Realty</title><meta name="description" content="d"/><meta name="robots" content="noindex, follow"/><link rel="canonical" href="https://ryan-realty.com/elsewhere"/>`,
        body: '<h1>a</h1><h1>b</h1><img src="/x.jpg">',
      }),
    )
    const fails = auditPage(URL_, p, { isHome: false, isListing: false }).fails.join('\n')
    expect(fails).toContain('noindex')
    expect(fails).toContain('canonical points elsewhere')
    expect(fails).toContain('2 <h1>')
    expect(fails).toContain('BreadcrumbList')
    expect(fails).toContain('no alt attribute')
  })

  it('fails a listing whose lead photo lost fetchPriority or its preload', () => {
    const body = `<h1>61288 King Saul</h1><script type="application/ld+json">{"@type":"BreadcrumbList"}</script><img src="https://cdn.resize.sparkplatform.com/ore/1600x1200/true/a.jpg" alt="x" loading="lazy"/>`
    const fails = auditPage(URL_, parsePage(page({ body })), { isHome: false, isListing: true }).fails.join('\n')
    expect(fails).toContain('fetchPriority')
    expect(fails).toContain('preload')
  })

  it('passes a listing whose lead photo is preloaded at high priority', () => {
    const head = `<title>T | Ryan Realty</title><meta name="description" content="d"/><link rel="canonical" href="${URL_}"/><link rel="preload" as="image" fetchPriority="high" imageSrcSet="x 800w"/>`
    const body = `<h1>h</h1><script type="application/ld+json">{"@type":"BreadcrumbList"}</script><img src="https://cdn.resize.sparkplatform.com/ore/1600x1200/true/a.jpg" alt="x" fetchPriority="high"/>`
    expect(auditPage(URL_, parsePage(page({ head, body })), { isHome: false, isListing: true }).fails).toEqual([])
  })

  it('warns, not fails, on a title between 61 and 90 chars', () => {
    const t = `${'W'.repeat(60)} | Ryan Realty`
    const p = parsePage(page({ head: `<title>${t}</title><meta name="description" content="d"/><link rel="canonical" href="${URL_}"/>` }))
    const r = auditPage(URL_, p, { isHome: false, isListing: false })
    expect(r.fails).toEqual([])
    expect(r.warns).toHaveLength(1)
  })
})

describe('auditDecision (data/seo/decisions.json)', () => {
  const O = 'https://ryan-realty.com'
  const redirect = { id: 'r', path: '/cities/sunriver', expect: { status: 301, location: '/communities/sunriver' } }
  const page = { id: 'p', path: '/communities/sunriver', expect: { status: 200, index: true, canonical: 'self', title: '^Sunriver real estate' } }
  const live = (over = {}) =>
    parsePage(
      `<html><head><title>${over.title ?? 'Sunriver real estate | Homes for Sale | Sunriver, OR | Ryan Realty'}</title>` +
        `<link rel="canonical" href="${over.canonical ?? O + '/communities/sunriver'}"/>` +
        (over.robots ? `<meta name="robots" content="${over.robots}"/>` : '') +
        `</head><body><h1>Sunriver homes for sale</h1></body></html>`,
    )

  it('passes a redirect that still lands on the decided page, absolute or relative', () => {
    expect(auditDecision(redirect, { status: 301, location: `${O}/communities/sunriver` }, O)).toEqual([])
    expect(auditDecision(redirect, { status: 301, location: '/communities/sunriver' }, O)).toEqual([])
  })

  it('fails the regressions it exists for', () => {
    // The city page comes back as its own page.
    expect(auditDecision(redirect, { status: 200, location: null, page: live() }, O).join()).toMatch(/HTTP 200, decision says 301/)
    // Indexed page turned noindex, canonical moved, title lost its phrase.
    const f = auditDecision(page, { status: 200, page: live({ robots: 'noindex, follow', canonical: `${O}/cities/sunriver`, title: 'Sunriver Homes for Sale' }) }, O).join('\n')
    expect(f).toMatch(/noindex, decision says indexable/)
    expect(f).toMatch(/canonical \/cities\/sunriver, decision says \/communities\/sunriver/)
    expect(f).toMatch(/no longer matches/)
  })

  it('fails a served-HTML pattern the decision needs (AEO takeaways, chart tables)', () => {
    const d = { id: 'h', path: '/cities/bend', expect: { status: 200, html: ['id="takeaways"'] } }
    expect(auditDecision(d, { status: 200, page: live(), html: '<section id="takeaways">' }, O)).toEqual([])
    expect(auditDecision(d, { status: 200, page: live(), html: '<main></main>' }, O).join()).toMatch(/no longer contains/)
  })

  it('passes the page as decided', () => {
    expect(auditDecision(page, { status: 200, page: live() }, O)).toEqual([])
  })

  it('every pinned decision is well formed', () => {
    const { decisions } = JSON.parse(readFileSync(new URL('../../data/seo/decisions.json', import.meta.url), 'utf8'))
    const ids = new Set()
    for (const d of decisions) {
      expect(d.id && !ids.has(d.id), d.id).toBe(true)
      ids.add(d.id)
      expect(d.path, d.id).toMatch(/^\//)
      expect(d.decided && d.why, d.id).toBeTruthy()
      expect(Object.keys(d.expect).length, d.id).toBeGreaterThan(0)
      for (const k of ['title', 'h1']) if (d.expect[k]) expect(() => new RegExp(d.expect[k]), d.id).not.toThrow()
    }
  })
})

describe('overSoftShareProblems (title-length ratchet, Matt 2026-10-05)', () => {
  it('passes at or under 15% of the sample over 60 chars', () => {
    expect(overSoftShareProblems(['a', 'b', 'c', 'd', 'e', 'f'], 40)).toEqual([])
    expect(overSoftShareProblems([], 0)).toEqual([])
  })
  it('fails past 15%, naming every long title', () => {
    const fails = overSoftShareProblems(['/x: title 66 chars: X', '/y: title 70 chars: Y', '/z', '/w', '/v', '/u', '/t'], 40)
    expect(fails).toHaveLength(1)
    expect(fails[0]).toMatch(/^7 of 40 sampled titles run past 60 chars, over the 15% ceiling: \/x: title 66 chars: X; /)
  })
})

describe('fetchText: one retry for a dropped tunnel, never for an HTTP answer', () => {
  const ok = (body = 'User-Agent: *') => ({ status: 200, headers: new Headers(), text: async () => body })
  const dropped = () => Object.assign(new TypeError('fetch failed'), { cause: new Error('ws_closed_mid_exchange') })

  it('a fetch that throws once is read on the retry', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      if (calls === 1) throw dropped()
      return ok()
    }
    const res = await fetchText('https://ryan-realty.com/robots.txt', 'ua', { fetchImpl, retryDelayMs: 0 })
    expect(res).toMatchObject({ status: 200, text: 'User-Agent: *' })
    expect(calls).toBe(2)
  })

  it('a body read that dies mid-stream is retried too', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return calls === 1
        ? { status: 200, headers: new Headers(), text: async () => { throw new TypeError('terminated') } }
        : ok('<urlset><url><loc>https://ryan-realty.com/</loc></url></urlset>')
    }
    const res = await fetchText('https://ryan-realty.com/sitemap.xml', 'ua', { fetchImpl, retryDelayMs: 0 })
    expect(res.text).toContain('<urlset>')
    expect(calls).toBe(2)
  })

  it('an HTTP status is the answer: a 503 is returned on the first read, not retried', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return { status: 503, headers: new Headers(), text: async () => 'down' }
    }
    const res = await fetchText('https://ryan-realty.com/', 'ua', { fetchImpl, retryDelayMs: 0 })
    expect(res).toMatchObject({ status: 503, text: '' })
    expect(calls).toBe(1)
  })

  it('two drops in a row still throw, so a real outage is not hidden', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      throw dropped()
    }
    await expect(fetchText('https://ryan-realty.com/', 'ua', { fetchImpl, retryDelayMs: 0 })).rejects.toThrow('fetch failed')
    expect(calls).toBe(2)
  })
})
