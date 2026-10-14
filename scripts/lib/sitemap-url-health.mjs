/**
 * sitemap-url-health.mjs — every sitemap URL is a real indexable page.
 *
 * A sitemap entry that 404s, 5xxs, noindexes, or points its canonical at
 * another host (or another path) wastes crawl budget and splits the index.
 * robots.txt that Disallows /communities, /cities, /homes-for-sale, or the
 * sitemap itself hides the same graph.
 *
 * Slimmer than scripts/lib/live-seo-audit.mjs (title / H1 / JSON-LD sample):
 * this one walks EVERY loc in every child sitemap and checks only:
 *   - HTTP 200 (no redirect)
 *   - self-referencing canonical on https://ryan-realty.com
 *   - not noindex (meta robots or X-Robots-Tag)
 * plus robots.txt does not block the public place / listing / sitemap paths.
 */

import { readFileSync } from 'node:fs'
import { fetchText, parsePage, parseRobots } from './live-seo-audit.mjs'

export const CANONICAL_ORIGIN = 'https://ryan-realty.com'
export const CANONICAL_HOST = 'ryan-realty.com'

/** deploy:verify default: every sitemap is sampled; seo:sitemap-urls walks all. */
export const DEFAULT_DEPLOY_SITEMAP_URL_HEALTH_MAX = 400

/** Paths a crawler must be able to fetch. Used on the live robots.txt and on app/robots.ts. */
export const IMPORTANT_PUBLIC_PATHS = Object.freeze([
  '/',
  '/communities',
  '/communities/tetherow',
  '/cities/bend',
  '/homes-for-sale',
  '/housing-market',
  '/blog',
  '/team',
  '/sitemap.xml',
  '/sitemaps/geo.xml',
  '/llms.txt',
  '/api/og',
])

const decode = (s) =>
  String(s)
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

function normPath(p) {
  if (!p || p === '/') return '/'
  return p.replace(/\/$/, '')
}

function normHref(href) {
  try {
    const u = new URL(href)
    u.hash = ''
    return `${u.origin}${normPath(u.pathname)}${u.search}`
  } catch {
    return href
  }
}

/** Longest-prefix robots rule. Equal length: Allow wins (Google). Empty Disallow is ignored. */
export function robotsRuleBlocksPath(group, path) {
  let bestLen = -1
  let allowed = true
  const consider = (rule, allow) => {
    if (!rule) return
    if (path === rule || path.startsWith(rule)) {
      if (rule.length > bestLen || (rule.length === bestLen && allow)) {
        bestLen = rule.length
        allowed = allow
      }
    }
  }
  for (const p of group.allow ?? []) consider(p, true)
  for (const p of group.disallow ?? []) consider(p, false)
  return bestLen >= 0 && !allowed
}

/** Failure strings when a robots group blocks a public path. */
export function auditRobotsImportantPaths(text) {
  const fails = []
  const groups = parseRobots(text)
  if (groups.length === 0) {
    return ['robots.txt has no User-agent group']
  }
  for (const g of groups) {
    for (const path of IMPORTANT_PUBLIC_PATHS) {
      if (robotsRuleBlocksPath(g, path)) {
        fails.push(
          `robots.txt group [${g.agents.join(', ')}] blocks ${path} — that path must stay crawlable`,
        )
      }
    }
  }
  return fails
}

