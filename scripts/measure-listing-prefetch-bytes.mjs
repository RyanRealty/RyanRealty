#!/usr/bin/env node
/**
 * measure-listing-prefetch-bytes.mjs — SITE-60
 *
 * Headless Chromium against a production `next start` server. Counts listing
 * photograph bytes with Next link prefetch allowed vs blocked.
 *
 * A list page that links to listings was measured 2026-09-09 at 25,386,060
 * bytes / 78 sparkplatform requests with prefetch on, and 333,689 / 11 with
 * it blocked — the extra is 1600×1200 hero preloads inside prefetched listing
 * RSC payloads. `next dev` disables prefetch, so this only means anything
 * against `next start`.
 *
 * Usage:
 *   node scripts/measure-listing-prefetch-bytes.mjs --base http://127.0.0.1:3127
 *   node scripts/measure-listing-prefetch-bytes.mjs --base http://127.0.0.1:3127 --prefetch off
 *   node scripts/measure-listing-prefetch-bytes.mjs --base http://127.0.0.1:3127 --visit-listing
 *
 * Env:
 *   MEASURE_BASE_URL   origin of a running production server
 */

import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __filename = fileURLToPath(import.meta.url)

/** Real Chrome. middleware.ts 403s automation UAs (take-route-shots trap 8). */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const LAUNCH_ARGS = [
  '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader',
  '--no-sandbox',
  '--ignore-gpu-blocklist',
]

const SPARK_HOST_RE = /(?:^|\.)sparkplatform\.com$/i
const SPARK_SIZE_RE = /\/(\d{2,4})x(\d{2,4})\//
const DEFAULT_PATHS = ['/oregon/medford', '/cities/bend']
const SETTLE_MS = 8_000
const SITE_59_PREFETCH_ON_BYTES = 25_386_060
const TARGET_MAX_BYTES = Math.floor(SITE_59_PREFETCH_ON_BYTES * 0.2)

/**
 * True when this URL is a listing photograph: a Spark photo CDN host, or
 * `/_next/image` proxying one. SITE-59 counted the host; Next/Image priority
 * preloads often go through the optimizer, whose query still names Spark.
 *
 * @param {string} raw
 */
export function isListingPhotoUrl(raw) {
  if (!raw) return false
  let url
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (SPARK_HOST_RE.test(url.hostname)) return true
  if (!url.pathname.includes('/_next/image')) return false
  const inner = url.searchParams.get('url')
  if (!inner) return false
  try {
    return SPARK_HOST_RE.test(new URL(inner).hostname)
  } catch {
    return inner.includes('sparkplatform.com')
  }
}

/**
 * Spark resize token (`1600x1200`, `320x240`) from a direct CDN URL or from
 * the optimizer's inner `url` query. Null when the URL is not a listing photo
 * or carries no size token.
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function listingPhotoSizeToken(raw) {
  if (!isListingPhotoUrl(raw)) return null
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const inner = url.searchParams.get('url')
  const path = inner ? safePathname(inner) : url.pathname
  const m = SPARK_SIZE_RE.exec(path)
  return m ? `${m[1]}x${m[2]}` : null
}

function safePathname(raw) {
  try {
    return new URL(raw).pathname
  } catch {
    return raw
  }
}

/**
 * A house URL, not a city/search index. `/homes-for-sale/medford` is a list;
 * `/homes-for-sale/medford/139-columbus-220222551` is the listing.
 *
 * @param {string} raw
 */
export function isListingDetailPath(raw) {
  let path = raw
  try {
    path = new URL(raw, 'http://local.invalid').pathname
  } catch {
    /* keep raw */
  }
  if (path.startsWith('/listing/') && path.split('/').filter(Boolean).length >= 2) return true
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'homes-for-sale' || parts.length < 3) return false
  const tail = parts[parts.length - 1] ?? ''
  return /-\d{5,}$/.test(tail) || /^\d{5,}$/.test(tail)
}

/**
 * @param {Array<{ url: string, bytes: number }>} hits
 */
export function summarizeListingPhotoHits(hits) {
  const bySize = new Map()
  let bytes = 0
  for (const hit of hits) {
    bytes += hit.bytes
    const token = listingPhotoSizeToken(hit.url) ?? 'unknown'
    const row = bySize.get(token) ?? { requests: 0, bytes: 0 }
    row.requests += 1
    row.bytes += hit.bytes
    bySize.set(token, row)
  }
  return {
    requests: hits.length,
    bytes,
    bySize: Object.fromEntries(
      [...bySize.entries()].sort((a, b) => b[1].bytes - a[1].bytes),
    ),
  }
}

