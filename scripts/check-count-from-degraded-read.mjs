#!/usr/bin/env node
/**
 * check-count-from-degraded-read.mjs (ci:count-degraded-read)
 *
 * §0 UNKNOWN IS NOT ZERO.
 *
 * `withTimeoutFallback(promise, fallback, ms)` resolves to `fallback` when a read
 * times out or throws. For an inventory read the fallback is `[]`, `null`, or
 * `{ pins: [] }` — byte-identical to a genuinely empty result. A page that turns
 * that into a number publishes a count it never measured.
 *
 * This shipped. `/cities/bend/southeast-bend` rendered
 *
 *     "0 homes for sale in Southeast Bend, Bend. Median list $810,000."
 *
 * on a cold load, because a 4.5s `listings_in_boundary` timeout returned
 * `{ polygon: null, pins: [] }` and the hero printed `pins.length`. The false
 * figure read as sourced precisely because a true one sat beside it. Five other
 * geo pages carried the same shape (city, community, subdivision, zip, areas).
 *
 * TWO RULES, both purely syntactic (ts.createSourceFile, no type checker):
 *
 * RULE 1 — a published count derived from a guarded read must be able to say
 *   "unknown". Any `const <countName> = …` in an `app/**` page whose initializer
 *   references a binding that came from `withTimeoutFallback*` MUST carry an
 *   explicit type annotation that includes `null`. The annotation is the whole
 *   point: it forces every render site to decide what an unmeasured count looks
 *   like, and `number` alone makes "unknown" unrepresentable so `?? 0` becomes
 *   the path of least resistance. A missing number beats a wrong one.
 *
 * RULE 2 — `a ?? b > 0 ? x : y` is a precedence trap, everywhere, always.
 *   `??` binds LOOSER than `>`, so it parses as `(a ?? (b > 0)) ? x : y`: the
 *   left operand never guards anything, it just becomes a truthiness test. That
 *   is the exact line that produced the "0 homes" render. Flagged repo-wide.
 *
 * Usage: node scripts/check-count-from-degraded-read.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

/** The guarded-read helpers whose fallback is indistinguishable from real data. */
const GUARD_FNS = new Set(['withTimeoutFallback', 'withTimeoutFallbackResult'])

/**
 * Names that reach a reader as a published inventory figure. Deliberately a
 * closed list: this gate is about counts a visitor SEES, not every integer.
 */
const COUNT_NAMES = new Set([
  'activeCount',
  'totalCount',
  'totalActive',
  'listingCount',
  'inventoryCount',
  'homeCount',
  'activeListings',
])

/** Rule 2 applies to every product surface, not just pages. */
const RULE2_DIRS = ['app', 'lib', 'components']
/** Rule 1 applies to rendered pages. */
const RULE1_GLOB = /^app\/.*\/page\.tsx$/

const problems = []

