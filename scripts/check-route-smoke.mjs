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
// The listings sitemap alone: the heaviest read the gate makes (see
// discoverResolvingListingKey), so it gets its own ceiling.
const SITEMAP_TIMEOUT_MS = Number(process.env.SMOKE_SITEMAP_TIMEOUT_MS ?? 45_000)

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
  ['/lp/tetherow', { status: 308, pathname: '/communities/tetherow' }],
  ['/lp/tetherow/heath', { status: 308, pathname: '/communities/tetherow' }],
  ['/blog/tetherow-resort-living-real-estate', { status: 308, pathname: '/communities/tetherow' }],
  ['/lp/bend', { status: 308, pathname: '/cities/bend' }],
  ['/lp/seller-home-value', { status: 308, pathname: '/sell' }],
  ['/lp/sell-your-home', { status: 308, pathname: '/sell' }],
  ['/lp/buyer-listing-alerts', { status: 308, pathname: '/homes-for-sale' }],
  ['/lp/expired-listing', { status: 308, pathname: '/sell/expired-listings' }],
  ['/lp/fsbo', { status: 308, pathname: '/sell/for-sale-by-owner' }],
  ['/lp/central-oregon-golf', { status: 308, pathname: '/central-oregon/golf' }],
  // SITE-185: one winner for "Bend luxury homes for sale", one hop each.
  ['/luxury-homes-bend', { status: 308, pathname: '/homes-for-sale/bend/luxury' }],
  ['/luxury-homes-bend-oregon', { status: 301, pathname: '/homes-for-sale/bend/luxury' }],
])

function timeoutFor(path) {
  return path.startsWith('/admin/') ? Math.max(TIMEOUT_MS, ADMIN_TIMEOUT_MS) : TIMEOUT_MS
}
// CONCURRENCY caps parallel HTTP requests so the smoke covers the
// full canonical set without overwhelming the dev/start:ci server.
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY ?? 6)
// Pause before re-fetching pages that timed out in the concurrent pass.
const RETRY_SETTLE_MS = Number(process.env.SMOKE_RETRY_SETTLE_MS ?? 10_000)

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

// COLD ISR PLAT RENDERS (P3 — DATA-6, SEO-2, EXP-7, 2026-09-23). The route
// inventory cannot enumerate /subdivisions/*, and that blind spot is how a
// class-wide 500 shipped: runPublishedPageRender called unstable_noStore() on
// any degraded read, which inside a runtime ISR render Next 16 answers with
// "Dynamic server usage: ... couldn't be rendered statically because it used
// unstable_noStore()" (digest DYNAMIC_SERVER_USAGE) and HTTP 500.
// /subdivisions/elkai-woods degraded on EVERY render (its cma_subdivision_ring
// read took 8.4 to 11.2 s against a 3.5 s budget) and 500'd on every fetch, so
// it is the deterministic case; blakley-heights is a sitemapped plat that did
// the same. Neither is prerendered, so against `start:ci` each is a cold
// on-demand ISR render, the exact path that failed.
const PLAT_ISR_ROUTES = [
  { path: '/subdivisions/elkai-woods', name: 'plat cold ISR render (elkai-woods, P3)' },
  { path: '/subdivisions/blakley-heights', name: 'plat cold ISR render (blakley-heights, P3)' },
]

