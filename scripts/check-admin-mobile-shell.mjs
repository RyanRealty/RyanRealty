#!/usr/bin/env node
/**
 * check-admin-mobile-shell.mjs — admin must stay usable on a phone.
 *
 * Escape 2026-06-10 (Matt report): the admin shell rendered a fixed always-on
 * w-56 sidebar with no mobile breakpoint, the public SiteHeader stacked above
 * the admin header (double chrome, two hamburgers), and the dashboard's live
 * third-party API calls (GA4 / Meta / FUB / GSC) ran uncached per render
 * (28-49s — reads as "down" on a phone).
 *
 * This gate locks the structural half of the fix:
 *   1. AdminSidebar is hidden below lg (phones get the sheet instead).
 *   2. AdminHeader renders AdminMobileNav (the phone hamburger + sheet).
 *   3. Desktop sidebar and mobile sheet both render from buildAdminNav
 *      (single nav source — the two can never drift).
 *   4. HideOnLP suppresses public chrome on /admin routes.
 *   5. The admin dashboard page keeps its unstable_cache wrapper.
 *
 * Usage: node scripts/check-admin-mobile-shell.mjs
 */
import { readFileSync } from 'node:fs'

const checks = [
  {
    file: 'app/components/admin/AdminSidebar.tsx',
    must: [/hidden[^"']*lg:flex|lg:flex[^"']*hidden/, /buildAdminNav/],
    why: 'desktop sidebar must be hidden below lg and built from buildAdminNav',
  },
  {
    file: 'app/components/admin/AdminHeader.tsx',
    must: [/AdminMobileNav/],
    why: 'admin header must mount the mobile nav (hamburger + sheet)',
  },
  {
    file: 'app/components/admin/AdminMobileNav.tsx',
    must: [/buildAdminNav/, /SheetContent/],
    why: 'mobile nav must render the shared nav sections inside a Sheet',
  },
  {
    file: 'components/layout/HideOnLP.tsx',
    must: [/\/admin/],
    why: 'public site chrome must be suppressed on /admin routes',
  },
  {
    file: 'app/admin/(protected)/page.tsx',
    must: [/unstable_cache/],
    why: 'dashboard data bundle must stay cached (uncached live APIs rendered in 28-49s)',
  },
]

const fails = []
for (const { file, must, why } of checks) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    fails.push(`${file}: missing — ${why}`)
    continue
  }
  for (const re of must) {
    if (!re.test(src)) fails.push(`${file}: pattern ${re} not found — ${why}`)
  }
}

console.log('Admin mobile shell gate')
console.log('=======================')
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log(`All ${checks.length} shell contracts hold (responsive sidebar, mobile sheet, single nav source, no public chrome on /admin, cached dashboard).`)
