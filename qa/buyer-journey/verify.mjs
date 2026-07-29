#!/usr/bin/env node
/**
 * Buyer-journey E2E verifier.
 *
 * Usage: node qa/buyer-journey/verify.mjs <path/to/results.json>
 *
 * Validates a run's results.json against qa/buyer-journey/manifest.json:
 *   - every manifest step is present with status "pass"
 *   - every evidence_required key is present and non-empty
 *   - *_file evidence exists on disk (relative to results.json)
 *   - *_count / *_ms evidence is numeric and satisfies evidence_min /
 *     evidence_max / evidence_exact from the manifest step
 *   - *_confirmed evidence is boolean true
 *   - the identity email matches the manifest pattern (sends stay on the
 *     test alias, never a real person)
 *   - no P0/P1 finding is left open; "fixed" requires a commit sha and
 *     re-passed steps
 *
 * Exit 0 = the run is done. Anything else = not done; the printed list is
 * the remaining work.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const resultsArg = process.argv[2]
if (!resultsArg) {
  console.error('usage: node qa/buyer-journey/verify.mjs <path/to/results.json>')
  process.exit(2)
}
const resultsPath = path.resolve(resultsArg)
let results
try {
  results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
} catch (e) {
  console.error(`FAIL cannot read/parse ${resultsPath}: ${e.message}`)
  process.exit(2)
}
const baseDir = path.dirname(resultsPath)

const errors = []
const warnings = []

// -- run-level checks --------------------------------------------------------
if (results.manifest_version !== manifest.version) {
  errors.push(`manifest_version "${results.manifest_version}" != manifest ${manifest.version}`)
}
const email = results.identity?.email ?? ''
if (!new RegExp(manifest.identity.email_pattern).test(email)) {
  errors.push(`identity.email "${email}" does not match ${manifest.identity.email_pattern} — sends must target the test alias only`)
}
for (const key of ['run_id', 'started_at', 'finished_at']) {
  if (!results[key]) errors.push(`missing run field: ${key}`)
}

// -- per-step checks ---------------------------------------------------------
const stepById = new Map((results.steps ?? []).map((s) => [s.id, s]))

for (const spec of manifest.steps) {
  const step = stepById.get(spec.id)
  if (!step) {
    errors.push(`[${spec.id}] step missing from results`)
    continue
  }
  if (step.status !== 'pass') {
    errors.push(`[${spec.id}] status is "${step.status}" (must be "pass")`)
  }
  const evidence = step.evidence ?? {}
  for (const key of spec.evidence_required) {
    const value = evidence[key]
    if (value === undefined || value === null || value === '') {
      errors.push(`[${spec.id}] evidence "${key}" missing or empty`)
      continue
    }
    if (key.endsWith('_file')) {
      const p = path.isAbsolute(value) ? value : path.join(baseDir, value)
      if (!fs.existsSync(p)) errors.push(`[${spec.id}] evidence file not found: ${value}`)
    }
    if (key.endsWith('_count') || key.endsWith('_ms')) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`[${spec.id}] evidence "${key}" must be a number, got ${JSON.stringify(value)}`)
        continue
      }
      const min = spec.evidence_min?.[key]
      const max = spec.evidence_max?.[key]
      const exact = spec.evidence_exact?.[key]
      if (min !== undefined && value < min) errors.push(`[${spec.id}] ${key}=${value} below minimum ${min}`)
      if (max !== undefined && value > max) errors.push(`[${spec.id}] ${key}=${value} above maximum ${max}`)
      if (exact !== undefined && value !== exact) errors.push(`[${spec.id}] ${key}=${value} must equal ${exact}`)
    }
    if (key.endsWith('_confirmed') && value !== true) {
      errors.push(`[${spec.id}] ${key} must be boolean true, got ${JSON.stringify(value)}`)
    }
    if (key.endsWith('_query_output') && String(value).trim().length < 10) {
      errors.push(`[${spec.id}] ${key} looks empty — paste the raw query result`)
    }
  }
}

for (const step of results.steps ?? []) {
  if (!manifest.steps.some((s) => s.id === step.id)) {
    warnings.push(`results contain unknown step "${step.id}" (not in manifest — ignored)`)
  }
}

// -- findings checks ---------------------------------------------------------
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3'])
for (const f of results.findings ?? []) {
  if (!SEVERITIES.has(f.severity)) {
    errors.push(`[finding ${f.id}] invalid severity "${f.severity}"`)
    continue
  }
  if (!f.title || !f.repro) errors.push(`[finding ${f.id}] needs title and repro`)
  const blocking = f.severity === 'P0' || f.severity === 'P1'
  if (blocking && f.status !== 'fixed') {
    errors.push(`[finding ${f.id}] ${f.severity} is "${f.status}" — P0/P1 must be fixed and retested before the run passes`)
  }
  if (f.status === 'fixed') {
    if (!/^[0-9a-f]{7,40}$/i.test(f.fix_commit ?? '')) {
      errors.push(`[finding ${f.id}] status=fixed requires fix_commit sha`)
    }
    if (!Array.isArray(f.retested_steps) || f.retested_steps.length === 0) {
      errors.push(`[finding ${f.id}] status=fixed requires retested_steps`)
    } else {
      for (const id of f.retested_steps) {
        const s = stepById.get(id)
        if (!s || s.status !== 'pass') errors.push(`[finding ${f.id}] retested step "${id}" is not passing`)
      }
    }
  }
}

// -- report ------------------------------------------------------------------
const done = (results.steps ?? []).filter((s) => s.status === 'pass').length
console.log(`buyer-journey verify — manifest ${manifest.version}, run ${results.run_id ?? '?'}`)
console.log(`steps passing: ${done}/${manifest.steps.length}   findings: ${(results.findings ?? []).length}`)
for (const w of warnings) console.log(`  warn: ${w}`)
if (errors.length) {
  console.log(`\nNOT DONE — ${errors.length} unmet requirement(s):`)
  for (const e of errors) console.log(`  ✗ ${e}`)
  process.exit(1)
}
console.log('\nDONE — every step passed with evidence; no open P0/P1.')
process.exit(0)
