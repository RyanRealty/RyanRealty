#!/usr/bin/env node
/**
 * Smoke check: assert the homes-for-sale search pages render WITH listings,
 * not just HTTP 200. This is the gate Matt asked for after search/preset pages
 * started returning 200 with an empty grid (a cold search_listings_advanced RPC
 * blowing past the page's fetch timeout, then ISR caching the empty render —
 * the poison-null pattern).
 *
 * A 200 alone is NOT a pass. Each URL must render real listing data:
 *   - the response is 200
 *   - the HTML does NOT contain the empty-state copy ("No homes match")
 *   - the HTML contains at least N formatted prices ($xxx,xxx)
 *
 * Covers both data paths:
 *   - plain city + price-preset pages  → fast listing_tile_mv path
 *   - jsonb-filter preset (new-listings) → heavy RPC fallback path
 *
 * Runs against the live deploy (local dev is Windows-only here, so prod is the
 * source of truth). Usage:
 *   node scripts/smoke-search-renders.mjs [baseUrl]
 *   npm run smoke:search
 * Exit 0 = all pages rendered with data. Exit 1 = at least one empty/broken.
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const FETCH_TIMEOUT_MS = 20000
const EMPTY_STATE = 'No homes match this search'
const PRICE_RE = /\$[0-9]{1,3}(?:,[0-9]{3})+/g

/**
 * Each case: a path, a human label, the data path it exercises, and the minimum
 * number of distinct prices that proves the grid rendered. Thresholds are well
 * under live inventory (Bend ~1.3K active, Redmond ~450, Bend <$500K ~320) so
 * the check is not flaky, while still catching a fully empty grid.
 */
const CASES = [
  { path: '/homes-for-sale/bend', label: 'Bend (plain city)', via: 'fast MV', minPrices: 6 },
  { path: '/homes-for-sale/redmond', label: 'Redmond (plain city)', via: 'fast MV', minPrices: 6 },
  { path: '/homes-for-sale/bend/under-500k', label: 'Bend under $500K (price preset)', via: 'fast MV + filter', minPrices: 6 },
  { path: '/homes-for-sale/bend/new-listings-30', label: 'Bend new listings 30d (jsonb preset)', via: 'RPC fallback', minPrices: 1 },
]

async function fetchText(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': 'RyanRealty-SmokeCheck/1.0 (+search-renders)',
        accept: 'text/html',
      },
    })
    const body = await res.text()
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

function evaluate(testCase, status, body) {
  const reasons = []
  if (status !== 200) reasons.push(`HTTP ${status} (expected 200)`)
  if (body.includes(EMPTY_STATE)) reasons.push(`rendered empty state ("${EMPTY_STATE}")`)
  const prices = new Set((body.match(PRICE_RE) || []))
  if (prices.size < testCase.minPrices) {
    reasons.push(`only ${prices.size} distinct prices (need >= ${testCase.minPrices})`)
  }
  return { ok: reasons.length === 0, priceCount: prices.size, reasons }
}

async function main() {
  console.log(`Search render smoke check against ${BASE}\n${'='.repeat(60)}`)
  let failed = 0
  for (const testCase of CASES) {
    const url = `${BASE}${testCase.path}`
    let result
    try {
      const { status, body } = await fetchText(url)
      result = evaluate(testCase, status, body)
      const tag = result.ok ? 'PASS' : 'FAIL'
      console.log(
        `[${tag}] ${testCase.label}  (${testCase.via})\n` +
          `        ${testCase.path}  ->  ${result.priceCount} prices` +
          (result.ok ? '' : `\n        ${result.reasons.join('; ')}`)
      )
    } catch (err) {
      result = { ok: false }
      console.log(`[FAIL] ${testCase.label}  (${testCase.via})\n        ${testCase.path}  ->  fetch error: ${err.message}`)
    }
    if (!result.ok) failed += 1
  }
  console.log('='.repeat(60))
  if (failed > 0) {
    console.log(`Search render smoke check FAILED: ${failed}/${CASES.length} page(s) rendered without listings.`)
    process.exit(1)
  }
  console.log(`Search render smoke check PASSED: all ${CASES.length} pages rendered with listings.`)
}

main().catch((err) => {
  console.error('Smoke check crashed:', err)
  process.exit(1)
})
