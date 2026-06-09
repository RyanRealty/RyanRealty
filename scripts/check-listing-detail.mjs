#!/usr/bin/env node
/**
 * check-listing-detail.mjs — content-correctness gate for the listing-detail page.
 *
 * WHY: The listing-detail page is the #1 money page — every paid ad lands here.
 * A JSONB-sentinel regression, a media-resolver break, or a details->>'field'
 * cast crash can cause the page to return HTTP 200 and ~5 KB of navigation
 * chrome while the price, photos, agent name, and contact CTA are all missing.
 * The route-smoke gate (check-route-smoke.mjs) only checks 200 + title + 5 KB
 * and cannot catch this class of regression.
 *
 * This gate asserts that a live listing renders its commerce content:
 *   (a) a formatted price matching /$[\d,]{6,}/
 *   (b) at least one listing photo URL (sparkplatform CDN or listing_photos cdn_url)
 *   (c) the listing-agent name marker (Talk to a broker)
 *   (d) the contact/tour CTA (Schedule a tour)
 *
 * Requires the SMOKE_LISTING_KEY env var OR a dynamic lookup from the site's
 * own active-listing API. In CI, pick-lhci-listing.mjs already resolves a key;
 * set SMOKE_LISTING_KEY to that value in the smoke-test.yml env block.
 *
 * Environment:
 *   LISTING_SMOKE_BASE   — base URL (default: https://ryan-realty.com)
 *   SMOKE_LISTING_KEY    — 20+-digit MLS listing key to test
 *
 * Usage:
 *   node scripts/check-listing-detail.mjs
 *   SMOKE_LISTING_KEY=20260501000000000001 node scripts/check-listing-detail.mjs
 *
 * Run mode: node scripts/check-listing-detail.mjs [--json]
 */

const BASE = (process.env.LISTING_SMOKE_BASE ?? process.env.SMOKE_BASE_URL ?? 'https://ryan-realty.com').replace(/\/+$/, '')
const LISTING_KEY = process.env.SMOKE_LISTING_KEY ?? null
const TIMEOUT_MS = Number(process.env.LISTING_SMOKE_TIMEOUT_MS ?? 15_000)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Required content markers
// ---------------------------------------------------------------------------

/**
 * (a) Price: a dollar sign followed by 6+ consecutive digits/commas.
 * Matches "$475,000", "$1,250,000", "$895000" in the rendered HTML.
 * The PriceCtaStrip component renders this via the <Price> primitive.
 */
const PRICE_RE = /\$[\d,]{6,}/

/**
 * (b) Photo URL: the listing_photos DAL uses cdn_url from our Supabase table
 * or falls back to the photo_url field (SparkAPI media). Both appear as src
 * attributes in the rendered HTML. We look for any URL containing common photo
 * host patterns used by this stack.
 *
 * Pattern covers:
 *   - sparkplatform.com (SparkAPI media CDN)
 *   - photos.sparkplatform.com
 *   - supabase.co storage (cdn_url from listing_photos table)
 *   - any /_next/image?url= rewrite wrapping the above
 */
const PHOTO_URL_RE = /(?:sparkplatform\.com|supabase\.co\/storage|_next\/image\?url=.*photo|cdn_url|photo_url=)/i

/**
 * (c) Listing-agent CTA marker: rendered by TextMattCTA.tsx as a static
 * string that is not configurable at the page level.
 */
const AGENT_CTA_RE = /Talk to a broker/i

/**
 * (d) Tour CTA: rendered by TextMattCTA.tsx as the primary CTAButton label.
 * Falls back to "Questions about this home?" for the H3. Both stable.
 */
const TOUR_CTA_RE = /Schedule a tour/i

// ---------------------------------------------------------------------------
// Fetch a live active-listing key dynamically if none was pinned
// ---------------------------------------------------------------------------

/**
 * Attempt to discover a live active listing key by fetching the search
 * page and parsing a listing-detail href from the HTML. This is a best-effort
 * fallback — if the search page is empty or unreachable, we fail loudly with
 * a clear instruction to set SMOKE_LISTING_KEY.
 */
