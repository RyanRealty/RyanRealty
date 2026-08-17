#!/usr/bin/env node
/**
 * check-nav-reachability.mjs
 *
 * Three assertions over lib/site-nav.ts:
 *
 *   1. REACHABILITY — every required top-level section href is present
 *      somewhere in the file.
 *
 *   2. BROKERAGE REACHABILITY — the company pages Matt called out on
 *      2026-07-30 ("there is really no way to easily get to the brokerage
 *      information") sit inside the KB_TOP_NAV About group specifically, so
 *      they are one hover away from every page, not buried in Menu+.
 *
 *   3. NO DUPLICATE HREF within a single menu group. The same destination
 *      offered twice in one menu is an IA defect, and it also throws React's
 *      "two children with the same key" on any consumer that keys on href
 *      (which is what '/blog' listed twice under PRIMARY_NAV/Guides did).
 *
 * Checks 1 and 3 read the file as text so the gate stays dependency-free and
 * runs in the secret-less static chain.
 *
 * Exit 0 — all assertions hold.
 * Exit 1 — prints every failure.
 *
 * Wired into CI as `ci:nav-reachability` inside the ci:gates chain.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const NAV_FILE = join(__dirname, '..', 'lib', 'site-nav.ts')

// Every top-level section that must be reachable from the site navigation.
const REQUIRED_HREFS = [
  '/homes-for-sale?view=list',
  '/homes-for-sale?view=map',
  '/open-houses',
  '/communities',
  '/neighborhoods',
  '/subdivisions',
  '/cities',
  '/housing-market',
  '/housing-market/reports',
  '/sell',
  '/sell/valuation',
  '/team',
  '/about',
  '/contact',
  '/blog',
  '/faq',
  '/privacy',
  '/terms',
  '/accessibility',
  '/fair-housing',
]

let src
try {
  src = readFileSync(NAV_FILE, 'utf8')
} catch (err) {
  console.error(`check-nav-reachability: could not read ${NAV_FILE}`)
  console.error(err.message)
  process.exit(1)
}

// Extract all single-quoted and double-quoted href string literals.
// Matches both: href: '/foo' and href: "/foo"
const HREF_RE = /href:\s*['"]([^'"]+)['"]/g
const found = new Set()
let m
while ((m = HREF_RE.exec(src)) !== null) {
  found.add(m[1])
}

const failures = []

for (const href of REQUIRED_HREFS.filter((r) => !found.has(r))) {
  failures.push(`missing required href: ${href} — add it to PRIMARY_NAV, KB_TOP_NAV or FOOTER_NAV`)
}

// ── 2. Brokerage pages live in the KB_TOP_NAV About group ────────────────────
// Matt, 2026-07-30: brokerage information must be obviously reachable, not
// buried behind Menu+. Slice the About group's literal block out of the source
// and assert each company page is inside it.
const BROKERAGE_HREFS = ['/about', '/team', '/reviews', '/contact']
const topNavStart = src.indexOf('export const KB_TOP_NAV')
if (topNavStart === -1) {
  failures.push(
    'KB_TOP_NAV is gone from lib/site-nav.ts — the top bar has no single source of truth',
  )
} else {
  const topNav = src.slice(topNavStart)
  // The About group runs from its href marker to the end of that array literal.
  const aboutIdx = topNav.indexOf("href: '/about',")
  const aboutBlock = aboutIdx === -1 ? '' : topNav.slice(aboutIdx, topNav.indexOf('],', aboutIdx))
  for (const href of BROKERAGE_HREFS) {
    if (!aboutBlock.includes(`'${href}'`)) {
      failures.push(
        `brokerage page ${href} is not in the KB_TOP_NAV About group — it must be one hover from every page`,
      )
    }
  }
}

// ── 3. No duplicate href inside one menu group ───────────────────────────────
// Groups are delimited by `children: [` / `links: [` array literals.
const GROUP_RE = /(children|links)\s*:\s*\[([\s\S]*?)\n\s{4}\],/g
let g
let groupCount = 0
while ((g = GROUP_RE.exec(src)) !== null) {
  groupCount += 1
  const body = g[2]
  // Name the group by the nearest preceding label:/title:/heading:.
  const before = src.slice(0, g.index)
  const nameMatch = [...before.matchAll(/(?:label|title|heading)\s*:\s*['"]([^'"]+)['"]/g)].pop()
  const groupName = nameMatch ? nameMatch[1] : `group @ char ${g.index}`
  const hrefs = [...body.matchAll(/href:\s*['"]([^'"]+)['"]/g)].map((h) => h[1])
  const seen = new Set()
  for (const h of hrefs) {
    if (seen.has(h)) {
      failures.push(
        `duplicate href "${h}" inside the "${groupName}" group — one destination, one entry ` +
          `(a repeat is also a duplicate React key in any consumer that keys on href)`,
      )
    }
    seen.add(h)
  }
}

if (failures.length > 0) {
  console.error('check-nav-reachability FAILED — lib/site-nav.ts:')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log(
  `check-nav-reachability passed — ${REQUIRED_HREFS.length} required hrefs present, ` +
    `${BROKERAGE_HREFS.length} brokerage pages in the About group, ` +
    `no duplicate href across ${groupCount} menu groups (${found.size} total hrefs).`,
)
process.exit(0)
