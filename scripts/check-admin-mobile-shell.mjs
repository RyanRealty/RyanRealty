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
 * Updated 2026-06-16: the whole admin migrated to the neutral ConsoleShell
 * (Matt directive "migrate all pages"); the brand AdminHeader/AdminSidebar/
 * AdminMobileNav chrome was retired from the layout (component files deleted
 * 2026-07-14 — dead code), and the three dashboards collapsed into
 * /admin/broker-dashboard (the admin home is now a thin redirect).
 * The gate now locks the CURRENT shell so it can't regress:
 *   1. ConsoleShell hides the desktop rail below lg and ships a mobile Sheet +
 *      the shared AdminNavList (one nav source for rail and sheet).
 *   2+3. Both admin layouts (protected + console) render ConsoleShell from the
 *      single buildAdminNav source — the two can never drift.
 *   4. HideOnLP suppresses public chrome on /admin routes (no double chrome).
 *   5. The admin home stays a thin redirect — it must NOT reintroduce a slow,
 *      uncached per-render data bundle on the landing route.
 *
 * Usage: node scripts/check-admin-mobile-shell.mjs
 */
import { readFileSync } from 'node:fs'

const checks = [
  {
    file: 'components/console/ConsoleShell.tsx',
    must: [/ConsoleTopNav/, /AdminNavList/, /SheetContent/, /lg:hidden/],
    why: 'console shell must render the FUB desktop top nav (lg+), the shared nav in a mobile Sheet, and a mobile header hidden at lg',
  },
  {
    file: 'components/console/ConsoleTopNav.tsx',
    must: [/hidden[^"']*lg:flex|lg:flex[^"']*hidden/, /buildAdminNav|AdminNavSection/],
    why: 'desktop top nav must be lg-only and driven by the single buildAdminNav source',
  },
  {
    file: 'app/admin/(protected)/layout.tsx',
    must: [/ConsoleShell/, /buildAdminNav/],
    why: 'protected admin layout must render ConsoleShell from the single buildAdminNav source',
  },
  {
    file: 'app/admin/console/layout.tsx',
    must: [/ConsoleShell/, /buildAdminNav/],
    why: 'console layout must render ConsoleShell from the single buildAdminNav source',
  },
  {
    file: 'components/layout/HideOnLP.tsx',
    must: [/\/admin/],
    why: 'public site chrome must be suppressed on /admin routes',
  },
  {
    file: 'app/admin/(protected)/page.tsx',
    must: [/redirect\(/],
    why: 'admin home stays a thin redirect to the single dashboard (no reintroduced slow per-render data bundle)',
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
console.log(`All ${checks.length} shell contracts hold (ConsoleShell responsive rail + mobile sheet, single nav source across both admin layouts, no public chrome on /admin, thin-redirect home).`)
