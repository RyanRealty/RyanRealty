#!/usr/bin/env node
/**
 * check-days-to-pending-source.mjs — ci:days-to-pending-source (§0).
 *
 * "Median to pending" and "days on market" are different statistics about
 * different populations. Days-to-pending measures homes that WENT UNDER
 * CONTRACT: how fast the market absorbed them. Days-on-market of the ACTIVE set
 * measures homes that have NOT sold: how long unsold inventory has been sitting.
 * The second is systematically larger, because the homes that sell fast leave
 * the active set — so substituting it understates market speed, badly.
 *
 * `/zip` substituted it. `app/zip/[zip]/page.tsx` computed the median `dom` of
 * `status:'active'` tiles and passed it to `daysToPending` and
 * `medianDaysToPending`, which render as "Median to pending" in the market HUD,
 * "Pending in N days" in the hero, and "Median to pending" in the SELL section.
 * Verified live 2026-07-24 against `market_pulse_live` (Bend median-to-pending
 * = 15 days):
 *     97701 48 days · 97702 60 · 97703 62 · 97707 72 · 97756 51
 * A 3-5x overstatement in a hero line, in a seller-facing panel, and in Dataset
 * JSON-LD that Google ingests, on every ZIP in the sitemap. Six other surfaces
 * feed the same field correctly from `market_pulse_live`; /zip was the only one
 * that did not.
 *
 * The same defect was live on a SECOND public page: `/housing-market` fed
 * `median_active_dom` into a table column headed "Days to pending" — Sisters 85
 * where the real figure is 16, Bend 57 vs 15, Sunriver 69 vs 18, Powell Butte 85
 * vs 22 (live 2026-07-24). The correct column sat in the same `market_pulse_live`
 * row the whole time; the DAL simply never projected it.
 *
 * THE RULE: a value bound to a `daysToPending` / `medianDaysToPending` field may
 * not come from an ACTIVE-INVENTORY days-on-market aggregate. A tile- or
 * pulse-derived active-DOM figure belongs in `medianDomActive`, which carries its
 * own label ("Median on market · active").
 *
 * Deliberately NOT "must be pulse-sourced". Reading a real `days_to_pending`
 * column off CLOSED rows is correct and common — `lib/youtube-market-report`
 * and `lib/data/prospecting` both do it. Demanding a positive pulse provenance
 * flagged four such call sites as violations, and a gate that cries wolf gets
 * loosened until it stops biting at all.
 *
 * AST-based (typescript compiler), covering every binding form — property
 * assignment, variable declaration, JSX attribute, reassignment — because a gate
 * that checks only the shape its own fix used is not a gate (see repo memory
 * gate-written-by-the-fixer).
 *
 * Exit 0 = no surface publishes unsold-inventory age as market speed.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'lib']

/** Fields that PROMISE a to-pending measurement. */
const PENDING_FIELDS = /^(median)?[Dd]aysToPending$/

/**
 * Identifiers that mark an expression as a genuine TO-PENDING measurement —
 * either the pulse column or a `days_to_pending` value read off closed rows.
 */
const PENDING_SOURCE_TOKENS = [
  'medianDaysToPending',
  'median_days_to_pending',
  'daysToPending',
  'days_to_pending',
  'Dtp',
  'dtp',
]

/**
 * Identifiers that mark an expression as an ACTIVE-INVENTORY days-on-market
 * aggregate — the age of homes that have NOT sold. `median_active_dom` is the
 * `market_pulse_live` column whose name says exactly what it is, and which
 * /housing-market was publishing under a "Days to pending" header.
 */
const ACTIVE_DOM_TOKENS = [
  'medianDom',
  'median_dom',
  'median_active_dom',
  'medianDomActive',
  'medianActiveDom',
  'domMedian',
  'avgDom',
]

const problems = []

function walk(dir, out) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (rel.includes('node_modules') || rel.includes('.next')) continue
    if (statSync(join(ROOT, rel)).isDirectory()) {
      walk(rel, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.test\.tsx?$|__tests__/.test(rel)) continue
    out.push(rel)
  }
  return out
}

/** Every form that binds a name to a value. */
function bindings(node) {
  if (ts.isPropertyAssignment(node) && node.initializer) {
    const n = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null
    return n ? [{ name: n, expr: node.initializer, where: node }] : []
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    return [{ name: node.name.text, expr: node.initializer, where: node }]
  }
  if (
    ts.isJsxAttribute(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression
  ) {
    return [{ name: node.name.text, expr: node.initializer.expression, where: node }]
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const l = node.left
    const n = ts.isIdentifier(l)
      ? l.text
      : ts.isPropertyAccessExpression(l) && ts.isIdentifier(l.name)
        ? l.name.text
        : null
    return n ? [{ name: n, expr: node.right, where: node }] : []
  }
  return []
}

function scanFile(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  if (!/[Dd]aysToPending/.test(src)) return
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const visit = (node) => {
    for (const { name, expr, where } of bindings(node)) {
      if (!PENDING_FIELDS.test(name)) continue
      const text = src.slice(expr.getStart(), expr.getEnd())
      // `null` is always fine — a scope with no pulse row shows nothing.
      if (/^\s*null\s*$/.test(text)) continue
      const pendingSource = PENDING_SOURCE_TOKENS.some((t) => text.includes(t))
      const activeDom = ACTIVE_DOM_TOKENS.some((t) => text.includes(t))
      if (activeDom && !pendingSource) {
        problems.push(
          `${rel}:${line(where)} binds \`${name}\` to an ACTIVE-inventory days-on-market aggregate ` +
            `(${text.trim().slice(0, 60)}). That is how long UNSOLD homes have been SITTING, not how ` +
            `fast homes go pending, and it is systematically larger because the homes that sell fast ` +
            `leave the active set. /zip rendered "Pending in 62 days" against a real 15; ` +
            `/housing-market showed Sisters at 85 against a real 16. Read ` +
            `market_pulse_live.median_days_to_pending, or pass null and put this figure in ` +
            `\`medianDomActive\`, which is labeled "Median on market · active".`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const files = []
for (const top of SCAN_ROOTS) if (existsSync(join(ROOT, top))) walk(top, files)
for (const rel of files) scanFile(rel)

console.log('Days-to-pending provenance (ci:days-to-pending-source)')
console.log('=====================================================')
console.log(`  scanned ${files.length} source files`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:days-to-pending-source: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Every to-pending figure comes from market_pulse_live (or is null).')
process.exit(0)
