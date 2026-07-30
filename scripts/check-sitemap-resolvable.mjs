#!/usr/bin/env node
/**
 * check-sitemap-resolvable.mjs — ci:sitemap-resolvable (P0.3, W2.2 gate).
 *
 * The 2026-07-21 sitemap drift: app/sitemap.ts emitted a URL family
 * (/cities/{city}/{subdivision}) whose route 404s, and the community family was
 * hardcoded to 14 slugs while the registry held 19 — so Google got submitted
 * 404s and 5 real pages were never submitted. Nothing failed the build. This
 * gate makes that class impossible: every URL FAMILY the sitemap emits must map
 * to a route file that exists, and the two specific drift invariants are pinned.
 *
 * It is a STATIC gate (no DB, no network) — safe for the secret-less ci:gates
 * chain. It verifies three things:
 *
 *   1. RESOLVER EXISTENCE. Every family below names the route file that serves
 *      it (following next.config rewrites, e.g. /homes-for-sale/* -> app/search
 *      /[...slug]). Each named resolver must exist on disk. A family whose route
 *      is deleted or renamed fails here.
 *   2. COMPLETENESS. Every `${baseUrl}/<segment>` first-path-segment emitted
 *      inline in app/sitemap.ts must be a declared family root. A NEW top-level
 *      family added to the sitemap without declaring its resolver fails here.
 *   3. DRIFT INVARIANTS. The exact 2026-07-21 regressions: communities are
 *      sourced from the resort registry (not a hardcoded list / the communities
 *      table), the /cities neighborhood family is sourced from the neighborhoods
 *      table, and /cities/{city}/{subdivision} is never emitted.
 *   4. INDEX SHAPE (2026-07-30). /sitemap.xml must serve a <sitemapindex> over
 *      the five per-class children, never a flat <urlset>. See INDEX CONTRACT
 *      below for why and for every link the check pins.
 *
 * Adding a new sitemap family? Add it to FAMILIES with its resolver, and (if it
 * renders from mutable data at depth >= 2) a resolver-parity contract test.
 *
 * Usage: node scripts/check-sitemap-resolvable.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const SITEMAP = 'app/sitemap.ts'
const NEXT_CONFIG = ['next.config.js', 'next.config.mjs', 'next.config.ts'].find(existsSync)

function fail(msg, details = []) {
  console.error(`\n[31m✗ ci:sitemap-resolvable: ${msg}[0m`)
  for (const d of details) console.error(`  ✗ ${d}`)
  process.exit(1)
}

if (!existsSync(SITEMAP)) fail(`${SITEMAP} not found`)
const src = readFileSync(SITEMAP, 'utf8')

// --- Every URL family app/sitemap.ts emits, and the route file that serves it.
// resolver paths follow next.config rewrites. A family lists ALL resolvers that
// must exist (a catch-all [...slug] serves every depth under its prefix).
const FAMILIES = [
  { id: 'root', roots: [''], resolvers: ['app/page.tsx'] },
  { id: 'luxury-homes-bend', roots: ['luxury-homes-bend'], resolvers: ['app/luxury-homes-bend/page.tsx'] },
  { id: 'cities', roots: ['cities'], resolvers: ['app/cities/page.tsx', 'app/cities/[slug]/page.tsx', 'app/cities/[slug]/[neighborhoodSlug]/page.tsx'] },
  // /homes-for-sale/* rewrites (next.config): browse + preset paths -> /search/*;
  // /homes-for-sale/listing/:key -> /listing/by-key; and ADDRESS-shaped detail
  // URLs (slug ending -{5+digits} or containing ~) -> /listing/by-address/[...].
  // by-address serves the single LARGEST family (one URL per active listing), so
  // it MUST be declared — its deletion would 404 most listing URLs silently.
  { id: 'homes-for-sale', roots: ['homes-for-sale'], resolvers: ['app/search/page.tsx', 'app/search/[...slug]/page.tsx', 'app/listing/by-key/[listingKey]/page.tsx', 'app/listing/by-address/[...slug]/page.tsx'] },
  { id: 'open-houses', roots: ['open-houses'], resolvers: ['app/open-houses/page.tsx', 'app/open-houses/[city]/page.tsx'] },
  { id: 'communities', roots: ['communities'], resolvers: ['app/communities/page.tsx', 'app/communities/[slug]/page.tsx'] },
  { id: 'subdivisions', roots: ['subdivisions'], resolvers: ['app/subdivisions/[slug]/page.tsx'] },
  { id: 'oregon', roots: ['oregon'], resolvers: ['app/oregon/[city]/page.tsx'] },
  { id: 'zip', roots: ['zip'], resolvers: ['app/zip/[zip]/page.tsx'] },
  { id: 'blog', roots: ['blog'], resolvers: ['app/blog/page.tsx', 'app/blog/[slug]/page.tsx'] },
  // /guides permanently redirects to /blog (next.config) — do not emit a guides family.
  { id: 'team', roots: ['team'], resolvers: ['app/team/page.tsx', 'app/team/[slug]/page.tsx'] },
  { id: 'schools', roots: ['schools'], resolvers: ['app/schools/page.tsx', 'app/schools/[slug]/page.tsx'] },
  { id: 'parks', roots: ['parks'], resolvers: ['app/parks/page.tsx', 'app/parks/[slug]/page.tsx'] },
  { id: 'price-drops', roots: ['price-drops'], resolvers: ['app/price-drops/page.tsx', 'app/price-drops/[city]/page.tsx'] },
  { id: 'motivated-sellers', roots: ['motivated-sellers'], resolvers: ['app/motivated-sellers/page.tsx', 'app/motivated-sellers/[city]/page.tsx'] },
  { id: 'housing-market', roots: ['housing-market'], resolvers: ['app/housing-market/page.tsx', 'app/housing-market/[...slug]/page.tsx', 'app/housing-market/reports/page.tsx', 'app/housing-market/reports/[slug]/page.tsx', 'app/housing-market/central-oregon/page.tsx'] },
  { id: 'central-oregon', roots: ['central-oregon'], resolvers: ['app/central-oregon/events/page.tsx', 'app/central-oregon/events/[slug]/page.tsx', 'app/central-oregon/venues/page.tsx', 'app/central-oregon/venues/[slug]/page.tsx', 'app/central-oregon/trails/page.tsx', 'app/central-oregon/trails/[slug]/page.tsx', 'app/central-oregon/golf/[slug]/page.tsx'] },
  { id: 'site-index', roots: ['site-index'], resolvers: ['app/site-index/page.tsx'] },
  // sell/buy intent LPs resolve through the [intent] dynamic route, which
  // notFound()s unless getSellLanding/getBuyLanding(intent) returns a config —
  // so the emitted intent slugs must be real keys in lead-landing-content.ts
  // (slugChecks), else the route resolves but the PAGE 404s.
  { id: 'sell', roots: ['sell'], resolvers: ['app/sell/page.tsx', 'app/sell/valuation/page.tsx', 'app/sell/[intent]/page.tsx'], slugSource: 'lib/lead-landing-content.ts', slugs: ['for-sale-by-owner', 'expired-listings', 'inherited-home'] },
  { id: 'buy', roots: ['buy'], resolvers: ['app/buy/page.tsx', 'app/buy/[intent]/page.tsx'], slugSource: 'lib/lead-landing-content.ts', slugs: ['first-time-home-buyer', 'relocation', 'investment'] },
  { id: 'lp', roots: ['lp'], resolvers: ['app/lp/tetherow/page.tsx', 'app/lp/bend/page.tsx', 'app/lp/tetherow/heath/page.tsx', 'app/lp/central-oregon-golf/page.tsx'] },
  { id: 'tools', roots: ['tools'], resolvers: ['app/tools/mortgage-calculator/page.tsx', 'app/tools/rental-property-calculator/page.tsx', 'app/tools/appreciation/page.tsx'] },
  // Static single-page families (each is a bare /segment -> app/segment/page.tsx).
  { id: 'static-singles', roots: ['about', 'contact', 'our-homes', 'videos', 'resources', 'faq', 'pulse', 'feed', 'reviews', 'join', 'privacy', 'terms', 'accessibility', 'fair-housing', 'dmca', 'activity'], resolvers: ['app/about/page.tsx', 'app/contact/page.tsx', 'app/our-homes/page.tsx', 'app/videos/page.tsx', 'app/resources/page.tsx', 'app/faq/page.tsx', 'app/pulse/page.tsx', 'app/feed/page.tsx', 'app/reviews/page.tsx', 'app/join/page.tsx', 'app/privacy/page.tsx', 'app/terms/page.tsx', 'app/accessibility/page.tsx', 'app/fair-housing/page.tsx', 'app/dmca/page.tsx', 'app/activity/page.tsx'] },
]

const problems = []

// --- Check 1: resolver existence ---
for (const fam of FAMILIES) {
  for (const r of fam.resolvers) {
    if (!existsSync(r)) problems.push(`family "${fam.id}": resolver ${r} does not exist (emitted URLs would 404)`)
  }
}

// --- Check 1b: enumerated-slug families whose dynamic resolver notFound()s
// unless the slug is a known key. The route file exists (Check 1) but the PAGE
// 404s for an unlisted slug — so each emitted slug must appear as a `'slug':`
// key in the named source. Catches "sitemap emits /sell/foo, foo isn't a config".
for (const fam of FAMILIES) {
  if (!fam.slugSource || !fam.slugs) continue
  if (!existsSync(fam.slugSource)) {
    problems.push(`family "${fam.id}": slug source ${fam.slugSource} does not exist`)
    continue
  }
  const srcText = readFileSync(fam.slugSource, 'utf8')
  for (const slug of fam.slugs) {
    const q = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Assert the config binds this slug to THIS family's URL via its own
    // `path: '/{root}/{slug}'` field — not merely that the key exists somewhere.
    // Ties the slug to the correct object (SELL_INTENT_PAGES vs BUY_INTENT_PAGES):
    // a key present only in the wrong object resolves to null -> notFound() (404).
    const pathRe = new RegExp(`path:\\s*['"\`]/${fam.roots[0].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}/${q}['"\`]`)
    if (!pathRe.test(srcText)) {
      problems.push(`family "${fam.id}": emitted slug "/${fam.roots[0]}/${slug}" has no config binding path:'/${fam.roots[0]}/${slug}' in ${fam.slugSource} — the [dynamic] route would notFound() (404)`)
    }
  }
}

// --- Check 2: completeness of inline ${baseUrl}/<segment> emissions ---
const declaredRoots = new Set(FAMILIES.flatMap((f) => f.roots))
const emitted = new Set()
for (const m of src.matchAll(/\$\{baseUrl\}\/([a-z0-9-]+)/gi)) emitted.add(m[1])
// bare `${baseUrl}` (root) and helper-produced paths are covered by families
for (const seg of emitted) {
  if (!declaredRoots.has(seg)) {
    problems.push(`sitemap emits inline family "/${seg}" with no declared resolver in FAMILIES — add it (with its route file) or stop emitting it`)
  }
}

// --- Check 3: the exact 2026-07-21 drift invariants ---
// (a) communities sourced from the resort registry, not a hardcoded list.
if (!/RESORT_COMMUNITY_SLUGS\s*[:=][^\n]*getAllResortCommunities\(\)/.test(src)) {
  problems.push('drift-guard: communities must be sourced from getAllResortCommunities() (RESORT_COMMUNITY_SLUGS). A hardcoded community list is the exact 2026-07-21 registry-drift regression.')
}
// (b) the /cities neighborhood family is sourced from the neighborhoods table
// AND emitted through the named cityNeighborhoodPath() helper (never inline).
if (!/getAllNeighborhoodsWithCity\(\)/.test(src) || !/cityNeighborhoodPath\(/.test(src)) {
  problems.push('drift-guard: neighborhood URLs must be sourced from getAllNeighborhoodsWithCity() and emitted via cityNeighborhoodPath(citySlug, n.slug) — the sole sanctioned 2-segment /cities path.')
}
// (c) NO inline 2-segment cities URL may be EMITTED in the sitemap. Emissions
// are `${baseUrl}/cities/${x}/${y}` template literals, so the ban is anchored on
// the ${baseUrl}/cities/ emission prefix — that targets the actual emitted URL
// (not an incidental mention of the shape in a comment). The route resolves ONLY
// neighborhoods-table slugs; any other second segment 404s. The one legit
// neighborhood URL is built by cityNeighborhoodPath() (in lib/slug.ts, outside
// this file's scan), so ANY inline ${baseUrl}/cities/${x}/${y} here — regardless
// of variable name OR a shadowed source binding — is a rogue family and fails.
// Closes the variable-rename and variable-shadow bypasses a name-based check left.
for (const m of src.matchAll(/\$\{baseUrl\}\/cities\/\$\{[^}]+\}\/\$\{[^}]+\}/g)) {
  problems.push(`drift-guard: inline 2-segment cities emission "${m[0]}" — 404s unless the second segment is a neighborhoods-table slug. Emit neighborhood URLs via cityNeighborhoodPath(citySlug, n.slug); subdivision browse is /homes-for-sale/{city}/{sub}, detail is /subdivisions/{slug}.`)
}
// (d) OUTPUT-BASED backstop must be wired. Text checks (a-c) pin the KNOWN
// emission syntax; they cannot enumerate string-concat / Array.join / aliased-
// baseUrl constructions of the same rogue URL. filterRogueCityUrls inspects the
// FINAL emitted URL strings and drops any 2-segment /cities URL that isn't a
// sanctioned neighborhood, so it is immune to construction syntax. Assert the
// sitemap actually returns through it (can't be silently removed), that the
// neighborhood loop feeds the allow-set, and that the guard + its unit test exist.
if (!/return filterRogueCityUrls\(/.test(src)) {
  problems.push('drift-guard: app/sitemap.ts must `return filterRogueCityUrls([...], allowedNeighborhoodPaths)` — the output-based backstop that catches rogue /cities URLs built by concat/join/aliased-baseUrl (which the text checks above cannot see).')
}
if (!/allowedNeighborhoodPaths\.add\(/.test(src)) {
  problems.push('drift-guard: the neighborhood loop must `allowedNeighborhoodPaths.add(neighborhoodPath)` so filterRogueCityUrls allows exactly the sanctioned neighborhood URLs.')
}
if (!existsSync('lib/sitemap-guard.ts')) problems.push('drift-guard: lib/sitemap-guard.ts (filterRogueCityUrls) is missing')
if (!existsSync('lib/sitemap-guard.test.ts')) problems.push('drift-guard: lib/sitemap-guard.test.ts (proves the guard catches concat/join/aliased constructions) is missing')

// --- Check 4: INDEX CONTRACT — /sitemap.xml is a sitemap index, not a urlset.
//
// The 2026-07-30 regression class: /sitemap.xml served ONE flat urlset of
// 10,689 <url> entries (2,148,231 bytes). Its prerender ran the whole
// buildAllUrls() fan-out and outgrew Vercel's 600s per-page build ceiling on
// 2026-07-28 — three retries, ~30 minutes burned on one route, two production
// deploys canceled. The per-class children at /sitemaps/{class}.xml already
// carried the same URL universe, so /sitemap.xml became a <sitemapindex> over
// them and stopped doing data work entirely.
//
// Next's metadata convention owns /sitemap.xml whenever app/sitemap.ts exists,
// and a MetadataRoute.Sitemap can ONLY emit <urlset> — the index shape is
// impossible there. So the index is a Route Handler and a beforeFiles rewrite
// maps /sitemap.xml onto it. That makes the live shape depend on FOUR files
// agreeing; this check pins every link so the monolith cannot silently return:
//   (a) the index route exists, emits <sitemapindex>, and emits NO <url> entry
//   (b) it enumerates SITEMAP_CLASSES, so it can never list a subset of the
//       children (a dropped class = silently unsubmitted URLs)
//   (c) next.config.ts rewrites /sitemap.xml -> the index in beforeFiles.
//       afterFiles would LOSE to the app/sitemap.ts filesystem route and serve
//       the flat urlset again — the exact regression, invisible in CI
//   (d) app/robots.ts still advertises /sitemap.xml (the index is the only
//       sitemap URL Google is told about)
//   (e) app/sitemap.ts stays off the build critical path (force-dynamic). It
//       remains the URL-universe builder the children import, and the
//       correct-but-slow fallback if the rewrite is ever removed.
/**
 * Comment-strip for the index-contract checks. Both block and line comments are
 * ANCHORED to the start of a line: next.config.ts embeds CSP hosts like
 * https://*.google-analytics.com, whose "//*" an unanchored block-comment regex
 * reads as a comment opener and then blanks everything up to the next "*\/" —
 * which silently deleted the very rewrite this gate checks for.
 */
