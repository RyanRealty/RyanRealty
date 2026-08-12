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
 * Rule: in any public page.tsx that renders a dark opening and that register's
 * breadcrumb, every breadcrumb tag must use the on-dark variant. Hard fail
 * otherwise. KB spells the pairing KbHero + KbBreadcrumb `overlay`; the v3
 * register spells the same pairing V3Stage + V3Breadcrumb `tone="on-media"`.
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

/**
 * The defect is a CLASS, not a KB implementation detail, so the predicates name
 * both registers. V3Stage is the v3 dark opening (full-bleed media under an
 * overlayStrength scrim) and V3Breadcrumb is the v3 trail, whose on-dark variant
 * is `tone="on-media"`. Migrating a page out of KB would otherwise take it out of
 * this gate's scope with no edit and no failure, which unships the protection
 * silently. docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.3.
 */
const REGISTERS = [
  {
    hero: /\bKbHero\b/,
    tag: /<KbBreadcrumb\b([\s\S]*?)\/>/g,
    onDark: /\boverlay\b/,
    name: '<KbBreadcrumb>',
    heroName: 'KbHero',
    fix: 'add the `overlay` prop (navy variant), e.g. <KbBreadcrumb overlay trail={[...]} />',
  },
  {
    hero: /<V3Stage\b/,
    tag: /<V3Breadcrumb\b([\s\S]*?)\/>/g,
    onDark: /tone\s*=\s*["']on-media["']/,
    name: '<V3Breadcrumb>',
    heroName: 'V3Stage',
    fix: 'pass tone="on-media", e.g. <V3Breadcrumb tone="on-media" trail={[...]} />',
  },
]

const fails = []
for (const f of walk(APP)) {
  const src = readFileSync(f, 'utf8')
  for (const reg of REGISTERS) {
    if (!reg.hero.test(src)) continue // only dark-opening pages
    reg.tag.lastIndex = 0
    let m
    while ((m = reg.tag.exec(src)) !== null) {
      if (reg.onDark.test(m[1])) continue
      const line = src.slice(0, m.index).split('\n').length
      fails.push(
        `${f}:${line}  ${reg.name} on a ${reg.heroName} (dark) page must use the on-dark variant — ` +
          `the default cream bar renders as a white strip above the dark hero. Fix: ${reg.fix}.`,
      )
    }
  }
}

console.log('KB breadcrumb overlay gate (dark-hero pages)')
console.log('===========================================')
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} dark-hero page(s) render the cream breadcrumb bar:\n`)
  for (const x of fails) console.error('  • ' + x)
  console.error('\nEach failure above names the fix for its own register.')
  process.exit(1)
}
console.log('Every KbBreadcrumb on a dark-hero page uses the navy overlay variant.')
