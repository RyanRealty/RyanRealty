#!/usr/bin/env node
/**
 * check-static-params.mjs — CI gate for "Every dynamic route exports generateStaticParams."
 *
 * Per docs/EXECUTION_PLAN.md Wave 3 §9:
 *   "Add generateStaticParams for dynamic routes (top 20 cities/
 *    communities, all 14 neighborhoods, all top listings)"
 *
 * The plan calls out generateStaticParams for ISR pre-rendering. Without
 * it, every dynamic route is pure SSR (no static fallback, cold-cache
 * TTFB suffers). This gate enforces the contract: any app/.../[slug]/
 * route that ships without generateStaticParams fails CI.
 *
 * Opt-out: a leading `// @no-static-params` comment for routes that
 * legitimately must stay full-SSR (e.g. admin pages, account pages).
 *
 * Usage:
 *   node scripts/check-static-params.mjs                # CI mode
 *   node scripts/check-static-params.mjs --report       # human-readable
 *   node scripts/check-static-params.mjs --json
 *   node scripts/check-static-params.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const APP_DIR = join(ROOT, 'app')
const BASELINE_PATH = join(ROOT, 'scripts/static-params-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

const SKIP_TOP_LEVEL = ['api', 'admin', 'account', 'dashboard']

function walkDynamicPages(dir, acc = []) {
  if (!statSync(dir).isDirectory()) return acc
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const rel = relative(APP_DIR, full)
      const topSeg = rel.split('/')[0]
      if (SKIP_TOP_LEVEL.includes(topSeg)) continue
      walkDynamicPages(full, acc)
    } else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'page.jsx') {
      // Only flag pages whose path contains a [slug] segment.
      const segs = relative(APP_DIR, full).split('/')
      const isDynamic = segs.some((s) => /^\[.+\]$/.test(s))
      if (isDynamic) acc.push(full)
    }
  }
  return acc
}

function classify(pagePath) {
  const src = readFileSync(pagePath, 'utf8')
  const rel = relative(ROOT, pagePath)
  const optOut = /@no-static-params/.test(src.slice(0, 600))
  const hasStaticParams = /\bgenerateStaticParams\s*[\(=]/.test(src)
  return { rel, optOut, hasStaticParams }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return new Set(raw.violators ?? [])
}

function main() {
  const pages = walkDynamicPages(APP_DIR)
  const results = pages.map(classify)
  const violators = results.filter((r) => !r.optOut && !r.hasStaticParams)
  const compliant = results.filter((r) => !r.optOut && r.hasStaticParams)
  const optedOut = results.filter((r) => r.optOut)

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason: 'Pre-Wave-3 snapshot of dynamic routes without generateStaticParams. New violations fail CI; existing ones are tracked until Wave 3 migration.',
      total: violators.length,
      violators: violators.map((r) => r.rel).sort(),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`Wrote baseline: ${violators.length} violators recorded at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolators = violators.filter((r) => !baseline.has(r.rel))
  const fixedSinceBaseline = [...baseline].filter((rel) => !violators.some((r) => r.rel === rel))

  if (JSON_OUT) {
    console.log(JSON.stringify({
      totalDynamic: results.length,
      compliant: compliant.length,
      optedOut: optedOut.length,
      totalViolators: violators.length,
      baselineSize: baseline.size,
      newViolators: newViolators.map((r) => r.rel),
      fixedSinceBaseline,
    }, null, 2))
    process.exit(newViolators.length === 0 ? 0 : 1)
  }

  console.log('generateStaticParams check (ratcheted)')
  console.log('======================================')
  console.log()
  console.log(`Dynamic routes scanned:           ${results.length}`)
  console.log(`  Compliant:                      ${compliant.length}`)
  console.log(`  Opted out (@no-static-params):  ${optedOut.length}`)
  console.log(`  Total violators:                ${violators.length}`)
  console.log(`  Baseline:                       ${baseline.size}`)
  console.log(`  NEW violators (CI BLOCKER):     ${newViolators.length}`)
  console.log(`  Fixed since baseline:           ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolators.length > 0) {
    console.log('NEW violators (these fail CI):')
    for (const r of newViolators) console.log(`  ${r.rel}`)
    console.log()
    console.log('Fix: either')
    console.log('  (a) export `generateStaticParams` from the page, or')
    console.log('  (b) add `// @no-static-params` to the top of the file if SSR-only is intentional.')
  }

  if (REPORT) process.exit(0)
  process.exit(newViolators.length === 0 ? 0 : 1)
}

main()
