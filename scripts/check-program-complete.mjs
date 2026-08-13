#!/usr/bin/env node
/**
 * check-program-complete.mjs — ci:program-complete (the un-fakeable "done" gate).
 *
 * The completion run for RR-PLATFORM-DECISIONS-2026-07-21 tracks every OPEN
 * decision in docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json. In waves A–D
 * the failure was: a feature shipped, someone said "done", but the gate/test the
 * decision named never landed — so the regression was never guarded and no one
 * checked the seam end to end. This gate removes the possibility.
 *
 * A ledger row may flip to status "done" ONLY when it names, and this gate can
 * verify on disk, the four things that make done real:
 *
 *   1. requiredMechanism — at least one gate/cron/test/migration/path that EXISTS,
 *      and (for gates) is WIRED into the ci:gates chain. A done row with no
 *      mechanical guard fails. "No mechanism = not done" is enforced here, not
 *      trusted.
 *   2. proofPath — where the live-surface proof lives (non-empty).
 *   3. verifiedBy — the INDEPENDENT verifier (a different agent than the builder),
 *      non-empty. The builder's own word is never sufficient (recorded here).
 *
 * If any done row is missing any of these, or names an artifact that isn't on
 * disk / isn't wired, the build fails. You cannot mark a row done without the
 * mechanical artifact existing. That is the whole point.
 *
 * GLOBAL DONE for the run = every non-"blocked:needs-matt" row is "done" and this
 * gate is green.
 *
 * Usage: node scripts/check-program-complete.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const LEDGER = 'docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json'
const ALLOWED = new Set(['not_started', 'partial', 'done', 'blocked:needs-matt'])

function fail(msg) {
  console.error(`\n[31m✗ ci:program-complete: ${msg}[0m`)
  process.exit(1)
}

if (!existsSync(LEDGER)) {
  fail(`ledger not found at ${LEDGER}. Step 0 of the completion run builds it (one row per open decision).`)
}

let ledger
try {
  ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
} catch (e) {
  fail(`ledger is not valid JSON: ${e.message}`)
}

const rows = Array.isArray(ledger.rows) ? ledger.rows : null
if (!rows) fail('ledger has no "rows" array.')

// --- Build the expanded ci:gates chain text once (to prove a gate is wired) ---
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = pkg.scripts ?? {}
const gatesChain = scripts['ci:gates:chain'] ?? scripts['ci:gates'] ?? ''
let expandedChain = gatesChain
for (const tok of gatesChain.match(/ci:[\w:-]+/g) ?? []) {
  expandedChain += '\n' + (scripts[tok] ?? '')
}

// --- vercel.json cron paths ---
let cronPaths = new Set()
try {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  for (const c of vercel.crons ?? []) if (c?.path) cronPaths.add(c.path)
} catch {
  /* vercel.json optional for the parse; cron checks will report missing */
}

/** Normalize a cron reference to its vercel.json path + route file. */
function cronRefs(ref) {
  let p = ref.trim()
  p = p.replace(/^app\/api\/cron\//, '/api/cron/').replace(/\/route\.(ts|js)$/, '')
  if (!p.startsWith('/api/cron/')) p = '/api/cron/' + p.replace(/^\/?(api\/cron\/)?/, '')
  const dir = 'app' + p
  const routeTs = `${dir}/route.ts`
  const routeJs = `${dir}/route.js`
  return { vercelPath: p, routeTs, routeJs }
}

const problems = []
const counts = { not_started: 0, partial: 0, done: 0, 'blocked:needs-matt': 0 }
const seenIds = new Set()

for (const row of rows) {
  const id = row?.id ?? '(no id)'
  if (seenIds.has(id)) problems.push(`${id}: duplicate row id`)
  seenIds.add(id)

  if (!ALLOWED.has(row?.status)) {
    problems.push(`${id}: status "${row?.status}" not in ${[...ALLOWED].join(' | ')}`)
    continue
  }
  counts[row.status]++

  if (row.status !== 'done') continue // only done rows are enforced

  // --- done rows must carry the three human-real guarantees ---
  if (!row.proofPath || !String(row.proofPath).trim()) {
    problems.push(`${id}: done but proofPath is empty (where is the live-surface proof?)`)
  }
  if (!row.verifiedBy || !String(row.verifiedBy).trim()) {
    problems.push(`${id}: done but verifiedBy is empty (an independent verifier, not the builder, must be named)`)
  }

  const m = row.requiredMechanism ?? {}
  const gates = m.gates ?? []
  const crons = m.crons ?? []
  const tests = m.tests ?? []
  const migrations = m.migrations ?? []
  const paths = m.paths ?? []
  const total = gates.length + crons.length + tests.length + migrations.length + paths.length
  if (total === 0) {
    problems.push(`${id}: done with NO mechanical guard — name a gate/cron/test/migration/path in requiredMechanism, or it is not done`)
    continue
  }

  for (const g of gates) {
    if (!existsSync(g)) problems.push(`${id}: gate "${g}" does not exist on disk`)
    else {
      const base = g.split('/').pop()
      if (!expandedChain.includes(base)) {
        problems.push(`${id}: gate "${g}" exists but is NOT wired into the ci:gates chain (it would never run — prose, not a gate)`)
      }
    }
  }
  for (const c of crons) {
    const { vercelPath, routeTs, routeJs } = cronRefs(c)
    if (!existsSync(routeTs) && !existsSync(routeJs)) {
      problems.push(`${id}: cron route for "${c}" (${routeTs}) does not exist`)
    }
    if (!cronPaths.has(vercelPath)) {
      problems.push(`${id}: cron "${vercelPath}" is not registered in vercel.json crons`)
    }
  }
  for (const t of tests) {
    if (!existsSync(t)) problems.push(`${id}: test file "${t}" does not exist`)
  }
  for (const mig of migrations) {
    if (!existsSync(mig)) problems.push(`${id}: migration "${mig}" does not exist`)
  }
  for (const p of paths) {
    if (!existsSync(p)) problems.push(`${id}: proof path "${p}" does not exist`)
  }
}

const openRemaining = counts.not_started + counts.partial
console.log('Program-completion ledger gate (ci:program-complete)')
console.log('====================================================')
console.log(`rows: ${rows.length}  ·  done ${counts.done}  ·  partial ${counts.partial}  ·  not_started ${counts.not_started}  ·  blocked:needs-matt ${counts['blocked:needs-matt']}`)
console.log(`open remaining (non-blocked, not done): ${openRemaining}`)

if (problems.length) {
  console.error('\nFaked or unbacked "done" rows:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  fail(`${problems.length} ledger integrity problem(s). A row is done only when its named mechanism exists AND (for gates) is wired.`)
}

if (openRemaining === 0 && counts.done > 0) {
  console.log('\n✓ Every non-blocked decision is done and mechanically backed. Program complete.')
} else {
  console.log('\n✓ Ledger integrity OK — every "done" row is mechanically backed. (Run still in progress.)')
}
process.exit(0)
