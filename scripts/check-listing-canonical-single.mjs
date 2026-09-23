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
 * P14 (visibility audit 2026-09-22, gsc-trend-6; MATT 2026-09-23 "nothing is
 * permanent") — the canonical kept MOVING even with one builder, because the
 * builder read the polygon classifier: 1,234 of 7,329 listing ids (16.8%) under
 * more than one URL in Search Console 2026-08-23..09-19, against 6.6% in June,
 * and every old path answered 200 with a rel=canonical. Three more rules:
 *
 *   3. listingTileHref builds the path from MLS fields only (no boundaryCity,
 *      no boundaryNeighborhood, no neighborhood segment), and the canonical-path
 *      lookups select no boundary_* column.
 *   4. middleware.ts 308s every non-canonical listing path through
 *      resolveListingCanonicalHop with the Edge lookup, before render.
 *   5. lib/routing/listing-canonical-pins.json exists, is internally consistent
 *      (every migration names a fixture and continues its chain), and the unit
 *      test that replays it against the real builder exists.
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
  // `[:=]`, not `:` — the object-literal spelling is the one this route shipped
  // for three months, but `base.alternates = { canonical }` is the same defect
  // one character apart and slipped through when this check was first written.
  // Match the ASSIGNMENT too, or the gate only holds the shape it happened to
  // be tested against.
  ok:
    !/alternates\s*[:=]\s*\{\s*canonical/.test(byAddress) &&
    !/\bcanonical\s*[:=]\s*`?\/homes-for-sale\//.test(byAddress) &&
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
// carry the fields; the TYPE was what dropped them. (The boundary-neighborhood
// half of this check retired with P14: the builder no longer reads it.)
const placeSections = src('lib/kb/place-sections.ts')
checks.push({
  label: 'place-sections activity + open-house rows pass listNumber and the MLS subdivision',
  ok:
    /ListNumber\?: string \| null/.test(placeSections) &&
    /listNumber: a\.ListNumber \?\? null/.test(placeSections) &&
    /subdivisionName: a\.SubdivisionName \?\? null/.test(placeSections) &&
    /listNumber: oh\.list_number \?\? null/.test(placeSections),
})

// The redirect hops must land ON the canonical, or the hop itself mints a
// duplicate. /listing/odsmls passed {city, subdivision} until 2026-09-08.
// /listing/by-key reaches the builder through listingCanonicalPathFromFields,
// the row -> path mapping it shares with the Edge hop (P14); that mapping must
// itself be listingCanonicalHref.
const pathCore = code(src('lib/data/listings/listingCanonicalPathCore.ts'))
for (const [path, label] of [
  ['app/listing/by-key/[listingKey]/route.ts', '/listing/by-key'],
  ['app/listing/odsmls/[...slug]/route.ts', '/listing/odsmls'],
]) {
  const text = code(src(path))
  checks.push({
    label: `${label} redirects to the canonical builder's URL, not a hand-rolled copy`,
    ok:
      (/listingCanonicalHref\(/.test(text) ||
        (/listingCanonicalPathFromFields\(/.test(text) && /return listingCanonicalHref\(\{/.test(pathCore))) &&
      !/listingDetailPath\(/.test(text),
  })
}

// ── P14.3 The path is built from MLS fields only ───────────────────────────
function fnBody(text, signature) {
  const start = text.indexOf(signature)
  if (start === -1) return ''
  const next = text.indexOf('\nexport ', start + signature.length)
  return text.slice(start, next === -1 ? undefined : next)
}
const tileHrefBody = code(fnBody(slug, 'export function listingTileHref('))
checks.push({
  label: 'P14: listingTileHref reads no polygon field and emits no neighborhood segment',
  ok:
    tileHrefBody.length > 0 &&
    !/tile\.boundaryCity|tile\.boundaryNeighborhood/.test(tileHrefBody) &&
    /city: tile\.city \?\? null, neighborhood: null, subdivision/.test(tileHrefBody),
})
checks.push({
  label: 'P14: the canonical-path lookups select no boundary_* column',
  ok:
    /export const LISTING_CANONICAL_PATH_COLUMNS/.test(pathCore) &&
    !/'boundary_/.test(pathCore) &&
    /LISTING_CANONICAL_PATH_COLUMNS/.test(src('lib/data/listings/getListingCanonicalPathFields.ts')) &&
    /LISTING_CANONICAL_PATH_COLUMNS/.test(src('lib/data/listings/getListingCanonicalPathFieldsEdge.ts')),
})

// ── P14.4 Middleware 308s every non-canonical listing path ─────────────────
const middleware = code(src('middleware.ts'))
const hopAt = middleware.indexOf('resolveListingCanonicalHop(pathname')
checks.push({
  label: 'P14: middleware.ts 308s non-canonical listing paths via resolveListingCanonicalHop + the Edge lookup',
  ok:
    /import \{ (isRouterFlightRequest, )?resolveListingCanonicalHop \} from '@\/lib\/routing\/listing-canonical-hop'/.test(middleware) &&
    /import \{ getListingCanonicalPathFieldsEdge \} from '@\/lib\/data\/listings\/getListingCanonicalPathFieldsEdge'/.test(
      middleware,
    ) &&
    hopAt !== -1 &&
    /getListingCanonicalPathFieldsEdge\(id\)/.test(middleware.slice(hopAt, hopAt + 600)) &&
    /NextResponse\.redirect\(redirectUrl, 308\)/.test(middleware.slice(hopAt, hopAt + 900)),
})
// The unit tests prove the decision; only a running server proves the Edge
// bundle emits it. ci:route-smoke carries that probe (red on production
// 2026-09-23 before this change: HTTP 200, no Location; green on a local server
// with it: 308 to the sitemap's own URL, which does not redirect again).
const routeSmoke = code(src('scripts/check-route-smoke.mjs'))
checks.push({
  label: 'P14: ci:route-smoke probes a non-canonical listing path on the running server and wants a 308',
  ok:
    /async function checkListingCanonicalHop\(/.test(routeSmoke) &&
    /status !== 308/.test(routeSmoke) &&
    /\/homes-for-sale\/outside-boundaries\/\$\{discovered\.path\.split\('\/'\)\.at\(-1\)\}/.test(routeSmoke) &&
    /if \(route\.listingSegment\) return checkListingCanonicalHop\(route, url\)/.test(routeSmoke),
})

// ── P14.5 The pin file is consistent and replayed by a unit test ───────────
const pins = JSON.parse(src('lib/routing/listing-canonical-pins.json'))
const fixtureIds = new Set((pins.fixtures ?? []).map((f) => f.id))
const chainEnd = new Map((pins.fixtures ?? []).map((f) => [f.id, f.pinned]))
const pinProblems = []
if ((pins.fixtures ?? []).length < 12) pinProblems.push(`only ${(pins.fixtures ?? []).length} fixtures (want >= 12)`)
for (const f of pins.fixtures ?? []) {
  if (!f.id || !f.input || typeof f.pinned !== 'string' || !f.pinned.startsWith('/homes-for-sale/')) {
    pinProblems.push(`fixture ${f.id ?? '?'} is missing id/input/pinned`)
  }
}
for (const m of pins.migrations ?? []) {
  if (!fixtureIds.has(m.id)) pinProblems.push(`migration names unknown fixture ${m.id}`)
  else if (chainEnd.get(m.id) !== m.from) pinProblems.push(`migration for ${m.id} does not continue its chain (from ${m.from})`)
  else if (m.from === m.to) pinProblems.push(`migration for ${m.id} moves nothing`)
  else if (!m.change || !m.date) pinProblems.push(`migration for ${m.id} names no change/date`)
  else chainEnd.set(m.id, m.to)
}
const pinTest = src('lib/routing/listing-canonical-hop.test.ts')
checks.push({
  label: `P14: listing-canonical-pins.json is consistent (${fixtureIds.size} fixtures, ${(pins.migrations ?? []).length} migrations) and replayed by the unit test`,
  ok: pinProblems.length === 0 && /listing-canonical-pins\.json/.test(pinTest) && /listingTileHref\(/.test(pinTest),
  detail: pinProblems.join('; '),
})

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
