#!/usr/bin/env node
/**
 * ONE CANONICAL PER LISTING (SITE-22).
 *
 * Two rules, both mechanical:
 *
 *   1. app/listing/by-address/[...slug]/page.tsx does NOT override the
 *      canonical it inherits. Commit b58edad4 (2026-06-01) added a
 *      self-canonical to whatever path was requested, and in the SAME commit
 *      taught app/listing/[listingKey]/page.tsx to build the public canonical
 *      through listingDetailPath — which made the override redundant that day.
 *      Because `:26-30` resolves the listing from the MLS tail alone, ANY city
 *      and ANY area segments render 200: verified live 2026-09-08 on 220226356
 *      at four paths including an invented /portland/ one, all 200,
 *      index,follow, each declaring itself canonical.
 *
 *   2. Every internal listing-href builder derives the path from the SAME
 *      fields the canonical does — through listingTileHref /
 *      listingCanonicalHref in lib/slug.ts, never a hand-rolled
 *      listingDetailPath call. ~15 builders passed {city, subdivision} while
 *      the canonical passed {boundaryCity, boundaryNeighborhood, subdivision},
 *      and two (lib/kb/place-sections.ts buildActivityItems / buildOpenHouseItems)
 *      passed no listNumber at all, so the path fell back to the 26-digit
 *      ListingKey.
 *
 * SIZE, measured 2026-09-08 (Search Console page rows for ryan-realty.com,
 * 2026-06-08..2026-09-05, grouped by trailing 9-digit MLS id):
 *   8,724 listing ids drew impressions across 11,356 URLs
 *   2,363 of those ids appeared at MORE THAN ONE URL — 4,995 URLs, 21,808
 *         impressions, 47.7% of listing-class impressions
 *   2,104 ids at two URLs, 249 at three, 10 at four
 *   885 URLs ending in a 20+ digit ListingKey, 3,348 impressions
 * The demonstrated harm is index fragmentation, NOT clicks: multi-URL ids ran
 * 1.33% CTR at weighted position 13.5 against 1.56% and 11.5 for single-URL
 * ids. That is not a rank claim about any page.
 *
 *   node scripts/check-listing-canonical-single.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const checks = []

function src(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

/**
 * Code only. These files document the defect they fixed, at length and by
 * name, so a bare text match reads their own history as a violation — which
 * is exactly the pressure that gets a comment deleted to please a gate.
 */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// ── 1. The by-address route returns the inherited canonical, unchanged ──────