/** One sitemap loc against one HTTP response. Pure. */
export function auditSitemapUrlHealth(url, { status, canonical, robots, xRobotsTag, location }) {
  const fails = []
  let where = url
  try {
    where = new URL(url).pathname
  } catch {
    fails.push(`${url}: sitemap loc is not a URL`)
    return fails
  }

  try {
    const listed = new URL(url)
    if (listed.protocol !== 'https:' || listed.hostname !== CANONICAL_HOST) {
      fails.push(`${where}: sitemap lists ${listed.origin}, want ${CANONICAL_ORIGIN}`)
    }
  } catch {
    /* already reported */
  }

  if (status >= 300 && status < 400) {
    fails.push(`${where}: sitemap URL redirects (${status} → ${location ?? 'no location'})`)
    return fails
  }
  if (status !== 200) {
    fails.push(`${where}: HTTP ${status}`)
    return fails
  }
  if (xRobotsTag && /noindex/i.test(xRobotsTag)) {
    fails.push(`${where}: X-Robots-Tag "${xRobotsTag}" on a sitemap URL`)
  }
  if (robots && /noindex/i.test(robots)) {
    fails.push(`${where}: meta robots "${robots}" on a sitemap URL`)
  }
  if (!canonical) {
    fails.push(`${where}: no self-referencing canonical`)
    return fails
  }
  try {
    const c = new URL(canonical)
    if (c.protocol !== 'https:' || c.hostname !== CANONICAL_HOST) {
      fails.push(`${where}: canonical host is ${c.origin}, want ${CANONICAL_ORIGIN}`)
    }
    if (normHref(c.href) !== normHref(url)) {
      fails.push(`${where}: canonical is not self-referencing (${canonical})`)
    }
  } catch {
    fails.push(`${where}: canonical is not a URL (${canonical})`)
  }
  return fails
}