function parseArgs(argv) {
  const out = {
    base: process.env.MEASURE_BASE_URL ?? '',
    paths: DEFAULT_PATHS.slice(),
    prefetch: 'both',
    visitListing: false,
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') out.base = String(argv[++i] ?? '')
    else if (a === '--path' || a === '--paths') {
      out.paths = String(argv[++i] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (a === '--prefetch') out.prefetch = String(argv[++i] ?? 'both')
    else if (a === '--visit-listing') out.visitListing = true
    else if (a === '--json') out.json = true
  }
  out.base = out.base.replace(/\/+$/, '')
  if (!out.base) {
    throw new Error('pass --base http://127.0.0.1:<port> of a running `next start` server')
  }
  return out
}

function modesFor(prefetch) {
  if (prefetch === 'on') return [true]
  if (prefetch === 'off') return [false]
  return [true, false]
}

/**
 * @param {import('playwright').Browser} browser
 * @param {{ base: string, path: string, allowPrefetch: boolean, visitListing: boolean }} opts
 */
async function measurePath(browser, opts) {
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  /** @type {Array<{ url: string, bytes: number }>} */
  const hits = []

  if (!opts.allowPrefetch) {
    await context.route('**/*', (route) => {
      const h = route.request().headers()
      const prefetch = h['next-router-prefetch']
      if (prefetch === '1' || prefetch === '2' || prefetch === 'true') return route.abort()
      if (h['next-router-segment-prefetch']) return route.abort()
      return route.continue()
    })
  }

  /** @type {Array<{ path: string, n1600: number, n320: number, bytes: number }>} */
  const listingFlights = []
  /** @type {Array<{ path: string, n1600: number, n320: number, bytes: number }>} */
  const otherFlights = []

  page.on('response', (res) => {
    const url = res.url()
    const req = res.request()
    const isFlight =
      req.headers()['rsc'] === '1' ||
      req.headers()['next-router-prefetch'] ||
      url.includes('_rsc=')
    if (isFlight && !url.includes('sparkplatform.com') && !url.includes('/_next/')) {
      void res
        .text()
        .then((body) => {
          const row = {
            path: safePathname(url),
            n1600: (body.match(/1600x1200/g) || []).length,
            n320: (body.match(/320x240/g) || []).length,
            bytes: body.length,
          }
          if (isListingDetailPath(url)) listingFlights.push(row)
          else otherFlights.push(row)
        })
        .catch(() => {})
    }
    if (!isListingPhotoUrl(url)) return
    const headers = res.headers()
    const len = Number(headers['content-length'] || 0)
    const rec = { url, bytes: Number.isFinite(len) ? len : 0 }
    hits.push(rec)
    void res
      .body()
      .then((buf) => {
        rec.bytes = buf.byteLength
      })
      .catch(() => {})
  })

  const target = `${opts.base}${opts.path}`
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {})

  const listingLinks = page.locator(
    'a[href*="/homes-for-sale/"][href*="-2"], a[href^="/listing/"]',
  )
  const linkCount = await listingLinks.count()
  const hoverLimit = Math.min(linkCount, 24)
  for (let i = 0; i < hoverLimit; i++) {
    const el = listingLinks.nth(i)
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 2_000 })
      await el.hover({ timeout: 2_000 })
    } catch {
      /* a link that unmounted mid-stream is not a measurement failure */
    }
  }
  await page.waitForTimeout(SETTLE_MS)

  const thumbs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img.v3-ledger__thumb, img.v3-ledger__media')]
    return imgs.map((img) => ({
      src: img.currentSrc || img.getAttribute('src') || '',
      naturalWidth: img.naturalWidth,
      complete: img.complete,
    }))
  })
  const visibleThumbs = thumbs.filter((t) => t.src && t.naturalWidth > 0)

  const firstListingHref = linkCount > 0 ? await listingLinks.first().getAttribute('href') : null

  await context.close()

  let listingHero = null
  if (opts.visitListing && firstListingHref) {
    listingHero = await measureListingDocument(browser, {
      base: opts.base,
      href: firstListingHref,
    })
  }

  return {
    path: opts.path,
    prefetch: opts.allowPrefetch ? 'on' : 'off',
    listingLinks: linkCount,
    visibleThumbs: visibleThumbs.length,
    thumbsTotal: thumbs.length,
    thumbs: visibleThumbs.slice(0, 16),
    photos: summarizeListingPhotoHits(hits),
    listingFlights: summarizeFlights(listingFlights),
    otherFlights: summarizeFlights(otherFlights),
    listingHero,
  }
}

/**
 * @param {Array<{ path: string, n1600: number, n320: number, bytes: number }>} rows
 */
function summarizeFlights(rows) {
  return {
    requests: rows.length,
    n1600: rows.reduce((n, r) => n + r.n1600, 0),
    n320: rows.reduce((n, r) => n + r.n320, 0),
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
    sample: rows
      .filter((r) => r.n1600 > 0 || r.n320 > 0)
      .slice(0, 8)
      .map((r) => ({ path: r.path, n1600: r.n1600, n320: r.n320, bytes: r.bytes })),
  }
}

