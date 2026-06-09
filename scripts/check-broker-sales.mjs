#!/usr/bin/env node
/**
 * check-broker-sales.mjs — smoke gate: broker pages render Ryan Realty listings
 * (active + recently sold) pulled from the broker's real MLS data.
 *
 * WHY: the broker -> listings link was resolved only through the `listing_agents`
 * table, which is a partial third-party sample with ZERO Ryan Realty rows (and
 * null agent_email/license). So getListingKeysForBroker returned [] for our own
 * brokers, and BOTH the active-listings section AND the new recently-sold section
 * silently rendered nothing — an HTTP 200 page with no listings. The fix resolves
 * keys through the populated, indexed listings.list_agent_email column. This gate
 * asserts a broker known to have inventory (Matt Ryan: verified 2 active + 13 sold
 * in the last 24 months) actually renders that inventory, so the resolution can't
 * silently regress to empty again.
 *
 * Runs against the live deploy (local dev is Windows-only). Override the host with
 * BROKER_SMOKE_BASE.
 *
 * Usage: node scripts/check-broker-sales.mjs
 */
const BASE = (process.env.BROKER_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000

// Matt is the principal broker with the most inventory; his page must show both
// an active and a recently-sold section. (Slug `matt-ryan` normalizes to the
// canonical `matthew-ryan` broker.)
const CASES = [
  {
    path: '/team/matt-ryan',
    label: 'broker: Matt Ryan',
    needSold: true, // 13 sold in last 24mo — the recently-sold section must render
    needActive: true, // 2 active — the active-listings section must render
  },
]

function countListingCards(html) {
  // Each ListingCard links to /listing/<key>. Count distinct hrefs.
  const set = new Set()
  const re = /\/listing\/[a-z0-9-]+/gi
  let m
  while ((m = re.exec(html)) !== null) set.add(m[0])
  return set.size
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
  if (/E\{\\?"digest\\?":/.test(html) || /"digest":"\d+"/.test(html))
    return { ...c, ok: false, reason: 'server error boundary (Next digest) — page threw', ms }

  const cardCount = countListingCards(html)
  const hasSoldSection = /Recently sold/i.test(html) && /Sold\s+[A-Z][a-z]{2}\s+\d{4}/.test(html)
  const hasActiveSection = /current listings/i.test(html)

  if (c.needSold && !hasSoldSection)
    return { ...c, ok: false, reason: 'no "Recently sold" section with SOLD-dated cards', ms, cardCount }
  if (c.needActive && !hasActiveSection)
    return { ...c, ok: false, reason: 'no active-listings ("current listings") section', ms, cardCount }
  if (cardCount < 1)
    return { ...c, ok: false, reason: 'no listing cards rendered (broker -> listings resolution returned empty)', ms }
  if (ms > LATENCY_BUDGET_MS)
    return { ...c, ok: false, reason: `too slow: ${ms}ms (budget ${LATENCY_BUDGET_MS}ms)`, ms, cardCount }
  return { ...c, ok: true, ms, cardCount }
}

const results = []
for (const c of CASES) results.push(await check(c))

console.log('Broker-sales smoke gate')
console.log('=======================\n')
console.log(`Host: ${BASE}\n`)
let failed = 0
for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} — ${r.cardCount} listing cards, ${r.ms}ms`)
  else {
    failed++
    console.log(`  FAIL  ${r.label} — ${r.reason}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${results.length} broker pages FAILED to render their Ryan Realty listings.`)
  console.log('A broker page that returns HTTP 200 but no active/sold listings is broken.')
  process.exit(1)
}
console.log(`All ${results.length} broker pages render active + recently-sold Ryan Realty listings.`)
process.exit(0)
