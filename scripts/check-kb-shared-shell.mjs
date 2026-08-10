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
 *   1. app/layout.tsx mounts PublicNav (or KbNav) as the single public header
 *   2. Every KB page.tsx with .kb-root in code references KbFooter
 *   3. No kb-root page re-mounts page-level KbNav (layout owns it)
 *
 * Usage: node scripts/check-kb-shared-shell.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'app'
const LAYOUT = join(ROOT, 'layout.tsx')

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
if (!/<PublicNav\b/.test(layoutSrc) && !/<KbNav\b/.test(layoutSrc)) {
  fails.push(
    `${LAYOUT} must mount <PublicNav /> (or <KbNav />) — the single public header`,
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
  const src = readFileSync(file, 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (!/kb-root/.test(code)) continue
  kbPages++
  const hasFooter = /<KbFooter\b/.test(src) || /\bKbFooter\b/.test(code)
  if (!hasFooter) {
    fails.push(
      `${file} renders .kb-root but does NOT render <KbFooter> (shared footer required)`,
    )
  }
  if (/<KbNav\b/.test(code)) {
    fails.push(
      `${file} re-mounts <KbNav> — remove it; root layout PublicNav owns the top bar`,
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
  `✓ kb-shared-shell: layout owns PublicNav; all ${kbPages} KB page(s) keep <KbFooter> and do not re-mount KbNav.`,
)
process.exit(0)