/**
 * A real document navigation to one listing. Isolated from the list-page
 * context so its 1600×1200 LCP hero cannot leak into the list totals.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ base: string, href: string }} opts
 */
async function measureListingDocument(browser, opts) {
  const dest = opts.href.startsWith('http') ? opts.href : `${opts.base}${opts.href}`
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  // Isolate the listing document from viewport prefetch of nav city/community
  // links (SITE-61 1600 plates). SITE-60 needs the lead-photo LCP, not the menu.
  await context.route('**/*', (route) => {
    const h = route.request().headers()
    const prefetch = h['next-router-prefetch']
    if (prefetch === '1' || prefetch === '2' || prefetch === 'true') return route.abort()
    if (h['next-router-segment-prefetch']) return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  /** @type {Array<{ url: string, bytes: number }>} */
  const hits = []
  page.on('response', (res) => {
    const url = res.url()
    if (!isListingPhotoUrl(url)) return
    const rec = { url, bytes: Number(res.headers()['content-length'] || 0) }
    hits.push(rec)
    void res
      .body()
      .then((buf) => {
        rec.bytes = buf.byteLength
      })
      .catch(() => {})
  })
  await page.goto(dest, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(SETTLE_MS)
  const summary = summarizeListingPhotoHits(hits)
  const large = hits.filter((h) => {
    const token = listingPhotoSizeToken(h.url)
    if (!token) return h.bytes >= 80_000
    const width = Number(token.split('x')[0])
    return width >= 800 || h.bytes >= 80_000
  })
  const url = page.url()
  await context.close()
  return {
    url,
    photoRequests: summary.requests,
    photoBytes: summary.bytes,
    largeDerivativeRequests: large.length,
    largeSample: large.slice(0, 4).map((h) => ({
      size: listingPhotoSizeToken(h.url),
      bytes: h.bytes,
      url: h.url.slice(0, 180),
    })),
  }
}

function fmt(n) {
  return `${(n / 1_048_576).toFixed(2)} MiB (${n.toLocaleString('en-US')} bytes)`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const browser = await chromium.launch({
    headless: true,
    args: LAUNCH_ARGS,
  })
  const results = []
  try {
    for (const path of args.paths) {
      for (const allowPrefetch of modesFor(args.prefetch)) {
        const visitListing = args.visitListing && allowPrefetch && path === args.paths[0]
        const row = await measurePath(browser, {
          base: args.base,
          path,
          allowPrefetch,
          visitListing,
        })
        results.push(row)
      }
    }
  } finally {
    await browser.close()
  }

  const report = {
    base: args.base,
    measuredAt: new Date().toISOString(),
    site59PrefetchOnBytes: SITE_59_PREFETCH_ON_BYTES,
    targetMaxBytes: TARGET_MAX_BYTES,
    results,
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`listing-prefetch bytes — ${args.base}`)
  console.log(`SITE-59 prefetch-on baseline: ${fmt(SITE_59_PREFETCH_ON_BYTES)}`)
  console.log(`accept ceiling (20% of that): ${fmt(TARGET_MAX_BYTES)}\n`)
  for (const row of results) {
    const vsSite59 =
      row.prefetch === 'on'
        ? `  vs SITE-59: ${((row.photos.bytes / SITE_59_PREFETCH_ON_BYTES) * 100).toFixed(1)}%`
        : ''
    console.log(
      `${row.path}  prefetch=${row.prefetch}  ` +
        `${row.photos.requests} req  ${fmt(row.photos.bytes)}  ` +
        `thumbs ${row.visibleThumbs}/${row.thumbsTotal}  links ${row.listingLinks}${vsSite59}`,
    )
    for (const [size, stat] of Object.entries(row.photos.bySize)) {
      console.log(`    ${size}: ${stat.requests} req  ${fmt(stat.bytes)}`)
    }
    if (row.listingFlights) {
      console.log(
        `    listing Flight: ${row.listingFlights.requests} req  ` +
          `${row.listingFlights.n1600}×1600  ${row.listingFlights.n320}×320`,
      )
    }
    if (row.otherFlights) {
      console.log(
        `    other Flight: ${row.otherFlights.requests} req  ` +
          `${row.otherFlights.n1600}×1600  ${row.otherFlights.n320}×320`,
      )
    }
    if (row.listingHero) {
      console.log(
        `    listing nav ${row.listingHero.url}  ` +
          `${row.listingHero.photoRequests} photo req  ${fmt(row.listingHero.photoBytes)}  ` +
          `large ${row.listingHero.largeDerivativeRequests}`,
      )
      for (const s of row.listingHero.largeSample) {
        console.log(`      ${s.size ?? '?'}  ${fmt(s.bytes)}  ${s.url}`)
      }
    }
  }
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) {
  main().catch((error) => {
    console.error('✗ measure-listing-prefetch-bytes.mjs crashed:', error)
    process.exit(2)
  })
}
