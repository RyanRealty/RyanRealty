#!/usr/bin/env node
/**
 * check-int-test-residue.mjs — ci:int-test-residue.
 *
 * THE DEFECT (2026-07-30, recurring): `*.int.test.ts` files write to the
 * PRODUCTION Supabase project (dwvlophlbvvygjfxcrhm). A killed run skips its
 * `afterAll` and the rows stay. The survey that day found stranded test rows in
 * SEVEN tables — 17 in `cmas` (five in `delivered`, inflating the count of
 * documents actually sent to clients), 11 in `broker_price_opinions`, 22 in
 * `crm_people` with 27 `crm_timeline` entries behind them, 11 in
 * `newsletter_subscribers`, plus `marketing_brain_actions` rows stuck in
 * `in_production` consuming CMA build-worker capacity. Archiving them was
 * cleanup, not a fix. CLAUDE.md §6: the answer is a gate.
 *
 * The runtime fix is test/int-scope.ts + test/int-global-setup.ts: one marker
 * spelling on every test-written identifier, one registry of the tables that
 * carry it, and a sweep before AND after every int run. This gate holds the
 * three ways that fix can rot.
 *
 * ASSERTS:
 *   R1  No hand-rolled test markers. Any string/template literal in an int test
 *       spelling a marker by hand (`zztest`, `zz-test`, `zz test`, `nl-oneoff`)
 *       is a violation — ids come from intId()/intEmail()/intAddress() or the
 *       sweep cannot find what the test wrote. Four different spellings were in
 *       use before this gate, which is why the sweep could not be written.
 *   R2  Registry completeness. Every table receiving .insert/.upsert/.update/
 *       .delete in an int test appears in INT_SWEEP_TARGETS (as a target or a
 *       child). A test that writes an unregistered table leaves rows the sweep
 *       will never look at.
 *   R3  The sweep stays wired: vitest.config.ts's `int` project declares
 *       globalSetup pointing at test/int-global-setup.ts, and that module
 *       exports both setup and teardown.
 *   R4  Any int test that writes at all imports test/int-scope. A brand-new
 *       file cannot hand-roll unmarked ids and slip past R1 by never spelling a
 *       marker.
 *
 * AST throughout (repo convention: code-inspecting gates use the TypeScript
 * compiler, never regex over source) — a rename, a reformat, or a differently
 * quoted string does not evade it.
 *
 * Exit: 0 = a killed int run cannot leave permanent residue in production.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const SCOPE_MODULE = 'test/int-scope.ts'
const SETUP_MODULE = 'test/int-global-setup.ts'
const VITEST_CONFIG = 'vitest.config.ts'

/** Spellings that must never be typed by hand in an int test. */
const HAND_ROLLED = [/zz-?\s?test/i, /nl-oneoff/i]
/** Methods that mutate a table. `.select()` is a read and is always fine. */
const MUTATORS = new Set(['insert', 'upsert', 'update', 'delete'])

const problems = []

function parse(rel) {
  const abs = join(process.cwd(), rel)
  if (!existsSync(abs)) {
    problems.push(`${rel}: not found — re-point this gate.`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

// ── Read the registry out of test/int-scope.ts ───────────────────────────────
const registered = new Set()
const scopeSf = parse(SCOPE_MODULE)
if (scopeSf) {
  const walk = (n) => {
    // `{ table: 'cmas', ... }` and `{ table: 'cma_comps', fk: 'cma_id' }`
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'table') {
      if (ts.isStringLiteral(n.initializer)) registered.add(n.initializer.text)
    }
    ts.forEachChild(n, walk)
  }
  walk(scopeSf)
  if (registered.size === 0) {
    problems.push(`${SCOPE_MODULE}: INT_SWEEP_TARGETS registers no tables — the sweep would clear nothing.`)
  }
  for (const req of ['intId', 'INT_MARKER', 'sweepIntResidue']) {
    if (!new RegExp(`export (const|function|async function) ${req}\\b`).test(scopeSf.getFullText())) {
      problems.push(`${SCOPE_MODULE}: must export ${req} — the int tests and the sweep both depend on it.`)
    }
  }
}

// ── R3: the sweep is wired into the int project ──────────────────────────────
const configSf = parse(VITEST_CONFIG)
if (configSf) {
  let intProject = null
  const findIntProject = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const isInt = n.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'name' &&
          ts.isStringLiteral(p.initializer) &&
          p.initializer.text === 'int',
      )
      if (isInt) intProject = n
    }
    ts.forEachChild(n, findIntProject)
  }
  findIntProject(configSf)

  if (!intProject) {
    problems.push(
      `${VITEST_CONFIG}: no vitest project named 'int'. The residue sweep hangs off that project — renaming it silently disarms the net.`,
    )
  } else {
    const globalSetup = intProject.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'globalSetup',
    )
    const text = globalSetup ? globalSetup.getText(configSf) : ''
    if (!globalSetup || !text.includes('int-global-setup')) {
      problems.push(
        `${VITEST_CONFIG}: the 'int' project must declare globalSetup: ['./${SETUP_MODULE}']. Without it nothing sweeps residue a killed run left in production.`,
      )
    }
  }
}

