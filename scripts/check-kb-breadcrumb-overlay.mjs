#!/usr/bin/env node
/**
 * check-kb-breadcrumb-overlay.mjs — every KbBreadcrumb on a dark-hero page uses
 * the navy `overlay` variant.
 *
 * KbBreadcrumb has two looks: the default CREAM bar (navy-on-cream, for light tops)
 * and `overlay` (navy bar, cream text). A page that opens on a dark KbHero must use
 * `overlay` — otherwise the cream bar renders as a white strip stuck above the
 * immersive dark hero (the /housing-market/sisters regression, 2026-06-20). City /
 * community / sell / about already pass it; this gate stops the cream bar from
 * reappearing on any dark-hero page.
 *
 * Rule: in any public page.tsx that renders BOTH <KbHero> and <KbBreadcrumb>, every
 * <KbBreadcrumb ... /> must include the `overlay` prop. Hard fail otherwise.
 *
 * Usage: node scripts/check-kb-breadcrumb-overlay.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP = 'app'
const SKIP_TOP = new Set(['api', 'admin', 'account', 'dashboard', 'marketing'])

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    const st = statSync(f)
    if (st.isDirectory()) {
      if (SKIP_TOP.has(relative(APP, f).split('/')[0])) continue
      walk(f, acc)
    } else if (e === 'page.tsx') {
      acc.push(f)
    }
  }
  return acc
}

const fails = []
for (const f of walk(APP)) {
  const src = readFileSync(f, 'utf8')
  if (!/\bKbHero\b/.test(src)) continue // only dark-hero pages
  if (!/<KbBreadcrumb\b/.test(src)) continue
  // Each <KbBreadcrumb ... /> tag (self-closing; trail props carry no '/>').
  const re = /<KbBreadcrumb\b([\s\S]*?)\/>/g
  let m
  while ((m = re.exec(src)) !== null) {
    if (!/\boverlay\b/.test(m[1])) {
      const line = src.slice(0, m.index).split('\n').length
      fails.push(
        `${f}:${line}  <KbBreadcrumb> on a KbHero (dark) page must pass \`overlay\` — ` +
          `the default cream bar renders as a white strip above the dark hero.`,
      )
    }
  }
}

console.log('KB breadcrumb overlay gate (dark-hero pages)')
console.log('===========================================')
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} dark-hero page(s) render the cream breadcrumb bar:\n`)
  for (const x of fails) console.error('  • ' + x)
  console.error('\nFix: add the `overlay` prop to <KbBreadcrumb> (navy variant), e.g. <KbBreadcrumb overlay trail={[...]} />.')
  process.exit(1)
}
console.log('Every KbBreadcrumb on a dark-hero page uses the navy overlay variant.')
