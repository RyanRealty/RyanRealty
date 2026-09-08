#!/usr/bin/env node
/**
 * check-site-primitive-wired.mjs — G73: a site primitive ships wired to a
 * public route, never reachable only from a dev page.
 *
 * The class of failure this locks out (Matt 2026-09-08, forensic audit of the
 * site queue's first day): SITE-05 and SITE-11 merged 4,419 lines to main that
 * no public page imported. `V3StickyAsk` was reachable only from
 * app/dev/site-05-sticky/page.tsx; `V3ProofBlock` + `getProofBlock` only from
 * app/dev/site-11-proof/page.tsx. Both nodes read as shipped — the components
 * existed, the dev harness rendered them, the parity lists were satisfied — and
 * no visitor on ryan-realty.com could reach either one. They were wired onto
 * /sell an hour later, by hand, because a human noticed.
 *
 * A dev page is a workbench, not a destination. Landing a primitive that only a
 * workbench imports is shipping nothing, so this gate calls it what it is.
 *
 * RULE: every component exported from the barrel `components/site/v3/index.ts`
 * must have at least one importer OUTSIDE app/dev/** — some file under app/**
 * (excluding app/dev/**) or components/** (excluding components/site/v3/**
 * itself, because a barrel sibling importing it does not make it reachable by
 * anyone). A component reached through the barrel re-export counts, so
 * `import { V3X } from '@/components/site/v3'` in a real page IS the wire.
 *
 * "Component" = an exported VALUE binding whose name is PascalCase (leading
 * capital AND at least one lowercase letter). That is what excludes the token
 * constants (V3_ROOT_CLASS, V3_FOOTER_COLUMNS), the hooks and helpers
 * (v3Text, useV3FieldBinding, proofBlockView), and every `export type`.
 *
 * DETECTION IS AST, NEVER REGEX (memory: reference_code_inspecting_gates_use_ast).
 * Both the barrel's export declarations and every candidate importer's import
 * declarations are read off the TypeScript AST, so a name inside a comment, a
 * string, or a type-only specifier cannot fake a wire.
 *
 * BASELINE: scripts/site-primitive-wired-baseline.json, SHRINK-ONLY.
 *   { "unwired": { "<ComponentName>": "<reason + the SITE node id that owes it>" } }
 * A component recorded there passes. The gate fails when:
 *   - an unwired component is NOT in the baseline (the new-violation red path)
 *   - a baseline entry is now wired (it may only shrink — delete the line)
 *   - a baseline entry names a component the barrel no longer exports (stale;
 *     a baseline that silently outlives its subject is a gate green for the
 *     wrong reason)
 *
 * Usage:
 *   node scripts/check-site-primitive-wired.mjs                  # CI mode
 *   node scripts/check-site-primitive-wired.mjs --report         # print rule, exit 0
 *   node scripts/check-site-primitive-wired.mjs --json           # machine output
 *   node scripts/check-site-primitive-wired.mjs --write-baseline # record current unwired
 *   node scripts/check-site-primitive-wired.mjs --root=<dir>     # run against a fixture tree
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

const argv = process.argv.slice(2)
const REPORT = argv.includes('--report')
const JSON_OUT = argv.includes('--json')
const WRITE_BASELINE = argv.includes('--write-baseline')
const rootArg = argv.find((a) => a.startsWith('--root='))

const ROOT = resolve(rootArg ? rootArg.slice('--root='.length) : join(SCRIPT_DIR, '..'))

const V3_DIR = join(ROOT, 'components/site/v3')
const BARREL = join(V3_DIR, 'index.ts')
const DEV_DIR = join(ROOT, 'app/dev')
const BASELINE_PATH = join(ROOT, 'scripts/site-primitive-wired-baseline.json')

const RULE =
  'Rule (G73, site primitives ship wired): every component exported from the barrel ' +
  'components/site/v3/index.ts must have at least one importer OUTSIDE app/dev/** — a file ' +
  'under app/** (not app/dev/**) or components/** (not components/site/v3/** itself). A ' +
  'primitive reachable only from a dev page is not shipped; the dev harness is a workbench, ' +
  'not a destination.'

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'out', '__snapshots__'])
const SOURCE_EXT = /\.(tsx?|jsx?|mts|cts)$/

/* -------------------------------------------------------------------------- */
/* File walking                                                                */
/* -------------------------------------------------------------------------- */

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) walk(full, acc)
    else if (SOURCE_EXT.test(entry) && !/\.d\.ts$/.test(entry)) acc.push(full)
  }
  return acc
}

