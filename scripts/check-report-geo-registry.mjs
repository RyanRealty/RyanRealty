#!/usr/bin/env node
/**
 * check-report-geo-registry.mjs — ci:report-geo-registry (W8.8).
 *
 * The report-coverage city sets (the "report core 7", the 11-city stat tier, the
 * 9-city /cities feature tier) were duplicated inline across getMarketReportData,
 * market-stat-consistency/compare, generate-market-report, getContactReport-
 * Subscriptions, the newsletter, market-report-types, and lib/cities — so a
 * coverage change had to be made in N places and silently drifted (the newsletter
 * fell a city behind the report core). They now live once in
 * lib/data/geo/report-cities.ts and every consumer imports from there.
 *
 * This gate keeps it that way: it fails the build if any array / Set / object
 * literal in the product code (app/, lib/, components/) — OUTSIDE the registry
 * and test files — spells out a set of Central Oregon city slugs/names that is
 * EXACTLY one of the registry's owned sets. Re-inlining a report list (in slug
 * OR display-name OR {slug,label} form) is caught; genuinely different city sets
 * (the service area, the housing-market page set with resorts, the pulse-tile
 * set, the pulse feed) are NOT flagged, because their member sets differ.
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast): parses with the real
 * TypeScript compiler and compares slug-normalized member SETS — never a regex
 * over source text. The canonical sets are read from the registry itself, so the
 * gate self-adjusts if the report core ever changes.
 *
 * Usage: node scripts/check-report-geo-registry.mjs   (npm run ci:report-geo-registry)
 * Exit: 0 = clean, 1 = a report list is inlined outside the registry.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const REGISTRY = 'lib/data/geo/report-cities.ts'
const SCAN_DIRS = ['app', 'lib', 'components']
const EXCLUDE_DIR_PREFIXES = ['lib/data/geo', 'node_modules', '.next']

function fail(msg) {
  console.error(`\n\x1b[31m✗ ci:report-geo-registry: ${msg}\x1b[0m`)
  process.exit(1)
}

/** Slugify a raw city name/slug the way route slugs are built, so a display name
 *  ("La Pine") and its slug ("la-pine") normalize to the same token. */
function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A canonical key for a set of members: sorted, slug-normalized, joined. */
function setKey(members) {
  return [...new Set(members.map(slugify))].sort().join('|')
}

/** Parse a TS/TSX file to a SourceFile (JSX-aware, comments/regex/templates
 *  handled natively by the compiler — the whole reason we don't regex). */
function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/**
 * The only property keys a PURE area-descriptor object may carry. An object-array
 * whose elements also carry DATA fields (lat/lng, counts, population, ...) is a
 * per-city DATA TABLE, not a bare list copy — it legitimately enumerates cities
 * to attach data (e.g. map-pin coordinates) and cannot import a plain list, so it
 * is NOT a W8.8 drift target. Only {slug}/{slug,label}/{value,label}-shaped
 * objects (a bare area list, like the retired CENTRAL_OREGON_CITIES) count.
 */
const AREA_DESCRIPTOR_KEYS = new Set(['slug', 'label', 'name', 'value'])

const propName = (p) =>
  ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : null

/**
 * Extract the member string list from an ArrayLiteralExpression IF it is a bare
 * city-list literal: either every element is a string literal, or every element
 * is a PURE area-descriptor object (only AREA_DESCRIPTOR_KEYS, carrying a
 * string-literal `slug`). Returns null for anything else — mixed arrays, spreads,
 * non-string members, or object elements that carry data fields (a data table).
 */