const byAddress = code(src('app/listing/by-address/[...slug]/page.tsx'))
checks.push({
  label: 'by-address generateMetadata does not override the inherited canonical',
  ok:
    !/alternates:\s*\{\s*canonical/.test(byAddress) &&
    !/const canonical = `\/homes-for-sale\//.test(byAddress) &&
    /return generateListingMetadata\(\{ params: Promise\.resolve\(\{ listingKey \}\) \}\)/.test(
      byAddress,
    ),
})

// The blank-200 trap this route is built around: a redirect thrown from the
// page body is flushed after the shell, so it cannot be the fix here.
checks.push({
  label: 'by-address does not redirect from the page body (loading.tsx flushes the shell first)',
  ok: !/\b(permanentRedirect|redirect)\s*\(/.test(byAddress),
})

// ── 2. The canonical and the hrefs are one expression ──────────────────────
const slug = src('lib/slug.ts')
checks.push({
  label: 'lib/slug.ts exports the ONE listing-URL builder in both its shapes',
  ok:
    /export function listingTileHref\(tile: ListingUrlSubject\): string/.test(slug) &&
    /export function listingCanonicalHref\(/.test(slug) &&
    /export type ListingUrlSubject/.test(slug) &&
    // Both sentinels live inside the builder, not in its callers.
    /outside\[\\s-\]\*boundaries/.test(slug) &&
    /!== 'N\/A'/.test(slug),
})

const detailPage = code(src('app/listing/[listingKey]/page.tsx'))
const jsonLd = code(src('app/listing/[listingKey]/listing-json-ld.ts'))
checks.push({
  label: 'the detail page canonical, its self-href and the JSON-LD url all call listingCanonicalHref',
  ok:
    /const canonicalPath = listingCanonicalHref\(listing\)/.test(detailPage) &&
    /const listingHref = listingCanonicalHref\(listing\)/.test(detailPage) &&
    /return listingCanonicalHref\(listing\)/.test(jsonLd) &&
    !/listingDetailPath\(/.test(detailPage) &&
    !/listingDetailPath\(/.test(jsonLd),
})

const sitemapPath = src('lib/data/sitemap/listing-sitemap-path.ts')
checks.push({
  label: 'the sitemap row is built by the same builder as the canonical',
  ok: /listingTileHref\(/.test(sitemapPath),
})

// The two builders the node named by line. Both are fed rows that already
// carry the fields; the TYPE was what dropped them.
const placeSections = src('lib/kb/place-sections.ts')
checks.push({
  label: 'place-sections activity + open-house rows pass listNumber and the boundary neighborhood',
  ok:
    /ListNumber\?: string \| null/.test(placeSections) &&
    /NeighborhoodName\?: string \| null/.test(placeSections) &&
    /listNumber: a\.ListNumber \?\? null/.test(placeSections) &&
    /boundaryNeighborhood: a\.NeighborhoodName \?\? null/.test(placeSections) &&
    /subdivisionName: a\.SubdivisionName \?\? null/.test(placeSections) &&
    /listNumber: oh\.list_number \?\? null/.test(placeSections),
})

// The redirect hops must land ON the canonical, or the hop itself mints a
// duplicate. /listing/odsmls passed {city, subdivision} until 2026-09-08.
for (const [path, label] of [
  ['app/listing/by-key/[listingKey]/route.ts', '/listing/by-key'],
  ['app/listing/odsmls/[...slug]/route.ts', '/listing/odsmls'],
]) {
  const text = src(path)
  checks.push({
    label: `${label} redirects to the canonical builder's URL, not a hand-rolled copy`,
    ok: /listingCanonicalHref\(/.test(text) && !/listingDetailPath\(/.test(text),
  })
}

// ── 3. No PUBLIC page builds an href with a raw listingDetailPath call ─────
//
// listingDetailPath stays exported: listingTileHref is built on it, and the
// key-only callers below genuinely hold nothing else (an alert email, a PDF,
// a calendar invite), where it degrades to /homes-for-sale/listing/<id> and
// /listing/by-key 308s that to the canonical. What may NOT happen again is a
// PUBLIC page builder passing a partial location object.
//
// Shrink-only: an entry may be removed when its caller adopts the builder;
// adding one requires a reason a reviewer can check.
const ALLOWED_RAW_CALLERS = new Map([
  ['lib/slug.ts', 'the builder itself'],
  ['lib/alerts/send.ts', 'key-only: an alert email holds a listing key and nothing else'],
  ['app/api/pdf/listing/route.ts', 'key-only: PDF header link'],
  ['app/api/pdf/cma/route.ts', 'key-only: CMA comp link'],
  ['app/api/calendar/route.ts', 'key-only: .ics URL'],
  ['app/api/open-houses/rsvp/route.ts', 'key-only: RSVP confirmation + broker alert'],
  ['app/actions/subscriptions-admin.ts', 'key-only: admin digest email'],
  ['app/actions/contact-listing-matches.ts', 'key-only: CRM match link'],
  ['app/admin/(protected)/listings/[listingKey]/page.tsx', 'admin, not crawlable'],
  ['app/admin/(protected)/listings/ListingsCsvExport.tsx', 'admin CSV export'],
  ['app/account/page.tsx', 'signed-in account page, noindex'],
  ['app/account/history/page.tsx', 'signed-in account page, noindex'],
  ['app/reports/sales/[city]/[period]/page.tsx', 'key-only: closed-sale report row'],
  ['components/compare/CompareClient.tsx', 'compare tray, key + city only'],
])

const SCAN_DIRS = ['app', 'components', 'lib']
const rawCallers = []
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue
    const text = code(readFileSync(full, 'utf8'))
    if (!/\blistingDetailPath\s*\(/.test(text)) continue
    rawCallers.push(relative(ROOT, full))
  }
}
for (const dir of SCAN_DIRS) walk(join(ROOT, dir))

const unexpected = rawCallers.filter((p) => !ALLOWED_RAW_CALLERS.has(p))
checks.push({
  label: `no NEW raw listingDetailPath href builder (${rawCallers.length} known callers)`,
  ok: unexpected.length === 0,
  detail: unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
})

// Shrink-only, the same ratchet every baseline in this repo uses.
const stale = [...ALLOWED_RAW_CALLERS.keys()].filter((p) => !rawCallers.includes(p))
checks.push({
  label: 'the raw-caller allowlist has no stale entry (it is shrink-only)',
  ok: stale.length === 0,
  detail: stale.length ? `adopted the builder, remove from the list: ${stale.join(', ')}` : '',
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}${c.detail ? `\n      ${c.detail}` : ''}`)
}
if (failed.length) {
  console.error(`\nlisting-canonical-single: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nlisting-canonical-single: ${checks.length}/${checks.length}`)
