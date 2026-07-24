#!/usr/bin/env node
/**
 * check-cma-rebrand-integrity.mjs — ci:cma-rebrand-integrity (W10.3).
 *
 * THE DEFECT (verified in code 2026-07-24, before this gate existed):
 * The "Signing broker" select in components/admin/cma/CmaReviewActions.tsx was
 * wired to rebuildCmaAction, which calls buildCma WITHOUT forwarding comp keys.
 * buildCma re-selects comparables from scratch and re-runs two Anthropic passes
 * (judgeComps at lib/cma/build.ts:158, auditCma at 233 and 272). So changing
 * WHO SIGNS a client-facing pricing document could change the recommended list
 * price — the same property valued twice, producing two numbers for a reason
 * that has nothing to do with the property. A seller prices against that
 * document. CLAUDE.md section 0.
 *
 * A re-brand is a RENDER, not a REBUILD. This gate holds that distinction,
 * because the regression is a single plausible edit: passing `brokerSlug` back
 * into the rebuild call "so the broker sticks."
 *
 * ASSERTS:
 *   1. lib/cma/rebrand.ts never imports or calls buildCma / judgeComps /
 *      auditCma / selectComps. A re-brand that recomputes is not a re-brand.
 *   2. The re-brand's row update touches ONLY presentation fields. Writing
 *      recommended_list, value_low, value_high, comps_count or citations from
 *      the re-brand path would mean numbers moved.
 *   3. The broker Select does not route into rebuildCmaAction: no call to
 *      rebuildCmaAction anywhere in the component may pass a brokerSlug
 *      property. (AST — a rename or reformat does not evade.)
 *
 * Exit: 0 = swapping the signature block cannot move a number. 1 = otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const REBRAND = 'lib/cma/rebrand.ts'
const COMPONENT = 'components/admin/cma/CmaReviewActions.tsx'

/** Anything that recomputes a figure. None of it belongs in a re-brand. */
const RECOMPUTE = ['buildCma', 'buildBpo', 'judgeComps', 'auditCma', 'selectComps', 'computePricing']
/** Columns that carry a NUMBER. A re-brand must not write any of them. */
const NUMERIC_COLUMNS = [
  'recommended_list',
  'value_low',
  'value_high',
  'comps_count',
  'citations',
  'price_override',
  'build_summary',
]

const problems = []

function parse(rel) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: not found — re-point this gate.`)
    return null
  }
  return ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

// ── 1 + 2: the re-brand module ───────────────────────────────────────────────
const rebrand = parse(REBRAND)
if (rebrand) {
  const text = rebrand.getFullText()

  for (const name of RECOMPUTE) {
    // import of it
    const imported = new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}`).test(text)
    let called = false
    const walk = (n) => {
      if (ts.isCallExpression(n)) {
        const c = n.expression
        if (ts.isIdentifier(c) && c.text === name) called = true
        if (ts.isPropertyAccessExpression(c) && c.name.text === name) called = true
      }
      ts.forEachChild(n, walk)
    }
    walk(rebrand)
    if (imported || called) {
      problems.push(
        `${REBRAND}: references ${name}(...). A re-brand must RENDER, not RECOMPUTE — recomputing is exactly what let a broker swap change the recommended list price.`,
      )
    }
  }

  // the update object must not carry a numeric column
  const walkUpdate = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      /^update\w*RowFieldsBySlug$/.test(n.expression.text)
    ) {
      const arg = n.arguments[1]
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          const key = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name))
            ? prop.name.text
            : null
          if (key && NUMERIC_COLUMNS.includes(key)) {
            const line = rebrand.getLineAndCharacterOfPosition(prop.getStart()).line + 1
            problems.push(
              `${REBRAND}:${line}: the re-brand writes \`${key}\`. Only presentation may change — writing a figure means the numbers moved when only the signer did.`,
            )
          }
        }
      }
    }
    ts.forEachChild(n, walkUpdate)
  }
  walkUpdate(rebrand)

  if (!/renderCmaHtml\s*\(/.test(text)) {
    problems.push(`${REBRAND}: never calls renderCmaHtml(...) — a re-brand has to actually re-render.`)
  }
}

// ── 3: the broker select must not route into a rebuild ───────────────────────
const component = parse(COMPONENT)
if (component) {
  const walk = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'rebuildCmaAction') {
      const arg = n.arguments[0]
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          const key = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name))
            ? prop.name.text
            : null
          if (key === 'brokerSlug') {
            const line = component.getLineAndCharacterOfPosition(prop.getStart()).line + 1
            problems.push(
              `${COMPONENT}:${line}: passes \`brokerSlug\` into rebuildCmaAction. That re-selects comparables and re-runs two Anthropic passes, so changing the signing broker can change the recommended list price. Use rebrandCmaAction — it re-renders only.`,
            )
          }
        }
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(component)

  if (!/rebrandCmaAction\s*\(/.test(component.getFullText())) {
    problems.push(
      `${COMPONENT}: never calls rebrandCmaAction(...) — there is no way to change the signing broker without a rebuild.`,
    )
  }
}

console.log('CMA re-brand integrity gate (ci:cma-rebrand-integrity)')
console.log('=====================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:cma-rebrand-integrity: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Swapping the signing broker re-renders only; no figure can move with it.')
process.exit(0)
