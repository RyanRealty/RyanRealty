#!/usr/bin/env node
/**
 * check-row-cap.mjs — CI gate G48 (`npm run ci:row-cap`): no single-shot
 * Supabase reads over PostgREST's 1,000-row response cap.
 *
 * THE CLASS: Supabase PostgREST silently caps every response at 1,000 rows
 * regardless of a larger `.limit(N)`. A `.limit(5000)` read "works" in dev
 * (small tables), then silently truncates in production once the table grows
 * past 1,000 matching rows — and every count, tally, dedupe set, or tier
 * derived from it is wrong with no error anywhere. Founding cases: newsletter
 * send tiering (lib/data/newsletter/queue.ts), CRM tag counts
 * (lib/data/crm/getCrmTags.ts), inbox queue (getInboxQueue.ts).
 *
 * THE RULE: any Supabase read that may match more than 1,000 rows uses a
 * paged `.range(offset, offset + 999)` loop with a STABLE `.order()` until a
 * short read — canonical helper: `fetchPagedRows` / `fetchAllRows` in
 * lib/supabase/paginate.ts (exemplars: lib/data/crm/getCrmSources.ts,
 * lib/data/newsletter/queue.ts). When only a count is displayed, use
 * `{ count: 'exact', head: true }` — no row fetch at all.
 *
 * WHAT THIS GATE FLAGS (literal numbers only — variables can't be resolved
 * statically and the paged helpers take their caps as arguments):
 *   (a) `.limit(N)` where N > 1000
 *   (b) `.range(a, b)` where b - a + 1 > 1000
 *
 * SCOPE: lib/**\/*.ts and app/**\/*.{ts,tsx}. Skips *.test.* / *.spec.*,
 * __tests__/, node_modules/, and .d.ts files. scripts/ is out of scope.
 *
 * OPT-OUT: a pragma on the same line or the line above:
 *     // row-cap-ok: <reason>
 * Reserved for reads that are provably ≤ 1,000 rows by construction AND need
 * the literal for another reason. A read that "needs" >1000 rows single-shot
 * is exactly the bug — page it instead.
 *
 * Usage:
 *   node scripts/check-row-cap.mjs          # CI mode (exit 1 on violations)
 *   node scripts/check-row-cap.mjs --report # same output, always exit 0
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_ROOTS = [join(ROOT, 'lib'), join(ROOT, 'app')]

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')

const SKIP_DIRS = new Set(['node_modules', '__tests__', '.next'])

const EXT_RE = /\.(ts|tsx)$/
const SKIP_FILE_RE = /(\.test\.|\.spec\.|\.d\.ts$)/

// Literal-number matchers. Numeric literals may carry underscore separators
// (100_000). Only bare numeric arguments match — `.limit(limit)` and
// `.range(from, to)` with variables are out of static reach (the paged
// helpers in lib/supabase/paginate.ts own those call sites).
const LIMIT_RE = /\.limit\(\s*(\d[\d_]*)\s*\)/g
const RANGE_RE = /\.range\(\s*(\d[\d_]*)\s*,\s*(\d[\d_]*)\s*\)/g

const PRAGMA_RE = /\/\/\s*row-cap-ok:\s*\S/

const MAX_ROWS = 1000

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, acc)
    else if (EXT_RE.test(entry) && !SKIP_FILE_RE.test(entry)) acc.push(full)
  }
  return acc
}

function toNumber(literal) {
  return Number(literal.replaceAll('_', ''))
}

/**
 * Replace comment content with spaces (newlines preserved) so the matchers
 * only ever see CODE — `.limit(5000)` quoted in a doc comment must not trip
 * the gate. String-aware (`//` inside '…' / "…" / `…` is not a comment) and
 * regex-literal-aware (a quote inside /[,()"\\]/g must not open a string).
 */
