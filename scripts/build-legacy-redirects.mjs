#!/usr/bin/env node
/**
 * build-legacy-redirects.mjs — generate the legacy WordPress/AgentFire → new-site
 * 301 redirect map for the ryan-realty.com cutover (gate LAUNCH-04).
 *
 * WHY: the new Next.js site replaces a legacy AgentFire/WordPress site that has
 * ~430 indexed page URLs + 137 blog posts (Yoast sitemaps). Cutting the domain
 * over with no redirects 404s every one of them and dumps years of accumulated
 * SEO equity. This builds a deterministic, complete map so every legacy URL 301s
 * to a real new-site route (single hop → 200).
 *
 * STRATEGY (deterministic, every destination is a known-existing route so there
 * is no 301→404):
 *   1. Curated exact map for money / system / team / guide pages.
 *   2. /explore/<city>/<neighborhood> and /explore/<city> → /cities/<city>
 *      (the city hub — a guaranteed-200 topical parent; consolidates the long
 *      tail of legacy neighborhood pages to the relevant city).
 *   3. Blog posts (post-sitemap) → /blog/<slug>. Per-post equity is preserved
 *      where the slug exists on the new site; the LAUNCH-04 gate
 *      (check-legacy-redirects.mjs) resolves each against the live staging host
 *      and DOWNGRADES any 404 to /blog so nothing dead-ends.
 *   4. Anything unmapped → a safe guaranteed-200 parent (logged as low-confidence
 *      so it can be hand-tuned).
 *
 * OUTPUT: data/legacy-redirects.json  { "<legacy-path-no-trailing-slash>": "<dest>" }
 *
 * Run:  node scripts/build-legacy-redirects.mjs
 * Re-run any time the legacy sitemap changes; commit the JSON.
 */

import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LEGACY_ORIGIN = 'https://ryan-realty.com'
const OUT = join(process.cwd(), 'data', 'legacy-redirects.json')

// Cities that have a /cities/<slug> hub on the new site.
const CITY_HUBS = new Set([
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'madras', 'prineville', 'terrebonne',
])

// Community slugs that actually have a /communities/<slug> page with real content,
// loaded from the registry so we never redirect to a soft-404 empty slug. NOTE the
// real slug shape: resort communities are bare (`tetherow`, `northwest-crossing`)
// while Bend neighborhoods are city-prefixed (`bend-awbrey-butte`, `bend-old-bend`).
// `/communities/[slug]` returns HTTP 200 for ANY slug (soft-404), so set-membership
// against this registry — NOT an HTTP probe — is the only safe validation.
function loadCommunitySlugs() {
  const slugs = new Set()
  const dataDir = join(process.cwd(), 'data')
  for (const f of readdirSync(dataDir)) {
    const m = f.match(/^resort-community-(.+)\.json$/)
    if (!m) continue
    try {
      const j = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
      slugs.add((j.slug || m[1]).toLowerCase())
    } catch { slugs.add(m[1].toLowerCase()) }
  }
  try {
    const reg = JSON.parse(readFileSync(join(dataDir, 'resort-communities.json'), 'utf8'))
    const arr = Array.isArray(reg) ? reg : (reg.communities || Object.values(reg))
    for (const c of arr) if (c && c.slug) slugs.add(String(c.slug).toLowerCase())
  } catch { /* registry optional */ }
  return slugs
}
const KNOWN_COMMUNITY = loadCommunitySlugs()

// Resolve a bare neighborhood/community name to its real /communities/<slug>, or null.
// Tries the bare slug (resort communities) then the `bend-<name>` form (Bend hoods).
function communityTarget(name) {
  const n = String(name).toLowerCase().replace(/^\/+|\/+$/g, '')
  if (KNOWN_COMMUNITY.has(n)) return `/communities/${n}`
  if (KNOWN_COMMUNITY.has(`bend-${n}`)) return `/communities/bend-${n}`
  return null
}

