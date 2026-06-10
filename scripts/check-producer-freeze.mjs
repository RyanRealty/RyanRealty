#!/usr/bin/env node
/**
 * check-producer-freeze.mjs — G45: the producer layer is growth-frozen.
 *
 * Matt directive 2026-06-09: the marketing brain's EXECUTION layer (producer
 * registry + producer-runtime choreography) is frozen at its current
 * footprint — maintenance-only. Rationale: that scaffolding ages with every
 * model generation and had published zero content posts as of the freeze,
 * while the durable spine (Supabase data layer, action-row protocol,
 * approval queue, voice/QA gates) is what compounds. Content is produced
 * in-session via marketing_brain_skills/produce/ — same action row, same
 * approval gate, same measurement.
 *
 * Mechanism: ratchet on the REGISTRY row count. Counts every data row in
 * marketing_brain_skills/producers/REGISTRY.md and fails if a name appears
 * that is not in scripts/producer-freeze-baseline.json. Shrinkage is always
 * allowed. Growth requires Matt's explicit unfreeze in the session
 * transcript, then `npm run ci:producer-freeze:baseline` (cite his approval
 * in the commit message).
 *
 * CLI: default pass/fail · --report (human, exit 0) · --json · --write-baseline
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REGISTRY = 'marketing_brain_skills/producers/REGISTRY.md'
const BASELINE = 'scripts/producer-freeze-baseline.json'

const args = new Set(process.argv.slice(2))
const writeBaseline = args.has('--write-baseline')
const report = args.has('--report')
const asJson = args.has('--json')

// Table-header first cells across the registry's sections — not producers.
const HEADER_CELLS = new Set([
  'producer_name', 'capability', 'capability_name', 'skill', 'skill_name',
  'name', 'trigger', 'pipeline', 'component', 'table', 'path',
])

function registryNames() {
  const md = readFileSync(REGISTRY, 'utf8')
  const names = []
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*([A-Za-z0-9][A-Za-z0-9_-]*)\s*\|/)
    if (!m) continue
    const cell = m[1]
    if (HEADER_CELLS.has(cell.toLowerCase())) continue
    names.push(cell)
  }
  return names.sort()
}

const names = registryNames()

if (writeBaseline) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reason:
          'Producer-layer freeze baseline (Matt directive 2026-06-09, CLAUDE.md "Producer-layer freeze"). ' +
          'The registry is frozen at this footprint; this list only shrinks. Regenerating it requires ' +
          "Matt's explicit unfreeze in the session transcript, cited in the commit message. " +
          'price-drop-digest (added 2026-06-09 by a parallel session, pre-freeze) is grandfathered.',
        count: names.length,
        names,
      },
      null,
      2
    ) + '\n'
  )
  console.log(`producer-freeze baseline written: ${names.length} registry rows`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`Producer-freeze gate FAILED — missing/unreadable ${BASELINE}. Run: npm run ci:producer-freeze:baseline`)
  process.exit(1)
}

const baseSet = new Set(baseline.names ?? [])
const added = names.filter((n) => !baseSet.has(n))
const removed = (baseline.names ?? []).filter((n) => !names.includes(n))

if (asJson) {
  console.log(JSON.stringify({ pass: added.length === 0, count: names.length, baseline: baseline.count, added, removed }))
  process.exit(report || added.length === 0 ? 0 : 1)
}

if (added.length > 0) {
  console.error(
    `Producer-freeze gate FAILED — REGISTRY grew by ${added.length} row(s): ${added.join(', ')}\n` +
      'The producer layer is growth-frozen (Matt directive 2026-06-09 — see CLAUDE.md "Producer-layer freeze").\n' +
      'Content is produced in-session via marketing_brain_skills/produce/ (same action row, same approval gate).\n' +
      'If Matt explicitly approved a new producer in this session, regenerate the baseline with\n' +
      '`npm run ci:producer-freeze:baseline` and cite his approval in the commit message.'
  )
  process.exit(report ? 0 : 1)
}

console.log(
  `Producer-freeze gate passed — registry at ${names.length} rows (baseline ${baseline.count}` +
    `${removed.length ? `, ${removed.length} removed since baseline` : ''}); growth blocked, shrinkage free.`
)
