#!/usr/bin/env node
// scripts/index-routes.mjs
//
// Walk app/**/page.tsx and generate docs/ROUTE_INVENTORY.md — the
// authoritative list of every canonical public route the site ships.
// Dynamic routes get expanded with their known slug families so the
// inventory is concrete (e.g. /cities/bend, /cities/redmond, ...
// instead of /cities/[slug]).
//
// Drives:
//   - extended G11 route smoke (instead of 10 hardcoded routes)
//   - manual regression sweeps
//   - the canonical "routes" surface for any future gate that needs
//     to enumerate public pages.
//
// The same gate-style refresh pattern as G16:
//   npm run ci:routes -- --refresh   regenerate
//   npm run ci:routes                check drift

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const APP = resolve('app')

// --- Canonical slug families ---------------------------------------------
//
// These are the authoritative slug lists the inventory uses when
// expanding [slug] segments. We read them from the SOURCE files so
// the inventory tracks reality — not a stale copy.

const CITY_SLUGS = (() => {
  const mod = readFileSync(resolve('lib/cities.ts'), 'utf8')
  const block = mod.match(/PRIMARY_CITIES\s*=\s*\[([\s\S]*?)\]/)
  if (!block) throw new Error('lib/cities.ts no longer exports PRIMARY_CITIES as a literal array')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) =>
    m[1].toLowerCase().replace(/\s+/g, '-'),
  )
})()

const COMMUNITIES = (() => {
  const raw = JSON.parse(readFileSync(resolve('data/resort-communities.json'), 'utf8'))
  return raw.communities.map((c) => ({ slug: c.slug, citySlug: c.city_slug }))
})()

// Bend neighborhood slugs — stripped `bend-` prefix so they match the
// route shape /cities/bend/<slug>. The polygon file mixes Bend
// neighborhoods with resort communities; only the `bend-` prefixed
// ones are city-neighborhood routes.
const BEND_NEIGHBORHOODS = (() => {
  const raw = JSON.parse(
    readFileSync(resolve('data/bend/bend-neighborhood-polygons.json'), 'utf8'),
  )
  return raw.communities
    .map((c) => c.slug)
    .filter((s) => s.startsWith('bend-'))
    .map((s) => s.replace(/^bend-/, ''))
})()

// Canonical Bend-area ZIPs. Hardcoded because there is no single
// source-of-truth file in the repo. These are the ZIPs the site
// targets per docs/EXECUTION_PLAN.md §3.
const ZIP_CODES = [
  '97701', '97702', '97703', '97707',
  '97739', '97759', '97734', '97741',
  '97760', '97754', '97756',
]

// LP route slugs — these are existing app/lp/<slug>/page.tsx files.
const LP_SLUGS = ['seller-home-value', 'buyer-listing-alerts', 'expired-listing']

// Sample listing key for the listing-detail route smoke. The full
// production-shaped smoke uses pick-lhci-listing.mjs to find a real
// listing at runtime; this slug is a placeholder for the inventory.
const SAMPLE_LISTING_KEY_PLACEHOLDER = '<runtime-resolved>'

// --- Walk app/ -----------------------------------------------------------

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) {
      // Skip route groups for now — they're rendered as their nested
      // routes anyway. Skip api/admin/cron internal paths.
      if (entry === 'api') continue
      out.push(...walk(full))
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      out.push(full)
    }
  }
  return out
}

function routeFromFile(file) {
  // app/cities/[slug]/[neighborhoodSlug]/page.tsx → /cities/[slug]/[neighborhoodSlug]
  const rel = relative(APP, file)
  const dir = rel.replace(/\/(page\.tsx?$)/, '')
  if (dir === 'page.tsx' || dir === 'page.ts') return '/'
  const segs = dir.split('/')
  // Drop route groups like (marketing)
  const cleaned = segs.filter((s) => !(s.startsWith('(') && s.endsWith(')')))
  if (cleaned.length === 0) return '/'
  return '/' + cleaned.join('/')
}

const files = walk(APP).sort()
const pattern = files.map(routeFromFile).sort()

// --- Expand dynamic routes -----------------------------------------------

const expanded = []
const families = new Map() // family pattern → expanded route list

for (const route of pattern) {
  if (!route.includes('[')) {
    expanded.push({ family: route, route })
    continue
  }
  const list = expandDynamic(route)
  if (list.length === 0) {
    expanded.push({ family: route, route: '(no enumeration)' })
  }
  for (const r of list) expanded.push({ family: route, route: r })
}

