#!/usr/bin/env node
/**
 * check-delta-sync-single-core.mjs — anti-fork gate for the MLS delta sync.
 *
 * Audit #1b: the delta-sync fetch->diff->upsert->finalize logic forked into two
 * lanes (app/actions/sync-spark.ts + app/api/cron/sync-delta/route.ts) that
 * drifted on tuning constants and the event/finalize matrix. The unified core
 * lives in lib/sync/deltaSync.ts.
 *
 * A delta-sync implementation is detected by its CALL to computeNextDeltaCursor
 * (lib/sync/deltaCursor.ts) — the cursor-safety primitive every delta lane must
 * use to advance sync_state.last_delta_sync_at without losing data. This gate
 * allowlists the files permitted to call it. The allowlist is RATCHETED: it may
 * only SHRINK. A NEW file calling the primitive is a re-fork and fails CI.
 *
 * Migration state: baseline currently allows 3 (the two live lanes + the new
 * dormant core). After the shadow-run cutover the two lanes become thin wrappers
 * that no longer call the primitive directly; re-baseline down to just
 * lib/sync/deltaSync.ts. See docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md.
 *
 * Usage:
 *   node scripts/check-delta-sync-single-core.mjs              # CI mode
 *   node scripts/check-delta-sync-single-core.mjs --report     # never exits 1
 *   node scripts/check-delta-sync-single-core.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/delta-sync-core-baseline.json')
const SCAN_DIRS = ['app', 'lib']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '.claude'])
// The primitive's own definition file is not a caller.
const DEFINITION_FILE = 'lib/sync/deltaCursor.ts'
const CALL_RE = /computeNextDeltaCursor\s*\(/

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const WRITE_BASELINE = args.has('--write-baseline')

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, acc)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

function findCallers() {
  const callers = []
  for (const d of SCAN_DIRS) {
    for (const file of walk(join(ROOT, d))) {
      const rel = relative(ROOT, file)
      if (rel === DEFINITION_FILE) continue
      const src = readFileSync(file, 'utf8')
      if (CALL_RE.test(src)) callers.push(rel)
    }
  }
  return callers.sort()
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

function main() {
  const callers = findCallers()

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason:
        'Audit #1b anti-fork: files permitted to call computeNextDeltaCursor (a delta-sync core). Ratchet — may only SHRINK. Target after cutover: 1 (lib/sync/deltaSync.ts).',
      total: callers.length,
      allowlist: callers,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`Wrote delta-sync core baseline: ${callers.length} allowed caller(s).`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const allow = new Set(baseline?.allowlist ?? [])
  const newForks = callers.filter((c) => !allow.has(c))
  const removed = [...allow].filter((c) => !callers.includes(c))

  console.log('delta-sync single-core check (anti-fork, ratcheted)')
  console.log('===================================================')
  console.log(`  Files calling computeNextDeltaCursor: ${callers.length}`)
  console.log(`  Baseline allowlist:                   ${allow.size}`)
  console.log(`  NEW forks (CI BLOCKER):               ${newForks.length}`)
  console.log(`  Removed since baseline:               ${removed.length}`)
  if (newForks.length > 0) {
    console.log('\nNEW delta-sync implementations (these fail CI):')
    for (const f of newForks) console.log(`  ${f}`)
    console.log('\nThe delta-sync core lives in lib/sync/deltaSync.ts. Do not fork a new')
    console.log('fetch->diff->upsert->finalize lane. See docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md.')
  }
  if (removed.length > 0) {
    console.log('\nAllowed callers that no longer call it (re-baseline to lock the shrink):')
    for (const f of removed) console.log(`  ${f}`)
  }
  if (!baseline) {
    console.log('\nNo baseline found — run --write-baseline.')
    process.exit(1)
  }
  if (REPORT) process.exit(0)
  process.exit(newForks.length === 0 ? 0 : 1)
}

main()
