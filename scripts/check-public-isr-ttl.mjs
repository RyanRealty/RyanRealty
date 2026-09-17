#!/usr/bin/env node
/**
 * check-public-isr-ttl.mjs — `npm run ci:public-isr-ttl`.
 *
 * THE CLASS: high-traffic public pages shipped `revalidate = 60`, so Vercel
 * ISR rebuilt those routes every minute. That is write spend, not freshness
 * the buyer can see. Matt 2026-09-13: raise the window; use TTLs already
 * used elsewhere in this repo (do not invent new ones).
 *
 *   300   — search / listing detail / homepage / city+community+subdivision
 *           detail / zip / compare / open houses / live market hub + geo
 *           reports / root layout
 *   1800  — team broker pages / price-drop inventory
 *   3600  — marketing (sell/buy/valuation/invest) / About / Contact / Team
 *           index / blog indexes / place indexes / POI details / MoS explainer
 *           / weekly report archive hub
 *   86400 — blog posts / FAQ / annual review / decade city archives
 *
 * Admin / CRM / CMA / auth / API mutation routes stay `0` / `force-dynamic`
 * and are not listed here.
 *
 * Two rules:
 *   1. Each listed file still exports the pinned TTL (exact).
 *   2. No other app page.tsx or layout.tsx may export `revalidate = 60`.
 *
 * Usage:
 *   node scripts/check-public-isr-ttl.mjs           # CI mode
 *   node scripts/check-public-isr-ttl.mjs --report  # same output, always exit 0
 */
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const REPORT = process.argv.slice(2).includes('--report')

export const PUBLIC_ISR_TTLS = [
  // Hot inventory / search / browse — buyer-facing freshness
  ['app/layout.tsx', 300],
  ['app/page.tsx', 300],
  ['app/search/page.tsx', 300],
  ['app/search/[...slug]/page.tsx', 300],
  ['app/listing/[listingKey]/page.tsx', 300],
  ['app/cities/[slug]/page.tsx', 300],
  ['app/cities/[slug]/[neighborhoodSlug]/page.tsx', 300],
  ['app/cities/[slug]/types/[type]/page.tsx', 300],
  ['app/communities/[slug]/page.tsx', 300],
  ['app/communities/[slug]/types/[type]/page.tsx', 300],
  ['app/subdivisions/[slug]/page.tsx', 300],
  ['app/zip/[zip]/page.tsx', 300],
  ['app/open-houses/page.tsx', 300],
  ['app/open-houses/[city]/page.tsx', 300],
  ['app/compare/page.tsx', 300],
  ['app/housing-market/page.tsx', 300],
  ['app/housing-market/[...slug]/page.tsx', 300],
  ['app/housing-market/central-oregon/page.tsx', 300],

  // Inventory-adjacent, already longer than search
  ['app/team/[slug]/page.tsx', 1800],
  ['app/price-drops/page.tsx', 1800],
  ['app/price-drops/[city]/page.tsx', 1800],

  // Cold marketing / indexes / POI / explainer
  ['app/about/page.tsx', 3600],
  ['app/contact/page.tsx', 3600],
  ['app/team/page.tsx', 3600],
  ['app/sell/page.tsx', 3600],
  ['app/sell/valuation/page.tsx', 3600],
  ['app/sell/expired-listings/page.tsx', 3600],
  ['app/sell/for-sale-by-owner/page.tsx', 3600],
  ['app/buy/page.tsx', 3600],
  ['app/buy/[intent]/page.tsx', 3600],
  ['app/invest/page.tsx', 3600],
  ['app/cities/page.tsx', 3600],
  ['app/communities/page.tsx', 3600],
  ['app/subdivisions/page.tsx', 3600],
  ['app/neighborhoods/page.tsx', 3600],
  ['app/blog/page.tsx', 3600],
  ['app/blog/page/[n]/page.tsx', 3600],
  ['app/blog/category/[category]/page.tsx', 3600],
  ['app/blog/category/[category]/page/[n]/page.tsx', 3600],
  ['app/videos/page.tsx', 3600],
  ['app/months-of-supply/page.tsx', 3600],
  ['app/housing-market/reports/page.tsx', 3600],
  ['app/housing-market/reports/[slug]/page.tsx', 3600],
  ['app/parks/[slug]/page.tsx', 3600],
  ['app/central-oregon/golf/[slug]/page.tsx', 3600],
  ['app/central-oregon/events/[slug]/page.tsx', 3600],
  ['app/central-oregon/trails/[slug]/page.tsx', 3600],
  ['app/central-oregon/venues/[slug]/page.tsx', 3600],
  ['app/schools/[slug]/page.tsx', 3600],

  // Static / archive
  ['app/blog/[slug]/page.tsx', 86400],
  ['app/faq/page.tsx', 86400],
  ['app/faq/[slug]/page.tsx', 86400],
  ['app/housing-market/annual-review/page.tsx', 86400],
  ['app/housing-market/reports/archive/[city]/page.tsx', 86400],
  ['app/how-we-get-our-numbers/page.tsx', 86400],
  ['app/new-construction/page.tsx', 86400],
]

const REVALIDATE_EXPORT = /export\s+const\s+revalidate\s*=\s*(-?\d+)/

function readExport(relPath) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) return { missing: true, value: null, source: '' }
  const source = readFileSync(abs, 'utf8')
  const match = source.match(REVALIDATE_EXPORT)
  return { missing: false, value: match ? Number(match[1]) : null, source }
}

function walkAppTsx(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const abs = join(dir, ent.name)
    if (ent.isDirectory()) {
      walkAppTsx(abs, out)
      continue
    }
    if (ent.name === 'page.tsx' || ent.name === 'layout.tsx') out.push(abs)
  }
  return out
}

function main() {
  const problems = []

  for (const [relPath, expected] of PUBLIC_ISR_TTLS) {
    const { missing, value } = readExport(relPath)
    if (missing) {
      problems.push(`${relPath}: file missing — public ISR TTL list drifted`)
      continue
    }
    if (value == null) {
      problems.push(`${relPath}: no \`export const revalidate\` — page lost ISR`)
      continue
    }
    if (value !== expected) {
      problems.push(
        `${relPath}: revalidate = ${value}s, expected ${expected}s (60s burns ISR Writes; do not invent a new TTL)`,
      )
    }
  }

  const listed = new Set(PUBLIC_ISR_TTLS.map(([rel]) => rel))
  for (const abs of walkAppTsx(join(ROOT, 'app'))) {
    const rel = relative(ROOT, abs).replaceAll('\\', '/')
    if (listed.has(rel)) continue
    const { value } = readExport(rel)
    if (value === 60) {
      problems.push(
        `${rel}: leftover \`revalidate = 60\` — raise to an existing public TTL (300 / 1800 / 3600 / 86400)`,
      )
    }
  }

  if (problems.length === 0) {
    console.log(`ci:public-isr-ttl OK — ${PUBLIC_ISR_TTLS.length} public pages pinned; no leftover revalidate = 60`)
    process.exit(0)
  }

  console.error('ci:public-isr-ttl FAIL')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(REPORT ? 0 : 1)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
