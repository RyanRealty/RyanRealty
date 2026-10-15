#!/usr/bin/env node
/**
 * check-market-metric-cached.mjs (ci:market-metric-cached)
 *
 * public.market_metric is a 1.5M-row history table. Uncached PostgREST
 * selects from pages and routes were 41–63% of production DB time on
 * 2026-10-14 (7,635 calls, 539ms mean) and pinned the MEDIUM instance
 * into swap. Reads go through lib/data/market-truth, each wrapped in
 * unstable_cache (≥1h). A page or route that queries the table live fails.
 *
 * RULES (TypeScript AST)
 *   R1  app/ and components/ runtime files never call .from('market_metric').
 *   R2  A lib/ file that does must import unstable_cache from the door
 *       (@/lib/data/cache/next-cache) and call it.
 *
 * Scope: tracked/untracked .ts/.tsx under app/, components/, lib/.
 * Out: tests, scripts/, node_modules/, .next/.
 *
 * Usage: node scripts/check-market-metric-cached.mjs [--report] [--json]
 * Break-tests: scripts/__tests__/check-market-metric-cached.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const DOOR = '@/lib/data/cache/next-cache'
export const TABLE = 'market_metric'
const SOURCE_EXT = /\.(ts|tsx)$/
const OUT_OF_SCOPE = [
  /^node_modules\//,
  /^\.next\//,
  /^scripts\//,
  /^test\//,
  /(^|\/)__tests__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
]

function isTableLiteral(node) {
  return node && ts.isStringLiteralLike(node) && node.text === TABLE
}

function isFromCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'from' &&
    node.arguments.length > 0 &&
    isTableLiteral(node.arguments[0])
  )
}

function isDoorModule(node) {
  return node && ts.isStringLiteralLike(node) && node.text === DOOR
}

/** Violations (strings) in one file's source. */
export function scanSource(rel, text) {
  if (!text.includes(TABLE) && !text.includes('market_metric')) return []
  const sf = ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`
  const fromHits = []
  let importsDoorCache = false
  let callsUnstableCache = false
  const visit = (node) => {
    if (isFromCall(node)) fromHits.push(at(node))
    if (ts.isImportDeclaration(node) && isDoorModule(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if ((el.propertyName ?? el.name).text === 'unstable_cache') importsDoorCache = true
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'unstable_cache'
    ) {
      callsUnstableCache = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (!fromHits.length) return []
  const isAppOrComponent = /^(app|components)\//.test(rel)
  if (isAppOrComponent) {
    return fromHits.map((hit) => `${hit} queries ${TABLE} from a page/route/component; use lib/data/market-truth`)
  }
  if (!importsDoorCache || !callsUnstableCache) {
    return fromHits.map(
      (hit) =>
        `${hit} queries ${TABLE} without wrapping unstable_cache from ${DOOR}`,
    )
  }
  return []
}

export function inScope(rel) {
  if (!SOURCE_EXT.test(rel)) return false
  return !OUT_OF_SCOPE.some((re) => re.test(rel))
}

function gitFiles(root) {
  const out = execFileSync('git', ['ls-files', 'app', 'components', 'lib'], {
    cwd: root,
    encoding: 'utf8',
  })
  return out.split('\n').filter(Boolean)
}

export function audit(root = join(dirname(fileURLToPath(import.meta.url)), '..')) {
  const violations = []
  for (const rel of gitFiles(root).filter(inScope)) {
    const text = readFileSync(join(root, rel), 'utf8')
    violations.push(...scanSource(rel, text))
  }
  return violations
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const REPORT = process.argv.includes('--report')
  const JSON_OUT = process.argv.includes('--json')
  const violations = audit()
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({ ok: violations.length === 0, violations }, null, 2) + '\n')
  } else if (violations.length) {
    console.error(`ci:market-metric-cached: ${violations.length} problem(s)`)
    for (const v of violations) console.error(`  ${v}`)
  } else {
    console.log('ci:market-metric-cached: OK. market_metric reads are cached through lib/data/market-truth.')
  }
  if (!REPORT && violations.length) process.exit(1)
}