// Curated exact map for the high-value money / system / team / guide pages.
// Every destination is a guaranteed-200 route on the new site (verified against
// the app/ route inventory). Paths are stored WITHOUT trailing slash.
const CURATED = {
  // system / legal
  '/about-us': '/about',
  '/accessibility': '/accessibility',
  '/contact': '/contact',
  '/cookie-policy': '/privacy',
  '/privacy-policy': '/privacy',
  '/terms-of-service': '/terms',
  '/sitemap': '/',
  '/thank-you': '/',
  '/blog': '/blog',
  '/explore': '/communities',
  '/join-us': '/join',
  '/giving-back': '/about',
  // team
  '/matt-ryan': '/team/matt-ryan',
  '/paul-stevenson': '/team/paul-stevenson',
  '/rebecca-ryser-peterson': '/team/rebecca-peterson',
  '/rebecca-active': '/team/rebecca-peterson',
  '/bend-oregon-realtor': '/about',
  // sell funnel
  '/free-home-valuation': '/home-valuation',
  '/sell-your-bend-oregon-home': '/sell',
  // Live FUB drip emails + texts still link prospects to /seller-plans/ and
  // reference "the plans" / "the marketing plan". Deep-link them to the
  // marketing-plan section on /sell so they land on the substance the message
  // promised, not the top of the page. (middleware splits the #anchor off.)
  '/seller-plans': '/sell#marketing-plan',
  '/seller-plans-new': '/sell#marketing-plan',
  '/signature-seller-plans': '/sell#marketing-plan',
  '/selling-fsbo-bend': '/sell',
  '/the-definitive-home-selling-guide': '/sell',
  '/the-definitive-guide-on-how-to-upsize-into-a-new-home': '/guides',
  // buy funnel
  '/buy-a-home-in-bend-oregon': '/buy',
  '/first-time-home-buyer-bend': '/buy',
  '/first-time-homebuyer-guide': '/guides',
  '/the-essential-guide-on-how-to-buy-like-a-pro': '/guides',
  '/vip-home-search': '/homes-for-sale',
  // search / listings
  '/properties': '/homes-for-sale',
  '/popular-searches': '/homes-for-sale',
  '/search-by-neighborhood': '/communities',
  '/featured-listings': '/our-homes',
  '/featured-listings-2': '/our-homes',
  '/office-listings-new': '/our-homes',
  '/past-sales': '/our-homes',
  '/coming-soon-listing': '/homes-for-sale',
  '/luxury-homes-bend-oregon': '/homes-for-sale',
  '/golf-homes-for-sale': '/homes-for-sale',
  '/duplexes-for-sale': '/homes-for-sale',
  '/homes-with-adus': '/homes-for-sale',
  // open house
  '/open-house': '/open-houses',
  '/open-house-on-56628-sunstone-loop': '/homes-for-sale',
  '/open-house-on-56628-sunstone-loop-2': '/homes-for-sale',
  '/open-house-on-56628-sunstone-loop-3': '/homes-for-sale',
  // tools
  '/mortgage-calculator': '/tools/mortgage-calculator',
  '/nosey-neighbor': '/homes-for-sale',
  // reviews
  '/testimonials': '/reviews',
  // market / housing
  '/bend-oregon-market-statistics': '/housing-market',
  '/june-report': '/housing-market',
  // relocation / lifestyle guides
  '/relocation': '/guides',
  '/relocating-to-bend-oregon': '/guides',
  '/moving-to-bend-oregon-2026': '/guides',
  '/bend-oregon-cost-of-living-2026': '/guides',
  '/best-bend-oregon-neighborhoods-families': '/communities',
  // standalone neighborhood-ish pages → community / city hub
  '/bends-west-side': '/cities/bend',
  '/living-in-nw-crossing-bend-oregon': '/communities/northwest-crossing',
  '/river-west-and-old-bend': '/communities/bend-river-west',
  '/river-west-and-old-bend-2': '/communities/bend-river-west',
  '/southeast-bend': '/cities/bend',
  '/southwest-bend': '/cities/bend',
  '/tumalo': '/cities/bend',
  '/tanager': '/communities',
  '/somerset': '/communities',
  '/powell-butte': '/cities/prineville',
  '/los-serranos': '/communities',
  '/caldera-springs': '/communities/caldera-springs',
  '/caldera-springs-2': '/communities/caldera-springs',
  '/caldera-springs-homes-for-sale': '/communities/caldera-springs',
  '/tetherow-bend-lifestyle-guide': '/communities/tetherow',
  // legacy single-listing address pages (sold) → active inventory
  '/17130-mayfield-dr': '/homes-for-sale',
  '/19496-tumalo-reservoir-road-bend': '/homes-for-sale',
  '/2354-nw-drouillard-ave': '/homes-for-sale',
  '/363-sw-bluff-drive-unit-208': '/homes-for-sale',
  '/56628-sunstone-loop-bend-or-97707': '/homes-for-sale',
  '/64350-old-bend-redmond-hwy': '/homes-for-sale',
  // Legacy AgentFire money pages (root-level) that ranked and 404'd post-cutover.
  '/about-ryan-realty': '/about',
  '/bend-oregon-real-estate': '/cities/bend',
  '/bend-oregon-housing-market': '/housing-market',
  '/bend-neighborhoods-housing-market-reports': '/housing-market',
  '/bend-oregon-relocation-guide': '/guides',
  '/buy-bend-real-estate': '/buy',
  '/buy-bend-real-estate/comprehensive-bend-oregon-home-buying-guide': '/buy',
  '/featured-properties': '/our-homes',
  '/fsbo': '/lp/fsbo',
  '/matthew-ryan': '/team/matt-ryan',
  '/rebecca-peterson': '/team/rebecca-peterson',
  '/trust': '/about',
}

