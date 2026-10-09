/**
 * live-seo-audit.mjs — the SEO baseline, checked against the LIVE site.
 *
 * WHY (Matt 2026-10-04: "this all needs to be encoded so we're not constantly
 * revisiting SEO"). Every rule below was found broken or nearly broken on the
 * live site in the 2026-10-04 review: Googlebot handed /admin/ by a bare
 * robots group, an empty image sitemap, the listing lead photo shipping with
 * no fetchpriority, preset pages printing their city's description. Source
 * gates catch what code says; this catches what production SERVES. It runs
 * at the end of `npm run deploy:verify` and alone as `npm run seo:live`.
 *
 * Fails (exit 1 from the caller) on:
 *   robots   a named crawler group without the private-page disallows; no Sitemap line
 *   sitemap  a child that is not 200; listings.xml with image:loc on < 90% of entries
 *   page     (sampled from every child sitemap, fetched as a real visit with
 *            Accept: text/html)
 *            - not a 200, or a sitemap URL that redirects
 *            - noindex in meta robots or X-Robots-Tag
 *            - canonical missing, relative, or not this URL
 *            - title missing, brand not exactly once, or over 90 chars
 *            - meta description missing, or shared by two sampled pages
 *            - not exactly one <h1>
 *            - no BreadcrumbList JSON-LD (homepage exempt), or JSON-LD that does not parse
 *            - an <img> with no alt attribute
 *   listing  the lead photo without fetchPriority="high", or no image preload
 *   decision any pinned decision in data/seo/decisions.json the live URL no
 *            longer keeps (status, redirect target, index, canonical, title,
 *            h1, served-HTML patterns). Those are Matt's calls; a miss means
 *            the site regressed.
 * Titles over 60 chars (Google truncates): each one is a warning, and more
 * than MAX_OVER_SOFT_SHARE of the sample over 60 FAILS (Matt 2026-10-05,
 * "shorten them now"). The 2026-10-04 suffix change left 203 of 367 sampled
 * titles over 60; the 2026-10-05 pass fit place, community, type, area and
 * blog titles to TITLE_BUDGET (lib/site/page-metadata.ts fitTitle), so a
 * share past the ceiling means a title template or a blog seo_title drifted.
 * The ceiling leaves room for recorded plat names longer than the budget,
 * which are never cut: after the pass, 2 of 150 broadly sampled live titles
 * and 3 of the audit's 40 ran past 60, all plat names; before it, 16 of 40.
 */

// Audit what Google is served. Next streams metadata for ordinary visitors and
// serves it in <head> to crawlers it recognises; reading as Googlebot is the view
// that ranks. The tail names the probe in access logs.
import { readFileSync } from 'node:fs'
import { withTransportRetry } from './transport-retry.mjs'

/**
 * The title-length ratchet: a sample with more than MAX_OVER_SOFT_SHARE of its
 * titles past 60 chars fails, naming each long title. Exported for tests.
 */
export function overSoftShareProblems(overSoftPages, sampled) {
  if (sampled <= 0 || overSoftPages.length / sampled <= MAX_OVER_SOFT_SHARE) return []
  return [
    `${overSoftPages.length} of ${sampled} sampled titles run past ${MAX_TITLE_SOFT} chars, over the ${Math.round(MAX_OVER_SOFT_SHARE * 100)}% ceiling: ${overSoftPages.join('; ')}`,
  ]
}

export const LIVE_SEO_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) rr-live-seo'

const PRIVATE_DISALLOWS = ['/admin/', '/dev/']
const MAX_TITLE_HARD = 90
const MAX_TITLE_SOFT = 60
export const MAX_OVER_SOFT_SHARE = 0.15
const IMAGE_SITEMAP_MIN_SHARE = 0.9
const BRAND = 'Ryan Realty'

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

function attr(tag, name) {
  const m = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? decode(m[1] ?? m[2] ?? '') : null
}

function metaContent(html, key, value) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(m[0], key) ?? '').toLowerCase() === value) return attr(m[0], 'content')
  }
  return null
}