function cityMembersOf(arrayNode) {
  const els = arrayNode.elements
  if (els.length === 0) return null
  const strings = []
  let allStrings = true
  let allSlugObjects = true
  for (const el of els) {
    if (ts.isStringLiteralLike(el)) {
      strings.push(el.text)
      allSlugObjects = false
    } else if (ts.isObjectLiteralExpression(el)) {
      allStrings = false
      // A data field (any key outside AREA_DESCRIPTOR_KEYS) → this is a data
      // table (e.g. map pins with lat/lng), not a bare list. Skip the literal.
      const keys = el.properties.map(propName)
      if (keys.some((k) => k === null || !AREA_DESCRIPTOR_KEYS.has(k))) return null
      // Extract the city identifier from the FIRST descriptor prop present, in
      // priority order, so {slug}, {value,label} (the shadcn <Select> option
      // shape), and {name} object lists are ALL detected — not just {slug}. A
      // core-city list re-inlined as dropdown options must not evade the gate.
      let member = null
      for (const key of ['slug', 'value', 'name', 'label']) {
        const prop = el.properties.find((p) => propName(p) === key)
        if (prop && ts.isPropertyAssignment(prop) && ts.isStringLiteralLike(prop.initializer)) {
          member = prop.initializer.text
          break
        }
      }
      if (member === null) return null
      strings.push(member)
    } else {
      return null
    }
  }
  if (!allStrings && !allSlugObjects) return null
  return strings
}

/**
 * A report-coverage signature is only DISTINCTIVE at 7+ cities. Smaller subsets
 * (e.g. the newsletter's 6 = the report core minus Terrebonne) coincide with
 * unrelated service-area lists — the expired/FSBO detectors and the /cities quick
 * facts independently enumerate the same 6 primary cities — so owning a sub-7 set
 * would false-positive on lists that are NOT report coverage. The three report
 * tiers are 7 (core), 9 (/cities), 11 (stat), all ≥ this floor. Sub-7 registry
 * sets stay import-discipline-protected, not detected.
 */
const MIN_OWNED_SET_SIZE = 7

/** Read the registry and return the canonical owned sets: { name -> setKey }. */
function registryOwnedSets() {
  const text = readFileSync(join(ROOT, REGISTRY), 'utf8')
  const sf = parse(REGISTRY, text)
  const byName = {}
  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        let init = decl.initializer
        // unwrap `[...] as const`
        if (ts.isAsExpression(init)) init = init.expression
        if (ts.isArrayLiteralExpression(init)) {
          const members = cityMembersOf(init)
          if (members && members.length >= MIN_OWNED_SET_SIZE) byName[decl.name.text] = setKey(members)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return byName
}

function listFiles(dir) {
  const out = []
  const walk = (d) => {
    const rel = relative(ROOT, d)
    if (EXCLUDE_DIR_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))) return
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(full)
    }
  }
  walk(join(ROOT, dir))
  return out
}

const owned = registryOwnedSets()
const ownedKeys = new Map(Object.entries(owned).map(([name, key]) => [key, name]))
if (ownedKeys.size === 0) fail(`could not read any owned city set from ${REGISTRY} (registry shape changed?)`)

const violations = []
for (const dir of SCAN_DIRS) {
  for (const file of listFiles(dir)) {
    const rel = relative(ROOT, file)
    const text = readFileSync(file, 'utf8')
    // cheap prefilter: skip files with no city token at all
    if (!/bend|redmond|sisters|sunriver|tumalo|terrebonne|prineville|la-pine|la pine/i.test(text)) continue
    const sf = parse(rel, text)
    const visit = (node) => {
      if (ts.isArrayLiteralExpression(node)) {
        const members = cityMembersOf(node)
        if (members && members.length >= 3) {
          const key = setKey(members)
          const ownerName = ownedKeys.get(key)
          if (ownerName) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
            violations.push({ rel, line: line + 1, ownerName, count: members.length })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
}

console.log('Report-coverage geo registry gate (ci:report-geo-registry)')
console.log('=========================================================')
console.log(`registry: ${REGISTRY}`)
console.log(`owned sets: ${Object.keys(owned).join(', ')}`)

if (violations.length) {
  console.error('\nA report-coverage city list is inlined outside the registry:')
  for (const v of violations) {
    console.error(
      `  ✗ ${v.rel}:${v.line} — an inline ${v.count}-city literal equals the registry's ${v.ownerName}. ` +
        `Import it from @/lib/data/geo/report-cities instead of re-inlining.`,
    )
  }
  fail(`${violations.length} inlined report-city list(s). One registry, no copies.`)
}

console.log('\n✓ No report-coverage city list is inlined outside the registry.')
process.exit(0)
