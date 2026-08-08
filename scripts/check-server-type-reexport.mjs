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
 * THE RULE: in a 'use server' file, `export type { X }` WITHOUT a `from` clause
 * is banned when X arrives via an import. Two safe forms remain:
 *   · `export type { X } from './module'` — a true re-export, fully erased.
 *   · `export type X = …` declared locally in the same file.
 * The fix at a call site is always the same: import the type from the module
 * that declares it.
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
      if (st.moduleSpecifier) continue // `export … from '…'` is a real re-export — safe.
      if (!st.isTypeOnly) continue // value exports are the module's actual API.
      const clause = st.exportClause
      if (!clause || !ts.isNamedExports(clause)) continue
      const offending = clause.elements
        .map((el) => (el.propertyName ?? el.name).text)
        .filter((n) => imported.has(n))
      if (offending.length) {
        const line = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1
        failures.push(
          `${file}:${line} — 'use server' module re-exports imported type(s) ${offending.join(', ')}. ` +
            `Next emits this as a runtime binding, so the module throws ` +
            `"ReferenceError: <name> is not defined" at evaluation while tsc stays green.`,
        )
      }
    }
  }
}

if (failures.length) {
  console.error("✗ server-type-reexport: a 'use server' module re-exports an imported type:\n")
  for (const f of failures) console.error('  ' + f)
  console.error('\nFix: delete the re-export; import the type from the module that declares it.')
  process.exit(1)
}
console.log(`✓ server-type-reexport: ${scanned} 'use server' module(s), none re-exports an imported type.`)