/** Parse the SEO-relevant facts out of server HTML. Exported for tests. */
export function parsePage(html) {
  // Not just <head>: a route that streams (a loading.tsx boundary) gets its
  // <title>, description and canonical written later in the document, and
  // React hoists them into <head> on load. Inline <svg> may carry its own
  // <title>, so drop SVG bodies before looking.
  const head = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)
  const canonicalTag = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => (attr(t, 'rel') ?? '').toLowerCase() === 'canonical')
  const ldTypes = []
  let ldParseErrors = 0
  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o) => {
        if (Array.isArray(o)) return o.forEach(walk)
        if (o && typeof o === 'object') {
          const t = o['@type']
          if (t) ldTypes.push(...(Array.isArray(t) ? t : [t]))
          Object.values(o).forEach(walk)
        }
      }
      walk(JSON.parse(m[1]))
    } catch {
      ldParseErrors += 1
    }
  }
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  const preloads = [...head.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => (attr(t, 'rel') ?? '').toLowerCase() === 'preload' && (attr(t, 'as') ?? '').toLowerCase() === 'image')
  return {
    title: titleMatch ? decode(titleMatch[1].trim()) : null,
    description: metaContent(head, 'name', 'description'),
    robots: metaContent(head, 'name', 'robots'),
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
    h1: (() => {
      const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
      return m ? decode(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : null
    })(),
    ldTypes,
    ldParseErrors,
    imgsWithoutAlt: imgs.filter((t) => attr(t, 'alt') === null).length,
    imgCount: imgs.length,
    leadPhotoHigh: imgs.some((t) => /sparkplatform\.com/.test(t) && /fetchpriority="high"/i.test(t)),
    imagePreload: preloads.length > 0,
  }
}

/** robots.txt groups: [{ agents: [...], allow: [...], disallow: [...] }]. Exported for tests. */
export function parseRobots(text) {
  const groups = []
  let cur = null
  let lastWasAgent = false
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim().toLowerCase()
    const val = line.slice(i + 1).trim()
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) {
        cur = { agents: [], allow: [], disallow: [] }
        groups.push(cur)
      }
      cur.agents.push(val)
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur) continue
    if (key === 'allow') cur.allow.push(val)
    if (key === 'disallow') cur.disallow.push(val)
  }
  return groups
}

