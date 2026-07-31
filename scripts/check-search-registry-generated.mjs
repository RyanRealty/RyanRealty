#!/usr/bin/env node
/**
 * check-search-registry-generated.mjs — ci:search-registry-generated.
 * SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30 §11.2, P1 gate.
 *
 * The decision: the search field registry stops being a hand-maintained list
 * whose completeness depends on someone's diligence. Every registry field must
 * trace to the MLS's own field metadata (or be explicitly declared derived in
 * the curation layer, with a reason), every registry option must exist in the
 * metadata vocabulary or carry a curation-allowlist entry, and the mask-dead
 * fields removed by the 2026-07-30 accuracy audit can never quietly return.
 * This is the gate class that would have caught PropertySubType never shipping
 * and specialConditions shipping 4 of its 13 real values.
 *
 * What it does: re-derives the registry↔metadata comparison from the three
 * committed artifacts and FAILS on:
 *
 *   (a) UNMAPPED    — a registry field that maps to no metadata concept and has
 *                     no curation source / derived-with-reason entry.
 *   (b) UNEXPLAINED — a registry option (or boolean viaValue target) absent
 *                     from BOTH the metadata value set and the curation
 *                     allowlist (data/search-metadata/curation.json).
 *   (c) EXCLUSION   — a mask-dead field (the 10 removed 2026-07-30 + laundry-
 *                     Features, 2026-07-29) reappearing by registry key, mapped
 *                     concept, or MV column.
 *   (d) DRIFT       — data/search-metadata/registry-report.json does not
 *                     reproduce byte-for-byte from snapshot + curation +
 *                     registry (someone edited one side without regenerating).
 *
 * Inputs (ALL static, committed — no network, no DB, no secrets, so this runs
 * in the ci:gates chain):
 *   - lib/search/field-registry.ts            (parsed via the TypeScript AST —
 *     repo rule: code-inspecting gates use AST, never regex)
 *   - data/search-metadata/spark-metadata.snapshot.json
 *   - data/search-metadata/curation.json
 *   - data/search-metadata/registry-report.json
 *
 * Fix on failure: adjust the registry or curation.json (every entry needs a
 * reason), then `node scripts/generate-search-registry.mjs` and commit the
 * regenerated report. Refreshing the snapshot itself requires the raw Spark
 * pulls: `node scripts/generate-search-registry.mjs --input data/search-metadata/raw`.
 *
 * Exit: 0 = registry fully explained by metadata + curation and report is
 * current. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  SNAPSHOT_PATH,
  CURATION_PATH,
  REPORT_PATH,
  REGISTRY_PATH,
  loadSnapshot,
  loadCuration,
  extractRegistryFields,
  buildComparison,
  canonicalJson,
} from './generate-search-registry.mjs'

const root = process.cwd()
const problems = []

for (const [p, hint] of [
  [SNAPSHOT_PATH, 'run `node scripts/generate-search-registry.mjs --input <raw-pull-dir>`'],
  [CURATION_PATH, 'the curation layer is a required committed artifact'],
  [REPORT_PATH, 'run `node scripts/generate-search-registry.mjs`'],
]) {
  if (!existsSync(join(root, p))) problems.push(`missing artifact: ${p} — ${hint}`)
}

let summary = null
if (!problems.length) {
  const snapshot = loadSnapshot(root)
  const curation = loadCuration(root)
  const registryFields = extractRegistryFields(root)
  const { report, problems: cmp } = buildComparison({ snapshot, curation, registryFields })
  summary = report.summary
  problems.push(...cmp)

  // (d) the committed report must reproduce byte-for-byte (plan §11.2).
  const committed = readFileSync(join(root, REPORT_PATH), 'utf8')
  if (committed !== canonicalJson(report)) {
    problems.push(
      `drift: ${REPORT_PATH} does not reproduce from ${REGISTRY_PATH} + ${SNAPSHOT_PATH} + ${CURATION_PATH} — ` +
        'run `node scripts/generate-search-registry.mjs` and commit the regenerated report',
    )
  }
}

console.log('Search registry generation gate (ci:search-registry-generated)')
console.log('===============================================================')
if (summary) {
  console.log(
    `registry fields: ${summary.registryFields} · resolutions: ${JSON.stringify(summary.byResolution)} · ` +
      `exclusions enforced: ${summary.exclusions} · long tail (P5): ${summary.longTailStandardCount} standard+IDX, ${summary.longTailCustomCount} custom/group`,
  )
}
if (problems.length) {
  console.error('\nProblems:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(
    `\n\x1b[31m✗ ci:search-registry-generated: ${problems.length} problem(s). ` +
      `Every search filter must trace to MLS metadata or a reasoned curation entry, and the mask-dead set stays dead.\x1b[0m`,
  )
  process.exit(1)
}
console.log('✓ registry reproduces from metadata + curation; no unexplained field, option, or resurrected mask-dead filter.')
process.exit(0)
