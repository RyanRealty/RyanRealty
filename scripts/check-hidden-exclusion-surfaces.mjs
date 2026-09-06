#!/usr/bin/env node
/**
 * check-hidden-exclusion-surfaces.mjs — ci:hidden-exclusion-surfaces (W7.2).
 *
 * "Hide homes I don't want to see" must subtract a hidden home from EVERY browse
 * of for-sale inventory — the /search grid + map, the city/community browse grid
 * + map, the price-drops grids, and the video-tour grid — not just one. Leaks
 * kept appearing across the search surfaces, and the gate that guards them was
 * attacked in five adversarial rounds. Every early version parsed imports with a
 * hand-rolled comment/string stripper + a text regex, and every round found a new
 * lexer edge case that desynced it and let a raw-card import slip through green:
 *   - an aliased import; a JSX-text apostrophe; a hardcoded page list;
 *   - the word `from` inside an import comment; `import D,{x}from'm'` (no spaces);
 *   - a regex literal `/\/*$/` read as a block-comment open;
 *   - a nested template `` `${`/*`}` `` desyncing the string scanner;
 *   - a unicode escape in the specifier (`'.../ListingCard'`) dodging a
 *     byte-literal path match.
 *
 * The lesson (from the round-5 verifier): a hand-rolled JS lexer will keep losing
 * this arms race. So this version parses imports with the REAL TypeScript
 * compiler (ts.createSourceFile + walk ImportDeclaration nodes). That closes the
 * whole class at once: the parser handles comments, template interpolation, regex
 * literals, and escape sequences natively, and `moduleSpecifier.text` is the
 * DECODED specifier value (so `ListingCard` compares equal to `ListingCard`).
 *
 * Two invariants, both AST-checked:
 *   1. WRAPPER INTEGRITY. Each exclusion-aware wrapper (a component that renders a
 *      raw card / pin layer AND applies the per-user subtraction) must reference
 *      an exclusion primitive as a real identifier. Gutting a wrapper's exclusion
 *      fails (a comment/string mention cannot fake it — it is not an Identifier).
 *   2. DISCOVERY. Every app/**\/page.tsx is parsed. A page that VALUE-imports a
 *      raw listing renderer (a card OR the map pin layer) — under ANY alias,
 *      since we match the resolved module specifier, not JSX — is a browse of
 *      for-sale inventory. It must be a wrapper route or in the curated allowlist,
 *      else it fails. New browse routes are caught automatically; type-only
 *      imports are correctly ignored.
 *
 * Usage: node scripts/check-hidden-exclusion-surfaces.mjs
 */
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const CWD = process.cwd()

// Modules whose default/value export renders for-sale listings (a card, a tile,
// or a map PIN layer) with NO per-user hidden subtraction of its own. A page
// that value-imports one of these is a browse of for-sale inventory.
const RAW_LISTING_MODULES = [
  '@/components/site/ListingCard',
  '@/components/ListingTile',
  '@/components/site/VideoListingCard',
  '@/components/SearchMapClustered',
  '@/components/LazySearchMapClustered',
]

// Resolve imports the way the Next build does (tsconfig paths, `@/` alias, etc.)
// so a raw renderer counts whether it's imported as `@/components/site/ListingCard`,
// `@/components/site/./ListingCard`, or a plain relative `../../components/site/
// ListingCard` — all three resolve to the SAME file. The prior gate compared the
// literal specifier text and was defeated by a relative import (round 6).
const RESOLVE_OPTS = (() => {
  const configPath = ts.findConfigFile(CWD, ts.sys.fileExists, 'tsconfig.json')
  const parsed = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, CWD)
    : { options: {} }
  return { ...parsed.options, moduleResolution: ts.ModuleResolutionKind.Bundler }
})()
// A resolution cache so resolving EVERY value import on every page (node_modules,
// `@/`, relative) stays fast — no basename pre-filter, because that filter was
// unsound (a renamed path alias / symlink resolves to a raw file under a
// different last segment; round-7 latent finding).
const RESOLVE_CACHE = ts.createModuleResolutionCache(CWD, (f) => f, RESOLVE_OPTS)

