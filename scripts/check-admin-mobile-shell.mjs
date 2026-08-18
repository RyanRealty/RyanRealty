#!/usr/bin/env node
/**
 * check-admin-mobile-shell.mjs — admin must stay usable on a phone.
 *
 * Escape 2026-06-10 (Matt report): the admin shell rendered a fixed always-on
 * w-56 sidebar with no mobile breakpoint, the public SiteHeader stacked above
 * the admin header (double chrome, two hamburgers), and the dashboard's live
 * third-party API calls (GA4 / Meta / GSC) ran uncached per render
 * (28-49s — reads as "down" on a phone).
 *
 * Updated 2026-06-16: the whole admin migrated to the neutral ConsoleShell
 * (Matt directive "migrate all pages"); the brand AdminHeader/AdminSidebar/
 * AdminMobileNav chrome was retired from the layout (component files deleted
 * 2026-07-14 — dead code), and the three dashboards collapsed into
 * /admin/broker-dashboard (the admin home is now a thin redirect).
 *
 * Updated 2026-07-15 (route consolidation): the duplicated /admin/console
 * layout was deleted — the Lead Command Center moved to /admin/crm/[id] inside
 * (protected), and the console segment holds only thin redirect stubs. ONE
 * admin layout remains; the gate asserts the duplicate never comes back.
 * Updated 2026-08-06 (Phase 11B B4, Matt decision): the phone wordmark header
 * was public-brand chrome leak. ADMIN_UI.md §5 amnesia rule — the admin carries
 * NO public brand: no wordmark image in the phone shell. Phone chrome = the
 * locked 5-tab bar (CrmMobileTabBar) + a slim utility row (sheet trigger, ⌘K
 * trigger, avatar, contacts-list scope switch). The gate now also asserts the
 * wordmark can never come back into ConsoleShell (mustNot).
 * Updated Phase 11B B5: the desktop chrome migrated to the LOCKED §5 Option A
 * left rail (ADMIN_UI.md, Matt 2026-08-05). The legacy navy top bar
 * (components/console/ConsoleTopNav.tsx — a navy #102742 bar carrying the white
 * public wordmark) is DELETED; the gate asserts it stays gone and that the
 * DESKTOP path carries no wordmark / brand-navy bar either (mustNot on the
 * shell AND the v2 RailNav primitive).
 *
 * The gate locks the CURRENT shell so it can't regress:
 *   1. ConsoleShell mounts the §5 left rail (RailNav, lg+ only), hides it below
 *      lg, ships a mobile Sheet + the shared AdminNavList (one nav source for
 *      rail and sheet), mounts the locked 5-tab bar, and carries no public
 *      wordmark and no brand-navy chrome anywhere — phone OR desktop (§5 amnesia).
 *   2+3. The single admin layout (protected) renders ConsoleShell from the
 *      single buildAdminNav source; no second admin layout may exist under
 *      app/admin/console (that duplicate drifted once — brokerSlug was missing).
 *   4. HideOnLP suppresses public chrome on /admin routes (no double chrome).
 *   5. The admin home stays a thin redirect — it must NOT reintroduce a slow,
 *      uncached per-render data bundle on the landing route.
 *
 * Usage: node scripts/check-admin-mobile-shell.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const checks = [
  {
    file: 'components/console/ConsoleShell.tsx',
    must: [/RailNav/, /hidden[^"']*lg:flex|lg:flex[^"']*hidden/, /AdminNavList/, /SheetContent/, /lg:hidden/, /CrmMobileTabBar/],
    mustNot: [/Wordmark/, /logo-horizontal/, /\/images\/brand\//, /ConsoleTopNav/, /102742/],
    why: 'console shell must mount the §5 left rail (RailNav, lg+ only), the shared nav in a mobile Sheet, the locked 5-tab bar, phone chrome hidden at lg — and NO public wordmark or brand-navy chrome on ANY breakpoint (ADMIN_UI §5 amnesia rule, B4/B5)',
  },
  {
    file: 'components/admin/v2/RailNav.tsx',
    must: [/av2-rail/],
    mustNot: [/Wordmark/, /logo-horizontal/, /\/images\/brand\//, /102742/],
    why: 'the desktop chrome is the v2 RailNav primitive (§5 Option A, locked 2026-08-05) — v2 language only, no public brand in the DESKTOP path either',
  },
  {
    file: 'app/admin/(protected)/layout.tsx',
    must: [/ConsoleShell/, /buildAdminNav/],
    why: 'protected admin layout must render ConsoleShell from the single buildAdminNav source',
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

// Route consolidation 2026-07-15: exactly ONE admin layout. The old
// app/admin/console/layout.tsx was a full duplicate of the (protected) auth
// chain that had already drifted (it dropped ConsoleShell's brokerSlug prop).
// The console segment holds only thin redirect stubs — a reintroduced layout
// there is the duplication coming back.
if (existsSync('app/admin/console/layout.tsx')) {
  fails.push(
    'app/admin/console/layout.tsx: exists — the console segment is redirect stubs only; the single admin layout is app/admin/(protected)/layout.tsx',
  )
}

// B5: the legacy navy top bar is RETIRED (deleted, Phase 11B). Desktop chrome
// is the §5 Option A left rail. A resurrected file here is the navy wordmark bar
// coming back.
if (existsSync('components/console/ConsoleTopNav.tsx')) {
  fails.push(
    'components/console/ConsoleTopNav.tsx: exists — retired in Phase 11B B5 (it carried the navy brand bar + white public wordmark, ADMIN_UI §5 amnesia violation); the desktop chrome is the §5 left rail (RailNav in ConsoleShell)',
  )
}

for (const { file, must, mustNot = [], why } of checks) {
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
  for (const re of mustNot) {
    if (re.test(src)) fails.push(`${file}: forbidden pattern ${re} found — ${why}`)
  }
}

console.log('Admin mobile shell gate')
console.log('=======================')
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log(`All ${checks.length} shell contracts hold (ConsoleShell §5 left rail on lg+ + mobile sheet + locked 5-tab bar, no public wordmark or navy brand bar on any breakpoint, retired top bar stays deleted, one admin layout + one nav source, no duplicate console layout, no public chrome on /admin, thin-redirect home).`)
