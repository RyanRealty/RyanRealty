#!/usr/bin/env node
/**
 * Canonical listing-display gate.
 *
 * components/site/ListingCard.tsx is the ONE listing card the whole site uses
 * (the design-system .listing). This gate locks that in so we never regress to
 * the old tiles/sliders/shadcn nav again:
 *
 *   HARD BAN (zero allowed, ever):
 *     - any import of the deleted GeoSectionFeaturedListings
 *     - any import of the shadcn ui/navigation-menu
 *
 *   RATCHET (baselined, can only shrink):
 *     - the legacy ListingTile + TilesSlider still live in many files. Their
 *       current usage is baselined in scripts/.canonical-listings-baseline.json.
 *       A NEW file importing either FAILS the gate, so the count only goes DOWN
 *       toward ListingCard and the old sliders can never come back.
 *
 * Usage:
 *   node scripts/check-canonical-listings.mjs                  # check
 *   node scripts/check-canonical-listings.mjs --write-baseline # snapshot current legacy usage
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = path.join(ROOT, 'scripts', '.canonical-listings-baseline.json')
const WRITE = process.argv.includes('--write-baseline')

const HARD_BANNED = [
  { re: /from\s+['"][^'"]*\/GeoSectionFeaturedListings['"]/, name: 'GeoSectionFeaturedListings', fix: 'use FeaturedListings (ListingCard grid)' },
  { re: /from\s+['"][^'"]*\/ui\/navigation-menu['"]/, name: 'shadcn ui/navigation-menu', fix: 'use the design-system header (plain nav)' },
]
const RATCHET = [
  { re: /from\s+['"][^'"]*\/ListingTile['"]/, name: 'ListingTile' },
  { re: /from\s+['"][^'"]*\/TilesSlider['"]/, name: 'TilesSlider' },
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) walk(p, out)
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const files = ['app', 'components'].flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
)
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

const hard = []
const ratchetHits = new Set()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const b of HARD_BANNED) if (b.re.test(src)) hard.push(`${rel(f)} -> ${b.name} (${b.fix})`)
  for (const r of RATCHET) if (r.re.test(src)) ratchetHits.add(rel(f))
}

if (WRITE) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ allowed: [...ratchetHits].sort() }, null, 2) + '\n')
  console.log(`Wrote baseline: ${ratchetHits.size} files still using ListingTile/TilesSlider (allowed to shrink, not grow).`)
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE_FILE)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).allowed)
  : new Set()
const newRatchet = [...ratchetHits].filter((f) => !baseline.has(f)).sort()

let failed = false
if (hard.length) {
  failed = true
  console.error('Canonical-listings gate FAILED — banned component imports:')
  for (const h of hard) console.error('  - ' + h)
}
if (newRatchet.length) {
  failed = true
  console.error('\nCanonical-listings gate FAILED — NEW files importing the legacy ListingTile/TilesSlider:')
  for (const f of newRatchet) console.error('  - ' + f + ' (use components/site/ListingCard instead)')
  console.error('\nThe legacy tile/slider is being migrated OUT. Do not add new usages.')
}
if (failed) process.exit(1)
console.log(
  `Canonical-listings gate passed (0 banned imports, ${ratchetHits.size} baselined legacy usages, 0 new).`,
)
