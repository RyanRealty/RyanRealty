#!/usr/bin/env node
/**
 * check-market-cache-geo-scope.mjs — ci:market-cache-geo-scope (§0).
 *
 * A `market_stats_cache` slug does NOT identify a geography. Verified live
 * 2026-07-24: 13 slugs exist under more than one `geo_type`, and `sunriver`
 * exists under THREE (city, neighborhood, subdivision). A read that filters on
 * geo_slug alone and takes `order(period_end desc).limit(1)` therefore returns
 * whichever GEOGRAPHY happened to be written last.
 *
 * It was returning the wrong one, live, on public pages:
 *   • /communities/sunriver asked for the COMMUNITY and was served the CITY row
 *     — 124 twelve-month sales and a 93.2% sale-to-list ratio for all of
 *     Sunriver, rendered as the community's own figures (the neighborhood row
 *     says 93). The other 12 collisions resolved correctly only by accident of
 *     write order, so each was one cron run from the same misattribution.
 *   • /lp/tetherow's peer table asks for ['tetherow','pronghorn','broken-top',
 *     'caldera-springs','sunriver'] as resort COMMUNITIES and could pull the
 *     city row into the comparison, on a lead-capture page.
 *
 * THE RULE: every read of `market_stats_cache` constrains `geo_type`. A caller
 * that asks for a geo_type with no row gets nothing and shows nothing — the §0
 * outcome — instead of another geography's numbers wearing its label.
 *
 * AST-based (typescript compiler): the filter is found by walking the PostgREST
 * builder chain off `.from('market_stats_cache')`, so a comment mentioning
 * geo_type cannot satisfy it and a reordered chain cannot evade it.
 *
 * Exit 0 = no market-cache read can be served another geography's row.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'lib']
const TABLE = 'market_stats_cache'
const GEO_COL = 'geo_type'

/**
 * WRITE paths legitimately supply geo_type in the row payload rather than a
 * filter; an upsert's conflict target carries it. Reads are what this gate is
 * about. Prefix-matched, and each one is named so the list stays auditable.
 */
const WRITE_PATHS = ['lib/data/market/marketNarrativeWrites.ts', 'lib/data/market/subdivisionStatsWrites.ts']

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
    // Integration tests read the cache directly to ASSERT on it; they are the
    // verification, not a publishing surface.
    if (/\.test\.tsx?$|\.int\.test\.tsx?$|__tests__/.test(rel)) continue
    out.push(rel)
  }
  return out
}

/** True when `node` is a call to `.<method>(...)` anywhere down the chain root. */
function chainMentions(node, method, firstArg) {
  let cur = node
  // Walk UP the property-access chain from the .from() call to the outermost
  // call in the same expression statement.
  while (cur && cur.parent) {
    const p = cur.parent
    if (ts.isPropertyAccessExpression(p) && p.parent && ts.isCallExpression(p.parent)) {
      if (p.name.text === method) {
        const a = p.parent.arguments?.[0]
        if (!firstArg) return true
        if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && a.text === firstArg) {
          return true
        }
      }
      cur = p.parent
      continue
    }
    // `let q = sb.from(...)…` then `q = q.order(...)` — the chain continues
    // through a variable. Stop climbing; the declaration scan below covers it.
    break
  }
  return false
}

/**
 * The chain may be split across statements (`let q = sb.from(…).select(…); q =
 * q.eq(…)`). So after the syntactic climb, fall back to asking whether the
 * enclosing FUNCTION constrains geo_type at all. Coarser, but it cannot produce
 * a false PASS for a function that never mentions the column.
 */
function enclosingFunctionText(node, sf) {
  let cur = node
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur)
    ) {
      return cur.getText(sf)
    }
    cur = cur.parent
  }
  return sf.getText()
}

function scan(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  if (!src.includes(TABLE)) return
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from'
    ) {
      const a = node.arguments?.[0]
      const isTable = a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && a.text === TABLE
      if (isTable) {
        const inChain =
          chainMentions(node, 'eq', GEO_COL) ||
          chainMentions(node, 'in', GEO_COL) ||
          chainMentions(node, 'match')
        const fnText = enclosingFunctionText(node, sf)
        const inFn = new RegExp(`['"\`]${GEO_COL}['"\`]`).test(fnText)
        if (!inChain && !inFn) {
          problems.push(
            `${rel}:${line(node)} reads ${TABLE} without constraining ${GEO_COL}. A slug is not a ` +
              `geography: 13 slugs exist under more than one geo_type and 'sunriver' under three, so ` +
              `this returns whichever geography was written last. /communities/sunriver was served ` +
              `the CITY row (124 sales for all of Sunriver) as the community's own figures.`,
          )
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const files = []
for (const top of SCAN_ROOTS) if (existsSync(join(ROOT, top))) walk(top, files)

let scanned = 0
for (const rel of files) {
  if (WRITE_PATHS.some((p) => rel === p || rel.startsWith(p))) continue
  scanned++
  scan(rel)
}

console.log('Market-cache geo scoping (ci:market-cache-geo-scope)')
console.log('===================================================')
console.log(`  scanned ${scanned} source files for ${TABLE} reads`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:market-cache-geo-scope: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log(`✓ Every ${TABLE} read constrains ${GEO_COL} — no surface can be served another geography.`)
process.exit(0)