function stripComments(text) {
  return text.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const INDEX_ROUTE = 'app/sitemaps/index.xml/route.ts'
const CHILD_ROUTE = 'app/sitemaps/[cls]/route.ts'
const ROBOTS = 'app/robots.ts'
const CLASSIFY = 'lib/data/sitemap/classify.ts'

for (const f of [INDEX_ROUTE, CHILD_ROUTE, ROBOTS, CLASSIFY]) {
  if (!existsSync(f)) problems.push(`index-contract: ${f} is missing — /sitemap.xml cannot serve a sitemap index without it`)
}

if (existsSync(INDEX_ROUTE)) {
  const idx = readFileSync(INDEX_ROUTE, 'utf8')
  if (!/<sitemapindex/.test(idx)) {
    problems.push(`index-contract: ${INDEX_ROUTE} does not emit "<sitemapindex" — /sitemap.xml must be a sitemap index.`)
  }
  // Strip comments before scanning for URL entries: the WHY comment
  // legitimately names the shape it replaced. Block-comment stripping is
  // ANCHORED to line start — an unanchored /\*...\*\/ also eats the "//*" inside
  // URLs like https://*.example.com and silently blanks real code.
  const idxCode = stripComments(idx)
  if (/<urlset|<url>/.test(idxCode)) {
    problems.push(`index-contract: ${INDEX_ROUTE} emits "<url>"/"<urlset" — /sitemap.xml regressed to a flat urlset. The 10,689-URL monolith blew the 600s prerender ceiling and canceled production deploys; per-URL entries belong in the per-class children at /sitemaps/{class}.xml.`)
  }
  if (!/SITEMAP_CLASSES/.test(idxCode)) {
    problems.push(`index-contract: ${INDEX_ROUTE} must enumerate SITEMAP_CLASSES (from ${CLASSIFY}) so every child sitemap is listed by construction. A hand-written list can drop a class, and a class that is not listed is never submitted to Google.`)
  }
}

if (NEXT_CONFIG && existsSync(NEXT_CONFIG)) {
  // Comment-stripped so a prose mention of "beforeFiles"/"afterFiles" (there is
  // one, explaining exactly this) cannot satisfy or break the position check.
  const cfg = stripComments(readFileSync(NEXT_CONFIG, 'utf8'))
  const rewriteRe = /source:\s*'\/sitemap\.xml'\s*,\s*destination:\s*'\/sitemaps\/index\.xml'/
  const m = rewriteRe.exec(cfg)
  // Extract the exact span of the beforeFiles array by bracket matching, so
  // "inside beforeFiles" is a structural fact, not a string-order guess.
  let span = null
  const keyIdx = cfg.search(/\bbeforeFiles\s*:\s*\[/)
  if (keyIdx !== -1) {
    const open = cfg.indexOf('[', keyIdx)
    let depth = 0
    for (let i = open; i < cfg.length; i++) {
      if (cfg[i] === '[') depth++
      else if (cfg[i] === ']') {
        depth--
        if (depth === 0) { span = [open, i]; break }
      }
    }
  }
  if (!m) {
    problems.push(`index-contract: ${NEXT_CONFIG} has no rewrite { source: '/sitemap.xml', destination: '/sitemaps/index.xml' } — without it /sitemap.xml falls through to the app/sitemap.ts metadata route and serves the flat urlset again.`)
  } else if (!span || m.index < span[0] || m.index > span[1]) {
    problems.push(`index-contract: the /sitemap.xml rewrite in ${NEXT_CONFIG} is not inside the beforeFiles array. afterFiles rewrites run AFTER filesystem routes, so app/sitemap.ts would win and serve the flat urlset.`)
  }
}

if (existsSync(ROBOTS)) {
  const rb = readFileSync(ROBOTS, 'utf8')
  if (!/sitemap:\s*`?\$\{?baseUrl\}?\/sitemap\.xml/.test(rb) && !/\/sitemap\.xml/.test(rb)) {
    problems.push(`index-contract: ${ROBOTS} must still advertise /sitemap.xml — it is the only sitemap URL Google is given, and it now resolves to the index.`)
  }
}

// Comment-stripped: a comment quoting the export must not satisfy the check.
if (!/export const dynamic = 'force-dynamic'/.test(stripComments(src))) {
  problems.push(`index-contract: ${SITEMAP} must export dynamic = 'force-dynamic'. It is no longer the served sitemap (the index route is), and prerendering its 10,689-URL fan-out is exactly what blew the 600s build ceiling. It stays as the URL-universe builder the children import, plus a runtime fallback.`)
}

const resolverCount = FAMILIES.reduce((n, f) => n + f.resolvers.length, 0)
console.log('Sitemap-resolvable gate (ci:sitemap-resolvable)')
console.log('===============================================')
console.log(`families: ${FAMILIES.length}  ·  resolvers checked: ${resolverCount}  ·  inline roots emitted: ${emitted.size}`)
console.log(`index contract: ${INDEX_ROUTE} + beforeFiles rewrite + ${ROBOTS}`)

if (problems.length) fail(`${problems.length} sitemap resolvability problem(s)`, problems)

console.log('\n✓ Every sitemap URL family maps to a route that exists; drift invariants intact.')
console.log('✓ /sitemap.xml serves a <sitemapindex> over the per-class children (no flat urlset).')
process.exit(0)
