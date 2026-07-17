#!/usr/bin/env node
/**
 * check-admin-nav-source.mjs — ONE admin nav source, mechanically held.
 *
 * Pain #3 of the admin rebuild (2026-07-17, D9): the admin used to run EIGHT
 * coexisting nav systems — a 56-item two-pass regroup that bypassed role gating
 * (≥4 dead-end regressions), a hardcoded mobile tab array, and a 4-entry
 * command-palette list with labels for a deleted shell. The fix made
 * lib/admin/nav.ts DESTINATIONS the single capability-projected source for the
 * desktop bar, the mobile sheet, the bottom tab bar, and the ⌘K palette.
 * This gate keeps it that way:
 *
 *   1. NO consumer carries its own /admin route list. The shell adapter
 *      (admin-nav.ts), the tab bar, and the palette must contain zero
 *      `href: '/admin...'` literals — routes live ONLY in lib/admin/nav.ts.
 *   2. Every href in DESTINATIONS resolves to a real page under
 *      app/admin/(protected)/ — the nav can never point at a dead route.
 *   3. The palette mounts ONCE (ConsoleShell); ConsoleTopNav renders only the
 *      trigger. The double-mount registered two ⌘K listeners and stacked two
 *      dialogs (audit §9.2).
 *
 * Usage: node scripts/check-admin-nav-source.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const fails = []

function read(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    fails.push(`${file}: missing — the one-nav-source contract expects it`)
    return null
  }
}

// ── 1. No consumer-owned /admin route lists ─────────────────────────────────
const NO_ROUTE_LITERALS = [
  'app/components/admin/admin-nav.ts',
  'components/console/CrmMobileTabBar.tsx',
  'components/console/ConsoleCommandPalette.tsx',
]
const HREF_LITERAL = /href:\s*['"`]\/admin/
for (const file of NO_ROUTE_LITERALS) {
  const src = read(file)
  if (src && HREF_LITERAL.test(src)) {
    fails.push(`${file}: contains an \`href: '/admin...'\` literal — admin routes live ONLY in lib/admin/nav.ts DESTINATIONS`)
  }
}

// ── 2. Every DESTINATIONS href resolves to a real page ──────────────────────
const navSrc = read('lib/admin/nav.ts')
if (navSrc) {
  const hrefs = new Set()
  const HREF_RE = /href:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = HREF_RE.exec(navSrc)) !== null) hrefs.add(m[1])
  if (hrefs.size === 0) fails.push('lib/admin/nav.ts: no hrefs found — DESTINATIONS parse failed?')
  for (const href of hrefs) {
    if (!href.startsWith('/admin')) {
      fails.push(`lib/admin/nav.ts: href ${href} is not an /admin route`)
      continue
    }
    const rel = href === '/admin' ? '' : href.slice('/admin/'.length)
    const page = rel ? `app/admin/(protected)/${rel}/page.tsx` : 'app/admin/(protected)/page.tsx'
    if (!existsSync(page)) {
      fails.push(`lib/admin/nav.ts: href ${href} has no page at ${page} — the nav may not point at a dead route`)
    }
  }
}

// ── 3. Single palette mount ─────────────────────────────────────────────────
const topNav = read('components/console/ConsoleTopNav.tsx')
if (topNav && /<ConsoleCommandPalette[\s/>]/.test(topNav)) {
  fails.push('components/console/ConsoleTopNav.tsx: mounts ConsoleCommandPalette — only ConsoleShell may (render ConsoleCommandPaletteTrigger instead)')
}
const shell = read('components/console/ConsoleShell.tsx')
if (shell) {
  const mounts = (shell.match(/<ConsoleCommandPalette[\s/>]/g) ?? []).length
  if (mounts !== 1) {
    fails.push(`components/console/ConsoleShell.tsx: ${mounts} ConsoleCommandPalette mounts — exactly 1 required (one ⌘K listener, one dialog)`)
  }
}

console.log('Admin nav one-source gate')
console.log('=========================')
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('All contracts hold: no consumer route lists, every nav href resolves to a live page, one palette mount.')
