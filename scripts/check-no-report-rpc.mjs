#!/usr/bin/env node
/**
 * check-no-report-rpc.mjs — ci:no-report-rpc (W8.1).
 *
 * ONE GENERATION PATH. Public market numbers come from market_stats_cache /
 * market_pulse_live, never from live aggregation over raw `listings`
 * (CLAUDE.md §0 + docs/DATABASE_FOR_AI_AGENTS.md "Don't aggregate raw listings
 * for market reports — use the cache").
 *
 * This gate exists because the second path was not hypothetical: /reports rendered
 * cache-based headline cards directly above an RPC-based table, and the two
 * published contradictory verdicts for the same city on one screen (Bend read
 * 507 active · MoS 3.9 "seller's market" in the card and 984 active · MoS 5.3
 * "balanced market" in the table). W8.1 migrated every public consumer onto the
 * cache. This gate keeps them there.
 *
 * WHAT IT BANS — outside the allowlist, a file may not:
 *   1. call supabase.rpc('get_city_period_metrics' | 'get_city_price_bands' |
 *      'get_city_metrics_timeseries', …)
 *   2. import getReportMetrics / getReportPriceBands / getReportMetricsTimeSeries
 *      from '@/app/actions/reports' (the wrappers around those RPCs)
 *
 * WHO IS ALLOWED (and why each is legitimate, not grandfathered debt):
 *   - app/actions/reports.ts — the wrapper definitions themselves.
 *   - app/admin/** — the ADMIN custom-report tools (arbitrary date range +
 *     property-type + price-band filters). A fixed-period cache cannot express
 *     those queries; these surfaces are internal, never public pages.
 *   - app/api/cron/market-stat-consistency/** — the MONITOR. Its entire job is
 *     comparing the RPC path against the cache path and alerting on |delta| > 1%.
 *     Banning the RPC here would delete the cross-check.
 *
 * AST-based (typescript compiler), never regex: a comment mentioning the RPC name
 * or a string in prose must not fail the build, and a renamed import must not
 * sneak past. See memory reference_code_inspecting_gates_use_ast.
 *
 * Exit 0 = no public surface reads the raw-listings report RPCs.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

const BANNED_RPCS = new Set([
  'get_city_period_metrics',
  'get_city_price_bands',
  'get_city_metrics_timeseries',
])

const BANNED_WRAPPERS = new Set([
  'getReportMetrics',
  'getReportPriceBands',
  'getReportMetricsTimeSeries',
])

/** Paths permitted to reach the RPC. Prefix-matched against the repo-relative path. */
const ALLOWED_PREFIXES = [
  'app/actions/reports.ts',
  'app/admin/',
  'app/api/cron/market-stat-consistency/',
]

const SCAN_ROOTS = ['app', 'components', 'lib']

const problems = []

function isAllowed(rel) {
  return ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p))
}

function walk(dir, out) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name)
    if (rel.includes('node_modules') || rel.includes('.next')) continue
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) {
      walk(rel, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.test\.tsx?$|\.int\.test\.tsx?$|__tests__/.test(rel)) continue
    out.push(rel)
  }
  return out
}

/** The literal text of a call's first argument, when it is a plain string. */
function firstStringArg(node) {
  const a = node.arguments?.[0]
  if (!a) return null
  if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return a.text
  return null
}

