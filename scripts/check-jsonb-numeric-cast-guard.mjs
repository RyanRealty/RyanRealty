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

/**
 * A numeric-shape regex guard. `-?` and `+?` are accepted before the digit
 * class: `~ '^-?[0-9]+(\.[0-9]+)?$'` is a CORRECT guard and the original
 * pattern rejected it, because it only matched `'^[0-9`.
 */
const GUARD = /~\s*'\^[-+]?\??\\?\[0-9/

/** The jsonb key in a `details->>'Key'` extraction. */
const KEY_RE = /details\s*->>\s*'([A-Za-z0-9_]+)'/g

/**
 * A guard for `key`, anywhere in a statement. `\)?` because the extraction is
 * commonly parenthesised before the operator:
 * `(l.details->>'DaysOnMarket') ~ '^[0-9]+$'`.
 */
function keyGuardRe(key) {
  return new RegExp(`details\\s*->>\\s*'${key}'\\s*\\)?\\s*~\\s*'\\^[-+]?\\??\\\\?\\[0-9`)
}

/**
 * Split source into `;`-delimited statements, carrying each line's 1-based
 * number so a violation still reports its real location.
 *
 * WHY STATEMENT SCOPE (2026-08-02): this check used to require the guard on the
 * SAME LINE as the cast, which is not how anyone writes guarded SQL. Both real
 * shapes span lines, and one puts the guard AFTER the cast:
 *
 *     CASE WHEN (l.details->>'DaysOnMarket') ~ '^[0-9]+(\.[0-9]+)?$'
 *            THEN round((l.details->>'DaysOnMarket')::numeric)::integer
 *
 *     UPDATE public.listings l
 *     SET "OriginalListPrice" = (l.details->>'OriginalListPrice')::numeric
 *      ...
 *      AND (l.details->>'OriginalListPrice') ~ '^[0-9]+(\.[0-9]+)?$';
 *
 * Both are correctly guarded and the gate called all of them violations — 7
 * across two migrations. A line-scoped check pressures authors to cram guards
 * onto one line to satisfy it, which is worse SQL for no safety gain. The unit
 * that actually matters is the STATEMENT: a cast and the `WHERE` clause that
 * protects it either execute together or not at all.
 *
 * Still strict: the guard must name the SAME jsonb key, so an unrelated guard
 * elsewhere in the statement cannot launder an unguarded cast.
 */
function statements(lines) {
  const out = []
  let current = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].split('--')[0]
    current.push({ line, n: i + 1 })
    if (line.includes(';')) {
      out.push(current)
      current = []
    }
  }
  if (current.length) out.push(current)
  return out
}

function classifyFile(file) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const rel = relative(ROOT, file)
  const violations = []

  for (const stmt of statements(lines)) {
    const stmtText = stmt.map((l) => l.line).join('\n')
    for (const { line, n } of stmt) {
      if (!/details\s*->>/.test(line)) continue
      if (!NUMERIC_CAST.test(line)) continue
      if (GUARD.test(line)) continue

      // Every key cast on this line must be guarded somewhere in the statement.
      const keys = [...line.matchAll(KEY_RE)].map((m) => m[1])
      const guarded =
        keys.length > 0 && keys.every((key) => keyGuardRe(key).test(stmtText))
      if (guarded) continue

      violations.push(`${rel}:${n}`)
    }
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
