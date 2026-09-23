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
 * app/sitemap.ts's link CHANGED SHAPE (SITE-54, 2026-09-09), not dropped. It used
 * to call getMatrixCityPresetNoIndex(city, preset) once per (city, preset) combo —
 * up to ~1,080 sequential awaits. Measured against production: each call
 * independently rebuilt the ~8.3s search-matrix (getSearchMatrix's React `cache()`
 * does not dedupe across the unstable_cache revalidation context buildAllUrls runs
 * inside), so the loop degenerated into ~1,080 sequential rebuilds and blew every
 * sitemap deadline — the exact class of failure this node exists to kill, one leg
 * over. The fix resolves the matrix ONCE (getMatrixCityPresetDecisionSet) and
 * applies the SAME branches synchronously per combo
 * (matrixCityPresetNoIndexFromSet — byte-for-byte the same logic as
 * getMatrixCityPresetNoIndex, see lib/seo/getSearchMatrixEntries.ts). The gate now
 * requires BOTH calls on app/sitemap.ts instead of one call to the async form.
 *
 * Exit: 0 = every surface wires the guard, 1 = a surface dropped it.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// The 2-segment zero-inventory guard must be wired on every surface. The search
// page calls it via resolveMatrixNoIndex (the shared wrapper — keeps the search
// route god-file lean); the sitemap calls the batched decision-set form (SITE-54)
// and the wrapper calls the underlying per-combo getMatrixCityPresetNoIndex. Every
// link must hold, or the guard is dead somewhere on the path.
const CHECKS = [
  {
    file: 'app/sitemap.ts',
    guards: ['getMatrixCityPresetDecisionSet', 'matrixCityPresetNoIndexFromSet'],
    why: 'omit a zero-count combo from the sitemap',
  },
  // The search route's metadata assembly moved to the colocated module in the
  // 2026-07-31 file-size split; page.tsx's generateMetadata forwards to it.
  { file: 'app/search/[...slug]/search-metadata.ts', guards: ['resolveMatrixNoIndex'], why: 'noindex a zero-count combo at render' },
  {
    file: 'lib/seo/getSearchMatrixEntries.ts',
    guards: ['getMatrixCityPresetNoIndex'],
    why: 'resolveMatrixNoIndex must actually consult the 2-segment count',
  },
  // ── The 2-segment {city}/{area} browse pair (visibility audit 2026-09-22:
  // SEO-1, SEO-6, EXP-2, EXP-4). ONE decision (lib/seo/browse-pair-decision.ts,
  // decideBrowsePair) says whether an area exists, whether it may be indexed,
  // where its canonical points and whether the sitemap submits it. Every link
  // must hold, or the page and the sitemap drift apart again: the sitemap
  // submitting 1,815 pairs (live 2026-09-23) of which 662 were plat twins of
  // the same place, 17 community twins, 146 printed an MLS code and 1,051 had nothing
  // for sale and rendered one line, while any made-up segment rendered as an
  // indexable page about an invented place.
  {
    file: 'app/sitemap.ts',
    guards: ['getBrowsePairSitemapPaths'],
    why: 'submit exactly the browse pairs the shared decision emits',
  },
  {
    file: 'lib/seo/getBrowsePairDecision.ts',
    guards: ['decideBrowsePair'],
    why: 'feed both the page decision and the sitemap leg from decideBrowsePair',
  },
  {
    file: 'app/search/[...slug]/resolve-slug.ts',
    guards: ['getBrowsePairDecision'],
    why: 'resolve the area segment through the shared decision (SEO-1: fail closed on an unknown area)',
  },
  {
    file: 'app/search/[...slug]/search-metadata.ts',
    guards: ['isRefusedBrowsePair'],
    why: 'noindex + drop the canonical for an area no source knows',
  },
  {
    file: 'app/search/[...slug]/page.tsx',
    guards: ['isRefusedBrowsePair', 'areaSoldHistoryModel'],
    why: 'render the refusal for an unknown area and the sold history for a quiet one',
  },
  // A plat slug is county-wide and a browse slug is per city: bend/north-rim
  // (25 closed sales filed "North Rim" in Bend) is not the Redmond plat
  // north-rim. 87 of 758 exact slug matches were in another city, and 16
  // same-city plats matched only across a word break (2026-09-23).
  {
    file: 'lib/seo/browse-pair-decision.ts',
    guards: ['isSameCityPlat'],
    why: 'twin a browse pair to a plat only when the plat is in the same city',
  },
  {
    file: 'app/search/[...slug]/sections/AreaSoldHistory.tsx',
    guards: ['isSameCityPlat'],
    why: 'keep the plat door to a plat in the same city',
  },
  // ── Place-type twins (EXP-6): the type page is submitted exactly when its
  // preset twin canonicalizes to it.
  {
    file: 'app/sitemap.ts',
    guards: ['placeTypeSitemapPaths', 'cityPresetTypeTwin'],
    why: 'submit the type pages and drop their preset twins by the same rule',
  },
  {
    file: 'app/search/[...slug]/search-metadata.ts',
    guards: ['resolvePresetTypeTwinPath'],
    why: 'point the canonical of a type preset at its type page',
  },
]

const problems = []

/** True if the file contains a real CallExpression whose callee is `name`. */
function callsFunction(rel, name, sf) {
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

for (const { file, guards, why } of CHECKS) {
  const p = join(process.cwd(), file)
  if (!existsSync(p)) {
    problems.push(`${file}: file not found`)
    continue
  }
  const sf = ts.createSourceFile(file, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const missing = guards.filter((g) => !callsFunction(file, g, sf))
  if (missing.length > 0) {
    problems.push(
      `${file}: does not CALL ${missing.map((g) => `${g}()`).join(' and ')} — the 2-segment {city}/{preset} guard cannot ${why}.`,
    )
  }
}

console.log('Sitemap 2-segment inventory gate (ci:sitemap-inventory-gate)')
console.log('===========================================================')
if (problems.length) {
  console.error('\nA shared sitemap/page decision is not wired end-to-end:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:sitemap-inventory-gate: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log(
  `✓ All ${CHECKS.length} links wired — no zero-inventory {city}/{preset} URL, no browse pair the shared decision refuses, and no type-preset twin is submitted or indexable.`,
)
process.exit(0)
