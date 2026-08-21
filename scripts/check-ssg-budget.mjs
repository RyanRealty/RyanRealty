#!/usr/bin/env node
/**
 * check-ssg-budget.mjs — CI gate: "The build-time SSG fan-out on DB-heavy geo
 * routes stays at zero."
 *
 * The class of failure this locks out (found 2026-08-21 profiling Vercel):
 * `next build` spent 11.2 of 14 minutes in "Generating static pages (644)",
 * dominated by ~125 subdivision/out-of-area pages that each chain sequential
 * timeout-capped Supabase rails (3000–9000ms ceilings). At build concurrency
 * (7 workers) those queries time out by the hundreds — 352 in one peak-hours
 * build — so the deploy is slow AND ships empty rails baked into static HTML.
 * Both routes carry dynamicParams=true and short revalidate, so on-demand ISR
 * serves the same URLs with the same content, minus the build cost.
 *
 * Rule: each route listed in ZERO_PRERENDER must export a generateStaticParams
 * whose body is exactly `return []` (comments allowed). Regrowing a fan-out on
 * one of these routes is a deliberate decision: remove the route from this
 * list in the same commit and say why in the commit message.
 *
 * Usage:
 *   node scripts/check-ssg-budget.mjs            # CI mode
 *   node scripts/check-ssg-budget.mjs --report   # never exits 1
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const REPORT = process.argv.includes('--report')

const ZERO_PRERENDER = [
  'app/subdivisions/[slug]/page.tsx',
  'app/oregon/[city]/page.tsx',
]

const failures = []

for (const rel of ZERO_PRERENDER) {
  const file = join(ROOT, rel)
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    failures.push(`${rel}: file missing — update ZERO_PRERENDER in scripts/check-ssg-budget.mjs`)
    continue
  }
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true)

  let fn = null
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === 'generateStaticParams') fn = stmt
  }
  if (!fn || !fn.body) {
    failures.push(`${rel}: no generateStaticParams function declaration found`)
    continue
  }

  const stmts = fn.body.statements
  const onlyReturnsEmptyArray =
    stmts.length === 1 &&
    ts.isReturnStatement(stmts[0]) &&
    stmts[0].expression != null &&
    ts.isArrayLiteralExpression(stmts[0].expression) &&
    stmts[0].expression.elements.length === 0

  if (!onlyReturnsEmptyArray) {
    failures.push(
      `${rel}: generateStaticParams must be exactly \`return []\` — this route's build-time prerender is budgeted to zero`,
    )
  }
}

if (failures.length === 0) {
  console.log(`ci:ssg-budget OK — ${ZERO_PRERENDER.length} route(s) hold a zero build-time fan-out`)
  process.exit(0)
}

console.error('ci:ssg-budget FAIL')
for (const f of failures) console.error(`  ✗ ${f}`)
console.error(
  '\nThese routes render on demand (dynamicParams=true + revalidate); prerendering them was the top Vercel build cost. See scripts/check-ssg-budget.mjs header.',
)
process.exit(REPORT ? 0 : 1)