const setupSf = parse(SETUP_MODULE)
if (setupSf) {
  const text = setupSf.getFullText()
  for (const fn of ['setup', 'teardown']) {
    if (!new RegExp(`export async function ${fn}\\b`).test(text)) {
      problems.push(
        `${SETUP_MODULE}: must export async function ${fn}(). setup() is the crash-proof half (it clears what a killed run stranded); teardown() clears this run.`,
      )
    }
  }
  if (!text.includes('sweepIntResidue')) {
    problems.push(`${SETUP_MODULE}: does not call sweepIntResidue — the hooks are wired to nothing.`)
  }
}

// ── R1 / R2 / R4: every int test ─────────────────────────────────────────────
const intTests = walkFiles('lib')
  .filter((f) => f.endsWith('.int.test.ts'))
  .sort()

if (intTests.length === 0) {
  problems.push('No *.int.test.ts files found under lib/ — this gate is pointed at nothing.')
}

for (const rel of intTests) {
  const sf = parse(rel)
  if (!sf) continue

  let importsScope = false
  const writesTables = new Map() // table -> line
  let anyWrite = null

  const walk = (n) => {
    // R4 — import of the scope module (any path spelling ending in int-scope).
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      if (/int-scope$/.test(n.moduleSpecifier.text)) importsScope = true
    }
    // R1 — hand-rolled markers in literals.
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) ||
        ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const raw = n.text ?? ''
      // The import specifier itself may legitimately contain the module name.
      const isModuleSpecifier = n.parent && ts.isImportDeclaration(n.parent)
      if (!isModuleSpecifier && HAND_ROLLED.some((re) => re.test(raw))) {
        problems.push(
          `${rel}:${lineOf(sf, n)}: hand-rolled test marker in a literal (${JSON.stringify(raw.slice(0, 60))}). Build ids with intId()/intEmail()/intAddress() from @/test/int-scope — the sweep matches ONE spelling, and hand-rolled variants are what stranded rows in seven production tables.`,
        )
      }
    }
    // R2 — table writes. `sb.from('cmas').insert(...)`, any chain depth.
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text
      if (MUTATORS.has(method)) {
        const table = tableOfChain(n.expression.expression)
        if (table) {
          anyWrite ??= lineOf(sf, n)
          if (!writesTables.has(table)) writesTables.set(table, lineOf(sf, n))
        }
      }
    }
    ts.forEachChild(n, walk)
  }

  /** Walk back down a `.from('x')` chain to the table literal. */
  function tableOfChain(node) {
    let cur = node
    while (cur) {
      if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
        if (cur.expression.name.text === 'from') {
          const arg = cur.arguments[0]
          return arg && ts.isStringLiteral(arg) ? arg.text : null
        }
        cur = cur.expression.expression
        continue
      }
      if (ts.isPropertyAccessExpression(cur)) {
        cur = cur.expression
        continue
      }
      return null
    }
    return null
  }

  walk(sf)

  for (const [table, line] of writesTables) {
    if (!registered.has(table)) {
      problems.push(
        `${rel}:${line}: writes \`${table}\` but it is not in INT_SWEEP_TARGETS (${SCOPE_MODULE}). Rows this test leaves behind would never be swept. Register the table (and its FK children) there.`,
      )
    }
  }

  if (anyWrite != null && !importsScope) {
    problems.push(
      `${rel}:${anyWrite}: writes to the production DB without importing @/test/int-scope. Every written identifier must carry INT_MARKER via intId()/intEmail()/intAddress(), or the sweep cannot find it.`,
    )
  }
}

if (problems.length) {
  console.error(`\n✗ ci:int-test-residue — ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    `\nInt tests run against PRODUCTION Supabase. The contract is in ${SCOPE_MODULE}.\n`,
  )
  process.exit(1)
}

console.log(
  `✓ ci:int-test-residue — ${intTests.length} int test file(s), ${registered.size} swept table(s); pre-run + post-run sweep wired.`,
)
