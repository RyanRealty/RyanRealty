#!/usr/bin/env node
/**
 * check-server-type-reexport.mjs — a 'use server' module may not re-export a
 * name it only imported as a TYPE.
 *
 * WHY THIS EXISTS (2026-08-08). /admin/crm/subscriptions served the admin error
 * boundary. The cause was one line in app/actions/alert-admin.ts:
 *
 *   import { listPendingAlertApprovalGroups, type AlertEngineSettings } from '…'
 *   export type { AlertEngineSettings, PendingApprovalGroup, PendingApprovalItem }
 *
 * Next treats a re-export from a server module as a RUNTIME binding. TypeScript
 * had already erased the type-only import, so the emitted module referenced a
 * name that did not exist and threw at evaluation:
 *
 *   ReferenceError: AlertEngineSettings is not defined
 *
 * tsc is GREEN on this — the TypeScript is perfectly valid. Only the browser
 * says anything, and what it says is a 500. A second latent instance was found
 * the same day in app/actions/video-tours-cache.ts, which is why this is a gate
 * and not a fixed bug.
 *
 * THE RULE (types): in a 'use server' file, `export type { X }` WITHOUT a `from`
 * clause is banned when X arrives via an import. Two safe forms remain:
 *   · `export type { X } from './module'` — a true re-export, fully erased.
 *   · `export type X = …` declared locally in the same file.
 * The fix at a call site is always the same: import the type from the module
 * that declares it.
 *
 * THE RULE (values, 2026-09-16): Turbopack refuses any value re-export from a
 * 'use server' file — `export { fn } from './other'` and `export { importedFn }`.
 * Production sat on ERROR for ~24h after crm.ts re-exported getNextRecommendation
 * / getCrmAccess. Wrap as a local `export async function` or import the action
 * from the file that declares it. Type-only `export type { X } from` stays legal.
 *
 * AST, not regex (repo convention, and learned the hard way here): the first
 * draft of this gate matched the worked example inside its own explanatory
 * comment. The TypeScript parser sees declarations; a regex sees text.
 *
 * Usage: node scripts/check-server-type-reexport.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOTS = ['app', 'lib', 'components']
const EXT = new Set(['.ts', '.tsx'])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      walk(p, out)
    } else if (EXT.has(e.name.slice(e.name.lastIndexOf('.')))) out.push(p)
  }
  return out
}

const failures = []
let scanned = 0

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)

    // 'use server' must be a directive prologue — the first statement.
    const first = sf.statements[0]
    const isServer =
      first &&
      ts.isExpressionStatement(first) &&
      ts.isStringLiteral(first.expression) &&
      first.expression.text === 'use server'
    if (!isServer) continue
    scanned++

    // Every name this module IMPORTS (type-only or value).
    const imported = new Set()
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue
      const named = st.importClause.namedBindings
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) imported.add(el.name.text)
      }
    }

    for (const st of sf.statements) {
      if (!ts.isExportDeclaration(st)) continue
      const line = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1
      const clause = st.exportClause

      // Value re-export from another module: `export { fn } from './x'`
      // Turbopack: "Only async functions are allowed to be exported".
      if (st.moduleSpecifier && !st.isTypeOnly) {
        const names =
          clause && ts.isNamedExports(clause)
            ? clause.elements.map((el) => (el.propertyName ?? el.name).text).join(', ')
            : '*'
        failures.push(
          `${file}:${line} — 'use server' module value-re-exports ${names} from another module. ` +
            `Turbopack requires a local async function declaration (not export { … } from).`,
        )
        continue
      }

      if (st.moduleSpecifier) continue // `export type { X } from '…'` is fully erased — safe.
      if (!clause || !ts.isNamedExports(clause)) continue

      const names = clause.elements.map((el) => (el.propertyName ?? el.name).text)
      const importedNames = names.filter((n) => imported.has(n))
      if (!importedNames.length) continue

      if (st.isTypeOnly) {
        failures.push(
          `${file}:${line} — 'use server' module re-exports imported type(s) ${importedNames.join(', ')}. ` +
            `Next emits this as a runtime binding, so the module throws ` +
            `"ReferenceError: <name> is not defined" at evaluation while tsc stays green.`,
        )
        continue
      }

      failures.push(
        `${file}:${line} — 'use server' module re-exports imported value(s) ${importedNames.join(', ')}. ` +
          `Turbopack requires a local async function declaration (not export { importedFn }).`,
      )
    }
  }
}

if (failures.length) {
  console.error("✗ server-type-reexport: a 'use server' module has an illegal re-export:\n")
  for (const f of failures) console.error('  ' + f)
  console.error(
    '\nFix: delete the re-export. Types come from the declaring module (or a local `export type X =`). ' +
      'Values must be a local `export async function`.',
  )
  process.exit(1)
}
console.log(
  `✓ server-type-reexport: ${scanned} 'use server' module(s), no illegal type or value re-exports.`,
)