function stripComments(src) {
  let out = ''
  let i = 0
  let mode = 'code' // code | line | block | single | double | template | regex
  let inCharClass = false // inside [...] of a regex literal

  // A `/` starts a regex literal (not division) when the previous significant
  // code char can't end an expression.
  const regexPrecederRE = /[(,=:[!&|?{};+\-*%~^<>]$|\b(return|typeof|case|in|of|new|delete|void|do|else|yield|await)$|^$/

  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; out += '  '; i += 2; continue }
      if (ch === '/' && next === '*') { mode = 'block'; out += '  '; i += 2; continue }
      if (ch === '/') {
        const before = out.replace(/\s+$/, '')
        if (regexPrecederRE.test(before.slice(-8))) { mode = 'regex'; inCharClass = false }
        out += ch; i += 1; continue
      }
      if (ch === "'") mode = 'single'
      else if (ch === '"') mode = 'double'
      else if (ch === '`') mode = 'template'
      out += ch; i += 1; continue
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out += '\n' } else out += ' '
      i += 1; continue
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; out += '  '; i += 2; continue }
      out += ch === '\n' ? '\n' : ' '; i += 1; continue
    }
    if (mode === 'regex') {
      if (ch === '\\') { out += ch + (next ?? ''); i += 2; continue }
      if (ch === '[') inCharClass = true
      else if (ch === ']') inCharClass = false
      else if (ch === '/' && !inCharClass) mode = 'code'
      else if (ch === '\n') mode = 'code' // regex literals never span lines
      out += ch; i += 1; continue
    }
    // string modes
    if (ch === '\\') { out += ch + (next ?? ''); i += 2; continue }
    if ((mode === 'single' && ch === "'") || (mode === 'double' && ch === '"') || (mode === 'template' && ch === '`')) {
      mode = 'code'
    }
    out += ch; i += 1
  }
  return out
}

function scanFile(filePath) {
  const src = readFileSync(filePath, 'utf8')
  const rawLines = src.split('\n')
  const lines = stripComments(src).split('\n')
  const violations = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const raw = rawLines[i] ?? ''
    const prevRaw = i > 0 ? rawLines[i - 1] : ''
    if (PRAGMA_RE.test(raw) || PRAGMA_RE.test(prevRaw)) continue

    for (const m of line.matchAll(LIMIT_RE)) {
      const n = toNumber(m[1])
      if (n > MAX_ROWS) {
        violations.push({ line: i + 1, snippet: raw.trim(), detail: `.limit(${m[1]}) — PostgREST returns at most ${MAX_ROWS} rows per response; the other ${n - MAX_ROWS} are silently dropped` })
      }
    }
    for (const m of line.matchAll(RANGE_RE)) {
      const a = toNumber(m[1])
      const b = toNumber(m[2])
      const span = b - a + 1
      if (span > MAX_ROWS) {
        violations.push({ line: i + 1, snippet: raw.trim(), detail: `.range(${m[1]}, ${m[2]}) spans ${span} rows — PostgREST returns at most ${MAX_ROWS} per response; the rest are silently dropped` })
      }
    }
  }
  return violations
}

function main() {
  const files = SCAN_ROOTS.flatMap((root) => walk(root))
  const findings = []
  for (const file of files) {
    for (const v of scanFile(file)) {
      findings.push({ rel: relative(ROOT, file), ...v })
    }
  }

  console.log('Row-cap check (G48) — no single-shot Supabase reads over the 1,000-row PostgREST cap')
  console.log('====================================================================================')
  console.log()
  console.log(`Files scanned: ${files.length}`)
  console.log(`Violations:    ${findings.length}`)
  console.log()

  if (findings.length > 0) {
    for (const f of findings) {
      console.log(`  ${f.rel}:${f.line}`)
      console.log(`    ${f.snippet}`)
      console.log(`    ${f.detail}`)
      console.log()
    }
    console.log('Fix: page the read — rebuild the query per page with a STABLE .order() and')
    console.log('.range(offset, offset + 999) until a short read. Canonical helpers:')
    console.log('  fetchPagedRows / fetchAllRows in lib/supabase/paginate.ts')
    console.log('  (exemplars: lib/data/crm/getCrmSources.ts, lib/data/newsletter/queue.ts)')
    console.log('If only a COUNT is displayed, use { count: "exact", head: true } instead of')
    console.log('fetching rows. A read provably ≤ 1,000 rows by construction may opt out with')
    console.log('`// row-cap-ok: <reason>` on the same or previous line — but a read that')
    console.log('"needs" more than 1,000 rows in one shot is the bug this gate exists to stop.')
  }

  if (REPORT) process.exit(0)
  process.exit(findings.length === 0 ? 0 : 1)
}

main()
