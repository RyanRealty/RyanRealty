#!/usr/bin/env node
/**
 * check-rubric-freeze.mjs — the accept test does not move mid-round.
 *
 * Matt 2026-09-12 ("fix it all"): between 2026-09-08 and 2026-09-12 the site
 * queue's ruler changed four times (rubric -08 -> -10 -> -12, demoMatch
 * required, competitiveBriefPass required, judge pinned). Every change
 * rebaselined every class, so no page was ever measured as better. A loop
 * that keeps re-zeroing its own ruler cannot show progress.
 *
 * This gate reads design_system/public/taste-rule-freeze.json and fails when:
 *   - the live constants in scripts/lib/taste-evaluate-result.mjs,
 *     taste-receipt.mjs and taste-table-core.mjs drift from it;
 *   - a taste-evaluator.v*.md newer than the frozen rubric exists;
 *   - a class in taste-classes.json has no taste-table.json row on the frozen
 *     rubric from a judge on the chain, with an integer median.
 *
 * To change a rule: edit the manifest AND re-run the whole table in the same
 * change (`node scripts/taste-table.mjs https://ryan-realty.com`). A known
 * capture failure goes in manifest.coverageExceptions with a reason, dated.
 *
 * Wired as ci:rubric-freeze.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALLOWED_EVALUATORS,
  EVALUATOR_MODEL,
  RUBRIC_PATH,
  RUBRIC_VERSION,
} from './lib/taste-evaluate-result.mjs'
import {
  COMPETITIVE_BRIEF_RULE_FROM,
  DEMO_MATCH_RUBRIC,
  DEMO_MATCH_RULE_FROM,
  FINISH_LINE,
  RECEIPT_V2_FROM,
  RISE_FLOOR,
  RISE_FLOOR_FROM,
} from './lib/taste-receipt.mjs'
import { FINISH_LINE as TABLE_FINISH_LINE } from './lib/taste-table-core.mjs'
import { rubricFreezeProblems } from './lib/rubric-freeze.mjs'

const ROOT = process.cwd()
const MANIFEST = 'design_system/public/taste-rule-freeze.json'
const PUBLIC_DIR = 'design_system/public'

function readJson(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return { error: `${rel} is missing` }
  try {
    return { value: JSON.parse(readFileSync(abs, 'utf8')) }
  } catch (err) {
    return { error: `${rel} is malformed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

console.log('rubric freeze (ci:rubric-freeze)')
console.log('================================')

const manifestRead = readJson(MANIFEST)
if (manifestRead.error) {
  console.log(`  - ${manifestRead.error}`)
  process.exit(1)
}
const manifest = manifestRead.value

const registryRead = readJson(manifest.classRegistry ?? 'design_system/public/taste-classes.json')
const tableRead = readJson(manifest.table ?? 'design_system/public/taste-table.json')
const ioProblems = [registryRead.error, tableRead.error].filter(Boolean)
if (typeof manifest.rubricPath === 'string' && !existsSync(join(ROOT, manifest.rubricPath))) {
  ioProblems.push(`${manifest.rubricPath} (manifest.rubricPath) does not exist`)
}

const { shape, drift, stray, coverage } = rubricFreezeProblems({
  manifest,
  live: {
    rubricVersion: RUBRIC_VERSION,
    rubricPath: RUBRIC_PATH,
    finishLine: FINISH_LINE,
    tableFinishLine: TABLE_FINISH_LINE,
    primaryEvaluator: EVALUATOR_MODEL,
    allowedEvaluators: [...ALLOWED_EVALUATORS],
    receiptV2From: RECEIPT_V2_FROM,
    demoMatchRuleFrom: DEMO_MATCH_RULE_FROM,
    demoMatchRubric: DEMO_MATCH_RUBRIC,
    competitiveBriefRuleFrom: COMPETITIVE_BRIEF_RULE_FROM,
    riseFloor: RISE_FLOOR,
    riseFloorFrom: RISE_FLOOR_FROM,
  },
  rubricFiles: existsSync(join(ROOT, PUBLIC_DIR)) ? readdirSync(join(ROOT, PUBLIC_DIR)) : [],
  registryClasses: registryRead.value?.classes ?? [],
  table: tableRead.value ?? null,
})

const total = ioProblems.length + shape.length + drift.length + stray.length + coverage.length
console.log(`frozen rubric ${manifest.rubricVersion} since ${manifest.frozenAt}; judge chain ${(manifest.allowedEvaluators ?? []).join(' -> ')}.`)
if (total === 0) {
  console.log(`OK - code matches the freeze and every class in the registry is scored on it.`)
  process.exit(0)
}

console.log(`\n${total} violation(s):`)
for (const p of [...ioProblems, ...shape]) console.log(`  - ${p}`)
if (drift.length) {
  console.log('\n  RULE DRIFT — the code moved the ruler without re-freezing:')
  for (const p of drift) console.log(`    - ${p}`)
}
if (stray.length) {
  console.log('\n  STRAY RUBRIC:')
  for (const p of stray) console.log(`    - ${p}`)
}
if (coverage.length) {
  console.log(`\n  COVERAGE — classes not scored on ${manifest.rubricVersion} by a judge on the chain:`)
  for (const p of coverage) console.log(`    - ${p}`)
  const keys = [...new Set(coverage.map((p) => p.split(':')[0]))].join(',')
  console.log(`\n  Re-run: node scripts/taste-table.mjs https://ryan-realty.com --classes ${keys}`)
}
console.log(
  '\nThe rule set is frozen for the round. To change it: edit design_system/public/taste-rule-freeze.json AND re-run the whole table in the same change. A rule bump without a full table is a reset with no measurement.',
)
process.exit(1)