const isInside = (abs, dir) => abs === dir || abs.startsWith(dir + '/')

/* -------------------------------------------------------------------------- */
/* AST                                                                         */
/* -------------------------------------------------------------------------- */

function parse(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** PascalCase value name = a component. Excludes SCREAMING_SNAKE and camelCase. */
function isComponentName(name) {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name)
}

/**
 * Resolve a module specifier to an absolute path, WITHOUT requiring the file to
 * exist — the only question here is whether it points inside components/site/v3.
 * Handles the repo's single tsconfig path alias (`@/*` -> `./*`) and relatives.
 */
function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith('@/')) return resolve(ROOT, spec.slice(2))
  if (spec.startsWith('./') || spec.startsWith('../')) return resolve(dirname(fromFile), spec)
  return null
}

/** The concrete file a barrel module specifier points at, for reporting. */
function resolveToFile(abs) {
  const candidates = [
    abs,
    `${abs}.ts`,
    `${abs}.tsx`,
    join(abs, 'index.ts'),
    join(abs, 'index.tsx'),
  ]
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c
    } catch {
      /* keep looking */
    }
  }
  return null
}

/**
 * Components exported by the barrel: [{ name, home }] where `home` is the file
 * the component actually lives in (relative to ROOT).
 */
function readBarrelComponents() {
  const source = readFileSync(BARREL, 'utf8')
  const sf = parse(BARREL, source)
  const out = new Map()

  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt)) continue
    if (stmt.isTypeOnly) continue
    if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue

    let home = relative(ROOT, BARREL)
    if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const abs = resolveSpecifier(stmt.moduleSpecifier.text, BARREL)
      const file = abs ? resolveToFile(abs) : null
      home = file ? relative(ROOT, file) : `${relative(ROOT, V3_DIR)}/${stmt.moduleSpecifier.text}`
    }

    for (const spec of stmt.exportClause.elements) {
      if (spec.isTypeOnly) continue
      const name = spec.name.text
      if (!isComponentName(name)) continue
      if (!out.has(name)) out.set(name, { name, home })
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Value names this file imports from anywhere inside components/site/v3.
 * Type-only imports do not count — a type import renders nothing.
 * A namespace import (`import * as V3`) touches every export, so it wires all.
 */
function importedFromV3(file) {
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    return { names: new Set(), namespace: false }
  }
  if (!source.includes('site/v3')) return { names: new Set(), namespace: false }

  const sf = parse(file, source)
  const names = new Set()
  let namespace = false

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue
    const abs = resolveSpecifier(stmt.moduleSpecifier.text, file)
    if (!abs || !isInside(abs, V3_DIR)) continue

    const clause = stmt.importClause
    if (!clause || clause.isTypeOnly) continue
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      namespace = true
      continue
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const spec of clause.namedBindings.elements) {
        if (spec.isTypeOnly) continue
        // `import { V3X as Foo }` still consumes V3X — the barrel's exported name.
        names.add((spec.propertyName ?? spec.name).text)
      }
    }
  }
  return { names, namespace }
}

