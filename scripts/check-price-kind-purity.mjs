#!/usr/bin/env node
/**
 * check-price-kind-purity.mjs — ci:price-kind-purity (§0).
 *
 * A LIST price is what a seller is asking. A SALE price is what a buyer paid.
 * They are different numbers about different homes, and a surface that labels
 * one and publishes the other is publishing a wrong figure with a straight face.
 *
 * THIS IS NOT HYPOTHETICAL. `CityMarketStats` carried a single ambiguous
 * `medianPrice`, filled from `market_pulse_live.median_list_price` on one path
 * and `market_stats_cache.median_sale_price` on another. `market_pulse_live`
 * carries NO neighborhood or subdivision rows (verified live 2026-07-24 — 17
 * rows, all city or region), so the cache path was the ORDINARY path for a
 * resort community, and /communities/widgi-creek rendered a $1,169,500 median
 * CLOSED SALE price under the label "Median list", beside an active count of 48.
 * Nothing in the type, the mappers, or the page said which number it was.
 *
 * TWO RULES:
 *
 *   1. CROSS-KIND ASSIGNMENT (repo-wide). A property named for one price kind
 *      may not be initialized from an expression that mentions the other kind.
 *      `medianListPrice: cached.median_sale_price` fails. This is what makes the
 *      kind-explicit names load-bearing rather than decorative.
 *
 *   2. NO AMBIGUOUS PRICE FIELD in the market-stats contract. `medianPrice` /
 *      `avgPrice` may not reappear on `CityMarketStats` or be returned by
 *      app/actions/market-stats.ts. Rule 1 cannot protect a field whose name
 *      does not say what it measures — an ambiguous name is how the defect got
 *      in, so the name is banned where the defect lived.
 *
 * AST-based (typescript compiler), never regex over whole files: a comment or a
 * doc block discussing the bug must not fail the build. See memory
 * reference_code_inspecting_gates_use_ast.
 *
 * Exit 0 = no asking price is satisfied from a closed-sale figure.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'lib']

/** Property names that PROMISE a kind. Anything else is out of scope. */
const LIST_FIELDS = /^(median|avg|average)_?[Ll]ist_?[Pp]rice$|^medianList$/
const SALE_FIELDS = /^(median|avg|average)_?[Ss]ale_?[Pp]rice$|^medianSale$/

/** Tokens that identify an expression as reading one kind or the other. */
const SALE_TOKENS = [
  'median_sale_price',
  'avg_sale_price',
  'medianSalePrice',
  'avgSalePrice',
  'ClosePrice',
  'closePrice',
  'salePrice',
]
const LIST_TOKENS = [
  'median_list_price',
  'avg_list_price',
  'medianListPrice',
  'avgListPrice',
  'ListPrice',
  'listPrice',
]

/**
 * The market-stats contract, where the ambiguous names are banned outright.
 * `listings.ts` holds the CityMarketStats declaration; `market-stats.ts` holds
 * the mappers that fill it.
 */
const CONTRACT_FILES = ['app/actions/listings.ts', 'app/actions/market-stats.ts']
const AMBIGUOUS = new Set(['medianPrice', 'avgPrice'])
const CONTRACT_TYPE = 'CityMarketStats'

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

/** Which kind an initializer expression reads, by the identifiers it touches. */
function kindOf(src, node) {
  const text = src.slice(node.getStart(), node.getEnd())
  const sale = SALE_TOKENS.some((t) => text.includes(t))
  const list = LIST_TOKENS.some((t) => text.includes(t))
  if (sale && !list) return 'sale'
  if (list && !sale) return 'list'
  return null // mixed or neither — this gate makes no claim
}

function scanFile(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  // Cheap pre-filter: no price identifier at all, nothing to say.
  if (!/[Ll]ist_?[Pp]rice|[Ss]ale_?[Pp]rice|ClosePrice/.test(src)) return
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const isContract = CONTRACT_FILES.includes(rel)

  /**
   * Every syntactic form that BINDS a name to a value. Rule 1 used to inspect
   * object-literal properties only, which missed the shape the D4 fix itself
   * ships in — `const medianListPrice = …` on the community page. Swapping that
   * one line to a sale median republished a closed median in the hero, the FAQ
   * text and the JSON-LD with the gate still green. A gate blind to the form its
   * own subject is written in is not a gate.
   */
  const bindings = (node) => {
    // `{ medianListPrice: <expr> }` — object literal / returned object.
    if (ts.isPropertyAssignment(node) && node.initializer) {
      const n = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null
      return n ? [{ name: n, expr: node.initializer, where: node }] : []
    }
    // `const medianListPrice = <expr>` / `let … =` — including the page-level
    // resolution every community surface reads from.
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      return [{ name: node.name.text, expr: node.initializer, where: node }]
    }
    // `<Comp medianListPrice={<expr>} />`
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression
    ) {
      return [{ name: node.name.text, expr: node.initializer.expression, where: node }]
    }
    // `x.medianListPrice = <expr>` / `medianListPrice = <expr>` — reassignment.
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

  const visit = (node) => {
    // RULE 1 — cross-kind binding, in ANY form that names a price field.
    for (const { name, expr, where } of bindings(node)) {
      const want = LIST_FIELDS.test(name) ? 'list' : SALE_FIELDS.test(name) ? 'sale' : null
      if (!want) continue
      const got = kindOf(src, expr)
      if (got && got !== want) {
        problems.push(
          `${rel}:${line(where)} \`${name}\` is a ${want.toUpperCase()} price field but is ` +
            `assigned from a ${got.toUpperCase()} price source. A median asking price and a ` +
            `median closed price are different numbers about different homes — publish the ` +
            `one the label promises, or publish nothing.`,
        )
      }
    }

    // RULE 2a — the ambiguous field may not reappear on the contract type.
    if (isContract && ts.isTypeAliasDeclaration(node) && node.name.text === CONTRACT_TYPE) {
      const members = ts.isTypeLiteralNode(node.type) ? node.type.members : []
      for (const m of members) {
        const n = m.name && ts.isIdentifier(m.name) ? m.name.text : null
        if (n && AMBIGUOUS.has(n)) {
          problems.push(
            `${rel}:${line(m)} ${CONTRACT_TYPE}.${n} is price-kind AMBIGUOUS. It was filled from a ` +
              `list price on one path and a closed-sale price on another, and consumers labeled it ` +
              `"Median list" either way. Use medianListPrice / medianSalePrice (both may be null).`,
          )
        }
      }
    }

    // RULE 2b — nor may the mappers emit it.
    if (isContract && ts.isPropertyAssignment(node)) {
      const n = ts.isIdentifier(node.name) ? node.name.text : null
      if (n && AMBIGUOUS.has(n)) {
        problems.push(
          `${rel}:${line(node)} emits price-kind-ambiguous \`${n}\`. Name the kind: ` +
            `medianListPrice for the asking side, medianSalePrice for the closed side.`,
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

// The contract files must exist — a silent rename would disable rule 2 entirely.
for (const f of CONTRACT_FILES) {
  if (!existsSync(join(ROOT, f))) {
    problems.push(
      `${f} not found — ci:price-kind-purity cannot enforce the market-stats contract. ` +
        `If the file moved, update CONTRACT_FILES.`,
    )
  }
}

console.log('List-vs-sale price purity (ci:price-kind-purity)')
console.log('===============================================')
console.log(`  scanned ${files.length} source files across ${SCAN_ROOTS.join(', ')}`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:price-kind-purity: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ No asking-price field is satisfied from a closed-sale figure.')
process.exit(0)
