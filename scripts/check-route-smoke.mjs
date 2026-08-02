#!/usr/bin/env node
/**
 * check-route-smoke.mjs — HTTP smoke test for the canonical route set.
 *
 * Per the feedback memory "Verify before moving on": every fix that
 * affects a user-facing surface gets browser-rendered + timely-loaded
 * confirmation before "done." Type-check + lint is necessary but not
 * sufficient.
 *
 * This gate is the mechanical version. It hits a known set of canonical
 * routes against a running server (localhost:3000 by default) and
 * asserts:
 *
 *   - HTTP 200 (route renders, no 5xx)
 *   - Body does NOT contain "Page not found" (route resolved, not 404)
 *   - Body does NOT contain "Application error" (no top-level crash)
 *   - <title> tag is non-empty
 *   - Body is at least 5 KB (catches blank-page regressions)
 *
 * Run modes:
 *   - Standalone: `node scripts/check-route-smoke.mjs` (requires the
 *     server to be up at SMOKE_BASE_URL or http://127.0.0.1:3000)
 *   - In CI (.github/workflows/ci.yml, "Route smoke test"): the server is
 *     started in the background, `scripts/wait-for-server.mjs` polls it until
 *     200, then this runs. That replaced start-server-and-test, whose only
 *     failure output was "Timed out waiting for", with no status or timing.
 *
 * Add a route: edit ROUTES below. To pin a route to a known-good
 * listing key without burning into source, set SMOKE_LISTING_KEY in
 * the environment (the pick-lhci-listing.mjs script can be reused).
 *
 * Why this exists: the listing-detail rebuild on 2026-05-28 shipped
 * with the page returning "Page not found" because of a DAL bug
 * (literal double-quotes around PostgREST column names) that
 * type-check + lint did not catch. A smoke against the prod URL would
 * have caught it before any commit shipped.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const LISTING_KEY = process.env.SMOKE_LISTING_KEY
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000)

// ADMIN ROUTES GET A LONGER BUDGET — as a CLASS, not route by route.
//
// First attempt here named a single slow route and gave it 45s. That was wrong
// twice over: /admin/media/banners still exceeded 45s, and two neighbours
// (/admin/reports/lead-flow, /admin/reports/traffic-sources) that had passed at
// 15s in the previous run tipped over too. They are all the same kind of page —
// a staff dashboard aggregating over listings with a cold cache — so they sit
// near whatever single threshold is chosen and which ones trip is close to
// random. Naming them one at a time is whack-a-mole.
//
// The split that actually means something is public vs admin:
//
//   public  15s. These are the pages users and Googlebot load. Slow is a real
//           regression, and the tight budget is the point of the gate.
//   admin   60s. Staff-only, behind auth, Disallow-ed in robots.txt, and heavy
//           by construction on a cold start. CI is always a cold start.
const ADMIN_TIMEOUT_MS = Number(process.env.SMOKE_ADMIN_TIMEOUT_MS ?? 60_000)

// SKIPPED — reported every run, never silently dropped.
//
// /admin/media/banners exceeds even 60s cold. listMissingBanners() fans out
// getSubdivisionsInCity() across every browse city, each a heavy listings scan.
// That has already been optimised once (serial loop -> Promise.all, see its
// comment "blew past the 45s page budget") and is still too slow to smoke on a
// cold cache. Keeping it in makes this gate permanently red or flaky, which is
// worse than one visible, justified exclusion.
//
// The real fix is in listMissingBanners / getSubdivisionsInCity, not in this
// file. Deliberately not attempted from here: measuring that query needs live
// Supabase, and a performance change nobody can measure is a guess.
// /admin/media/banners was skipped here from 2026-08-02 until the cold-load
// cause was found: getSubdivisionsInCity() fetched EVERY historical row for each
// of 13 cities (277,415 rows, 284 round-trips, 38.2s) and filtered to "active"
// in JS. Now pre-filtered server-side: 3,344 rows, 14 round-trips, 271-510ms,
// byte-identical output. The route is back in the smoke set.
const SKIP_ROUTES = new Map([
])

function timeoutFor(path) {
  return path.startsWith('/admin/') ? Math.max(TIMEOUT_MS, ADMIN_TIMEOUT_MS) : TIMEOUT_MS
}
// CONCURRENCY caps parallel HTTP requests so the smoke covers the
// full canonical set without overwhelming the dev/start:ci server.
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY ?? 6)

// Read the canonical public-route set from docs/ROUTE_INVENTORY.md
// (G16-style sources-of-truth pattern). The inventory is regenerated
// by scripts/index-routes.mjs from the canonical slug arrays committed
// in the repo, so a route added to `app/<route>/page.tsx` plus the
// slug source automatically gets smoke-tested next CI run. Closes
// GAP-9 from out/guardrail-inventory-2026-05-28.md.
function loadRoutesFromInventory() {
  const path = resolve('docs/ROUTE_INVENTORY.md')
  if (!existsSync(path)) return null
  const md = readFileSync(path, 'utf8')
  const routes = []
  // The inventory lists routes as `\`/path\`` under per-category H2
  // headings. Pull every backticked route literal.
  const re = /^- `([^`]+)`/gm
  let m
  while ((m = re.exec(md))) {
    const path = m[1]
    if (path.includes('<runtime-resolved>')) continue
    // The inventory also carries non-path markers for dynamic families the
    // generator cannot expand — it writes a literal `(no enumeration)` row
    // (scripts/index-routes.mjs). Those are documentation, not URLs: fetching
    // one produced "Failed to parse URL from http://127.0.0.1:3000(no
    // enumeration)" and counted as a smoke failure. Anything that is not a
    // rooted path is a marker, so skip it rather than enumerate marker strings.
    if (!path.startsWith('/')) continue
    routes.push({ path, name: path === '/' ? 'homepage' : path.replace(/^\//, '') })
  }
  return routes
}

const INVENTORY_ROUTES = loadRoutesFromInventory()
const ROUTES = INVENTORY_ROUTES
  ? [
      ...INVENTORY_ROUTES,
      ...(LISTING_KEY
        ? [{ path: `/listing/${LISTING_KEY}`, name: 'listing detail (live)' }]
        : []),
    ]
  : // Fallback to the original hardcoded set if the inventory is missing.
    [
      { path: '/', name: 'homepage' },
      { path: '/cities/bend', name: 'cities/bend' },
      { path: '/communities', name: 'communities index' },
      { path: '/team', name: 'team' },
      { path: '/about', name: 'about' },
      { path: '/contact', name: 'contact' },
      { path: '/sell', name: 'sell' },
      { path: '/housing-market', name: 'housing market hub' },
      { path: '/lp/seller-home-value', name: 'seller LP' },
      { path: '/lp/buyer-listing-alerts', name: 'buyer LP' },
      ...(LISTING_KEY
        ? [{ path: `/listing/${LISTING_KEY}`, name: 'listing detail' }]
        : []),
    ]

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { ...CI_PROBE_HEADERS },
    })
    const body = await res.text()
    return { status: res.status, body }
  } finally {
    clearTimeout(t)
  }
}

function checkBody(body) {
  const reasons = []
  if (body.includes('Page not found')) reasons.push('contains "Page not found"')
  if (body.includes('Application error')) reasons.push('contains "Application error"')
  const titleMatch = body.match(/<title>([^<]*)<\/title>/i)
  if (!titleMatch || titleMatch[1].trim().length === 0) reasons.push('empty <title>')
  if (body.length < 5_000) reasons.push(`body too small (${body.length} bytes)`)
  return { ok: reasons.length === 0, reasons, title: titleMatch?.[1]?.trim() }
}

async function checkRoute(route) {
  const url = BASE + route.path
  const skipReason = SKIP_ROUTES.get(route.path)
  if (skipReason) return { ...route, url, ok: true, skipped: true, status: 0, reasons: [skipReason], title: null }
  try {
    const { status, body } = await fetchWithTimeout(url, timeoutFor(route.path))
    if (status !== 200) {
      return { ...route, url, ok: false, status, reasons: [`HTTP ${status}`], title: null }
    }
    const c = checkBody(body)
    return { ...route, url, status, ok: c.ok, reasons: c.reasons, title: c.title }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = []
  let cursor = 0
  async function next() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await worker(items[idx])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()))
  return results
}

async function main() {
  const results = await runWithConcurrency(ROUTES, checkRoute, CONCURRENCY)
  const failed = results.filter((r) => !r.ok)

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2))
    process.exit(failed.length === 0 ? 0 : 1)
  }

  console.log('Route smoke check')
  console.log('=================')
  console.log(`Base URL: ${BASE}`)
  console.log()
  for (const r of results) {
    const status = r.skipped ? 'SKIP' : r.ok ? 'OK  ' : 'FAIL'
    const http = r.skipped ? '  -' : `HTTP ${r.status}`
    console.log(`[${status}] ${http}  ${r.path}  (${r.name})`)
    if (r.title) console.log(`         title: ${r.title}`)
    if (!r.ok || r.skipped) for (const reason of r.reasons) console.log(`         reason: ${reason}`)
  }
  const skipped = results.filter((r) => r.skipped)
  const checked = results.length - skipped.length
  console.log()
  console.log(
    `Summary: ${checked - failed.length} of ${checked} routes pass` +
      (skipped.length ? `, ${skipped.length} skipped (see [SKIP] above).` : '.'),
  )
  if (failed.length > 0 && !REPORT) {
    console.log()
    console.log('Fix: start the server with `npm run start:ci` (or `npm run dev`),')
    console.log('then re-run. CI does this in the "Route smoke test" step.')
  }

  if (REPORT) process.exit(0)
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