/** Resolve a specifier to its canonical (realpath'd) absolute file, or null. */
function canonicalTarget(spec, containingFile) {
  const r = ts.resolveModuleName(spec, containingFile, RESOLVE_OPTS, ts.sys, RESOLVE_CACHE).resolvedModule
  if (!r) return null
  try { return realpathSync(r.resolvedFileName) } catch { return r.resolvedFileName }
}

// Components that render a raw card / pin layer BUT apply the per-user hidden
// subtraction. Pages route through these instead of importing a raw renderer
// directly. Each must keep referencing an exclusion signal, or it is no longer
// trustworthy.
const WRAPPERS = [
  'components/search/HideAwareListingGrid.tsx',
  'components/search/SearchResults.tsx',
  'components/search/MapSearchView.tsx',
  'components/search/MapSearchView.tsx',
  'components/site/HideAwareVideoGrid.tsx',
  'components/search/HideAwareSearchMap.tsx',
]
const EXCLUSION_IDENTIFIERS = new Set(['excludeHiddenListings', 'isHiddenListing', 'getHiddenListingKeys'])

// Pages that legitimately render raw cards WITHOUT the hidden subtraction because
// they are NOT a browse of for-sale inventory. Each needs a real reason.
const CURATED_ALLOWLIST = new Map([
  ['app/account/hidden/page.tsx', "shows the user's HIDDEN homes on purpose — subtracting them would empty the page"],
  ['app/account/collections/[id]/page.tsx', "the user's own saved collection; filtering their explicit picks by a hide flag would be wrong"],
  ['app/account/page.tsx', "account dashboard: the user's own saved + recently-viewed tiles, not a search"],
  ['app/account/history/page.tsx', "the user's own viewing history, not a browse of inventory"],
  ['app/account/saved-homes/page.tsx', "the user's own saved homes, not a browse of inventory"],
])

function parse(src) {
  return ts.createSourceFile('f.tsx', src, ts.ScriptTarget.Latest, /* setParentNodes */ false, ts.ScriptKind.TSX)
}

// The specifier STRINGS this source VALUE-imports (default binding, namespace
// `* as X`, a named import with at least one non-type specifier, OR a dynamic
// `import('...')` — e.g. `dynamic(() => import('.../ListingCard'))`). `import
// type ...` and `{ type X }`-only static imports render nothing, so they are
// excluded. Specifiers come back DECODED (unicode escapes resolved).
function valueImportedSpecifiers(src) {
  const sf = parse(src)
  const specs = new Set()
  // Static imports.
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    const spec = stmt.moduleSpecifier
    if (!ts.isStringLiteral(spec)) continue
    const clause = stmt.importClause
    if (!clause || clause.isTypeOnly) continue // side-effect or `import type`
    let isValue = false
    if (clause.name) isValue = true // default binding
    const nb = clause.namedBindings
    if (nb) {
      if (ts.isNamespaceImport(nb)) isValue = true // import * as X
      else if (ts.isNamedImports(nb) && nb.elements.some((el) => !el.isTypeOnly)) isValue = true
    }
    if (isValue) specs.add(spec.text)
  }
  // Every OTHER way a page can pull in a module at a string literal:
  //   - dynamic `import('...')` (next/dynamic, lazy, React.lazy)
  //   - CommonJS `require('...')` (a CallExpression whose callee is `require`)
  //   - TS `import x = require('...')` (ImportEqualsDeclaration)
  // A bare `require()` never enters an ImportDeclaration, so it must be walked
  // for explicitly — Turbopack/webpack resolve a string-literal require the same
  // as an import, so it renders the raw module just the same (round-7 bypass).
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isDynImport = callee.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
      if (isDynImport || isRequire) {
        const arg = node.arguments[0]
        if (arg && ts.isStringLiteral(arg)) specs.add(arg.text)
      }
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const e = node.moduleReference.expression
      if (e && ts.isStringLiteral(e)) specs.add(e.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return specs
}

/** The RAW_LISTING_MODULES a page value-imports, matched by RESOLVED file (so a
 *  relative / aliased / `.`-laden / renamed-alias spelling all count), not by
 *  literal text. Every value specifier is resolved — no basename shortcut. */