function normalize(pathname) {
  let p = pathname.trim()
  try { p = decodeURIComponent(p) } catch { /* keep raw */ }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p.toLowerCase()
}

async function fetchSitemapLocs(url) {
  // Non-fatal: the legacy AgentFire host is GONE post-cutover (ryan-realty.com is
  // now the new site), so its Yoast sitemaps 404. We keep the fetch for the case
  // where a legacy mirror is reachable, but never let its absence wipe the map —
  // the durable source of the legacy URLs is data/legacy-ranking-paths.json + the
  // existing committed map (seeded in main()).
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (cutover-redirect-builder)' } })
    if (!res.ok) { console.warn(`warn: ${url} → ${res.status} (skipping live sitemap)`); return [] }
    const xml = await res.text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    return locs
      .map((u) => u.replace(LEGACY_ORIGIN, ''))
      .map(normalize)
      .filter((p) => p && p !== '/')
  } catch (e) {
    console.warn(`warn: ${url} unreachable (${e.message}) — using committed fixtures`)
    return []
  }
}

function cityTarget(city) {
  const c = String(city).toLowerCase()
  // Black Butte Ranch has a richer /communities page than its thin /cities page.
  if (c === 'black-butte-ranch' && KNOWN_COMMUNITY.has('black-butte-ranch')) return '/communities/black-butte-ranch'
  if (CITY_HUBS.has(c)) return `/cities/${c}`
  return '/homes-for-sale'
}

