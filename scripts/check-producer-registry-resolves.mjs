#!/usr/bin/env node
/**
 * check-producer-registry-resolves.mjs — ci:producer-registry-resolves (W10.5).
 *
 * The in-process producer shim (lib/marketing-brain/inbox-producer-registry.ts)
 * maps a marketing action_type to a producer SKILL.md directory. The cloud
 * producer-runtime (app/api/cron/producer-runtime) loads that SKILL.md from the
 * DEPLOYED repo (path.join(process.cwd(), producerSlug, 'SKILL.md')). If the shim
 * points at a directory that has no SKILL.md in the repo — as it did for the
 * ~24 video producers decommissioned 2026-06-14, whose video_production_skills/
 * tree lives only on the local render worker — the runtime dies with "SKILL.md
 * not found" and the broker's request is lost, instead of falling through to
 * comms:matt_alert (which is what an ABSENT entry does).
 *
 * This gate fails the build if any path in the shim does not resolve to a real
 * `<path>/SKILL.md` on disk. It keeps the shim honest: only cloud-runnable
 * producers belong here; a local-only or deleted producer must be OMITTED (so the
 * dispatcher routes it to matt_alert), never mapped to a dead path.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast) — parses the shim
 * with the real TypeScript compiler and reads the object-literal string VALUES,
 * never a regex over source text.
 *
 * Usage: node scripts/check-producer-registry-resolves.mjs  (npm run ci:producer-registry-resolves)
 * Exit: 0 = every path resolves, 1 = a shim path has no SKILL.md.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SHIM = 'lib/marketing-brain/inbox-producer-registry.ts'

function fail(msg) {
  console.error(`\n\x1b[31m✗ ci:producer-registry-resolves: ${msg}\x1b[0m`)
  process.exit(1)
}

const text = readFileSync(join(ROOT, SHIM), 'utf8')
const sf = ts.createSourceFile(SHIM, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/** Collect { key, value, line } for every string→string property in the first
 *  object literal whose declared name is PRODUCER_REGISTRY. */
const entries = []
const visit = (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'PRODUCER_REGISTRY' &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    for (const prop of node.initializer.properties) {
      if (!ts.isPropertyAssignment(prop)) continue
      const key = ts.isStringLiteralLike(prop.name)
        ? prop.name.text
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : null
      if (!ts.isStringLiteralLike(prop.initializer)) {
        const { line } = sf.getLineAndCharacterOfPosition(prop.getStart(sf))
        fail(`entry "${key}" at ${SHIM}:${line + 1} has a non-string-literal value — the shim must be a flat string→string map.`)
      }
      const { line } = sf.getLineAndCharacterOfPosition(prop.getStart(sf))
      entries.push({ key, value: prop.initializer.text, line: line + 1 })
    }
  }
  ts.forEachChild(node, visit)
}
visit(sf)

if (entries.length === 0) fail(`no PRODUCER_REGISTRY object-literal entries found in ${SHIM} (shape changed?).`)

const unresolved = []
for (const e of entries) {
  const skill = join(ROOT, e.value, 'SKILL.md')
  if (!existsSync(skill)) unresolved.push(e)
}

console.log('Producer-registry resolution gate (ci:producer-registry-resolves)')
console.log('=================================================================')
console.log(`shim: ${SHIM}  ·  ${entries.length} entries`)

if (unresolved.length) {
  console.error('\nShim entries pointing at a producer with NO SKILL.md in the repo:')
  for (const e of unresolved) {
    console.error(`  ✗ ${SHIM}:${e.line} — "${e.key}" → ${e.value} (no ${e.value}/SKILL.md).`)
  }
  fail(
    `${unresolved.length} unresolved producer path(s). Either the producer is decommissioned / local-only — ` +
      `then DELETE the entry (the dispatcher routes it to comms:matt_alert) — or add its SKILL.md to the repo.`,
  )
}

console.log(`\n✓ All ${entries.length} shim paths resolve to a real SKILL.md.`)
process.exit(0)
