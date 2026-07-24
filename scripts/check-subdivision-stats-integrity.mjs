#!/usr/bin/env node
/**
 * check-subdivision-stats-integrity.mjs — ci:subdivision-stats-integrity (W2.1/W2.4).
 *
 * The subdivision stats producer→consumer has three §0 invariants a code change
 * could silently break, reintroducing the exact hazards this feature fixed. The
 * live-DB int test (subdivision-stats.int.test.ts) proves the NUMBERS trace, but
 * it skips without DB creds — so this STATIC gate (in ci:gates) guards the WIRING
 * that keeps those numbers correct, and bites in a secret-less CI:
 *
 *   1. CITY SCOPING (anti-collision). The producer function must scope by BOTH
 *      "City" AND "SubdivisionName" — never name-only. Name-only merges same-named
 *      subdivisions across cities (Summerfield exists in Medford AND Redmond).
 *   2. WRITE-KEY == READ-KEY. The writer must key the cache row on slugify(alias),
 *      the exact string /subdivisions/[slug] passes to getMarketStats, and must
 *      pass the exact City + SubdivisionName for scoping.
 *   3. CONSUMER PERIOD. The subdivision page must read periodType 'ytd' — the
 *      stable period the writer populates (default rolling_90d is unpopulated and
 *      too thin per ODS).
 *
 * AST-based per docs (never regex a call site). Exit 0 = all invariants hold.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const problems = []

const MIGRATION = join(ROOT, 'supabase/migrations/20260724030000_compute_subdivision_period_stats.sql')
const WRITER = join(ROOT, 'lib/data/market/subdivisionStatsWrites.ts')
const PAGE = join(ROOT, 'app/subdivisions/[slug]/page.tsx')

// ── 1. Producer scopes by City AND SubdivisionName (the migration SQL) ──────────
if (!existsSync(MIGRATION)) {
  problems.push(`producer migration missing: ${MIGRATION}`)
} else {
  const sql = readFileSync(MIGRATION, 'utf8')
  // The close-window predicate must carry both scoping columns bound to the params.
  const hasCity = /"City"\s*=\s*p_city/.test(sql)
  const hasName = /"SubdivisionName"\s*=\s*p_subdivision_name/.test(sql)
  if (!hasCity) problems.push('producer does not scope by "City" = p_city (cross-city merge risk)')
  if (!hasName) problems.push('producer does not scope by "SubdivisionName" = p_subdivision_name')
  // No name-only reconstruction (the shared RPC bug): initcap(p_geo_slug) must not be the scope.
  if (/"SubdivisionName"\s*=\s*initcap\s*\(/.test(sql)) {
    problems.push('producer scopes by initcap(p_geo_slug) — the name-only collision bug')
  }
}

// ── AST helpers ─────────────────────────────────────────────────────────────
function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}
function findCalls(node, pred, out = []) {
  if (ts.isCallExpression(node) && pred(node)) out.push(node)
  // NB: the callback must return undefined — forEachChild short-circuits on any
  // truthy return, so `(c) => findCalls(...)` (returns the array) would stop after
  // the first child. Use a block body.
  node.forEachChild((c) => {
    findCalls(c, pred, out)
  })
  return out
}
/** keys of the FIRST object-literal argument of a call. */
function objArgKeys(call) {
  const arg = call.arguments.find((a) => ts.isObjectLiteralExpression(a))
  if (!arg) return null
  return arg.properties
    .filter(ts.isPropertyAssignment)
    .map((p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null))
    .filter(Boolean)
}
/** string value of a named property in the first object-literal arg. */
function objArgProp(call, key) {
  const arg = call.arguments.find((a) => ts.isObjectLiteralExpression(a))
  if (!arg) return null
  const prop = arg.properties.find(
    (p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key,
  )
  if (!prop || !ts.isPropertyAssignment(prop)) return null
  return ts.isStringLiteral(prop.initializer) ? prop.initializer.text : '<non-literal>'
}

// ── 2. Writer: .rpc('compute_subdivision_period_stats', {p_geo_slug,p_city,p_subdivision_name,...}) ──
if (!existsSync(WRITER)) {
  problems.push(`writer missing: ${WRITER}`)
} else {
  const src = readFileSync(WRITER, 'utf8')
  const sf = parse(WRITER)
  const rpcCalls = findCalls(sf, (call) => {
    if (!ts.isPropertyAccessExpression(call.expression)) return false
    if (call.expression.name.text !== 'rpc') return false
    const first = call.arguments[0]
    return first && ts.isStringLiteral(first) && first.text === 'compute_subdivision_period_stats'
  })
  if (rpcCalls.length === 0) {
    problems.push('writer does not call .rpc("compute_subdivision_period_stats") — producer unwired')
  } else {
    const keys = objArgKeys(rpcCalls[0]) ?? []
    for (const req of ['p_geo_slug', 'p_city', 'p_subdivision_name', 'p_period_type', 'p_period_start']) {
      if (!keys.includes(req)) problems.push(`writer rpc call is missing the "${req}" argument`)
    }
  }
  // write-key must be slugify(alias) — the writer must call slugify and use it as the geo_slug.
  if (!/p_geo_slug\s*:\s*slug\b/.test(src) || !/const\s+slug\s*=\s*slugify\(/.test(src)) {
    problems.push('writer does not derive p_geo_slug from slugify(alias) — write-key != page read-key')
  }
}

// ── 3. Consumer: subdivision page reads getMarketStats geoType:'subdivision' periodType:'ytd' ──
if (!existsSync(PAGE)) {
  problems.push(`consumer page missing: ${PAGE}`)
} else {
  const sf = parse(PAGE)
  const gmsCalls = findCalls(sf, (call) => ts.isIdentifier(call.expression) && call.expression.text === 'getMarketStats')
  const subCall = gmsCalls.find((c) => objArgProp(c, 'geoType') === 'subdivision')
  if (!subCall) {
    problems.push('subdivision page has no getMarketStats({geoType:"subdivision"}) call')
  } else if (objArgProp(subCall, 'periodType') !== 'ytd') {
    problems.push(`subdivision getMarketStats periodType is "${objArgProp(subCall, 'periodType')}", must be "ytd" (the populated, ODS-safe period)`)
  }
}

console.log('Subdivision stats integrity gate (ci:subdivision-stats-integrity)')
console.log('================================================================')
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:subdivision-stats-integrity: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Producer scopes by city+name; write-key = slugify(alias); consumer reads ytd.')
process.exit(0)
