import { describe, expect, it } from 'vitest'
import { auditPage, auditRobots, parsePage, parseRobots } from '../lib/live-seo-audit.mjs'

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
