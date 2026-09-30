#!/usr/bin/env node
/**
 * check-broker-sales.mjs — smoke gate: broker pages render Ryan Realty listings
 * (the broker's own closings, plus active listings whenever the broker has any)
 * pulled from the broker's real MLS data.
 *
 * WHY: the broker -> listings link was resolved only through the `listing_agents`
 * table, which is a partial third-party sample with ZERO Ryan Realty rows (and
 * null agent_email/license). So getListingKeysForBroker returned [] for our own
 * brokers, and both listing sections silently rendered nothing: an HTTP 200 page
 * with no listings. The fix resolves keys through the populated, indexed
 * listings.list_agent_email column. This gate asserts a broker with a closing
 * record (Matt Ryan) actually renders it, so the resolution can't silently regress
 * to empty again.
 *
 * What it reads (the v3 broker page, app/team/[slug]/page.tsx):
 *   - `#track-record` "<First>'s newest closings": getBrokerSales, keyed on
 *     listings.list_agent_email. Must render SOLD-dated rows with listing cards.
 *   - `#active-listings` "Active listings": getListingKeysByListAgentEmail, the
 *     same column. It renders only when the broker has an active listing, so a
 *     missing section is right on a day with no inventory and wrong on a day with
 *     some. With NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY set, the
 *     gate reads the broker's active rows (a row read, no aggregate) and requires
 *     the section exactly when they exist, carrying one of those listings. Without
 *     them it can only check that a rendered section is not empty, and says so.
 *
 * Runs against the live deploy. Override the host with BROKER_SMOKE_BASE.
 *
 * Usage: node scripts/check-broker-sales.mjs
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BROKER_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000
// lib/listing-status-public.ts PUBLIC_ACTIVE_STATUSES: what getListingTiles
// calls 'active', so the section and this read agree on what counts.
const ACTIVE_STATUSES = ['Active', 'Active Under Contract']

// Matt is the principal broker with the longest record; his page must show his
// closings. (Slug `matt-ryan` normalizes to the canonical `matthew-ryan` broker.)
const CASES = [
  {
    path: '/team/matt-ryan',
    label: 'broker: Matt Ryan',
    email: 'matt@ryan-realty.com',
  },
]

const CARD_RE = /\/homes-for-sale\/(?:[a-z0-9-]+\/){1,3}[a-z0-9-]*\d{8,}[a-z0-9-]*/gi

function listingCards(html) {
  // ListingCard links to the canonical detail URL:
  //   /homes-for-sale/<city>/[<subdivision>/]<address-slug>-<ListingKey>
  // Distinct detail hrefs (a final path segment carrying an 8+ digit key is what
  // distinguishes a listing-detail link from a search/preset link).
  return new Set(html.match(CARD_RE) ?? [])
}

/** The HTML of one top-level v3 section, by id; '' when the page has none. */
function section(html, id) {
  const start = html.indexOf(`<section id="${id}"`)
  if (start < 0) return ''
  const end = html.indexOf('<section', start + 1)
  return html.slice(start, end < 0 ? undefined : end)
}

/** The broker's active listing keys, or null when there is no database to ask. */
async function activeListingKeys(email) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null
  const statuses = ACTIVE_STATUSES.map((s) => `"${s}"`).join(',')
  const url =
    `${SUPABASE_URL}/rest/v1/listings?select=ListingKey,ListPrice` +
    `&list_agent_email=eq.${encodeURIComponent(email)}` +
    `&StandardStatus=in.(${encodeURIComponent(statuses)})&limit=200`
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } })
  if (!res.ok) throw new Error(`listings read HTTP ${res.status}`)
  const rows = await res.json()
  // publishActiveListingRows drops a tile with no ask price, so this does too.
  return rows.filter((r) => r.ListingKey && Number(r.ListPrice) > 0).map((r) => String(r.ListingKey))
}

async function check(c) {
  const url = `${BASE}${c.path}?_smoke=${Date.now()}`
  const t0 = Date.now()
  let res, html
  try {
    res = await fetch(url, { headers: { ...CI_PROBE_HEADERS, 'User-Agent': UA }, redirect: 'follow' })
    html = await res.text()
  } catch (e) {
    return { ...c, ok: false, reason: `fetch failed: ${e.message}` }
  }
  const ms = Date.now() - t0
  if (res.status !== 200) return { ...c, ok: false, reason: `HTTP ${res.status}`, ms }
  if (/E\{\\?"digest\\?":/.test(html) || /"digest":"\d+"/.test(html))
    return { ...c, ok: false, reason: 'server error boundary (Next digest) — page threw', ms }

  const own = section(html, 'track-record')
  const ownCards = listingCards(own).size
  if (!own || !/Sold\s+[A-Z][a-z]{2}\s+\d{4}/.test(own) || ownCards < 1)
    return { ...c, ok: false, reason: 'no "newest closings" section (#track-record) with SOLD-dated listing cards', ms }

  const active = section(html, 'active-listings')
  const activeCards = [...listingCards(active)]
  if (active && activeCards.length < 1)
    return { ...c, ok: false, reason: 'the "Active listings" section rendered with no listing cards', ms }

  let activeNote
  let keys
  try {
    keys = await activeListingKeys(c.email)
  } catch (e) {
    return { ...c, ok: false, reason: `could not read the broker's active listings: ${e.message}`, ms }
  }
  if (keys === null) {
    activeNote = active
      ? `${activeCards.length} active (not checked against the database: no Supabase env)`
      : 'no active section (not checked against the database: no Supabase env)'
  } else if (keys.length > 0) {
    if (!active)
      return { ...c, ok: false, reason: `${keys.length} active listing(s) in the MLS but no "Active listings" section`, ms }
    if (!activeCards.some((href) => keys.some((k) => href.endsWith(k))))
      return { ...c, ok: false, reason: 'the "Active listings" section shows none of the broker\'s active listings', ms }
    activeNote = `${activeCards.length} active, matching ${keys.length} in the MLS`
  } else {
    if (active)
      return { ...c, ok: false, reason: 'an "Active listings" section rendered, but the broker has no active listing in the MLS', ms }
    activeNote = 'no active listings in the MLS, section correctly absent'
  }

  if (ms > LATENCY_BUDGET_MS)
    return { ...c, ok: false, reason: `too slow: ${ms}ms (budget ${LATENCY_BUDGET_MS}ms)`, ms }
  return { ...c, ok: true, ms, ownCards, activeNote }
}

const results = []
for (const c of CASES) results.push(await check(c))

console.log('Broker-sales smoke gate')
console.log('=======================\n')
console.log(`Host: ${BASE}\n`)
let failed = 0
for (const r of results) {
  if (r.ok) console.log(`  OK    ${r.label} — ${r.ownCards} closing cards; ${r.activeNote}; ${r.ms}ms`)
  else {
    failed++
    console.log(`  FAIL  ${r.label} — ${r.reason}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${results.length} broker pages FAILED to render their Ryan Realty listings.`)
  console.log('A broker page that returns HTTP 200 but none of the broker\'s listings is broken.')
  process.exit(1)
}
console.log(`All ${results.length} broker pages render the broker's closings and match their active inventory.`)
process.exit(0)