async function discoverListingPath() {
  const searchUrl = `${BASE}/homes-for-sale/bend?_smoke=${Date.now()}`
  let html = ''
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(searchUrl, { signal: ctrl.signal, headers: { 'user-agent': UA } })
    clearTimeout(t)
    html = await res.text()
  } catch {
    return null
  }
  // Listing-card links use the pretty URL (the real money path consumers hit):
  //   /homes-for-sale/<city>/[<subdivision>/]<address-slug>-<MLS number>
  // e.g. /homes-for-sale/bend/arborwood/1886-curtis-220221070 (9-digit MLS#).
  // That URL rewrites to /listing/[listingKey] internally, so asserting against
  // it exercises the rewrite AND the detail render.
  const m = html.match(/href="(\/homes-for-sale\/[a-z0-9-]+(?:\/[a-z0-9-]+)*-\d{6,})"/i)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let path = LISTING_KEY ? `/listing/${LISTING_KEY}` : null

  if (!path) {
    console.log('SMOKE_LISTING_KEY not set — discovering a live active listing from /homes-for-sale/bend...')
    path = await discoverListingPath()
    if (!path) {
      console.error('FAIL: Could not discover a live listing link.')
      console.error('Set SMOKE_LISTING_KEY to a known-active MLS listing key, e.g.:')
      console.error('  SMOKE_LISTING_KEY=20260101000000000001 node scripts/check-listing-detail.mjs')
      console.error('Or ensure the server is running and /homes-for-sale/bend returns listings.')
      process.exit(1)
    }
    console.log(`Discovered listing path: ${path}`)
  }
  const url = `${BASE}${path}?_smoke=${Date.now()}`

  let res, html
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
    clearTimeout(t)
    html = await res.text()
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      console.error(`FAIL: Cannot reach ${BASE}`)
      console.error('Start the server with `npm run dev` or `npm run start:ci`, then re-run.')
      console.error(`(Or set LISTING_SMOKE_BASE to a running deploy URL.)`)
      process.exit(1)
    }
    console.error(`FAIL: fetch error — ${msg}`)
    process.exit(1)
  }

  const fails = []

  if (res.status !== 200) fails.push(`HTTP ${res.status} (expected 200)`)
  if (html.includes('Page not found')) fails.push('page rendered "Page not found" — listing not resolving in DAL')
  if (html.includes('Application error')) fails.push('page rendered "Application error" — server threw')
  if (/"digest":"\d+"/.test(html)) fails.push('Next.js error boundary digest — server threw during render')

  if (!PRICE_RE.test(html)) fails.push('no formatted price ($NNN,NNN) found — ListPrice not rendered')
  if (!PHOTO_URL_RE.test(html)) fails.push('no listing photo URL found — photo resolver returned empty or crashed')
  if (!AGENT_CTA_RE.test(html)) fails.push('no "Talk to a broker" marker — TextMattCTA sidebar not rendering')
  if (!TOUR_CTA_RE.test(html)) fails.push('no "Schedule a tour" CTA — TextMattCTA primary button missing')

  if (JSON_OUT) {
    console.log(JSON.stringify({
      base: BASE,
      path,
      listingKey,
      status: res.status,
      ok: fails.length === 0,
      fails,
    }, null, 2))
    process.exit(fails.length === 0 ? 0 : 1)
  }

  console.log('Listing-detail content gate')
  console.log('===========================')
  console.log(`Base URL:    ${BASE}`)
  console.log(`Path:        ${path}`)
  console.log()

  if (fails.length === 0) {
    console.log('OK  — listing page renders price + photo + agent CTA + tour CTA.')
    process.exit(0)
  }

  console.log(`FAIL — ${fails.length} content assertion(s) failed:`)
  for (const f of fails) console.log(`  - ${f}`)
  console.log()
  console.log('The listing-detail page must render its core commerce content, not just a 200 shell.')
  console.log('A broken price, missing photos, or missing CTA costs ad spend and kills lead conversion.')
  process.exit(1)
}

main()
