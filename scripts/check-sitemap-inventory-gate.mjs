#!/usr/bin/env node
/**
 * check-sitemap-inventory-gate.mjs — ci:sitemap-inventory-gate (W3.1).
 *
 * A 2-segment /homes-for-sale/{city}/{preset} combo with a VERIFIED zero
 * city-wide active count must NEVER be a submitted, indexable URL (§0 — a URL in
 * the sitemap is never backed by invented inventory; and a zero-result indexable
 * page is thin-content SEO harm). The ONE source of truth for that decision is
 * getMatrixCityPresetNoIndex (lib/seo/getSearchMatrixEntries.ts), read from the
 * live getSearchMatrix count.
 *
 * This gate asserts BOTH consumer surfaces actually CALL that guard — the whole
 * path, producer→consumer, stays wired:
 *   1. app/sitemap.ts — omits the combo from the sitemap.
 *   2. app/search/[...slug]/page.tsx — noindexes it at render.
 *
 * The count LOGIC (verified-zero → noindex, unknown → fail-open) is pinned by the
 * vitest contract lib/seo/search-matrix.test.ts; this gate pins that the logic is
 * WIRED on both surfaces (a correct helper that nobody calls guards nothing).
 *
 * AST-based (docs: reference_code_inspecting_gates_use_ast): parses each file
 * with the TypeScript compiler and looks for a real CallExpression to the guard —
 * a comment or string mention cannot satisfy it.
 *
 * Exit: 0 = both surfaces call the guard, 1 = a surface dropped it.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// The 2-segment zero-inventory guard must be wired on every surface. The search
// page calls it via resolveMatrixNoIndex (the shared wrapper — keeps the search
// route god-file lean); the sitemap and the wrapper both call the underlying
// getMatrixCityPresetNoIndex. All three links must hold, or the guard is dead.
const CHECKS = [
  { file: 'app/sitemap.ts', guard: 'getMatrixCityPresetNoIndex', why: 'omit a zero-count combo from the sitemap' },
  // The search route's metadata assembly moved to the colocated module in the
  // 2026-07-31 file-size split; page.tsx's generateMetadata forwards to it.
  { file: 'app/search/[...slug]/search-metadata.ts', guard: 'resolveMatrixNoIndex', why: 'noindex a zero-count combo at render' },
  {
    file: 'lib/seo/getSearchMatrixEntries.ts',
    guard: 'getMatrixCityPresetNoIndex',
    why: 'resolveMatrixNoIndex must actually consult the 2-segment count',
  },
]

const problems = []

/** True if the file contains a real CallExpression whose callee is `name`. */
function callsFunction(rel, name) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`)
    return false
  }
  const sf = ts.createSourceFile(rel, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = false
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      // direct call `name(...)` or `await name(...)` (the await wraps the call arg)
      if (ts.isIdentifier(callee) && callee.text === name) found = true
      // member call `x.name(...)` — not expected here, but handle defensively
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === name) found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

for (const { file, guard, why } of CHECKS) {
  if (!callsFunction(file, guard)) {
    problems.push(`${file}: does not CALL ${guard}() — the 2-segment {city}/{preset} guard cannot ${why}.`)
  }
}

console.log('Sitemap 2-segment inventory gate (ci:sitemap-inventory-gate)')
console.log('===========================================================')
if (problems.length) {
  console.error('\nThe zero-inventory city×preset guard is not wired end-to-end:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:sitemap-inventory-gate: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log(`✓ All ${CHECKS.length} surfaces wire the 2-segment guard — no zero-inventory {city}/{preset} URL is submitted or indexable.`)
process.exit(0)