const INVENTORY_ROUTES = loadRoutesFromInventory()
const ROUTES = INVENTORY_ROUTES
  ? [
      ...INVENTORY_ROUTES,
      ...PLAT_ISR_ROUTES,
      { path: '/blog/tetherow-resort-living-real-estate', name: 'tetherow blog hop' },
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
      ...PLAT_ISR_ROUTES,
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
  // SEO-1 (visibility audit 2026-09-22): a made-up area segment under a real
  // city answered 200, "index, follow", a self canonical and an H1 title-cased
  // from the slug (live 2026-09-23: /homes-for-sale/prineville/p1-no-such-place
  // -> "P1 No Such Place homes for sale"). It must render the refusal
  // (app/search/[...slug]/sections/AreaUnavailable.tsx) with noindex. Two
  // cities, so a fix keyed to one city cannot pass. No subdivision name,
  // boundary slug or registry community contains "smoke" (checked 2026-09-23
  // against subdivision_city_inventory_mv and boundaries: 0 rows each).
  { path: '/homes-for-sale/bend/rr-smoke-no-such-area', name: 'search area (Bend) — refusal body' },
  { path: '/homes-for-sale/prineville/rr-smoke-no-such-area', name: 'search area (Prineville) — refusal body' },
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
  // The sitemap is the heaviest read this gate makes: ~7,500 active rows paged
  // out of a ~600,000-row MV. On 2026-09-16 it answered 500 ("canceling
  // statement due to statement timeout") once in GitHub Actions (PR #252,
  // 144/145) and twice on a local production build, then 200 on the next try —
  // a transient on the database, not a property of the server under test. One
  // probe turned that into a red step, so the discovery retries with backoff;
  // a status that holds across every attempt is still reported as the failure
  // it is. The loader itself is hardened separately (keyset paging).
  //
  // A TIMEOUT IS A FAILED ATTEMPT, NOT A CRASH (2026-09-16, run 35043457290).
  // The first cut of this loop only looked at the returned status, so when the
  // sitemap took longer than TIMEOUT_MS the AbortError from fetchWithTimeout
  // escaped it and the whole gate died with a stack trace before the retry.
  // Every attempt's throw is caught here and counted like a bad status. The
  // sitemap also gets its own, longer ceiling: fifteen seconds is right for a
  // page, not for the one read that pages 7,500 rows on a cold server.
  const DISCOVERY_ATTEMPTS = 3
  const DISCOVERY_BACKOFF_MS = [1000, 3000]
  let status = 0
  let body = ''
  let why = ''
  for (let attempt = 1; attempt <= DISCOVERY_ATTEMPTS; attempt++) {
    try {
      ;({ status, body } = await fetchWithTimeout(`${BASE}/sitemaps/listings.xml`, SITEMAP_TIMEOUT_MS))
      why = `HTTP ${status}`
    } catch (err) {
      status = 0
      body = ''
      why = err?.name === 'AbortError' ? `no response within ${SITEMAP_TIMEOUT_MS}ms` : `fetch failed: ${err?.message ?? err}`
    }
    if (status === 200) break
    if (attempt < DISCOVERY_ATTEMPTS) {
      const wait = DISCOVERY_BACKOFF_MS[attempt - 1] ?? DISCOVERY_BACKOFF_MS.at(-1)
      console.warn(`  sitemaps/listings.xml answered ${why} (attempt ${attempt}/${DISCOVERY_ATTEMPTS}) — retrying in ${wait}ms`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  if (status !== 200) return { key: null, path: null, why: `sitemaps/listings.xml answered ${why} on ${DISCOVERY_ATTEMPTS} attempts` }
  // Canonical detail URLs end in -<mlsNumber>; getListingCanonicalPathFields
  // accepts an MLS number as well as a ListingKey.
  const m = body.match(/<loc>([^<]*\/homes-for-sale\/[^<]*?-(\d{5,}))<\/loc>/)
  if (!m) return { key: null, path: null, why: 'no canonical listing URL in sitemaps/listings.xml' }
  return { key: m[2], path: locationPathname(m[1]), why: null }
}

/**
 * LISTING CANONICAL HOP (P14, visibility audit 2026-09-22, gsc-trend-6).
 *
 * A listing page renders from the MLS number at the END of its path, so any
 * segments in front of it used to answer 200 with only a rel=canonical: 1,234
 * of 7,329 listing ids sat under more than one URL in Search Console
 * 2026-08-23..09-19. middleware.ts now 308s every such path to the canonical
 * before render (lib/routing/listing-canonical-hop.ts). The unit tests prove the
 * decision; only a running server proves the Edge bundle, its inlined Supabase
 * env and the real runtime actually emit it. The probe takes the discovered
 * sitemap URL's last segment under the retired /outside-boundaries/ city (690
 * of those ids had such a variant in Search Console) and wants: a 308, a
 * Location that is not the probe and ends in the same listing segment, and a
 * Location that does not redirect again.
 */
async function checkListingCanonicalHop(route, url) {
  try {
    const { status, location } = await fetchWithTimeout(url, timeoutFor(route.path), { redirect: 'manual' })
    const pathname = locationPathname(location)
    const reasons = []
    if (status !== 308) reasons.push(`HTTP ${status} (want 308 — a non-canonical listing path must hop before render)`)
    if (!pathname) reasons.push('no Location header')
    else if (pathname === route.path) reasons.push(`Location points back at itself (${pathname})`)
    else if (!pathname.endsWith(`/${route.listingSegment}`)) reasons.push(`Location ${pathname} is not this listing (want .../${route.listingSegment})`)
    if (reasons.length === 0) {
      const again = await fetchWithTimeout(BASE + pathname, timeoutFor(pathname), { redirect: 'manual' })
      if (again.status >= 300 && again.status < 400) {
        reasons.push(`the canonical ${pathname} redirects again (HTTP ${again.status} -> ${locationPathname(again.location)})`)
      }
    }
    return { ...route, url, status, ok: reasons.length === 0, reasons, title: pathname || null }
  } catch (e) {
    return { ...route, url, ok: false, status: 0, reasons: [String(e?.message ?? e)], title: null }
  }
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
  if (route.listingSegment) return checkListingCanonicalHop(route, url)
  if (route.refusal) return checkRefusal(route, url)
  const skipReason = SKIP_ROUTES.get(route.path)
  if (skipReason) return { ...route, url, ok: true, skipped: true, status: 0, reasons: [skipReason], title: null }
  const hop = HOP_ROUTES.get(route.path)
  if (hop) return checkHop(route, url, hop)
  return checkFullPage(route, url)
}

/**
 * A full page that gave no answer inside its budget during the concurrent
 * pass. It is fetched again AFTER the pass, one at a time (see main).
 *
 * The retry used to run immediately, inside the same six-wide pool, so it
 * met the same contention: on a 2-core runner with every data cache cold,
 * /housing-market/history and /housing-market/reports each aborted twice at
 * 15s (run 35920741632, 2026-09-23) on a commit whose app code had passed an
 * hour earlier, while production answered /housing-market/history in 0.39s
 * and /housing-market/reports in 1.56s warm (15.0s cold). A route must still
 * answer inside its budget with the server to itself, so a page that is
 * slow on its own still fails.
 */
function timedOutFullPage(result) {
  return (
    !result.ok &&
    result.status === 0 &&
    /aborted/i.test(result.reasons[0] ?? '') &&
    !result.predetermined &&
    !result.resolvingRedirect &&
    !result.listingSegment &&
    !result.refusal &&
    !HOP_ROUTES.has(result.path)
  )
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
        // P14: the same discovered listing under a retired city segment. A
        // discovery failure is already reported once, by the route above.
        ...(discovered.path
          ? [
              {
                path: `/homes-for-sale/outside-boundaries/${discovered.path.split('/').at(-1)}`,
                name: 'listing canonical hop — a non-canonical listing path must 308 to the canonical before render',
                listingSegment: discovered.path.split('/').at(-1),
              },
            ]
          : []),
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
  // The server keeps rendering a page after the client gives up on it, so the
  // renders the pool abandoned drain before the serial retries begin.
  if (results.some(timedOutFullPage)) await new Promise((r) => setTimeout(r, RETRY_SETTLE_MS))
  for (let i = 0; i < results.length; i += 1) {
    if (!timedOutFullPage(results[i])) continue
    const retry = await checkFullPage(toCheck[i], BASE + toCheck[i].path)
    results[i] = retry.ok
      ? { ...retry, title: `${retry.title ?? ''} (answered on a serial retry after timing out in the concurrent pass)` }
      : retry
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
