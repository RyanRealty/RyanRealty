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

// Permanent hops in next.config. Fetching them with redirect:follow renders
// the destination twice under the same 15s public budget — CI aborted both
// /reports and /housing-market/reports on the same cold start (HTTP 0).
const HOP_ROUTES = new Map([
  ['/reports', { status: 308, pathname: '/housing-market/reports' }],
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

// REFUSAL ROUTES — the negative half of this gate (added 2026-08-19).
//
// A listing URL that cannot resolve is not an edge case: 68 Active rows are
// non-displayable right now (44 seller internet opt-outs, 24 non-IDX-participant
// brokers, verified against production Supabase), plus every Coming Soon row and
// every stale/guessed key. All of them land on getListingDetail(...) === null.
//
// Until this gate existed they served HTTP 200 with an EMPTY body. Measured on
// ryan-realty.com: /listing/20260206214430774501000000 returned 200 with 1,634
// characters of text — the nav and the footer, no <h1>, no hero, no price. The
// cause is structural, not a data bug: the route renders dynamically inside the
// Suspense boundary that loading.tsx creates, React flushes the shell (and with
// it the 200) before the page resolves, and a notFound() thrown afterwards can
// only mark the boundary for a client-side swap. Next never writes the
// not-found body into the already-committed stream.
//
// So the assertions here are about the SERVED HTML, which is the only thing a
// no-JS visitor or a non-rendering crawler ever sees:
//   - an <h1> exists          -> a real page, not a bare shell
//   - robots says noindex     -> a 200 we cannot downgrade stays out of the index
//   - status is not 5xx       -> refusing is not crashing
//
// Both directions are checkable: revert the miss path in
// app/listing/[listingKey]/page.tsx to `notFound()` and these routes fail on the
// missing <h1>.
//
// The sentinel key and MLS number are verified absent from `listings`
// (ListNumber '999999999', ListingKey '999999999' and 'rr-smoke-no-such-listing'
// all count 0), so they cannot start passing because a real home moved in.
const SMOKE_MISSING_KEY = 'rr-smoke-no-such-listing'
const SMOKE_MISSING_MLS = '999999999'
const REFUSAL_ROUTES = [
  { path: `/listing/${SMOKE_MISSING_KEY}`, name: 'listing detail — refusal body' },
  {
    // Matches the next.config rewrite /homes-for-sale/:city/:listingSlug([^/]*-[0-9]{5,})
    // -> /listing/by-address/... This is the shape the sitemap publishes.
    path: `/homes-for-sale/bend/${SMOKE_MISSING_KEY}-${SMOKE_MISSING_MLS}`,
    name: 'canonical listing URL — refusal body',
  },
  { path: `/listing/by-key/${SMOKE_MISSING_KEY}`, name: 'listing by-key — refusal body' },
  {
    // A key too long to be a key. This was a SECOND route into the same blank
    // 200: getListingDetail validated its input with a throwing zod parse
    // OUTSIDE its try/catch, so an over-long path segment threw out of the page
    // render instead of returning null, and the streamed shell turned that into
    // HTTP 200 with 1,593 characters and no <h1> on ryan-realty.com. A
    // malformed key is a miss, so it must land on the same refusal.
    path: `/listing/${'a'.repeat(150)}`,
    name: 'over-long listing key — refusal body',
  },
]

function checkRefusalBody(body) {
  const reasons = []
  // The discriminator. A bare streamed shell carries the chrome's <h2> menu
  // titles and nothing else; every real page body on this site opens with one.
  if (!/<h1[\s>]/i.test(body)) reasons.push('no <h1> in the served HTML (blank shell)')
  if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(body)) {
    reasons.push('no robots noindex (an unresolvable listing URL must not be indexable)')
  }
  if (body.includes('Application error')) reasons.push('contains "Application error"')
  return { ok: reasons.length === 0, reasons }
}

async function checkRefusal(route, url) {
  try {
    const { status, body } = await fetchWithTimeout(url, timeoutFor(route.path))
    // 404 is the ideal status and 200 is what the streamed shell forces; both
    // are acceptable as long as a body came with it. 5xx never is.
    if (status >= 500 || status === 0) {
      return { ...route, url, ok: false, status, reasons: [`HTTP ${status}`], title: null }
    }
    const c = checkRefusalBody(body)
    const titleMatch = body.match(/<title>([^<]*)<\/title>/i)
    return { ...route, url, status, ok: c.ok, reasons: c.reasons, title: titleMatch?.[1]?.trim() ?? null }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
}

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
// Run only the negative half. Used to prove this gate fails in the broken
// direction without paying for the whole canonical inventory.
const REFUSALS_ONLY = args.has('--refusals-only')

async function fetchWithTimeout(url, ms, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { ...CI_PROBE_HEADERS },
      ...init,
    })
    if (init.redirect === 'manual') {
      return { status: res.status, body: '', location: res.headers.get('location') }
    }
    const body = await res.text()
    return { status: res.status, body, location: null }
  } finally {
    clearTimeout(t)
  }
}