function importedRawModules(src, pageFile, rawTargets) {
  const hit = new Set()
  for (const spec of valueImportedSpecifiers(src)) {
    const target = canonicalTarget(spec, pageFile)
    if (target && rawTargets.has(target)) hit.add(rawTargets.get(target))
  }
  return [...hit]
}

// Does this source reference an exclusion primitive as a REAL identifier
// (import binding or call)? A mention in a comment or string is not an
// Identifier node, so it cannot fake integrity.
function referencesExclusion(src) {
  let found = false
  const visit = (node) => {
    if (found) return
    if (ts.isIdentifier(node) && EXCLUSION_IDENTIFIERS.has(node.text)) { found = true; return }
    ts.forEachChild(node, visit)
  }
  visit(parse(src))
  return found
}

// Recursively collect every app/**/page.tsx.
function walkPages(dir, out) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walkPages(full, out)
    else if (e.name === 'page.tsx' || e.name === 'page.ts' || e.name === 'page.jsx') out.push(full)
  }
}

const problems = []

// Resolve the raw modules to canonical files ONCE (from a repo-root dummy). A
// page import counts as a raw import when it resolves to one of THESE files.
const DUMMY_CONTAINER = join(CWD, '__hidden_exclusion_resolve__.tsx')
const RAW_TARGETS = new Map() // canonical path -> the `@/` module name (for messages)
for (const mod of RAW_LISTING_MODULES) {
  const target = canonicalTarget(mod, DUMMY_CONTAINER)
  if (target) RAW_TARGETS.set(target, mod)
  else problems.push(`RAW_LISTING_MODULES entry does not resolve: ${mod} — the module moved; update the gate.`)
}

// 1. Wrapper integrity.
for (const w of WRAPPERS) {
  if (!existsSync(w)) { problems.push(`wrapper missing: ${w} — update WRAPPERS if it moved.`); continue }
  if (!referencesExclusion(readFileSync(w, 'utf8'))) {
    problems.push(`${w}: an exclusion-aware wrapper no longer references the hidden-exclusion primitive (excludeHiddenListings / isHiddenListing / getHiddenListingKeys) as a real identifier. It renders raw cards/pins, so losing exclusion re-opens the leak.`)
  }
}

// 2. Discovery: every page that value-imports a raw renderer (by RESOLVED file,
//    any spelling) must be a wrapper route or allowlisted.
const pages = []
walkPages('app', pages)
for (const abs of pages) {
  const rel = relative(CWD, abs).replace(/\\/g, '/')
  const imported = importedRawModules(readFileSync(abs, 'utf8'), abs, RAW_TARGETS)
  if (imported.length === 0) continue
  if (CURATED_ALLOWLIST.has(rel)) continue
  problems.push(`${rel}: value-imports a raw listing renderer (${imported.join(', ')}) but is not a hidden-exclusion wrapper route and not in the curated allowlist. A browse of for-sale inventory must render listings through an exclusion-aware wrapper (${WRAPPERS.map((w) => w.split('/').pop()).join(' / ')}) so hidden homes are subtracted — or add it to CURATED_ALLOWLIST with a reason if it is genuinely not a browse (the user's own saved/hidden list, a marketing strip).`)
}

// 3. Stale allowlist entries (a rename left a dead reason behind).
for (const [f] of CURATED_ALLOWLIST) {
  if (!existsSync(f)) problems.push(`CURATED_ALLOWLIST entry no longer exists on disk: ${f} — remove it.`)
}

console.log('Hidden-exclusion browse-surface gate (ci:hidden-exclusion-surfaces)')
console.log('==================================================================')
console.log(`wrappers: ${WRAPPERS.length} · pages scanned: ${pages.length} · curated-allowlisted: ${CURATED_ALLOWLIST.size} · parser: typescript ${ts.version}`)
if (problems.length) {
  console.error(`\n\x1b[31m✗ ci:hidden-exclusion-surfaces: ${problems.length} problem(s)\x1b[0m`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('✓ Every browse of for-sale inventory subtracts hidden homes through an exclusion-aware wrapper; no page renders raw listing renderers uncovered.')
process.exit(0)
