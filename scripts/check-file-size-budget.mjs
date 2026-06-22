#!/usr/bin/env node
/**
 * check-file-size-budget.mjs (ci:file-size-budget) — audit p2.2 (safe slice).
 *
 * Audit 2.2 wants three god-files split (lib/data/index.ts 594 LOC / 132 exports,
 * lib/data/sync/syncWrites.ts 1,106, app/actions/listings.ts 2,670) and barrel
 * fan-out capped. The actual splits cross the RSC client/server boundary and the
 * 'use server' action manifest — verifiable only by `next build` — so they are
 * the deferred large-refactor remainder.
 *
 * This gate is the safe, no-code-touch half: a RATCHET that freezes the finding
 * so it cannot drift worse while the real split waits. It moves no product code.
 *
 * Two rules, both "may only shrink":
 *   1. LINE BUDGET — every app/ + lib/ source file currently >= FLOOR lines is
 *      baselined at its current size and may not GROW past it; and no NEW file
 *      may cross FLOOR (no new god-file).
 *   2. BARREL BUDGET — tracked re-export barrels (lib/data/index.ts) may not GROW
 *      their export-statement count. This pins the named 594-LOC barrel even
 *      though it sits just under the line FLOOR.
 *
 * Usage:
 *   node scripts/check-file-size-budget.mjs                  # check vs baseline
 *   node scripts/check-file-size-budget.mjs --report         # human report
 *   node scripts/check-file-size-budget.mjs --write-baseline # record current
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { walkFiles } from './lib/walk.mjs'

const __filename = fileURLToPath(import.meta.url)
const BASELINE = 'scripts/file-size-budget-baseline.json'
const FLOOR = 600
const BARRELS = ['lib/data/index.ts']

// Pure counters (exported for the unit test).
export function countLoc(content) {
  return content.split('\n').length
}
export function countExports(content) {
  return (content.match(/^\s*export\b/gm) || []).length
}

function scan() {
  const files = {}
  for (const f of walkFiles('app').concat(walkFiles('lib'))) {
    if (/\.test\.(ts|tsx)$/.test(f)) continue
    const n = countLoc(readFileSync(f, 'utf8'))
    if (n >= FLOOR) files[f] = n
  }
  const barrels = {}
  for (const b of BARRELS) if (existsSync(b)) barrels[b] = countExports(readFileSync(b, 'utf8'))
  return { files, barrels }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const { files, barrels } = scan()

  if (args.includes('--write-baseline')) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note: `app/ + lib/ source files >= ${FLOOR} LOC (frozen at current size; no new file may cross the floor) + tracked barrel export counts. All values may only SHRINK. Regenerate with --write-baseline. This freezes the audit p2.2 god-files in place; the actual splits are the deferred next-build remainder.`,
          floor: FLOOR,
          files,
          barrels,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`✓ Baseline written: ${Object.keys(files).length} files >= ${FLOOR} LOC + ${Object.keys(barrels).length} barrel(s) → ${BASELINE}`)
    process.exit(0)
  }

  if (args.includes('--report')) {
    console.log(`file-size budget — ${Object.keys(files).length} files >= ${FLOOR} LOC\n`)
    for (const [f, n] of Object.entries(files).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`  ${String(n).padStart(5)} ${f}`)
    }
    for (const [b, n] of Object.entries(barrels)) console.log(`  barrel ${b}: ${n} exports`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline at ' + BASELINE)
    console.error('  Run: node scripts/check-file-size-budget.mjs --write-baseline')
    process.exit(2)
  }

  const failures = []
  for (const [f, n] of Object.entries(files)) {
    const was = baseline.files?.[f]
    if (was === undefined) failures.push(`NEW file >= ${FLOOR} LOC: ${f} (${n})`)
    else if (n > was) failures.push(`${f} grew: ${n} (baseline ${was}) — +${n - was}`)
  }
  for (const [b, n] of Object.entries(barrels)) {
    const was = baseline.barrels?.[b]
    if (was !== undefined && n > was) failures.push(`barrel ${b} grew: ${n} exports (baseline ${was}) — +${n - was}`)
  }

  console.log('file-size budget (ci:file-size-budget)')
  console.log('======================================')
  if (failures.length) {
    console.error(`✗ ${failures.length} budget breach(es):`)
    for (const m of failures) console.error(`  ${m}`)
    console.error('')
    console.error('Split the file / shrink the barrel instead of growing it (audit p2.2).')
    console.error('If the growth is genuinely unavoidable, re-baseline with --write-baseline.')
    process.exit(1)
  }
  console.log(`✓ OK — ${Object.keys(files).length} large files + ${Object.keys(barrels).length} barrel(s) within budget (none grew, no new god-file).`)
  process.exit(0)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
