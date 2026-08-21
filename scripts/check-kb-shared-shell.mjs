#!/usr/bin/env node
/**
 * G53 — KB shared-shell usage gate (Phase 3 + 2026-08-10 dual-chrome kill).
 *
 * Every page that adopts the KB design surface (`.kb-root`) MUST render
 * <KbFooter>. Top nav is global: app/layout.tsx mounts <PublicNav /> → KbNav
 * (Buy · Areas · Market · Sell · About from lib/site-nav.ts). Pages must NOT
 * re-mount KbNav (double chrome).
 *
 * Asserts:
 *   1. app/layout.tsx mounts exactly one public header (PublicNav, KbNav, or the
 *      v3 register's V3Chrome)
 *   2. Every page.tsx that opens a register's token scope references that
 *      register's footer: .kb-root pairs with KbFooter, V3_ROOT_CLASS with V3Footer
 *   3. No such page re-mounts the header itself (layout owns it)
 *
 * Usage: node scripts/check-kb-shared-shell.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const ROOT = 'app'
const LAYOUT = join(ROOT, 'layout.tsx')

/**
 * Line comments first, block comments second. A glob like `@/app/actions/*` inside
 * a `//` comment carries the literal `/*`; stripping block comments first opens a
 * phantom comment there that runs to the next block-comment close and swallows the
 * body of the file, which drops the page out of this gate's scope entirely. Four
 * pages were invisible to G52 and G53 that way, three of them the flagship market
 * routes (found 2026-08-12, docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 2.1).
 */
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
}

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

// ── 1. Root layout owns public nav ───────────────────────────────────────────
let layoutSrc
try {
  layoutSrc = readFileSync(LAYOUT, 'utf8')
} catch (e) {
  console.error(`✗ kb-shared-shell: cannot read ${LAYOUT}: ${e.message}`)
  process.exit(1)
}
// V3Chrome is the v3-era public header (components/site/v3/V3Chrome.tsx), the
// destination register for the P9 roll. The assertion is EXACTLY ONE header, not
// one particular implementation, so the swap does not have to happen behind a
// failing gate. Ban on SiteHeader below is unchanged.
if (!/<PublicNav\b/.test(layoutSrc) && !/<KbNav\b/.test(layoutSrc) && !/<V3Chrome\b/.test(layoutSrc)) {
  fails.push(
    `${LAYOUT} must mount exactly one public header (<PublicNav />, <KbNav />, or <V3Chrome />)`,
  )
}
if (/<SiteHeader\b/.test(layoutSrc)) {
  fails.push(
    `${LAYOUT} still mounts <SiteHeader /> — dual chrome is retired (use PublicNav only)`,
  )
}

// ── 2–3. KB pages: footer required; no page-level KbNav ──────────────────────
let kbPages = 0
for (const file of pageFiles(ROOT)) {
  // Dev prototypes are noindex, unlinked, and carry their own chrome by
  // definition, the same exclusion ci:default-chrome-footer and ci:public-ui make.
  if (file.startsWith(join(ROOT, 'dev') + sep)) continue
  const src = readFileSync(file, 'utf8')
  const code = stripComments(src)
  const isV3 = /\bV3_ROOT_CLASS\b/.test(code)
  if (!/kb-root/.test(code) && !isV3) continue
  kbPages++
  // Each register satisfies rule 2 with its own footer. A v3 page carries
  // <V3Footer>; ci:default-chrome-footer enforces the same fact from the other
  // side (docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.7).
  const hasFooter = isV3
    ? /<V3Footer\b/.test(src) || /\bV3Footer\b/.test(code)
    : /<KbFooter\b/.test(src) || /\bKbFooter\b/.test(code) || /<HoodDFooter\b/.test(src) || /<CityDFooter\b/.test(src) || /<HomeDFooter\b/.test(src)
  if (!hasFooter) {
    fails.push(
      isV3
        ? `${file} opens the v3 token scope but does NOT render <V3Footer> (shared footer required)`
        : `${file} renders .kb-root but does NOT render <KbFooter>, <HoodDFooter>, <CityDFooter>, or <HomeDFooter> (shared footer required)`,
    )
  }
  if (/<KbNav\b/.test(code) || /<V3Chrome\b/.test(code)) {
    fails.push(
      `${file} re-mounts the public header — remove it; app/layout.tsx owns the top bar`,
    )
  }
}

if (fails.length) {
  console.error(`\n✗ kb-shared-shell: ${fails.length} failure(s):\n`)
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  Dual-chrome kill (2026-08-10): one PublicNav in app/layout.tsx;\n' +
      '  every .kb-root page keeps <KbFooter> only. Do not bring SiteHeader back.\n',
  )
  process.exit(1)
}
console.log(
  `✓ kb-shared-shell: layout owns the public header; all ${kbPages} KB/v3 page(s) keep their register footer and do not re-mount the header.`,
)
process.exit(0)
