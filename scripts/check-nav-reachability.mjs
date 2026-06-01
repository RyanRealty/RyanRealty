#!/usr/bin/env node
/**
 * check-nav-reachability.mjs
 *
 * Parses lib/site-nav.ts as text, extracts all href string literals, and
 * asserts that a required set of top-level section hrefs are all present.
 *
 * Exit 0 — all required hrefs found.
 * Exit 1 — one or more required hrefs missing (lists them).
 *
 * Wire into CI: add "node scripts/check-nav-reachability.mjs" to the ci:gates npm script.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const NAV_FILE = join(__dirname, '..', 'lib', 'site-nav.ts')

// Every top-level section that must be reachable from the site navigation.
const REQUIRED_HREFS = [
  '/homes-for-sale',
  '/search',
  '/open-houses',
  '/communities',
  '/cities',
  '/housing-market',
  '/housing-market/reports',
  '/sell',
  '/sell/valuation',
  '/team',
  '/about',
  '/contact',
  '/blog',
  '/guides',
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

const missing = REQUIRED_HREFS.filter((r) => !found.has(r))

if (missing.length > 0) {
  console.error('check-nav-reachability FAILED — the following required hrefs are missing from lib/site-nav.ts:')
  for (const href of missing) {
    console.error(`  missing: ${href}`)
  }
  console.error(`\nFound ${found.size} hrefs total. Add the missing routes to PRIMARY_NAV or FOOTER_NAV in lib/site-nav.ts.`)
  process.exit(1)
}

console.log(`check-nav-reachability passed — all ${REQUIRED_HREFS.length} required hrefs present (${found.size} total hrefs in nav).`)
process.exit(0)
