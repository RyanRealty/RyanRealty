#!/usr/bin/env node
// scripts/check-producer-guard.mjs
//
// G22 — Producer pipeline discipline. Closes GAP-10 from the
// 2026-05-28 guardrail inventory.
//
// Every changed `scripts/build_*.py` producer file (staged for commit)
// must:
//   (a) import `require_action_row` from `_producer_lib`
//   (b) call `require_action_row(payload)` somewhere in the script
//
// OR the file must carry an explicit opt-out comment on a line by itself:
//   # @producer-guard-exempt: <reason>
//
// This forces every producer to participate in the brain audit trail
// (the `marketing_brain_actions` row) per CLAUDE.md "Marketing Brain
// Architecture" — direct `python3 scripts/build_X.py <payload.json>`
// invocations bypass the trail unless the script itself refuses.
//
// Runs against staged changes (pre-commit) by default. Pass `--all` to
// audit every producer script in the repo (status report).

import { execSync, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve('.')
const SCRIPTS = join(ROOT, 'scripts')

const args = process.argv.slice(2)
const AUDIT_ALL = args.includes('--all')

function getStagedProducerFiles() {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=AM'],
      { encoding: 'utf8' },
    )
    return out
      .split('\n')
      .filter((p) => /^scripts\/build_[a-z0-9_]+\.py$/.test(p))
      .map((p) => resolve(p))
      .filter((p) => existsSync(p))
  } catch {
    return []
  }
}

function getAllProducerFiles() {
  return readdirSync(SCRIPTS)
    .filter((n) => /^build_[a-z0-9_]+\.py$/.test(n))
    .map((n) => join(SCRIPTS, n))
}

function checkFile(absPath) {
  const src = readFileSync(absPath, 'utf8')
  // Opt-out line is allowed (skip the rest of the rules).
  if (/^[ \t]*#\s*@producer-guard-exempt:\s*\S+/m.test(src)) {
    return { ok: true, opt_out: true }
  }
  const importsGuard =
    /\bfrom\s+_producer_lib\s+import\s+[^\n]*\brequire_action_row\b/.test(src) ||
    /\bfrom\s+\.?_producer_lib\s+import\s+[^\n]*\brequire_action_row\b/.test(src) ||
    /\bimport\s+_producer_lib\b/.test(src)
  const callsGuard = /\brequire_action_row\s*\(/.test(src)
  if (importsGuard && callsGuard) return { ok: true, opt_out: false }
  return {
    ok: false,
    opt_out: false,
    missing_import: !importsGuard,
    missing_call: !callsGuard,
  }
}

const files = AUDIT_ALL ? getAllProducerFiles() : getStagedProducerFiles()
if (files.length === 0) {
  if (AUDIT_ALL) {
    console.log('No producer scripts in scripts/build_*.py.')
  } else {
    // No staged producer changes — nothing to do, gate is a no-op.
    console.log('Producer guard check: no staged producer changes.')
  }
  process.exit(0)
}

console.log(`Producer guard check (G22)`)
console.log(`===========================`)
console.log(`Scanning ${files.length} ${AUDIT_ALL ? 'producer' : 'staged producer'} file(s)…`)
console.log('')

let failed = 0
let compliant = 0
let exempt = 0

for (const f of files) {
  const rel = f.replace(ROOT + '/', '')
  const result = checkFile(f)
  if (result.ok && result.opt_out) {
    exempt++
    console.log(`  ${rel} — EXEMPT (@producer-guard-exempt)`)
  } else if (result.ok) {
    compliant++
    console.log(`  ${rel} — OK (calls require_action_row)`)
  } else {
    failed++
    const why = [
      result.missing_import ? 'missing `from _producer_lib import require_action_row`' : null,
      result.missing_call ? 'never calls `require_action_row(payload)`' : null,
    ].filter(Boolean).join('; ')
    console.log(`  ${rel} — FAIL (${why})`)
  }
}

console.log('')
console.log(
  `Total: ${files.length} · OK ${compliant} · Exempt ${exempt} · Fail ${failed}`,
)

if (failed > 0) {
  console.error('')
  console.error('Producer guard check FAILED.')
  console.error('')
  console.error(
    'Every staged scripts/build_*.py must call `require_action_row(payload)` from _producer_lib so the brain pipeline audit row (marketing_brain_actions) is enforced. Rogue script invocations bypass the audit trail + cost caps + measurement loop.',
  )
  console.error('')
  console.error('Fix paths:')
  console.error('  a) Add to the top of the script:')
  console.error('       from _producer_lib import require_action_row')
  console.error('       require_action_row(payload)')
  console.error("  b) OR add a single-line opt-out: `# @producer-guard-exempt: <reason>`")
  console.error('     (acceptable only for diagnostic / utility scripts that are not real producers)')
  process.exit(1)
}

process.exit(0)