export function extractIndexLocs(xml) {
  return [...String(xml).matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
}

export function extractUrlsetLocs(xml) {
  return [...String(xml).matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
}

/** Evenly spaced sample so a cap does not only hit the front of one sitemap. */
export function sampleEven(arr, n) {
  if (n <= 0) return []
  if (arr.length <= n) return [...arr]
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

/**
 * When maxUrls is set, take a floor from every child sitemap so listings.xml
 * is not skipped because core.xml came first. Uncapped walks stay complete.
 */
export function takeSitemapTargets(groups, maxUrls, priorityUrls = []) {
  const uniqueGroups = groups.map((urls) => [...new Set(urls)])
  const all = [...new Set(uniqueGroups.flat())]
  if (!Number.isFinite(maxUrls) || maxUrls >= all.length) return all

  const picked = []
  const seen = new Set()
  const push = (url) => {
    if (!url || seen.has(url) || !all.includes(url)) return
    seen.add(url)
    picked.push(url)
  }
  for (const url of priorityUrls) push(url)

  const remainingBudget = Math.max(0, maxUrls - picked.length)
  const n = uniqueGroups.length || 1
  const floor = Math.max(1, Math.floor(remainingBudget / n))
  for (const urls of uniqueGroups) {
    for (const url of sampleEven(urls, Math.min(floor, urls.length))) push(url)
  }
  if (picked.length < maxUrls) {
    for (const url of all) {
      if (picked.length >= maxUrls) break
      push(url)
    }
  }
  return picked.slice(0, maxUrls)
}

/** Community / resort / city doors that must be in a capped deploy walk. */
export const PRIORITY_SITEMAP_URLS = Object.freeze(
  [
    '/',
    '/communities',
    '/communities/tetherow',
    '/communities/sunriver',
    '/communities/eagle-crest',
    '/communities/tetherow/types/single-family',
    '/cities/bend',
    '/homes-for-sale',
    '/housing-market',
    '/blog',
    '/team',
  ].map((p) => (p === '/' ? CANONICAL_ORIGIN : `${CANONICAL_ORIGIN}${p}`)),
)

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
 * Live sweep. Returns { fails, lines, checked }.
 *
 * @param {string} origin
 * @param {{ ua: string, concurrency?: number, maxUrls?: number, fetchImpl?: typeof fetch, timeoutMs?: number }} opts
 */
export async function runSitemapUrlHealth(origin, opts) {
  const ua = opts.ua
  const concurrency = opts.concurrency ?? 8
  const maxUrls = opts.maxUrls ?? Infinity
  const fetchImpl = opts.fetchImpl
  const timeoutMs = opts.timeoutMs ?? 60_000
  const base = String(origin).replace(/\/$/, '')
  const fails = []
  const lines = []

  const robots = await fetchText(`${base}/robots.txt`, ua, {
    accept: 'text/plain',
    fetchImpl,
    timeoutMs,
  })
  if (robots.status !== 200) fails.push(`robots.txt returned ${robots.status}`)
  else fails.push(...auditRobotsImportantPaths(robots.text))

  const index = await fetchText(`${base}/sitemap.xml`, ua, {
    accept: 'application/xml',
    fetchImpl,
    timeoutMs: 300_000,
  })
  const children = extractIndexLocs(index.text)
  if (index.status !== 200 || children.length === 0) {
    const fallback = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
    if (index.status !== 200 || fallback.length === 0) {
      fails.push(`/sitemap.xml returned ${index.status} with ${children.length} children`)
    } else {
      children.push(...fallback.filter((u) => /\/sitemaps\/[^/]+\.xml$/.test(u)))
    }
  }

  const groups = []
  let uniqueTotal = 0
  for (const child of children) {
    const res = await fetchText(child, ua, {
      accept: 'application/xml',
      fetchImpl,
      timeoutMs: 300_000,
    })
    const urls = extractUrlsetLocs(res.text)
    if (res.status !== 200 || urls.length === 0) {
      fails.push(`${pathnameOf(child)} returned ${res.status} with ${urls.length} URLs`)
      continue
    }
    lines.push(`${pathnameOf(child)}: ${urls.length} URLs`)
    groups.push(urls)
  }

  const unique = [...new Set(groups.flat())]
  const targets = takeSitemapTargets(groups, maxUrls, PRIORITY_SITEMAP_URLS)
  if (targets.length < unique.length) {
    lines.push(`pages: checking ${targets.length} of ${unique.length} sitemap URLs (stratified cap)`)
  } else {
    lines.push(`pages: checking all ${targets.length} sitemap URLs`)
  }

  await mapLimit(targets, concurrency, async (url) => {
    let res
    try {
      res = await fetchText(url, ua, { fetchImpl, timeoutMs, redirect: 'manual' })
    } catch (err) {
      fails.push(`${pathnameOf(url)}: fetch failed (${err?.name ?? 'error'})`)
      return
    }
    const page = res.status === 200 ? parsePage(res.text) : { canonical: null, robots: null }
    fails.push(
      ...auditSitemapUrlHealth(url, {
        status: res.status,
        canonical: page.canonical,
        robots: page.robots,
        xRobotsTag: res.headers.get('x-robots-tag'),
        location: res.headers.get('location'),
      }),
    )
  })

  return { fails, lines, checked: targets.length }
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/** Source assertions for ci:sitemap-url-health (no network). */
export function auditRobotsSource(src) {
  const fails = []
  if (!/PUBLIC_ALLOW\s*=\s*\[\s*'\/'\s*,\s*'\/api\/og'\s*,\s*'\/llms\.txt'\s*\]/.test(src)) {
    fails.push("app/robots.ts PUBLIC_ALLOW must keep '/', '/api/og', and '/llms.txt'")
  }
  for (const path of IMPORTANT_PUBLIC_PATHS.filter((p) => p !== '/' && p !== '/api/og')) {
    const prefix = path.endsWith('/') ? path : `${path.split('/').slice(0, 2).join('/')}/`
    const privateBlock = src.match(/PRIVATE_PAGES\s*=\s*\[([^\]]*)\]/)
    if (privateBlock && privateBlock[1].includes(`'${prefix}'`)) {
      fails.push(`app/robots.ts PRIVATE_PAGES lists ${prefix} — that hides a public path`)
    }
  }
  if (/disallow:\s*\[\s*'\/'\s*\]/i.test(src) || /disallow:\s*'\/'/i.test(src)) {
    fails.push("app/robots.ts must not Disallow '/' for any group")
  }
  return fails
}

export function readRepoFile(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
}