function resolvePage(path) {
  if (CURATED[path]) return { dest: CURATED[path], confidence: 'high' }
  // /explore/<city>/<neighborhood...> or /explore/<city>
  let m = path.match(/^\/explore\/([^/]+)(?:\/(.+))?$/)
  if (m) {
    const city = m[1]
    if (CITY_HUBS.has(city)) return { dest: `/cities/${city}`, confidence: 'high' }
    return { dest: communityTarget(city) || '/communities', confidence: communityTarget(city) ? 'high' : 'medium' }
  }
  // Legacy AgentFire IDX families that carried the bulk of the local rankings and
  // were 404'ing post-cutover (the #1 cause of the traffic cliff):
  //   /listings/city|county|subdivision/<Name>[/<Type>]
  //   /best-neighborhoods-bend-oregon/<n>-homes-for-sale[/<n>-home-value]
  //   /bend-oregon-housing-market[/<n>-...-report]
  if ((m = path.match(/^\/listings\/city\/([^/]+)(?:\/[^/]+)?$/))) return { dest: cityTarget(m[1]), confidence: 'high' }
  if (path.match(/^\/listings\/county\/[^/]+(?:\/[^/]+)?$/)) return { dest: '/homes-for-sale', confidence: 'high' }
  if ((m = path.match(/^\/listings\/subdivision\/([^/]+)(?:\/[^/]+)?$/))) return { dest: communityTarget(m[1]) || '/cities/bend', confidence: 'high' }
  if ((m = path.match(/^\/best-neighborhoods-bend-oregon\/([^/]+?)-homes-for-sale(?:\/.*)?$/))) return { dest: communityTarget(m[1]) || '/cities/bend', confidence: 'high' }
  if ((m = path.match(/^\/bend-oregon-housing-market\/(.+)$/))) {
    const n = m[1].replace(/-housing-market-report$/, '').replace(/-market-report$/, '')
    return { dest: communityTarget(n) || '/housing-market', confidence: 'high' }
  }
  // unmapped page → safe guaranteed-200 parent, flagged for review
  return { dest: '/', confidence: 'low' }
}

function resolvePost(path) {
  // post-sitemap entries are single-segment blog slugs.
  const slug = path.replace(/^\//, '')
  if (!slug || slug.includes('/')) return { dest: '/blog', confidence: 'medium' }
  // Map to /blog/<slug>; the LAUNCH-04 gate downgrades any 404 to /blog.
  return { dest: `/blog/${slug}`, confidence: 'medium' }
}

async function main() {
  const [pages, posts] = await Promise.all([
    fetchSitemapLocs(`${LEGACY_ORIGIN}/page-sitemap.xml`),
    fetchSitemapLocs(`${LEGACY_ORIGIN}/post-sitemap.xml`),
  ])

  const map = {}
  const lowConfidence = []

  // Seed from the existing committed map so prior live-sitemap-derived entries
  // (address slugs, /explore, blog posts) survive a re-run when the legacy host
  // is gone. Curated + family resolution below overwrites with better targets.
  if (existsSync(OUT)) {
    try { Object.assign(map, JSON.parse(readFileSync(OUT, 'utf8'))) } catch { /* fresh build */ }
  }

  // The legacy ranking URLs that actually accumulated local SEO and 404'd at the
  // cutover. Committed fixture because the live AgentFire sitemap no longer exists.
  // Resolved through resolvePage so each lands on a real-content page.
  const RANKING_FIXTURE = join(process.cwd(), 'data', 'legacy-ranking-paths.json')
  const rankingPaths = existsSync(RANKING_FIXTURE)
    ? JSON.parse(readFileSync(RANKING_FIXTURE, 'utf8')).map(normalize)
    : []
  for (const p of rankingPaths) {
    const { dest } = resolvePage(p)
    map[p] = dest
  }

  for (const p of pages) {
    const { dest, confidence } = resolvePage(p)
    map[p] = dest
    if (confidence === 'low') lowConfidence.push(`${p} → ${dest} (page, unmapped)`)
  }
  for (const p of posts) {
    if (map[p]) continue // a page path also in posts: page mapping wins
    const { dest } = resolvePost(p)
    map[p] = dest
  }

  // Deterministic key order for a clean diff.
  const ordered = {}
  for (const k of Object.keys(map).sort()) ordered[k] = map[k]

  writeFileSync(OUT, JSON.stringify(ordered, null, 2) + '\n')

  console.log(`legacy-redirects: ${pages.length} pages + ${posts.length} posts → ${Object.keys(ordered).length} mappings`)
  console.log(`wrote ${OUT}`)
  if (lowConfidence.length) {
    console.log(`\n${lowConfidence.length} low-confidence (review + tighten):`)
    for (const l of lowConfidence) console.log('  ' + l)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
