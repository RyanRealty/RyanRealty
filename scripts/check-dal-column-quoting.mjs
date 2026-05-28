#!/usr/bin/env node
// scripts/check-dal-column-quoting.mjs
//
// G17 — Closes GAP-1 from the 2026-05-28 guardrail inventory:
// PostgREST mixed-case column quoting in lib/data/ functions.
//
// THE BUG CLASS this catches (the 2026-05-28 "Listing Not Found"
// regression, commit f136a40):
//
//   .eq('"ListingKey"', listingKey)        ← BROKEN
//   .eq('ListingKey',   listingKey)        ← CORRECT
//
// The first form puts LITERAL double-quote characters inside the JS
// string. supabase-js sends that as the URL parameter
// `?%22ListingKey%22=eq.X`. PostgREST interprets the URL-decoded
// `"ListingKey"` as a column NAME containing quote characters — which
// doesn't exist — and silently returns nothing. The page renders as
// "Listing Not Found."
//
// supabase-js handles mixed-case columns correctly when you pass the
// bare name (no extra quotes inside the JS string). PostgREST quotes
// the identifier as needed.
//
// (The CLAUDE.md rule that says "wrap mixed-case in double quotes" is
// about RAW SQL — psql / execute_sql with hand-written SELECT — not
// about supabase-js client method arguments.)
//
// The gate:
//   1. Reads docs/DATABASE_SCHEMA_SNAPSHOT.md for the full set of
//      mixed-case columns.
//   2. Walks lib/data/**/*.ts.
//   3. Finds every Supabase query-builder call (.eq, .filter, .select,
//      .order, .range, .is, .gt/lt/gte/lte, .in, .match, .contains)
//      and checks the column-name argument. If the JS string contains
//      literal `\"` characters wrapping a mixed-case column, FAIL.
//
// Run via:
//   npm run ci:dal-column-quoting

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve('.')
const SNAPSHOT = join(ROOT, 'docs/DATABASE_SCHEMA_SNAPSHOT.md')
const DATA_DIR = join(ROOT, 'lib/data')

// ─── 1. Mixed-case columns from the snapshot ─────────────────────────

function loadMixedCaseColumns() {
  const md = readFileSync(SNAPSHOT, 'utf8')
  // The snapshot renders mixed-case columns as `\`"ColumnName"\``. Pull
  // the inner ColumnName values. Lowercase columns are rendered as
  // `\`column_name\`` — no double quotes — and are excluded.
  const set = new Set()
  const re = /`"([A-Za-z_][A-Za-z0-9_]*)"`/g
  let m
  while ((m = re.exec(md))) {
    set.add(m[1])
  }
  return set
}

// ─── 2. Walk lib/data ─────────────────────────────────────────────────

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === '__tests__') continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|mts)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

// ─── 3. Scan one file for unquoted mixed-case column references ──────

// Match `.METHOD( 'STRING'` or `.METHOD( "STRING"` (with leading whitespace).
// Captures: method name, the first string argument including its quotes.
const QUERY_METHOD_RE =
  /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|range|order|select|filter|match|or|not|csv|head|count)\(\s*('[^']*'|"[^"]*"|`[^`]*`)/g

function scanFile(absPath, mixedCase) {
  const src = readFileSync(absPath, 'utf8')
  const rel = relative(ROOT, absPath)
  const violations = []
  let m
  while ((m = QUERY_METHOD_RE.exec(src))) {
    const method = m[1]
    const lit = m[2]
    // Unwrap the quote characters.
    const inner = lit.slice(1, -1)
    // Method-specific handling:
    //   - .select() takes a comma-separated column list. Split + check each.
    //   - .order() / .range() / .csv() / .count() etc. take a column.
    //   - Everything else passes the column as the first arg.
    const columns =
      method === 'select'
        ? inner.split(',').map((s) => s.trim()).filter(Boolean)
        : [inner.trim()]
    for (const c of columns) {
      // Only flag when the JS string contains LITERAL `"` characters
      // wrapping the column name — that's the broken form that
      // PostgREST sends through as a quoted-name-with-actual-quotes.
      const wrapped = c.startsWith('"') && c.endsWith('"') && c.length > 2
      const bare = wrapped ? c.slice(1, -1) : c
      if (wrapped && mixedCase.has(bare)) {
        const lineNum = src.slice(0, m.index).split('\n').length
        violations.push({
          file: rel,
          line: lineNum,
          method,
          column: bare,
          snippet: src.slice(Math.max(0, m.index - 10), m.index + 60).replace(/\s+/g, ' ').trim(),
        })
      }
    }
  }
  return violations
}

// ─── Main ────────────────────────────────────────────────────────────

console.log('DAL mixed-case column quoting (G17)')
console.log('===================================')

const mixedCase = loadMixedCaseColumns()
console.log(`Mixed-case columns sourced from snapshot: ${mixedCase.size}`)

const files = walk(DATA_DIR)
console.log(`Scanning ${files.length} lib/data files...`)
console.log('')

const allViolations = []
for (const f of files) {
  allViolations.push(...scanFile(f, mixedCase))
}

if (allViolations.length === 0) {
  console.log(`OK — zero unquoted mixed-case column references.`)
  process.exit(0)
}

// Group by file.
const byFile = new Map()
for (const v of allViolations) {
  if (!byFile.has(v.file)) byFile.set(v.file, [])
  byFile.get(v.file).push(v)
}
console.error(`FAIL — ${allViolations.length} violations across ${byFile.size} files:`)
console.error('')
for (const [file, vs] of [...byFile.entries()].sort()) {
  console.error(`  ${file}:`)
  for (const v of vs) {
    console.error(`    line ${v.line}: .${v.method}('"${v.column}"', …) ← LITERAL DOUBLE QUOTES inside the JS string`)
    console.error(`      → "${v.snippet}"`)
    console.error(
      `      Fix: .${v.method}('${v.column}', …) — drop the literal double quotes. supabase-js handles mixed-case correctly.`,
    )
  }
}
console.error('')
console.error(
  'Why: putting literal `\"` characters inside the JS string sends them through to PostgREST as part of the column name, which Postgres then looks for as a column WITH quote characters in its name — silently returns nothing. supabase-js handles bare mixed-case names correctly. The CLAUDE.md double-quote rule applies to RAW SQL, not supabase-js client calls.',
)
process.exit(1)
