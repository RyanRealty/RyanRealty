#!/usr/bin/env node
/**
 * check-capture-scope.mjs — ci:capture-scope (ledger row W6.8).
 *
 * Matt's locked decision (2026-07-24): prospecting capture scope stays at
 * $500K+, single-family, six cities. The ledger row promises that widening it
 * later is "the promised one-constant change".
 *
 * It was not one constant. The scope was written out FOUR times: the six-city
 * list in `expired-listing-processor.ts` and again in `fsbo-detector.ts`, and
 * the price threshold in both of those plus a third time inline in the Zillow
 * `searchQueryState` builder. What held them together was two comments —
 * "must match SERVICE_AREA_CITIES … exactly" and "Keep in sync with
 * FSBO_MIN_LIST_PRICE below". A comment is not a mechanism, and two of those
 * copies are sent to an EXTERNAL service (Zillow) while the other two run the
 * local filter, so a drift would silently fetch a population the filter then
 * rejects — or admit one it should never have seen.
 *
 * THE RULE: the threshold and the city set are spelled out in ONE module,
 * lib/prospecting/capture-scope.ts. Every other file in the prospecting path
 * imports them.
 *
 * WHAT THIS GATE DOES NOT DO, on purpose: it does not pin the VALUES. Freezing
 * $500,000 here would make a future widen a two-place edit that includes this
 * gate — the opposite of what the row promises. It enforces single source; the
 * value is the owner's to change, in one line.
 *
 * AST-based (typescript compiler): a comment quoting the old threshold, or a doc
 * block explaining the history, must not fail the build.
 *
 * Exit 0 = capture scope has exactly one definition.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SOURCE = 'lib/prospecting/capture-scope.ts'

/**
 * The prospecting path — where a redefinition would actually change what gets
 * captured. Scoped rather than repo-wide so an unrelated 500000 (a price band, a
 * chart axis, a test fixture) is not swept in.
 */
const SCAN = [
  'lib/expired-listing-processor.ts',
  'lib/fsbo-detector.ts',
  'lib/fsbo-processor.ts',
  'lib/fsbo-craigslist.ts',
  'app/api/cron/detect-expired-listings',
  'app/api/cron/detect-fsbo',
  'app/api/cron/expired-outreach',
  'lib/prospecting',
]

const CITY_SET = ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine']
const problems = []

function filesUnder(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return []
  if (!statSync(abs).isDirectory()) return /\.(ts|tsx)$/.test(rel) ? [rel] : []
  const out = []
  for (const name of readdirSync(abs)) out.push(...filesUnder(join(rel, name)))
  return out
}

/** Numeric literal value, tolerating 500_000 and parenthesized forms. */
function numericValue(node) {
  if (!node) return null
  if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/g, ''))
  if (ts.isParenthesizedExpression(node)) return numericValue(node.expression)
  if (ts.isAsExpression(node)) return numericValue(node.expression)
  return null
}

/** The string elements of an array literal, when every element is a literal. */
function stringArray(node) {
  let n = node
  if (n && ts.isAsExpression(n)) n = n.expression
  if (!n || !ts.isArrayLiteralExpression(n)) return null
  const out = []
  for (const el of n.elements) {
    if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) out.push(el.text)
    else return null
  }
  return out
}

function scan(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const visit = (node) => {
    // A second copy of the threshold, in any expression position — a const, an
    // object property (the Zillow query builder's `price: { min: 500_000 }`), a
    // comparison, a default argument.
    const v = numericValue(node)
    if (v === 500000 && !ts.isPropertyAssignment(node.parent ?? {})) {
      problems.push(
        `${rel}:${line(node)} hardcodes the capture threshold (500000). Import ` +
          `CAPTURE_MIN_LIST_PRICE from ${SOURCE} — the ledger promises widening scope is a ` +
          `ONE-constant change, and a second copy makes it two.`,
      )
    } else if (v === 500000) {
      problems.push(
        `${rel}:${line(node)} hardcodes the capture threshold (500000) in a property. Import ` +
          `CAPTURE_MIN_LIST_PRICE from ${SOURCE}. This position feeds an external query in at least ` +
          `one file, so a drift changes what is FETCHED, not just what is kept.`,
      )
    }

    // A second copy of the city set (order-insensitive, so a reshuffle is caught).
    const arr = stringArray(node)
    if (arr && arr.length === CITY_SET.length) {
      const a = [...arr].map((s) => s.toLowerCase()).sort().join('|')
      const b = [...CITY_SET].map((s) => s.toLowerCase()).sort().join('|')
      if (a === b) {
        problems.push(
          `${rel}:${line(node)} re-declares the six-city service area. Import ` +
            `CAPTURE_SERVICE_AREA_CITIES from ${SOURCE}; the two copies used to be held together ` +
            `by a comment reading "must match … exactly".`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

if (!existsSync(join(ROOT, SOURCE))) {
  problems.push(`${SOURCE} is missing — capture scope has no single source to point at.`)
} else {
  // The source must actually DEFINE both, or this gate is guarding nothing.
  const srcText = readFileSync(join(ROOT, SOURCE), 'utf8')
  for (const name of ['CAPTURE_MIN_LIST_PRICE', 'CAPTURE_SERVICE_AREA_CITIES']) {
    if (!new RegExp(`export const ${name}\\b`).test(srcText)) {
      problems.push(`${SOURCE} does not export ${name} — the single source is incomplete.`)
    }
  }
}

const files = [...new Set(SCAN.flatMap(filesUnder))].filter((f) => f !== SOURCE && !/\.test\.tsx?$/.test(f))
for (const rel of files) scan(rel)

console.log('Prospecting capture scope (ci:capture-scope)')
console.log('===========================================')
console.log(`  single source: ${SOURCE} · scanned ${files.length} prospecting file(s)`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:capture-scope: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Capture scope is defined once — widening it stays a one-constant change.')
process.exit(0)