function scan(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  // Cheap pre-filter: if neither an RPC name nor a wrapper name appears anywhere
  // in the text, the AST cannot contain one either.
  let touches = false
  for (const n of BANNED_RPCS) if (src.includes(n)) touches = true
  for (const n of BANNED_WRAPPERS) if (src.includes(n)) touches = true
  if (!touches) return

  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  // Pre-pass: identifiers bound to a banned RPC name, so `const N = 'get_city_…'`
  // followed by `.rpc(N)` is caught rather than read as an opaque identifier.
  const bannedConstNames = new Set()
  const collectConsts = (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
      BANNED_RPCS.has(n.initializer.text)
    ) {
      bannedConstNames.add(n.name.text)
    }
    ts.forEachChild(n, (c) => {
      collectConsts(c)
    })
  }
  collectConsts(sf)

  const visit = (node) => {
    // 1. supabase.rpc('get_city_*', …)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc'
    ) {
      const name = firstStringArg(node)
      if (name && BANNED_RPCS.has(name)) {
        problems.push(
          `${rel}:${line(node)} calls .rpc('${name}') — that RPC aggregates raw \`listings\`. ` +
            `Public market numbers must come from market_stats_cache / market_pulse_live ` +
            `(getCityMarketDetail, getMarketPulse, getPriceHistory, getCityRangeReport).`,
        )
      }
    }

    // 1b. supabase.rpc(CONST) where CONST is a module-level string holding a
    //     banned name — the indirection a determined bypass reaches for first.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc'
    ) {
      const a = node.arguments?.[0]
      if (a && ts.isIdentifier(a) && bannedConstNames.has(a.text)) {
        problems.push(
          `${rel}:${line(node)} calls .rpc(${a.text}) where ${a.text} holds a retired ` +
            `raw-\`listings\` RPC name. Read the cache instead.`,
        )
      }
    }

    // 2. Any import FORM that pulls a banned wrapper out of app/actions/reports:
    //    named, aliased, namespace (`import * as R`), or a re-export.
    const isReportsModule = (spec) =>
      spec === '@/app/actions/reports' || /(^|\/)app\/actions\/reports$/.test(spec)

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isReportsModule(node.moduleSpecifier.text)
    ) {
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : node.exportClause
      const kind = ts.isImportDeclaration(node) ? 'imports' : 're-exports'

      // `import * as R from '@/app/actions/reports'` — the whole surface, so any
      // banned member is reachable as R.getReportMetrics(...).
      if (bindings && ts.isNamespaceImport(bindings)) {
        problems.push(
          `${rel}:${line(bindings)} namespace-imports @/app/actions/reports as ` +
            `'${bindings.name.text}' — that exposes the raw-\`listings\` RPC wrappers. ` +
            `Import the specific cache DAL you need instead.`,
        )
      } else if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) {
        for (const el of bindings.elements) {
          // propertyName is the ORIGINAL name when aliased (`x as y`).
          const original = (el.propertyName ?? el.name).text
          if (BANNED_WRAPPERS.has(original)) {
            problems.push(
              `${rel}:${line(el)} ${kind} ${original} from @/app/actions/reports — that wrapper ` +
                `calls a raw-\`listings\` RPC. Read the cache instead (getCityRangeReport for the ` +
                `/reports table, getCityMarketDetail + getMarketPulse for a single geo).`,
            )
          }
        }
      }
    }

    // 2b. Dynamic access: `await import('@/app/actions/reports')` and
    //     `require('@/app/actions/reports')` both hand back the whole module.
    if (ts.isCallExpression(node)) {
      const isDynImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynImport || isRequire) {
        const spec = firstStringArg(node)
        if (spec && isReportsModule(spec)) {
          problems.push(
            `${rel}:${line(node)} ${isRequire ? 'require()s' : 'dynamically imports'} ` +
              `@/app/actions/reports — that module's report wrappers call raw-\`listings\` RPCs. ` +
              `Read the cache instead.`,
          )
        }
      }
    }

    ts.forEachChild(node, (c) => {
      visit(c)
    })
  }
  visit(sf)
}

const files = []
for (const top of SCAN_ROOTS) if (existsSync(join(ROOT, top))) walk(top, files)

let scanned = 0
for (const rel of files) {
  const norm = relative(ROOT, join(ROOT, rel))
  if (isAllowed(norm)) continue
  scanned++
  scan(norm)
}

console.log('Raw-listings report-RPC gate (ci:no-report-rpc)')
console.log('==============================================')
console.log(`  scanned ${scanned} source files outside the allowlist (${ALLOWED_PREFIXES.join(', ')})`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:no-report-rpc: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ No public surface reads get_city_period_metrics / _price_bands / _metrics_timeseries.')
process.exit(0)