function parse(rel) {
  const src = readFileSync(resolve(ROOT, rel), 'utf8')
  return { src, sf: ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

/** Every identifier name referenced anywhere inside `node`. */
function identsIn(node) {
  const out = new Set()
  const visit = (n) => {
    if (ts.isIdentifier(n)) out.add(n.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

/** Does `node`'s subtree call one of the guard helpers? */
function callsGuard(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && GUARD_FNS.has(n.expression.text)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** Every name bound by a declaration's name node (identifier or destructuring). */
function boundNames(nameNode) {
  const out = []
  if (ts.isIdentifier(nameNode)) return [nameNode.text]
  if (ts.isArrayBindingPattern(nameNode) || ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements) {
      if (ts.isBindingElement(el)) out.push(...boundNames(el.name))
    }
  }
  return out
}

/**
 * Is this declaration inside a callback passed to a call (`.map(c => …)`)?
 *
 * A per-element count computed while iterating a guarded collection cannot
 * publish a fabricated figure: if the collection degraded to `[]` the callback
 * never runs and there is no card to print a number on. Only the page-level
 * declarations reach a reader on a degraded render, so Rule 1 stops at the
 * first callback boundary. The page component itself is a function DECLARATION,
 * not a call argument, so its own top-level bindings still count.
 */
function insideCallback(node) {
  for (let p = node.parent; p; p = p.parent) {
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isCallExpression(p.parent)) {
      return true
    }
  }
  return false
}

/** Does this type annotation admit `null`? */
function admitsNull(typeNode) {
  if (!typeNode) return false
  let ok = false
  const visit = (n) => {
    if (ok) return
    if (n.kind === ts.SyntaxKind.NullKeyword) ok = true
    else if (ts.isLiteralTypeNode(n) && n.literal.kind === ts.SyntaxKind.NullKeyword) ok = true
    else ts.forEachChild(n, visit)
  }
  visit(typeNode)
  return ok
}

// ── RULE 1 ───────────────────────────────────────────────────────────────────
function checkRule1(rel) {
  const { sf } = parse(rel)

  // Collect declarations once so the degradable set can reach a fixpoint.
  /** @type {Array<{names: string[], init: import('typescript').Node, decl: any}>} */
  const decls = []
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      decls.push({ names: boundNames(n.name), init: n.initializer, decl: n })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)

  // Seed: anything initialized from a guard call. A destructured
  // `const [a, b] = await Promise.all([...withTimeoutFallback...])` taints every
  // name in the pattern — we cannot tell positionally which element was guarded,
  // and over-approximating here only demands the honest nullable type.
  const degradable = new Set()
  for (const d of decls) if (callsGuard(d.init)) for (const nm of d.names) degradable.add(nm)

  // Fixpoint: a value computed FROM a degraded value is itself degraded.
  for (let pass = 0; pass < 12; pass += 1) {
    const before = degradable.size
    for (const d of decls) {
      if (d.names.some((nm) => degradable.has(nm))) continue
      const refs = identsIn(d.init)
      if ([...refs].some((r) => degradable.has(r))) for (const nm of d.names) degradable.add(nm)
    }
    if (degradable.size === before) break
  }

  for (const d of decls) {
    if (!ts.isIdentifier(d.decl.name)) continue
    const name = d.decl.name.text
    if (!COUNT_NAMES.has(name)) continue
    if (insideCallback(d.decl)) continue
    const refs = identsIn(d.init)
    const tainted = [...refs].filter((r) => degradable.has(r) && r !== name)
    if (tainted.length === 0) continue
    if (admitsNull(d.decl.type)) continue
    problems.push(
      `${rel}:${lineOf(sf, d.decl)} — \`${name}\` is derived from a guarded read ` +
        `(${tainted.slice(0, 3).join(', ')}) but is not typed to admit \`null\`.\n` +
        `      A timed-out read resolves to its empty fallback, so this publishes a ` +
        `count that was never measured.\n` +
        `      Fix: \`const ${name}: number | null = …\` and suppress the figure at every ` +
        `render site when it is null (§0).`,
    )
  }
}

// ── RULE 2 ───────────────────────────────────────────────────────────────────
const COMPARISONS = new Set([
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
])

function checkRule2(rel) {
  const { sf } = parse(rel)
  const visit = (n) => {
    if (ts.isConditionalExpression(n)) {
      const c = n.condition
      if (
        ts.isBinaryExpression(c) &&
        c.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
        ts.isBinaryExpression(c.right) &&
        COMPARISONS.has(c.right.operatorToken.kind)
      ) {
        problems.push(
          `${rel}:${lineOf(sf, n)} — precedence trap: \`${c.getText(sf).slice(0, 70).replace(/\s+/g, ' ')} ? …\`\n` +
            `      \`??\` binds looser than a comparison, so this parses as ` +
            `\`(left ?? (right-comparison)) ? … : …\` — the left operand never guards ` +
            `anything, it is just a truthiness test.\n` +
            `      Fix: parenthesize what you meant, e.g. \`(a ?? b) > 0 ? … : …\`.`,
        )
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

// ── RUN ──────────────────────────────────────────────────────────────────────
const all = [...new Set(RULE2_DIRS.flatMap((d) => walkFiles(resolve(ROOT, d))))]
  .map((f) => relative(ROOT, f))
  .filter((f) => !/\.(test|spec)\.tsx?$/.test(f))
  .sort()

const pages = all.filter((f) => RULE1_GLOB.test(f))
for (const rel of pages) checkRule1(rel)
for (const rel of all) checkRule2(rel)

console.log('Counts never come from a degraded read (ci:count-degraded-read)')
console.log('==============================================================')
console.log(`  rule 1: ${pages.length} page(s) · rule 2: ${all.length} file(s)`)
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:count-degraded-read: ${problems.length} problem(s).\x1b[0m`)
  console.error('  §0: a timeout is UNKNOWN, not zero. A missing number beats a wrong one.')
  process.exit(1)
}
console.log('✓ No published count resolves a timed-out read to a number.')
process.exit(0)