function locationPathname(location) {
  if (!location) return ''
  try {
    return new URL(location, 'http://127.0.0.1:3000').pathname
  } catch {
    return location
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

async function checkHop(route, url, hop) {
  try {
    const { status, location } = await fetchWithTimeout(url, timeoutFor(route.path), {
      redirect: 'manual',
    })
    const pathname = locationPathname(location)
    if (status !== hop.status) {
      return { ...route, url, ok: false, status, reasons: [`HTTP ${status}`], title: null }
    }
    if (pathname !== hop.pathname) {
      return {
        ...route,
        url,
        ok: false,
        status,
        reasons: [`Location ${pathname || '(none)'} (want ${hop.pathname})`],
        title: null,
      }
    }
    return { ...route, url, status, ok: true, reasons: [], title: null }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
}

/**
 * RESOLVING-REDIRECT CHECK — the half the sentinel probes could not reach.
 *
 * /listing/by-key/<key> has two branches. The MISS branch was covered above by
 * SMOKE_MISSING_KEY, and it passed. The branch that RESOLVES a row was never
 * probed, and it was broken: as a page it ended in permanentRedirect() after two
 * awaits, so the loading.tsx boundary had already flushed HTTP 200 and Next
 * could only deliver the hop as an RSC flight instruction. Measured on
 * ryan-realty.com 2026-08-19 (browser UA, redirect:manual):
 *
 *   /listing/by-key/20200228140308644050000000  200, Location: null, 0 <h1>
 *   /listing/by-key/rr-smoke-no-such-listing    200, refusal body, 1 <h1>  <- the gate's only input
 *
 * A gate whose only input cannot reach the broken branch is not a gate. The key
 * is DISCOVERED from the server under test (first canonical listing URL in its
 * own /sitemaps/listings.xml), so it is always a row that exists and is never
 * hardcoded. Failing to obtain one is a FAILURE, not a skip — silence here is
 * exactly how this defect survived.
 */
async function discoverResolvingListingKey() {
  const { status, body } = await fetchWithTimeout(`${BASE}/sitemaps/listings.xml`, TIMEOUT_MS)
  if (status !== 200) return { key: null, why: `sitemaps/listings.xml returned HTTP ${status}` }
  // Canonical detail URLs end in -<mlsNumber>; getListingCanonicalPathFields
  // accepts an MLS number as well as a ListingKey.
  const m = body.match(/<loc>[^<]*\/homes-for-sale\/[^<]*?-(\d{5,})<\/loc>/)
  if (!m) return { key: null, why: 'no canonical listing URL in sitemaps/listings.xml' }
  return { key: m[1], why: null }
}

async function checkResolvingRedirect(route, url) {
  try {
    const { status, location } = await fetchWithTimeout(url, timeoutFor(route.path), {
      redirect: 'manual',
    })
    const reasons = []
    if (![301, 302, 307, 308].includes(status)) {
      reasons.push(`HTTP ${status} (want a 3xx — a resolving key must emit a real redirect)`)
    }
    if (!location) reasons.push('no Location header (the shell flushed before the redirect threw)')
    const pathname = locationPathname(location)
    if (pathname && pathname === route.path) reasons.push(`Location points back at itself (${pathname})`)
    return { ...route, url, status, ok: reasons.length === 0, reasons, title: pathname || null }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
}

async function checkFullPage(route, url) {
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

async function checkRoute(route) {
  const url = BASE + route.path
  if (route.predetermined) return { ...route, url, title: null, ...route.predetermined }
  if (route.resolvingRedirect) return checkResolvingRedirect(route, url)
  if (route.refusal) return checkRefusal(route, url)
  const skipReason = SKIP_ROUTES.get(route.path)
  if (skipReason) return { ...route, url, ok: true, skipped: true, status: 0, reasons: [skipReason], title: null }
  const hop = HOP_ROUTES.get(route.path)
  if (hop) return checkHop(route, url, hop)
  let result = await checkFullPage(route, url)
  if (!result.ok && result.status === 0 && /aborted/i.test(result.reasons[0] ?? '')) {
    result = await checkFullPage(route, url)
  }
  return result
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
  const refusals = REFUSAL_ROUTES.map((r) => ({ ...r, refusal: true }))

  // The resolving half of every key-shaped redirect route. Discovered, never
  // hardcoded, and a discovery failure is a gate failure.
  const discovered = await discoverResolvingListingKey()
  const resolvingRoutes = discovered.key
    ? [
        {
          path: `/listing/by-key/${discovered.key}`,
          name: 'listing by-key — RESOLVING key must emit a real 3xx',
          resolvingRedirect: true,
        },
      ]
    : [
        {
          path: '/listing/by-key/<undiscovered>',
          name: 'listing by-key — RESOLVING key must emit a real 3xx',
          predetermined: {
            ok: false,
            status: 0,
            reasons: [`could not discover a resolving listing key: ${discovered.why}`],
          },
        },
      ]

  // ADMIN ROUTES ARE OPT-IN, OFF IN PR CI (2026-08-21). Even at the 60s class
  // budget, cold-cache admin dashboards aborted (HTTP 0) on a random 2-4 of
  // themselves in two separate runs the same day, and each flake burns a
  // ~25-minute PR round over staff-only pages no PR-facing visitor loads. The
  // public set — the thing a PR must not break — stays blocking. Set
  // SMOKE_INCLUDE_ADMIN=1 (nightly/local) to restore the full set. Excluded
  // routes are printed below, never silently dropped.
  const INCLUDE_ADMIN = process.env.SMOKE_INCLUDE_ADMIN === '1'
  const adminExcluded = INCLUDE_ADMIN ? [] : ROUTES.filter((r) => r.path.startsWith('/admin/'))
  const smokeRoutes = INCLUDE_ADMIN ? ROUTES : ROUTES.filter((r) => !r.path.startsWith('/admin/'))
  if (adminExcluded.length) {
    console.log(
      `[SKIP] ${adminExcluded.length} /admin/ route(s) excluded from the blocking smoke (SMOKE_INCLUDE_ADMIN=1 restores them)`,
    )
  }

  const toCheck = REFUSALS_ONLY
    ? [...refusals, ...resolvingRoutes]
    : [...smokeRoutes, ...refusals, ...resolvingRoutes]
  const results = await runWithConcurrency(toCheck, checkRoute, CONCURRENCY)
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
