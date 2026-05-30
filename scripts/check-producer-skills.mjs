#!/usr/bin/env node
/**
 * check-producer-skills.mjs  —  G35 (producer SKILL.md structural gate)
 *
 * Runs the producer validator (scripts/validate-producer.mjs) across EVERY
 * producer SKILL.md in the three producer-bearing roots and fails the build
 * if any real (non-capability) producer does not PASS.
 *
 * This is the "enforcement over audits" companion to validate-producer.mjs:
 * the per-file validator already existed, but nothing ran it across the whole
 * tree, so producers could (and did) silently drift out of compliance. This
 * gate closes that loop. Wired into `npm run ci:gates`.
 *
 * Gates enforced per producer (see validate-producer.mjs for the definitions):
 *   1  all 11 numbered sections present
 *   2  frontmatter complete (13 required fields)
 *   3  action_types match REGISTRY.md row
 *   4  all 8 mandatory base references cited
 *   5  content producers cite the 4 additional references
 *   6  zero em-dashes / en-dashes / horizontal bars
 *   9  target_platforms use only the canonical enum
 *   10 **Status:** present and valid (Canonical | Draft | Deprecated)
 * (Gates 7 + 8 are warnings only and never block.)
 *
 * Capability skills and brain components (validate-producer.mjs's
 * CAPABILITY_AND_BRAIN_PATHS set) are skipped by design.
 *
 * Usage:
 *   node scripts/check-producer-skills.mjs            # CI mode — exit 1 on any FAIL
 *   node scripts/check-producer-skills.mjs --report   # status report — never exits 1
 *
 * Exit 0 = every real producer passes. Exit 1 = at least one FAIL.
 */

import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGates } from './validate-producer.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const REPORT_ONLY = process.argv.slice(2).includes('--report')

// Roots that contain brain-callable producers. (automation_skills + the brain
// component skills live elsewhere and are not 11-section producers.)
const PRODUCER_ROOTS = [
  'marketing_brain_skills/producers',
  'social_media_skills',
  'video_production_skills',
]

function findSkillFiles(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) findSkillFiles(p, acc)
    else if (entry === 'SKILL.md') acc.push(p)
  }
  return acc
}

const files = []
for (const root of PRODUCER_ROOTS) {
  const abs = join(REPO_ROOT, root)
  if (existsSync(abs)) findSkillFiles(abs, files)
}
files.sort()

let pass = 0
let skip = 0
const failures = []

for (const f of files) {
  const result = runGates(f)
  const skipped = result.warnings?.some((w) => w.gate === 'capability_skipped')
  if (skipped) {
    skip++
  } else if (result.pass) {
    pass++
  } else {
    failures.push({
      file: relative(REPO_ROOT, f),
      gates: result.failures.map((x) => x.gate),
      detail: result.failures.map((x) => `      - ${x.gate}: ${x.message}`).join('\n'),
    })
  }
}

console.log('Producer SKILL.md structural gate (G35)')
console.log('=======================================')
console.log(
  `Scanned ${files.length} SKILL.md  ·  PASS ${pass}  ·  Skipped (capability/brain) ${skip}  ·  FAIL ${failures.length}`,
)

if (failures.length > 0) {
  console.log('')
  for (const fail of failures) {
    console.log(`  FAIL  ${fail.file}  [${fail.gates.join(', ')}]`)
    console.log(fail.detail)
  }
  console.error('')
  if (REPORT_ONLY) {
    console.error('(--report mode: not failing the build.)')
    process.exit(0)
  }
  console.error('Producer SKILL.md gate FAILED.')
  console.error('')
  console.error(
    'Every producer SKILL.md must pass scripts/validate-producer.mjs. Fix the gates above, or — if the file is a capability/reference skill, not a brain-callable producer — add its path to CAPABILITY_AND_BRAIN_PATHS in scripts/validate-producer.mjs.',
  )
  console.error('Re-run a single file for detail:  node scripts/validate-producer.mjs <path-to-SKILL.md>')
  process.exit(1)
}

console.log('')
console.log('All producers pass.')
process.exit(0)
