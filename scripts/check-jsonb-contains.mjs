#!/usr/bin/env node
/**
 * check-jsonb-contains.mjs — bans the supabase-js `.contains(<jsonb col>, [ ... ])`
 * bug class.
 *
 * PostgREST jsonb containment (`@>`) needs a JSON STRING. supabase-js serializes a
 * bare JS array/object to a Postgres ARRAY literal `{...}`, which the server rejects
 * with `invalid input syntax for type json`. Every call site that passed a literal
 * threw at runtime — and because the compliance path (`isSuppressedByEmail`) is
 * FAIL-CLOSED, a throw marked every address suppressed and SILENTLY skipped every
 * newsletter / CMA / lead send. Three sites shipped this way before it was caught by
 * a real end-to-end send (2026-07-03).
 *
 * The fix is always: pass `JSON.stringify([...])` (or a pre-built JSON string).
 *
 *   BAD :  .contains('emails', [{ value: x }])
 *   GOOD:  .contains('emails', JSON.stringify([{ value: x }]))
 *
 * jsonb columns on crm_people: emails, phones, custom. NOT `tags` — that is a
 * Postgres text[] (ARRAY), where a bare JS array IS the correct form.
 *
 * Static scan of lib/ + app/. Usage:
 *   node scripts/check-jsonb-contains.mjs            # human output, exits 1 on hit
 *   node scripts/check-jsonb-contains.mjs --json
 *   node scripts/check-jsonb-contains.mjs --report   # never exits 1
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

// jsonb array/object columns where a bare JS literal is wrong. `tags` is text[] — excluded.
const JSONB_COLS = ['emails', 'phones', 'custom']

// .contains( 'col' , <whitespace> [ or {   — a literal, not JSON.stringify / a variable.
const BAD_RE = new RegExp(
  `\\.contains\\(\\s*(['"\`])(${JSONB_COLS.join('|')})\\1\\s*,\\s*[\\[{]`,
)

function listSourceFiles() {
  // Track only committed/tracked source under lib + app; fall back to a find.
  try {
    const out = execSync('git ls-files lib app', { cwd: ROOT, encoding: 'utf8' })
    return out.split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.|\.d\.ts$/.test(f))
  } catch {
    return []
  }
}

export function scanContent(content) {
  // Check CODE, not comments — the fix's own explanatory comment names the pattern.
  const stripped = stripJsComments(content)
  const hits = []
  const lines = stripped.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (BAD_RE.test(lines[i])) hits.push({ line: i + 1, text: lines[i].trim().slice(0, 140) })
  }
  return hits
}

function run() {
  const files = listSourceFiles()
  const findings = []
  for (const rel of files) {
    let content
    try {
      content = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue
    }
    for (const h of scanContent(content)) findings.push({ file: rel, ...h })
  }
  return findings
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')
  const findings = run()

  if (asJson) {
    console.log(JSON.stringify({ pass: findings.length === 0, findings }, null, 2))
  } else if (findings.length === 0) {
    console.log('✓ jsonb-contains: no bare-array .contains() on jsonb columns (emails/phones/custom).')
  } else {
    console.error(`✗ jsonb-contains: ${findings.length} .contains(<jsonb col>, [literal]) call(s) — will throw "invalid input syntax for type json" at runtime:\n`)
    for (const f of findings) {
      console.error(`  • ${f.file}:${f.line}\n      ${f.text}`)
    }
    console.error('\n  Fix: pass a JSON string — .contains(\'emails\', JSON.stringify([{ value: x }])). See scripts/check-jsonb-contains.mjs header.')
  }

  if (findings.length && !report) process.exit(1)
  process.exit(0)
}
