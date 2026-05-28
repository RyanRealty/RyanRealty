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
 *   - Via start-server-and-test in CI:
 *       `start-server-and-test start:ci http://127.0.0.1:3000 ci:route-smoke`
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

const BASE = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const LISTING_KEY = process.env.SMOKE_LISTING_KEY
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000)

const ROUTES = [
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
      headers: { 'user-agent': 'rr-smoke/1.0' },
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
  try {
    const { status, body } = await fetchWithTimeout(url, TIMEOUT_MS)
    if (status !== 200) {
      return { ...route, url, ok: false, status, reasons: [`HTTP ${status}`], title: null }
    }
    const c = checkBody(body)
    return { ...route, url, status, ok: c.ok, reasons: c.reasons, title: c.title }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
}

async function main() {
  const results = []
  for (const r of ROUTES) {
    results.push(await checkRoute(r))
  }
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
    const status = r.ok ? 'OK  ' : 'FAIL'
    console.log(`[${status}] HTTP ${r.status}  ${r.path}  (${r.name})`)
    if (r.title) console.log(`         title: ${r.title}`)
    if (!r.ok) for (const reason of r.reasons) console.log(`         reason: ${reason}`)
  }
  console.log()
  console.log(`Summary: ${results.length - failed.length} of ${results.length} routes pass.`)
  if (failed.length > 0 && !REPORT) {
    console.log()
    console.log('Fix: start the server with `npm run start:ci` (or `npm run dev`),')
    console.log('then re-run. For CI, use start-server-and-test to wrap the gate.')
  }

  if (REPORT) process.exit(0)
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