function expandDynamic(template) {
  // Skip admin / account / api / auth / dashboard / segments — they
  // are not public canonical-smokeable routes.
  if (
    /^\/(admin|account|api|auth-error|dashboard|forgot-password|join|login|signup|offline|debug|playground|preview|drafts|test|scratch)/.test(template)
  ) {
    return [] // not a public canonical route — skip
  }

  // /cities/[slug]
  if (template === '/cities/[slug]') {
    return CITY_SLUGS.map((s) => `/cities/${s}`)
  }
  // /cities/[slug]/[neighborhoodSlug]
  if (template === '/cities/[slug]/[neighborhoodSlug]') {
    return BEND_NEIGHBORHOODS.map((n) => `/cities/bend/${n}`)
  }
  // /communities/[slug]
  if (template === '/communities/[slug]') {
    return COMMUNITIES.map((c) => `/communities/${c.slug}`)
  }
  // /zip/[zip]
  if (template === '/zip/[zip]' || template === '/zip/[slug]') {
    return ZIP_CODES.map((z) => `/zip/${z}`)
  }
  // /lp/[slug] (if any) — LP routes are usually directly named
  if (template === '/lp/[slug]') {
    return LP_SLUGS.map((s) => `/lp/${s}`)
  }
  // /listing/[listingKey]
  if (template === '/listing/[listingKey]') {
    return [`/listing/${SAMPLE_LISTING_KEY_PLACEHOLDER}`]
  }
  // Other dynamic shapes: don't expand. Inventory lists the template
  // and flags it as "manual smoke required". Subsequent gates can
  // ignore the family.
  return []
}

// --- Categorize ----------------------------------------------------------

const categories = {
  Homepage: (r) => r === '/',
  'Cities (LP family)': (r) => r.startsWith('/cities'),
  'Communities (LP family)': (r) => r.startsWith('/communities'),
  'Neighborhoods (LP family)': (r) => /^\/cities\/[^/]+\/[^/]+/.test(r) && !r.includes('['),
  ZIP: (r) => r.startsWith('/zip'),
  'Listing detail': (r) => r.startsWith('/listing/') && !r.includes('['),
  'Lead-capture LPs': (r) => r.startsWith('/lp/'),
  'Market reports': (r) => r.startsWith('/housing-market') || r.startsWith('/reports'),
  Search: (r) => r.startsWith('/search'),
  'Brand pages': (r) => /^\/(about|team|sell|contact|faq|reviews|guides|area-guides)/.test(r),
  'Footer + legal': (r) => /^\/(privacy|terms|fair-housing|accessibility|dmca)/.test(r),
}

const grouped = new Map()
for (const cat of Object.keys(categories)) grouped.set(cat, [])
const other = []

for (const e of expanded) {
  let assigned = false
  for (const cat of Object.keys(categories)) {
    if (categories[cat](e.route)) {
      grouped.get(cat).push(e)
      assigned = true
      break
    }
  }
  if (!assigned) other.push(e)
}

// --- Render --------------------------------------------------------------

const out = []
out.push('# Route inventory')
out.push('')
out.push(`**Generated:** ${new Date().toISOString()}`)
out.push('')
out.push(
  '**Source of truth:** auto-generated by walking `app/**/page.tsx` and expanding dynamic `[slug]` segments using the canonical slug arrays committed in this repo: `lib/cities.ts` `PRIMARY_CITIES`, `data/resort-communities.json`, `data/bend/bend-neighborhood-polygons.json`. **Do NOT hand-edit.** Re-run `npm run ci:routes -- --refresh` to regenerate.',
)
out.push('')
out.push(
  'Drives the extended G11 route smoke (instead of 10 hardcoded routes), any future structural gates that need to enumerate public pages, and manual regression sweeps.',
)
out.push('')
out.push('---')
out.push('')

for (const [cat, list] of grouped) {
  if (list.length === 0) continue
  const uniq = [...new Set(list.map((e) => e.route))].sort()
  out.push(`## ${cat} (${uniq.length})`)
  out.push('')
  for (const r of uniq) out.push(`- \`${r}\``)
  out.push('')
}

if (other.length > 0) {
  out.push('## Other / utility routes')
  out.push('')
  const uniq = [...new Set(other.map((e) => e.route))].sort()
  for (const r of uniq) out.push(`- \`${r}\``)
  out.push('')
}

// Totals.
const totalPublic = [...grouped.values()].reduce(
  (n, l) => n + new Set(l.map((e) => e.route)).size,
  0,
)
out.push('---')
out.push('')
out.push(`**Total canonical public routes:** ${totalPublic}`)
out.push(`**Cities:** ${CITY_SLUGS.length} · **Communities:** ${COMMUNITIES.length} · **Bend neighborhoods:** ${BEND_NEIGHBORHOODS.length} · **ZIPs:** ${ZIP_CODES.length} · **LPs:** ${LP_SLUGS.length}`)
out.push('')

const target = resolve('docs/ROUTE_INVENTORY.md')
writeFileSync(target, out.join('\n'))
console.error(`index-routes: wrote ${target} · ${totalPublic} public routes`)
