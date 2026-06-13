#!/usr/bin/env node
/**
 * check-admin-responsive.mjs — the entire admin site stays mobile-first.
 *
 * The shell is locked by check-admin-mobile-shell.mjs. This gate locks the
 * PAGES: it ratchets the count of mobile-hostile patterns inside admin
 * surfaces so new ones can never land (Matt directive 2026-06-13: "the entire
 * admin site responsive, no shortcuts, doesn't regress").
 *
 * Ratchet model (same as design-tokens): the current count is the baseline in
 * scripts/admin-responsive-baseline.json. The gate FAILS if the count rises.
 * Burn the baseline DOWN as pages are fixed; regenerate with --update (requires
 * the count to be <= the stored baseline).
 *
 * High-signal patterns flagged (low false-positive):
 *   1. <table> not wrapped in an overflow-x-auto/scroll/auto container nearby
 *      (the #1 phone-break — a wide table with no horizontal scroll).
 *   2. base grid-cols-N with N>=3 and NO responsive prefix anywhere in the
 *      class string (3+ columns crammed onto a phone).
 *   3. fixed widths >= 700px (w-[NNNpx] / min-w-[NNNpx]) with no responsive
 *      reset (blows past a phone viewport).
 *
 * Usage:  node scripts/check-admin-responsive.mjs            # check (CI)
 *         node scripts/check-admin-responsive.mjs --update   # lower the baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app/admin', 'app/components/admin', 'components/admin']
const BASELINE_PATH = 'scripts/admin-responsive-baseline.json'

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const BREAKPOINT = /(sm|md|lg|xl|2xl):/

function violationsIn(src) {
  const hits = []

  // 1. Unwrapped tables — a <table within 280 chars of an overflow wrapper is OK.
  for (const m of src.matchAll(/<table[\s>]/g)) {
    const before = src.slice(Math.max(0, m.index - 280), m.index)
    if (!/overflow-x-auto|overflow-auto|overflow-x-scroll/.test(before)) {
      hits.push('table-no-overflow')
    }
  }

  // 2. base grid-cols-N (N>=3) with no responsive grid-cols anywhere in the class.
  for (const m of src.matchAll(/className=("|'|`)([^"'`]*)\1/g)) {
    const cls = m[2]
    const baseMulti = /(?:^|\s)grid-cols-([3-9]|1[0-2])(?:\s|$)/.test(cls)
    const hasResponsiveGrid = /(sm|md|lg|xl|2xl):grid-cols-/.test(cls)
    if (baseMulti && !hasResponsiveGrid) hits.push('grid-cols-no-breakpoint')
  }

  // 3. fixed widths >= 700px with no responsive reset on the same element.
  for (const m of src.matchAll(/(?:^|[\s"'`])((?:min-)?w)-\[(\d{3,})px\]/g)) {
    const px = Number(m[2])
    const idx = m.index ?? 0
    const ctx = src.slice(Math.max(0, idx - 60), idx + 60)
    if (px >= 700 && !BREAKPOINT.test(ctx)) hits.push(`fixed-width-${px}`)
  }

  return hits
}

const files = ROOTS.flatMap(walk)
let total = 0
const byFile = {}
for (const f of files) {
  const hits = violationsIn(readFileSync(f, 'utf8'))
  if (hits.length) { byFile[f] = hits.length; total += hits.length }
}

const update = process.argv.includes('--update')
let baseline = { total: Infinity }
try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* first run */ }

if (update) {
  if (Number.isFinite(baseline.total) && total > baseline.total) {
    console.error(`✗ refusing to raise baseline (${baseline.total} → ${total}). Fix pages first.`)
    process.exit(1)
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({ total, files: byFile }, null, 2) + '\n')
  console.log(`✓ admin-responsive baseline set to ${total}`)
  process.exit(0)
}

if (total > baseline.total) {
  console.error(`✗ admin-responsive REGRESSION: ${total} mobile-hostile patterns vs baseline ${baseline.total}.`)
  const worst = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 12)
  for (const [f, n] of worst) console.error(`   ${n}  ${f}`)
  console.error('   Wrap tables in overflow-x-auto, add sm:/lg: to base multi-col grids, drop fixed >=700px widths.')
  process.exit(1)
}

console.log(`✓ admin-responsive OK — ${total} patterns (baseline ${baseline.total === Infinity ? total : baseline.total}); no regression.`)
process.exit(0)
