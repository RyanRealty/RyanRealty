#!/usr/bin/env node
/**
 * check-admin-curation.mjs — mechanically enforce "curate, never dump" (the
 * core rule of docs/ADMIN_DESIGN_STANDARD.md) so a data-wall admin screen can't
 * merge. This is the teeth the standard doc doesn't have on its own.
 *
 * Signal: a server-fetched collection rendered straight into the DOM uncapped —
 * `data.<collection>.map(` with NO .slice()/cap in between. A curated screen
 * writes `data.things.slice(0, 6).map(` (then "See all") or paginates; that form
 * has receiver `data.things.slice(...)`, which this pattern does NOT match. So
 * capping a list is exactly what clears the gate.
 *
 * Ratchet vs scripts/admin-curation-baseline.json — fails on any INCREASE.
 * Burn the baseline down as pages are curated; it must only ever drop.
 *   node scripts/check-admin-curation.mjs            # CI
 *   node scripts/check-admin-curation.mjs --report    # list offenders
 *   node scripts/check-admin-curation.mjs --update     # lower the baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app/admin', 'app/components/admin', 'components/admin']
const BASELINE_PATH = 'scripts/admin-curation-baseline.json'

// data.<member>.map(  — an uncapped render of fetched data. A .slice()/cap before
// .map() changes the receiver so it no longer matches: that is the intended fix.
const DUMP = /\bdata\.[A-Za-z_]\w*\.map\(/g

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

let total = 0
const byFile = {}
for (const f of ROOTS.flatMap(walk)) {
  const hits = (readFileSync(f, 'utf8').match(DUMP) ?? [])
  if (hits.length) { byFile[f] = hits.length; total += hits.length }
}

function printBreakdown() {
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.error(`   ${String(n).padStart(2)}  ${f}`)
}

const report = process.argv.includes('--report')
const update = process.argv.includes('--update')
let baseline = { total: Infinity }
try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* first run */ }

if (report) {
  console.error(`admin-curation: ${total} uncapped data dumps across ${Object.keys(byFile).length} files`)
  printBreakdown()
  process.exit(0)
}
if (update) {
  if (Number.isFinite(baseline.total) && total > baseline.total) {
    console.error(`✗ refusing to raise baseline (${baseline.total} → ${total}). Cap the lists first:`)
    printBreakdown()
    process.exit(1)
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({ total, files: byFile }, null, 2) + '\n')
  console.log(`✓ admin-curation baseline set to ${total}`)
  process.exit(0)
}
if (total > baseline.total) {
  console.error(`✗ admin-curation REGRESSION: ${total} uncapped data dumps vs baseline ${baseline.total}.`)
  printBreakdown()
  console.error('   Cap the list: data.things.slice(0, 6).map(...) + a "See all" link, or paginate.')
  process.exit(1)
}
console.log(`✓ admin-curation OK — ${total} uncapped data maps (baseline ${baseline.total === Infinity ? total : baseline.total}); no regression.`)
process.exit(0)
