#!/usr/bin/env node
// scripts/check-design-directives.mjs
//
// G25 — Design Directive registry gate.
//
// Parses docs/DESIGN_DIRECTIVES.md (the source of truth for every
// design rule) and enforces propagation discipline:
//
//   1. Every directive whose Status is `open` fails CI. A directive
//      may not stay un-mechanized indefinitely. The agent must either
//      build the gate (status → `enforced`) or explicitly mark it
//      `deferred` with a target wave / date + justification.
//
//   2. Every directive whose Status is `deferred` and whose target
//      has passed warns loudly. If the target is "wave-3" and Wave 3
//      has shipped, the directive must be promoted or downgraded.
//
//   3. Every directive whose Status is `enforced` must reference a
//      Gate ID that exists in docs/MECHANICAL_GATES.md. Drift between
//      the two registries fails CI.
//
//   4. Every directive whose Status is `wont-fix` is acceptable but
//      must carry a non-empty Cascade-path explanation (the
//      justification).
//
// Output: a summary table of open / enforced / deferred / wont-fix
// counts + per-row issues. Exits 0 only when zero `open` directives
// remain and no `enforced` gate references are stale.
//
// Run via:
//   npm run ci:design-directives
//
// Bypass: there is no bypass. Adding directives without a gate fails
// CI by design. The whole point is to force propagation.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DIRECTIVES_PATH = resolve('docs/DESIGN_DIRECTIVES.md')
const GATES_PATH = resolve('docs/MECHANICAL_GATES.md')

if (!existsSync(DIRECTIVES_PATH)) {
  console.error('G25: docs/DESIGN_DIRECTIVES.md is missing.')
  console.error('Create it from the audit (out/design-directive-audit-2026-05-28.md).')
  process.exit(1)
}

const md = readFileSync(DIRECTIVES_PATH, 'utf8')

// ─── Parse the directive rows ────────────────────────────────────────

// Rows look like:
//   | D01 | text | source | surfaces | status | gate | cascade | opened |
// We parse all `| Dnn | ... |` lines from any table block in the doc.

const rowRe = /^\|\s*(D\d+)\s*\|/m
const lines = md.split('\n')
const directives = []
for (const line of lines) {
  if (!rowRe.test(line)) continue
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
  if (cells.length < 7) continue
  const [id, directive, source, surfaces, status, gate, cascade, opened] = cells
  directives.push({
    id,
    directive,
    source,
    surfaces,
    status: status.toLowerCase().split(' ')[0],
    statusFull: status, // keeps `deferred (target: Wave 3)` etc.
    gate,
    cascade,
    opened: opened ?? '',
  })
}

if (directives.length === 0) {
  console.error('G25: parsed 0 directives. Check docs/DESIGN_DIRECTIVES.md table formatting.')
  process.exit(1)
}

// ─── Parse the gate registry ─────────────────────────────────────────

const gateIds = new Set(['NONE'])
if (existsSync(GATES_PATH)) {
  const gatesMd = readFileSync(GATES_PATH, 'utf8')
  const gateRe = /^\|\s*\**\s*(G\d+)\s*\**\s*\|/gm
  let m
  while ((m = gateRe.exec(gatesMd))) gateIds.add(m[1])
}

// ─── Validate ────────────────────────────────────────────────────────

const issues = []
const counts = { enforced: 0, open: 0, deferred: 0, 'wont-fix': 0, unknown: 0 }

for (const d of directives) {
  if (counts[d.status] === undefined) {
    counts.unknown++
    issues.push({
      severity: 'error',
      id: d.id,
      msg: `unknown status "${d.statusFull}". Allowed: enforced | open | deferred | wont-fix.`,
    })
    continue
  }
  counts[d.status]++

  // 1. `open` directives fail CI.
  if (d.status === 'open') {
    issues.push({
      severity: 'error',
      id: d.id,
      msg: `status=open — no gate yet. Build the gate (move to enforced) or mark deferred with a target wave + justification.`,
    })
  }

  // 2. `enforced` directives must reference a real gate.
  if (d.status === 'enforced') {
    // Gate cell may be "G4" or "G2 + G3 + G20" — split on `+` and check each.
    const refs = d.gate
      .replace(/\(.*?\)/g, '')
      .split(/[+,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (refs.length === 0 || (refs.length === 1 && refs[0].toUpperCase() === 'NONE')) {
      issues.push({
        severity: 'error',
        id: d.id,
        msg: `status=enforced but Gate column is NONE/empty. Reference a gate ID (G01–G25).`,
      })
    } else {
      for (const ref of refs) {
        const norm = ref.toUpperCase()
        if (norm !== 'NONE' && !gateIds.has(norm)) {
          issues.push({
            severity: 'error',
            id: d.id,
            msg: `references gate "${ref}" which is not in docs/MECHANICAL_GATES.md. Add the gate to the catalog or fix the reference.`,
          })
        }
      }
    }
  }

  // 3. `deferred` must have a target.
  if (d.status === 'deferred') {
    // Look for "target: Wave N" or "target: YYYY-MM-DD" in the status cell.
    if (!/target:/i.test(d.statusFull)) {
      issues.push({
        severity: 'warning',
        id: d.id,
        msg: `status=deferred but no "target:" annotation found. Add a wave or date.`,
      })
    }
    // Warn if target is Wave <=3 (already shipped) — generalize later.
    const m = /target:\s*Wave\s*(\d)/i.exec(d.statusFull)
    if (m) {
      const wave = Number(m[1])
      if (wave <= 2) {
        issues.push({
          severity: 'warning',
          id: d.id,
          msg: `target Wave ${wave} has shipped. Promote to enforced or mark wont-fix.`,
        })
      }
    }
  }

  // 4. `wont-fix` must have a non-empty cascade-path justification.
  if (d.status === 'wont-fix') {
    if (!d.cascade || d.cascade.length < 8) {
      issues.push({
        severity: 'error',
        id: d.id,
        msg: `status=wont-fix requires a justification in the Cascade-path column.`,
      })
    }
  }
}

// ─── Render ──────────────────────────────────────────────────────────

console.log('Design directive registry (G25)')
console.log('===============================')
console.log(`Source: ${DIRECTIVES_PATH.replace(process.cwd() + '/', '')}`)
console.log(`Gates registry: ${GATES_PATH.replace(process.cwd() + '/', '')}`)
console.log('')
console.log(`Directives: ${directives.length}`)
console.log(`  enforced  ${counts.enforced}`)
console.log(`  deferred  ${counts.deferred}`)
console.log(`  wont-fix  ${counts['wont-fix']}`)
console.log(`  open      ${counts.open}`)
if (counts.unknown > 0) console.log(`  UNKNOWN   ${counts.unknown}`)
console.log('')

if (issues.length === 0) {
  console.log('G25: OK — zero open directives, all enforced gates resolved.')
  process.exit(0)
}

const errors = issues.filter((i) => i.severity === 'error')
const warnings = issues.filter((i) => i.severity === 'warning')

if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`)
  for (const w of warnings) console.log(`  [warn] ${w.id}: ${w.msg}`)
  console.log('')
}

if (errors.length > 0) {
  console.error(`Errors (${errors.length}):`)
  for (const e of errors) console.error(`  [err]  ${e.id}: ${e.msg}`)
  console.error('')
  console.error(
    'G25: FAILED. Open directives must be mechanized (gate built) or explicitly deferred with a target. The propagation principle requires every design rule to have a mechanical owner.',
  )
  process.exit(1)
}

console.log('G25: WARN — passing with warnings.')
process.exit(0)
