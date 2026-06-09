#!/usr/bin/env node
/**
 * check-search-results.mjs — smoke gate: representative search pages return the
 * right listings, fast. (HTTP 200 is NOT proof a search works.)
 *
 * WHY: subdivision / neighborhood / preset search pages regressed to "takes too
 * long and returns no results":
 *   - advanced-filter searches (e.g. the acreage preset = lotAcresMin) routed to
 *     the heavy search_listings_advanced RPC, which timed out cold (57014) and
 *     fell back to an empty grid, even though lot_size_acres is a flat
 *     listing_tile_mv column the fast path can serve.
 *   - a neighborhood slug (e.g. mountain-view) was matched as a subdivision NAME
 *     instead of the boundary_neighborhood tag, so it returned 0.
 * Both render an HTTP 200 page, so a status-only check passed while the page was
 * broken. This gate asserts that a fixed set of search URLs that are KNOWN to
 * have active inventory actually render that inventory, within a latency budget —
 * so this class cannot silently regress again.
 *
 * Runs against the live deploy (local dev is Windows-only). Override the host
 * with SEARCH_SMOKE_BASE (e.g. a Vercel preview URL).
 *
 * Usage: node scripts/check-search-results.mjs
 */
const BASE = (process.env.SEARCH_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000

// Each scope is verified (Supabase) to have active inventory, so a 0/empty render
// is a real failure, not a legitimate empty search. `min` is a floor well under
// the true active count so the gate is robust to inventory drift.
const CASES = [
  { path: '/homes-for-sale/bend', label: 'city: Bend', min: 50 },
  { path: '/homes-for-sale/bend/mountain-view', label: 'neighborhood: Mountain View', min: 1 },
  { path: '/homes-for-sale/bend/awbrey-butte', label: 'neighborhood: Awbrey Butte', min: 1 },
  { path: '/homes-for-sale/powell-butte/acreage-5', label: 'preset: 5+ acres, Powell Butte', min: 1 },
  { path: '/homes-for-sale/bend/under-750k', label: 'preset: under $750k, Bend', min: 1 },
  // Keyword presets: free-text PublicRemarks search. These routed to the heavy
  // search_listings_advanced RPC, whose full-table jsonb ILIKE + count(*) OVER ()
  // hit the 12s statement timeout -> empty grid. Now served by the indexed
  // search_keyword_listings RPC. (Bend active+pending: single-level ~278.)
  { path: '/homes-for-sale/bend/single-level', label: 'keyword: single-level, Bend', min: 1 },
  { path: '/homes-for-sale/bend/with-shop', label: 'keyword: with-shop, Bend', min: 1 },
  { path: '/homes-for-sale/bend/rv-parking', label: 'keyword: RV parking, Bend', min: 1 },
]

function parseCount(html) {
  // The grid header renders "N homes" (also tolerate results/listings/properties).
  const m = html.match(/([0-9][0-9,]*)\s+(?:homes|results|listings|properties)\b/i)
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null
}

async function check(c) {
  const url = `${BASE}${c.path}?_smoke=${Date.now()}`
  const t0 = Date.now()
  let res, html
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    html = await res.text()
  } catch (e) {
    return { ...c, ok: false, reason: `fetch failed: ${e.message}` }
  }
  const ms = Date.now() - t0
  if (res.status !== 200) return { ...c, ok: false, reason: `HTTP ${res.status}`, ms }
  // A server error boundary serializes an error digest into the flight stream.
  if (/E\{\\?"digest\\?":/.test(html) || /"digest":"\d+"/.test(html))
    return { ...c, ok: false, reason: 'server error boundary (Next digest) — page threw', ms }
  const count = parseCount(html)
  if (count == null)
    return { ...c, ok: false, reason: 'no "N homes" header — grid did not render', ms }
  if (count < c.min)
    return { ...c, ok: false, reason: `only ${count} homes (expected >= ${c.min})`, ms, count }
  if (ms > LATENCY_BUDGET_MS)
    return { ...c, ok: false, reason: `too slow: ${ms}ms (budget ${LATENCY_BUDGET_MS}ms)`, ms, count }
  return { ...c, ok: true, ms, count }
}

const results = []
for (const c of CASES) results.push(await check(c))

console.log('Search-results smoke gate')
console.log('=========================\n')
console.log(`Host: ${BASE}\n`)
let failed = 0
for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} — ${r.count} homes, ${r.ms}ms`)
  else {
    failed++
    console.log(`  FAIL  ${r.label} — ${r.reason}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${results.length} search pages FAILED (empty, slow, or errored).`)
  console.log('A search page returning HTTP 200 is not enough — it must return the right listings, fast.')
  process.exit(1)
}
console.log(`All ${results.length} search scopes return listings within ${LATENCY_BUDGET_MS}ms.`)
process.exit(0)
