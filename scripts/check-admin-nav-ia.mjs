#!/usr/bin/env node
/**
 * check-admin-nav-ia.mjs — nav ↔ locked-IA parity (P10, 2026-08-05).
 *
 * The locked IA (docs/plans/ADMIN_PRODUCT/ia-lock.md, lock 2026-08-05) named
 * 11 destinations; the cut-list froze what may never come back. This gate
 * pins the nav source to both:
 *
 *   1. REACHABLE — every locked destination's canonical URL appears as an
 *      href in lib/admin/nav.ts (the one nav source).
 *   2. NO RESURRECTION — no frozen CUT route appears as a nav href, except
 *      the P9-adopted aliases (a cut redirect whose URL the new destination
 *      deliberately reclaimed, recorded in progress.txt: /admin/people
 *      2026-08-06, /admin/reports 2026-08-05).
 *
 * Textual on purpose: the gate must run secret-less in ci:gates, and nav.ts
 * declares hrefs as string literals.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const NAV = readFileSync(join(ROOT, 'lib/admin/nav.ts'), 'utf8')
const CUTLIST = readFileSync(join(ROOT, 'docs/plans/ADMIN_PRODUCT/cut-list.md'), 'utf8')

// The 11 locked destinations → canonical URLs (IA lock 2026-08-05 + P9 slugs).
const DESTINATIONS = {
  Today: '/admin/today',
  Messages: '/admin/messages',
  People: '/admin/people',
  Prospecting: '/admin/prospecting',
  Valuations: '/admin/valuations',
  Closings: '/admin/closings',
  Oversight: '/admin/oversight',
  Reports: '/admin/reports',
  Audiences: '/admin/audiences',
  Content: '/admin/content',
  Settings: '/admin/settings',
}

// Cut routes the P9 rolls deliberately reclaimed as the destination URL.
const ADOPTED_ALIASES = new Set(['/admin/people', '/admin/reports'])

const navHrefs = new Set([...NAV.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1].split('?')[0]))

const failures = []

for (const [name, url] of Object.entries(DESTINATIONS)) {
  if (!navHrefs.has(url)) failures.push(`locked destination not reachable in nav: ${name} (${url})`)
}

// Parse the frozen route-cut section: backticked /admin/... paths between the
// two section headers.
const cutSection = CUTLIST.split('## Route cuts')[1]?.split('## Surface cuts')[0] ?? ''
const cutRoutes = [...cutSection.matchAll(/`(\/admin[^`]*)`/g)]
  .map((m) => m[1])
  .filter((r) => !r.includes('['))
for (const cut of cutRoutes) {
  if (ADOPTED_ALIASES.has(cut)) continue
  if (navHrefs.has(cut)) failures.push(`frozen CUT route resurrected in nav: ${cut}`)
}

if (cutRoutes.length < 15) failures.push(`cut-list parse suspiciously small (${cutRoutes.length} routes) — check the section markers`)

if (failures.length) {
  console.error('✗ nav↔IA parity failed:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log(
  `✓ nav↔IA parity: all 11 locked destinations reachable; none of ${cutRoutes.length} frozen cut routes in nav (${ADOPTED_ALIASES.size} adopted aliases exempt).`,
)