/** Rule check on robots.txt text. Returns failure strings. Exported for tests. */
export function auditRobots(text) {
  const fails = []
  if (!/^sitemap:\s*https:\/\//im.test(text)) fails.push('robots.txt has no absolute Sitemap line')
  for (const g of parseRobots(text)) {
    const missing = PRIVATE_DISALLOWS.filter((p) => !g.disallow.includes(p))
    if (missing.length > 0) {
      fails.push(
        `robots.txt group [${g.agents.join(', ')}] lacks Disallow ${missing.join(' ')}: a crawler obeys only the group that names it`,
      )
    }
  }
  return fails
}

/** Rule check on one parsed page. Returns { fails, warns }. Exported for tests. */
export function auditPage(url, page, { isHome, isListing }) {
  const fails = []
  const warns = []
  const where = new URL(url).pathname
  if (page.robots && /noindex/i.test(page.robots)) fails.push(`${where}: meta robots "${page.robots}" on a sitemap URL`)
  if (!page.canonical) fails.push(`${where}: no canonical`)
  else if (!/^https:\/\//.test(page.canonical)) fails.push(`${where}: canonical is not absolute (${page.canonical})`)
  else if (page.canonical.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
    fails.push(`${where}: canonical points elsewhere (${page.canonical}) though the sitemap lists this URL`)
  }
  if (!page.title) fails.push(`${where}: no <title>`)
  else {
    const brands = page.title.split(BRAND).length - 1
    if (brands !== 1) fails.push(`${where}: "${BRAND}" appears ${brands}x in the title: ${page.title}`)
    if (page.title.length > MAX_TITLE_HARD) fails.push(`${where}: title is ${page.title.length} chars: ${page.title}`)
    else if (page.title.length > MAX_TITLE_SOFT) warns.push(`${where}: title ${page.title.length} chars: ${page.title}`)
  }
  if (!page.description) fails.push(`${where}: no meta description`)
  if (page.h1Count !== 1) fails.push(`${where}: ${page.h1Count} <h1> elements (want exactly 1)`)
  if (page.ldParseErrors > 0) fails.push(`${where}: ${page.ldParseErrors} JSON-LD block(s) do not parse`)
  if (!isHome && !page.ldTypes.includes('BreadcrumbList')) fails.push(`${where}: no BreadcrumbList JSON-LD`)
  if (page.imgsWithoutAlt > 0) fails.push(`${where}: ${page.imgsWithoutAlt} <img> with no alt attribute`)
  if (isListing && page.imgCount > 0) {
    if (!page.leadPhotoHigh) fails.push(`${where}: listing lead photo has no fetchPriority="high"`)
    if (!page.imagePreload) fails.push(`${where}: listing page has no <link rel="preload" as="image">`)
  }
  return { fails, warns }
}

/**
 * One read, with ONE retry on a transport error: the fetch or the body read
 * threw (a dropped tunnel, a reset, the timeout), each attempt on its own
 * timeout (withTransportRetry, scripts/lib/transport-retry.mjs). An HTTP status
 * is the site's answer and is never retried. The cloud container's egress relay
 * drops about one of six concurrent tunnels to a host, and before this one drop
 * failed deploy:verify on a READY deploy (robots or a sitemap: "unexpected
 * error: fetch failed", exit 2; a page: a false SEO fail).
 */
export async function fetchText(
  url,
  ua,
  {
    accept = 'text/html,application/xhtml+xml,*/*;q=0.8',
    redirect = 'manual',
    timeoutMs = 60_000,
    retries,
    retryDelayMs,
    fetchImpl = fetch,
  } = {},
) {
  return withTransportRetry(async () => {
    const res = await fetchImpl(url, { headers: { 'user-agent': ua, accept }, redirect, signal: AbortSignal.timeout(timeoutMs) })
    return { status: res.status, headers: res.headers, text: res.status === 200 ? await res.text() : '' }
  }, { retries, retryDelayMs })
}

function sample(arr, n) {
  if (arr.length <= n) return [...arr]
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

/**
 * Audit the live site. Returns { fails, warns, lines } — the caller prints
 * `lines` and fails on `fails.length > 0`.
 */
/**
 * One pinned decision against one live response. Pure; exported for tests.
 * `location` is the raw Location header (absolute or relative).
 */
export function auditDecision(decision, { status, location, page, html }, origin) {
  const fails = []
  const e = decision.expect ?? {}
  const at = `${decision.path} [${decision.id}]`
  if (e.status != null && status !== e.status) fails.push(`${at}: HTTP ${status}, decision says ${e.status}`)
  if (e.location != null) {
    let got = null
    try {
      got = location ? new URL(location, origin).pathname : null
    } catch {
      got = location
    }
    if (got !== e.location) fails.push(`${at}: redirects to ${got ?? 'nothing'}, decision says ${e.location}`)
  }
  if (page) {
    const noindex = /noindex/i.test(page.robots ?? '')
    if (e.index === true && noindex) fails.push(`${at}: noindex, decision says indexable`)
    if (e.index === false && !noindex) fails.push(`${at}: indexable, decision says noindex`)
    if (e.canonical != null) {
      const want = e.canonical === 'self' ? decision.path : e.canonical
      let got = null
      try {
        got = page.canonical ? new URL(page.canonical, origin).pathname : null
      } catch {
        got = page.canonical
      }
      const norm = (p) => (p && p.length > 1 ? p.replace(/\/$/, '') : p)
      if (norm(got) !== norm(want)) fails.push(`${at}: canonical ${got ?? 'missing'}, decision says ${want}`)
    }
    if (e.title != null && !new RegExp(e.title).test(page.title ?? '')) {
      fails.push(`${at}: title "${page.title ?? ''}" no longer matches /${e.title}/`)
    }
    if (e.h1 != null && !new RegExp(e.h1).test(page.h1 ?? '')) fails.push(`${at}: h1 "${page.h1 ?? ''}" no longer matches /${e.h1}/`)
    // Served-HTML patterns the decision needs present (the AEO takeaways, a
    // chart's data table): what an AI crawler reads without running script.
    for (const pattern of e.html ?? []) {
      if (!new RegExp(pattern).test(html ?? '')) fails.push(`${at}: served HTML no longer contains /${pattern}/`)
    }
  }
  return fails
}

/** Every pinned decision, fetched live and checked. */
export async function auditDecisions(origin, ua, decisions, concurrency = 6) {
  const fails = []
  await mapLimit(decisions, concurrency, async (d) => {
    let res
    try {
      res = await fetchText(`${origin}${d.path}`, ua)
    } catch (err) {
      fails.push(`${d.path} [${d.id}]: fetch failed (${err?.name ?? 'error'})`)
      return
    }
    const page = res.status === 200 ? parsePage(res.text) : null
    fails.push(...auditDecision(d, { status: res.status, location: res.headers.get('location'), page, html: res.status === 200 ? res.text : null }, origin))
  })
  return fails
}

export async function runLiveSeoAudit(base, { ua, perSitemap = 8, concurrency = 6 } = {}) {
  const fails = []
  const warns = []
  const lines = []
  const origin = base.replace(/\/$/, '')

  const robots = await fetchText(`${origin}/robots.txt`, ua, { accept: 'text/plain' })
  if (robots.status !== 200) fails.push(`robots.txt returned ${robots.status}`)
  else fails.push(...auditRobots(robots.text))

  const index = await fetchText(`${origin}/sitemap.xml`, ua, { accept: 'application/xml' })
  const children = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
  if (index.status !== 200 || children.length === 0) fails.push(`/sitemap.xml returned ${index.status} with ${children.length} children`)

  const targets = [{ url: `${origin}/`, isHome: true, isListing: false }]
  for (const child of children) {
    const res = await fetchText(child, ua, { accept: 'application/xml', timeoutMs: 300_000 })
    const locs = [...res.text.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
    if (res.status !== 200 || locs.length === 0) {
      fails.push(`${new URL(child).pathname} returned ${res.status} with ${locs.length} URLs`)
      continue
    }
    const isListings = /listings\.xml$/.test(child)
    if (isListings) {
      const images = (res.text.match(/<image:loc>/g) ?? []).length
      const share = images / locs.length
      lines.push(`image sitemap: ${images}/${locs.length} listing URLs carry a photo`)
      if (share < IMAGE_SITEMAP_MIN_SHARE) {
        fails.push(`listings.xml: only ${images} of ${locs.length} URLs carry <image:loc> (floor ${IMAGE_SITEMAP_MIN_SHARE * 100}%)`)
      }
    }
    for (const url of sample(locs, perSitemap)) {
      if (new URL(url).pathname === '/' || targets.some((t) => t.url === url)) continue
      targets.push({ url, isHome: false, isListing: isListings })
    }
  }

  const descSeen = new Map()
  let overSoft = 0
  const overSoftPages = []
  await mapLimit(targets, concurrency, async (t) => {
    let res
    try {
      res = await fetchText(t.url, ua)
    } catch (e) {
      fails.push(`${t.url}: fetch failed (${e?.name ?? 'error'})`)
      return
    }
    const where = new URL(t.url).pathname
    if (res.status >= 300 && res.status < 400) {
      fails.push(`${where}: sitemap URL redirects (${res.status} → ${res.headers.get('location')})`)
      return
    }
    if (res.status !== 200) {
      fails.push(`${where}: HTTP ${res.status}`)
      return
    }
    const xr = res.headers.get('x-robots-tag')
    if (xr && /noindex/i.test(xr)) fails.push(`${where}: X-Robots-Tag "${xr}" on a sitemap URL`)
    const page = parsePage(res.text)
    const r = auditPage(t.url, page, t)
    fails.push(...r.fails)
    overSoft += r.warns.length
    overSoftPages.push(...r.warns)
    if (page.description) {
      const prev = descSeen.get(page.description)
      if (prev) fails.push(`${where}: meta description duplicates ${prev}`)
      else descSeen.set(page.description, where)
    }
  })
  lines.push(`pages: ${targets.length} sampled (${perSitemap} per sitemap + home)`)

  const decisions = JSON.parse(readFileSync(new URL('../../data/seo/decisions.json', import.meta.url), 'utf8')).decisions
  const decisionFails = await auditDecisions(origin, ua, decisions, concurrency)
  fails.push(...decisionFails)
  lines.push(`decisions: ${decisions.length} pinned, ${decisionFails.length} broken`)
  if (overSoft > 0) warns.push(`${overSoft} of ${targets.length} sampled titles run past ${MAX_TITLE_SOFT} chars (Google truncates)`)
  fails.push(...overSoftShareProblems(overSoftPages, targets.length))
  return { fails, warns, lines }
}
