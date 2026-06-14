#!/usr/bin/env node
/**
 * check-admin-responsive.mjs — the ENTIRE admin site stays mobile-first.
 *
 * Matt directive 2026-06-13 (said more than once): every /admin surface must be
 * mobile-first, no shortcuts, and it must not regress. The shell is locked by
 * check-admin-mobile-shell.mjs; this gate locks the PAGES + admin components.
 *
 * Detects the real phone-break patterns:
 *   1. table-no-mobile-fallback — a <table>/<Table> in a file with NO mobile
 *      alternative (md:hidden card list, hidden md:block table, or overflow-x-auto).
 *      This is the #1 unusable-on-phone failure.
 *   2. grid-cols-no-breakpoint — base grid-cols-N (N>=3) with no sm/md/lg variant
 *      (3+ columns crammed on a 375px screen).
 *   3. fixed-width-NNN — w-[>=480px] / min-w-[>=480px] with no responsive reset
 *      (blows past a phone viewport).
 *
 * Ratchet vs scripts/admin-responsive-baseline.json. Fails on increase.
 *   node scripts/check-admin-responsive.mjs           # CI (compare to baseline)
 *   node scripts/check-admin-responsive.mjs --report   # print offenders, no gate
 *   node scripts/check-admin-responsive.mjs --update    # lower the baseline
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

function violationsIn(src) {
  const hits = []

  // 1. A table with no mobile treatment anywhere in the file.
  if (/<table[\s>]|<Table[\s>]/.test(src)) {
    const hasMobileFallback = /md:hidden|sm:hidden|hidden\s+md:block|hidden\s+sm:block|overflow-x-auto|overflow-auto/.test(src)
    if (!hasMobileFallback) hits.push('table-no-mobile-fallback')
  }

  // 2. base grid-cols-N (N>=3) with no responsive grid-cols in the same class.
  for (const m of src.matchAll(/className=("|'|`)([^"'`]*)\1/g)) {
    const cls = m[2]
    if (/(?:^|\s)grid-cols-([3-9]|1[0-2])(?:\s|$)/.test(cls) && !/(sm|md|lg|xl|2xl):grid-cols-/.test(cls)) {
      hits.push('grid-cols-no-breakpoint')
    }
  }

  // 3. forced widths past a phone with no responsive reset nearby.
  for (const m of src.matchAll(/(?:^|[\s"'`])(min-w|w)-\[(\d{3,})px\]/g)) {
    const px = Number(m[2])
    const idx = m.index ?? 0
    const ctx = src.slice(Math.max(0, idx - 70), idx + 70)
    if (px >= 480 && !/(sm|md|lg|xl|2xl):/.test(ctx)) hits.push(`fixed-width-${px}`)
  }

  return hits
}

const files = ROOTS.flatMap(walk)
let total = 0
const byFile = {}
for (const f of files) {
  const hits = violationsIn(readFileSync(f, 'utf8'))
  if (hits.length) { byFile[f] = hits; total += hits.length }
}

function printBreakdown() {
  const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)
  for (const [f, hits] of sorted) console.error(`   ${String(hits.length).padStart(2)}  ${f}  [${[...new Set(hits)].join(', ')}]`)
}

const report = process.argv.includes('--report')
const update = process.argv.includes('--update')
let baseline = { total: Infinity }
try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* first run */ }

if (report) {
  console.error(`admin-responsive: ${total} mobile-hostile patterns across ${Object.keys(byFile).length} files`)
  printBreakdown()
  process.exit(0)
}

if (update) {
  if (Number.isFinite(baseline.total) && total > baseline.total) {
    console.error(`✗ refusing to raise baseline (${baseline.total} → ${total}). Fix the pages first:`)
    printBreakdown()
    process.exit(1)
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({ total, files: byFile }, null, 2) + '\n')
  console.log(`✓ admin-responsive baseline set to ${total}`)
  process.exit(0)
}

if (total > baseline.total) {
  console.error(`✗ admin-responsive REGRESSION: ${total} mobile-hostile patterns vs baseline ${baseline.total}.`)
  printBreakdown()
  console.error('   Wrap tables with a md:hidden card list (+ hidden md:block table), add sm:/lg: to base grid-cols>=3, drop fixed >=480px widths.')
  process.exit(1)
}

console.log(`✓ admin-responsive OK — ${total} patterns (baseline ${baseline.total === Infinity ? total : baseline.total}); no regression.`)
process.exit(0)
