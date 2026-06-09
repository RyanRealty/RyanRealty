#!/usr/bin/env node
/**
 * check-process-canon.mjs — G44: THE LOOP stays the single canonical process.
 *
 * docs/DEVELOPMENT_PROCESS.md is the versioned source of truth for how all
 * development happens (the ingest->diagnose->prioritize->fix->verify->ship->
 * measure->learn->lock->compete cycle). Three failure modes would quietly
 * dissolve it back into scattered plans, so this gate fails the build on:
 *
 *   1. POINTER LOSS — an entry point every agent loads (CLAUDE.md, the
 *      producer TEMPLATE, the cron system-prompt builder) no longer points at
 *      docs/DEVELOPMENT_PROCESS.md.
 *   2. VERSION DRIFT — a pointer's "THE LOOP vX.Y.Z" version differs from the
 *      doc's own "**Version: X.Y.Z**" header (the doc changed but its
 *      consumers were not re-verified).
 *   3. ROGUE PLANS — a new .md lands in docs/plans/ without being registered
 *      in the canon's "Registered plan documents" table. Plans are inputs to
 *      THE LOOP, not parallel processes.
 *
 * Usage: node scripts/check-process-canon.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const CANON = 'docs/DEVELOPMENT_PROCESS.md'

const ENTRY_POINTS = [
  'CLAUDE.md',
  'marketing_brain_skills/producers/TEMPLATE.md',
  'lib/marketing-brain/producer-output-class.ts',
]

const fails = []

if (!existsSync(CANON)) {
  console.error(`FAIL: ${CANON} does not exist — the canonical process doc was deleted.`)
  process.exit(1)
}

const canon = readFileSync(CANON, 'utf8')
const verMatch = canon.match(/\*\*Version:\s*(\d+\.\d+\.\d+)\*\*/)
if (!verMatch) fails.push(`${CANON}: missing the "**Version: X.Y.Z**" header`)
const version = verMatch?.[1]

for (const ep of ENTRY_POINTS) {
  if (!existsSync(ep)) {
    fails.push(`entry point missing from disk: ${ep}`)
    continue
  }
  const src = readFileSync(ep, 'utf8')
  if (!src.includes('docs/DEVELOPMENT_PROCESS.md')) {
    fails.push(`${ep}: no pointer to docs/DEVELOPMENT_PROCESS.md`)
    continue
  }
  const pv = src.match(/THE LOOP v(\d+\.\d+\.\d+)/)
  if (!pv) {
    fails.push(`${ep}: pointer lacks a "THE LOOP vX.Y.Z" version marker`)
  } else if (version && pv[1] !== version) {
    fails.push(`${ep}: points at THE LOOP v${pv[1]} but the canon is v${version} — update the pointer in the same commit as the canon change`)
  }
}

// Rogue-plan check: every docs/plans/*.md basename must appear in the canon.
let planFiles = []
try {
  planFiles = readdirSync('docs/plans').filter((f) => f.endsWith('.md'))
} catch { /* no plans dir */ }
for (const f of planFiles) {
  if (!canon.includes(f)) {
    fails.push(`docs/plans/${f} is not registered in ${CANON} "Registered plan documents" — add a row (status: open input / record / archive) or do not create rogue plan docs`)
  }
}

console.log('Process-canon sync check (G44)')
console.log('==============================')
console.log(`Canon version: v${version ?? '?'} · entry points: ${ENTRY_POINTS.length} · plan docs: ${planFiles.length}`)
if (fails.length === 0) {
  console.log('THE LOOP canon, pointers, and plan registry are in sync.')
  process.exit(0)
}
console.log()
for (const f of fails) console.log('FAIL  ' + f)
process.exit(1)
