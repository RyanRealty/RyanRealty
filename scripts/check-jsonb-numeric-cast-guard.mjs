#!/usr/bin/env node
/**
 * check-jsonb-numeric-cast-guard.mjs — CI gate: every numeric cast of a jsonb
 * `details->>'...'` extraction in a SQL migration must be guarded by a numeric
 * regex (~ '^[0-9...') in the SAME clause, never by `IS NOT NULL` alone.
 *
 * WHY: the MLS feed stores the literal privacy sentinel '********' (and decimal
 * strings) in numeric details fields (YearBuilt, GarageSpaces, ...). A bare
 * `(details->>'YearBuilt')::int` passes an `IS NOT NULL` guard, reaches the cast
 * on the sentinel, and throws `22P02 invalid input syntax for type integer`,
 * aborting the WHOLE RPC — so a year-built or min-garage search returned an
 * empty/error grid. Found by the filter-mismatch audit 2026-06-08; the IS NOT
 * NULL false-safe is exactly what prose review keeps missing. Only the regex
 * guard short-circuits the sentinel before the cast.
 *
 * A flagged line contains `details->>` + a numeric cast (`)::int|numeric|float|
 * bigint|...`) but NO `~ '^[0-9` guard on the same line. Baselined + ratcheted:
 * pre-existing unguarded casts (in superseded migration files) are grandfathered;
 * NEW ones fail CI. The baseline only shrinks.
 *
 * Usage:
 *   node scripts/check-jsonb-numeric-cast-guard.mjs            # CI
 *   node scripts/check-jsonb-numeric-cast-guard.mjs --json
 *   node scripts/check-jsonb-numeric-cast-guard.mjs --write-baseline
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')
const BASELINE_PATH = join(ROOT, 'scripts/jsonb-numeric-cast-guard-baseline.json')

const args = new Set(process.argv.slice(2))
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

const NUMERIC_CAST = /\)\s*::\s*(int|integer|numeric|bigint|smallint|float|real|double\s+precision)\b/i
const GUARD = /~\s*'\^\\?\[0-9/

function classifyFile(file) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const rel = relative(ROOT, file)
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    // Strip SQL line comments so a migration's prose description of the bug
    // (which names the unguarded pattern) is not itself flagged.
    const line = lines[i].split('--')[0]
    if (!/details\s*->>/.test(line)) continue
    if (!NUMERIC_CAST.test(line)) continue
    if (GUARD.test(line)) continue
    violations.push(`${rel}:${i + 1}`)
  }
  return violations
}

function scan() {
  let files = []
  try { files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map((f) => join(MIGRATIONS_DIR, f)) } catch { /* no dir */ }
  return files.flatMap(classifyFile).sort()
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).violators ?? [])
}

function main() {
  const violations = scan()

  if (WRITE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      reason: "Unguarded numeric casts of jsonb details->> extractions (guarded only by IS NOT NULL, not a ~ '^[0-9' regex) at gate-creation time. These live in SUPERSEDED migration files; the live RPC is guarded. NEW unguarded casts fail CI; this list only shrinks.",
      total: violations.length,
      violators: violations,
    }, null, 2) + '\n')
    console.log(`Wrote baseline: ${violations.length} unguarded jsonb numeric casts at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolations = violations.filter((v) => !baseline.has(v))
  const fixed = [...baseline].filter((v) => !violations.includes(v))

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: violations.length, baselineSize: baseline.size, newViolations, fixed }, null, 2))
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('Unguarded jsonb numeric-cast check (ratcheted)')
  console.log('==============================================\n')
  console.log(`Unguarded details->> numeric casts:   ${violations.length}`)
  console.log(`  Baseline (superseded-migration debt): ${baseline.size}`)
  console.log(`  NEW unguarded casts (CI BLOCKER):     ${newViolations.length}`)
  console.log(`  Fixed since baseline:                 ${fixed.length}\n`)
  if (newViolations.length > 0) {
    console.log('NEW unguarded jsonb numeric casts (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log("\nFix: guard the cast in the SAME clause with a numeric regex, e.g.")
    console.log("  (l.details->>'YearBuilt' ~ '^[0-9]+$' AND (l.details->>'YearBuilt')::int >= p_year_built_min)")
    console.log("An `IS NOT NULL` guard alone does NOT satisfy this — the '********' MLS sentinel is non-null and crashes the cast.")
  }
  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