/* -------------------------------------------------------------------------- */
/* Baseline                                                                    */
/* -------------------------------------------------------------------------- */

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    return raw.unwired && typeof raw.unwired === 'object' ? raw.unwired : {}
  } catch {
    return {}
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

function main() {
  if (REPORT) {
    console.log(RULE)
    process.exit(0)
  }

  if (!existsSync(BARREL)) {
    console.error('ci:site-primitive-wired FAIL')
    console.error(`  ✗ barrel not found at ${relative(ROOT, BARREL)} — update this gate or the barrel path`)
    process.exit(1)
  }

  const components = readBarrelComponents()

  const appFiles = walk(join(ROOT, 'app'))
  const componentFiles = walk(join(ROOT, 'components'))

  const devFiles = appFiles.filter((f) => isInside(f, DEV_DIR))
  const realFiles = [
    ...appFiles.filter((f) => !isInside(f, DEV_DIR)),
    ...componentFiles.filter((f) => !isInside(f, V3_DIR)),
  ]

  // name -> importer files, split by whether the importer is a dev page
  const wiredBy = new Map()
  const devOnlyBy = new Map()
  let namespaceWire = null

  for (const file of realFiles) {
    const { names, namespace } = importedFromV3(file)
    if (namespace) namespaceWire = relative(ROOT, file)
    for (const n of names) {
      if (!wiredBy.has(n)) wiredBy.set(n, [])
      wiredBy.get(n).push(relative(ROOT, file))
    }
  }
  for (const file of devFiles) {
    const { names } = importedFromV3(file)
    for (const n of names) {
      if (!devOnlyBy.has(n)) devOnlyBy.set(n, [])
      devOnlyBy.get(n).push(relative(ROOT, file))
    }
  }

  const unwired = components
    .filter((c) => !wiredBy.has(c.name) && !namespaceWire)
    .map((c) => ({
      name: c.name,
      home: c.home,
      devImporters: (devOnlyBy.get(c.name) ?? []).sort(),
    }))

  if (WRITE_BASELINE) {
    const existing = loadBaseline()
    const record = {}
    for (const c of unwired.sort((a, b) => a.name.localeCompare(b.name))) {
      record[c.name] =
        existing[c.name] ??
        (c.devImporters.length
          ? `reachable only from ${c.devImporters.join(', ')} — SITE node that owes the wiring: TODO`
          : 'no importer outside components/site/v3 — SITE node that owes the wiring: TODO')
    }
    const payload = {
      note:
        'ci:site-primitive-wired (G73) — SHRINK-ONLY. Barrel components from components/site/v3/index.ts ' +
        'with no importer outside app/dev/**. A component leaves this list by being wired into the public ' +
        'route its SITE node owes; no component may be added without recording that node id. Regenerate ' +
        'with `node scripts/check-site-primitive-wired.mjs --write-baseline`.',
      generatedAt: new Date().toISOString(),
      unwired: record,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
    console.log(
      `Wrote baseline: ${Object.keys(record).length} unwired component(s) recorded at ${relative(ROOT, BASELINE_PATH)}`,
    )
    process.exit(0)
  }

  const baseline = loadBaseline()
  const baselineNames = new Set(Object.keys(baseline))
  const componentNames = new Set(components.map((c) => c.name))
  const unwiredNames = new Set(unwired.map((c) => c.name))

  const newViolations = unwired.filter((c) => !baselineNames.has(c.name))
  const nowWired = [...baselineNames].filter((n) => componentNames.has(n) && !unwiredNames.has(n))
  const stale = [...baselineNames].filter((n) => !componentNames.has(n))

  const failed = newViolations.length + nowWired.length + stale.length

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          barrelComponents: components.length,
          scannedImporters: realFiles.length,
          devFiles: devFiles.length,
          baselineSize: baselineNames.size,
          unwired: unwired.map((c) => ({ name: c.name, home: c.home, devImporters: c.devImporters })),
          newViolations: newViolations.map((c) => c.name),
          nowWired,
          staleBaselineEntries: stale,
        },
        null,
        2,
      ),
    )
    process.exit(failed === 0 ? 0 : 1)
  }

  if (failed === 0) {
    console.log(
      `ci:site-primitive-wired OK — ${components.length} barrel component(s), ` +
        `${components.length - unwired.length} wired outside app/dev/**, ` +
        `${baselineNames.size} recorded in the shrink-only baseline`,
    )
    process.exit(0)
  }

  console.error('')
  console.error('ci:site-primitive-wired FAIL')
  console.error('============================')
  console.error('')
  console.error(RULE)
  console.error('')

  if (newViolations.length > 0) {
    console.error(`Site primitives with NO importer outside app/dev/** (${newViolations.length}):`)
    for (const c of newViolations) {
      console.error(`  ✗ ${c.name} — ${c.home}`)
      if (c.devImporters.length > 0) {
        console.error(`      dev-only importers: ${c.devImporters.join(', ')}`)
      } else {
        console.error('      no importers at all (not even a dev page)')
      }
    }
    console.error('')
    console.error(
      'Fix: wire it into the public route the node owes, or record it in ' +
        'scripts/site-primitive-wired-baseline.json with the SITE node id that owes the wiring.',
    )
    console.error('')
  }

  if (nowWired.length > 0) {
    console.error(`Baseline entries that are now WIRED — the baseline may only shrink (${nowWired.length}):`)
    for (const n of nowWired) console.error(`  ✗ ${n}`)
    console.error('')
    console.error('Fix: delete those lines from scripts/site-primitive-wired-baseline.json.')
    console.error('')
  }

  if (stale.length > 0) {
    console.error(`Baseline entries the barrel no longer exports (${stale.length}):`)
    for (const n of stale) console.error(`  ✗ ${n}`)
    console.error('')
    console.error('Fix: delete those lines from scripts/site-primitive-wired-baseline.json.')
    console.error('')
  }

  process.exit(1)
}

main()
