#!/usr/bin/env node
/**
 * check-unstable-cache-door.mjs (ci:unstable-cache-door, G79) — every cached
 * read goes through ONE door: `unstable_cache` is imported from
 * `@/lib/data/cache/next-cache`, never from `next/cache`.
 *
 * THE DEFECT THIS GATE EXISTS FOR
 * -------------------------------
 * Production deploy dpl_57NPHyuPyFiSkL23TpQzyNQ1rV4L (main f8260352a,
 * 2026-09-25 01:24Z) ended in ERROR: "Error occurred prerendering page
 * /cities/redmond. TypeError: Cannot read properties of undefined (reading
 * 'find')". Next 16.1.6's unstable_cache resolves `undefined` in place of the
 * value when a key this render missed is read again in the same work store
 * after its window has passed: the stale branch returns the pending cache
 * WRITE, a Promise<void>. runPublishedPageRender's build retry
 * (lib/site/degraded-isr.ts) does exactly that, so getPlaceOpeningListings came
 * back undefined and buildPlaceAlertTypes ran `input.buckets.find` on it. The
 * same build logged city:resortTiles "e is not iterable" from the same cause.
 * lib/data/cache/next-cache.ts re-reads uncached when that happens; a module
 * that imports the raw export skips the repair and can take a deploy down.
 *
 * RULES (TypeScript AST, never a grep, so a comment or a string cannot trip it)
 *   R1  No runtime source file imports, re-exports, or requires
 *       `unstable_cache` from `next/cache` (named import under any alias,
 *       `export { unstable_cache } from`, a namespace import whose
 *       `.unstable_cache` is read, or `require` / `import()` of next/cache in a
 *       file that reads `unstable_cache`). Only the door itself may.
 *   R2  The door exists, imports Next's export, and exports `unstable_cache`.
 *
 * SCOPE: every tracked or untracked-not-ignored .ts/.tsx/.js/.jsx/.mjs/.cjs
 * file except node_modules/, .next/, scripts/ (CLI tools stub next/cache),
 * test/ and __tests__/ helpers, and *.test.* / *.spec.* files (a test may pin
 * the raw upstream behaviour on purpose; lib/data/cache/next-cache.test.ts
 * does).
 *
 * CANNOT SEE: a cached read built on something other than unstable_cache, or
 * a caller that aliases the door's export and then calls Next's directly
 * through a variable it received from elsewhere.
 *
 * Usage: node scripts/check-unstable-cache-door.mjs [--report] [--json]
 * Break-tests: scripts/__tests__/check-unstable-cache-door.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const DOOR = 'lib/data/cache/next-cache.ts'
const NAME = 'unstable_cache'
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const OUT_OF_SCOPE = [/^node_modules\//, /^\.next\//, /^scripts\//, /^test\//, /(^|\/)__tests__\//, /\.(test|spec)\.[cm]?[jt]sx?$/]

function isNextCache(node) {
  return node && ts.isStringLiteralLike(node) && node.text === 'next/cache'
}

/** Violations (strings) in one file's source. */
export function scanSource(rel, text) {
  if (!text.includes('next/cache')) return []
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  const namespaces = new Set()
  let loadsModule = false
  let readsName = false
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && isNextCache(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if ((el.propertyName ?? el.name).text === NAME) found.push(`${at(el)} imports ${NAME} from 'next/cache'`)
        }
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        namespaces.add(bindings.name.text)
      }
      if (node.importClause?.name) namespaces.add(node.importClause.name.text)
    }
    if (ts.isExportDeclaration(node) && isNextCache(node.moduleSpecifier)) {
      const clause = node.exportClause
      if (!clause) found.push(`${at(node)} re-exports everything from 'next/cache', ${NAME} included`)
      else if (ts.isNamedExports(clause)) {
        for (const el of clause.elements) {
          if ((el.propertyName ?? el.name).text === NAME) found.push(`${at(el)} re-exports ${NAME} from 'next/cache'`)
        }
      }
    }
    if (ts.isCallExpression(node) && isNextCache(node.arguments[0])) {
      const callee = node.expression
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require')) {
        loadsModule = true
      }
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === NAME) {
      readsName = true
      if (ts.isIdentifier(node.expression) && namespaces.has(node.expression.text)) {
        found.push(`${at(node)} reads ${node.expression.text}.${NAME} off a 'next/cache' namespace import`)
      }
    }
    if (ts.isBindingElement(node) && (node.propertyName ?? node.name).getText(sf) === NAME) readsName = true
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (loadsModule && readsName) found.push(`${rel} loads 'next/cache' at runtime and reads ${NAME} from it`)
  return found
}

/** R2: the door is in place. */
export function checkDoor(text) {
  if (text == null) return [`${DOOR} is missing: it is the one module allowed to wrap Next's ${NAME}`]
  const problems = []
  if (!/from ['"]next\/cache['"]/.test(text)) problems.push(`${DOOR} no longer imports Next's ${NAME}`)
  if (!new RegExp(`export (const|function) ${NAME}\\b`).test(text)) problems.push(`${DOOR} no longer exports ${NAME}`)
  return problems
}

export function inScope(rel) {
  return SOURCE_EXT.test(rel) && rel !== DOOR && !OUT_OF_SCOPE.some((re) => re.test(rel))
}

/** Full audit of a tree, given its file list (repo-relative, forward slashes). */
export function audit(root, files) {
  const violations = []
  for (const rel of files) {
    if (!inScope(rel)) continue
    const full = join(root, rel)
    if (!existsSync(full)) continue
    violations.push(...scanSource(rel, readFileSync(full, 'utf8')))
  }
  const doorPath = join(root, DOOR)
  violations.push(...checkDoor(existsSync(doorPath) ? readFileSync(doorPath, 'utf8') : null))
  return violations
}

export function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  return [...new Set(out.split('\0').filter(Boolean))]
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = new Set(process.argv.slice(2))
  const files = listFiles(root)
  const violations = audit(root, files)
  if (args.has('--json')) {
    console.log(JSON.stringify({ ok: violations.length === 0, violations }, null, 2))
  } else if (violations.length === 0) {
    console.log(`ci:unstable-cache-door: OK. Every ${NAME} comes through ${DOOR}.`)
  } else {
    console.error(`ci:unstable-cache-door: ${violations.length} problem(s)`)
    for (const v of violations) console.error(`  - ${v}`)
    console.error(
      `\nImport ${NAME} from '@/lib/data/cache/next-cache', not 'next/cache'. Next 16.1.6's export can resolve undefined in place of the value during a build retry; the door re-reads uncached (see ${DOOR}).`,
    )
  }
  if (!args.has('--report') && violations.length > 0) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
