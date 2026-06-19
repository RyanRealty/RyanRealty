#!/usr/bin/env node
/**
 * G53 — KB shared-shell usage gate (Phase 3, locks the site-wide KB migration).
 *
 * Every page that adopts the KB design surface (renders the `.kb-root` shell, the
 * scoped-CSS root that turns on kb.css + the SmoothScrollProvider context) MUST
 * also render the shared chrome — <KbNav> (the one coherent top bar + overlay
 * directory) and <KbFooter> (the KB footer block). A page that ships `.kb-root`
 * without both is a half-converted page: it gets KB body styling but loses the
 * nav and/or footer, so a real user lands on a page they can't navigate out of.
 *
 * This is the failure mode the Phase 9 migration kept hitting — an agent restyles
 * a page's body to KB tokens but drops the shell, or a future edit removes KbNav
 * to "fix" a double-chrome symptom (the real fix is HideChrome route coverage,
 * see components/layout/HideOnLP.tsx). All 50 KB pages satisfy this today; the
 * gate freezes that so the convergence can't silently regress.
 *
 * Asserts, for every app/**\/page.tsx that contains `kb-root`:
 *   - it references <KbNav   (the shared top bar)
 *   - it references <KbFooter (the shared footer)
 *
 * Usage: node scripts/check-kb-shared-shell.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'app'

/** Recursively collect every page.tsx under app/. */
function pageFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) pageFiles(full, out)
    else if (name === 'page.tsx') out.push(full)
  }
  return out
}

const fails = []
let kbPages = 0

for (const file of pageFiles(ROOT)) {
  const src = readFileSync(file, 'utf8')
  // A KB page is one that renders the kb-root surface. Match the className token,
  // not a comment mention — the surface is always applied as a class string.
  if (!/kb-root/.test(src)) continue
  kbPages++
  const hasNav = /<KbNav\b/.test(src) || /\bKbNav\b/.test(src)
  const hasFooter = /<KbFooter\b/.test(src) || /\bKbFooter\b/.test(src)
  if (!hasNav) fails.push(`${file} renders .kb-root but does NOT render <KbNav> (the page loses the shared top nav)`)
  if (!hasFooter) fails.push(`${file} renders .kb-root but does NOT render <KbFooter> (the page loses the shared footer)`)
}

if (fails.length) {
  console.error(`\n✗ kb-shared-shell: ${fails.length} KB page(s) missing the shared chrome:\n`)
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  Every page that renders .kb-root MUST also render <KbNav> + <KbFooter>\n' +
      '  (components/site/kb/). A KB body without the shell is a half-converted page —\n' +
      '  restyle in place and keep the shared chrome. If you removed KbNav to stop a\n' +
      '  double-chrome flash, the real fix is HideChrome route coverage, not dropping the nav.\n',
  )
  process.exit(1)
}
console.log(`✓ kb-shared-shell: all ${kbPages} KB page(s) render the shared <KbNav> + <KbFooter> chrome.`)
process.exit(0)
