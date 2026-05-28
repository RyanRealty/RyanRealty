#!/usr/bin/env node
/**
 * check-page-dal.mjs — CI gate for "Every page reads data through @/lib/data."
 *
 * Per docs/EXECUTION_PLAN.md acceptance criterion §1:
 *   "Every page in app/ imports data access from @/lib/data/ — zero raw
 *    queries (greppable)"
 *
 * The existing DAL boundary check (no-restricted-syntax + ci:dal-boundary)
 * is a NEGATIVE rule: don't call `from('listings')` outside lib/data/.
 * This gate is the POSITIVE counterpart: any page that renders data MUST
 * import from @/lib/data/. Pages without data (static-only) opt out with
 * a `// @data-free` directive at the top of the file.
 *
 * Why both: a page can avoid the negative rule by routing through some
 * indirect helper that isn't `from()`. The positive rule catches that
 * by demanding the canonical entry point.
 *
 * Scope: app/<route>/page.tsx files. Excludes:
 *   - app/api/**       (API routes — different read pattern)
 *   - app/admin/**     (admin tools — different scope per Plan §3)
 *   - app/(internal)/* (private route groups)
 *   - any page.tsx that begins with `// @data-free`
 *
 * Usage:
 *   node scripts/check-page-dal.mjs              # CI mode
 *   node scripts/check-page-dal.mjs --report     # human-readable
 *   node scripts/check-page-dal.mjs --json       # JSON
 *   node scripts/check-page-dal.mjs --list-allow # show allowlisted (data-free) pages
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const APP_DIR = join(ROOT, 'app')
const BASELINE_PATH = join(ROOT, 'scripts/page-dal-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const LIST_ALLOW = args.has('--list-allow')
const WRITE_BASELINE = args.has('--write-baseline')

const SKIP_DIR_PREFIXES = [
  'api',
  'admin',
]

function walkPages(dir, acc = []) {
  if (!statSync(dir).isDirectory()) return acc
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      // Skip top-level skipped groups
      const rel = relative(APP_DIR, full)
      const topSeg = rel.split('/')[0]
      if (SKIP_DIR_PREFIXES.includes(topSeg)) continue
      walkPages(full, acc)
    } else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'page.jsx') {
      acc.push(full)
    }
  }
  return acc
}

function classify(pagePath) {
  const src = readFileSync(pagePath, 'utf8')
  const rel = relative(ROOT, pagePath)
  const firstNonImportLine = src
    .split('\n')
    .slice(0, 10)
    .join(' ')
  const dataFree = /@data-free/.test(firstNonImportLine)
  const importsDal =
    /from\s+['"]@\/lib\/data(?:\/[^'"]*)?['"]/.test(src) ||
    /from\s+['"]\.\.\/.+\/lib\/data['"]/.test(src)
  return { rel, dataFree, importsDal }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return new Set(raw.violators ?? [])
}

function main() {
  const pages = walkPages(APP_DIR)
  const results = pages.map(classify)

  const allowlisted = results.filter((r) => r.dataFree)
  const violators = results.filter((r) => !r.dataFree && !r.importsDal)
  const compliant = results.filter((r) => !r.dataFree && r.importsDal)

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason: 'Snapshot of pre-DAL pages. The gate fails only on NEW violations beyond this baseline. Each line should disappear as Wave 3 page migrations route pages through @/lib/data/.',
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

  if (LIST_ALLOW) {
    console.log('Pages allowlisted with // @data-free directive:')
    for (const r of allowlisted) console.log(`  ${r.rel}`)
    console.log(`\nTotal: ${allowlisted.length}`)
    process.exit(0)
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      totalPages: results.length,
      compliant: compliant.length,
      allowlisted: allowlisted.length,
      totalViolators: violators.length,
      baselineSize: baseline.size,
      newViolators: newViolators.map((r) => r.rel),
      fixedSinceBaseline,
    }, null, 2))
    process.exit(newViolators.length === 0 ? 0 : 1)
  }

  console.log('Page DAL completeness check (ratcheted)')
  console.log('=======================================')
  console.log()
  console.log(`Total app/<route>/page.tsx files: ${results.length}`)
  console.log(`  Compliant (imports @/lib/data): ${compliant.length}`)
  console.log(`  Allowlisted (// @data-free):    ${allowlisted.length}`)
  console.log(`  Total violators:                ${violators.length}`)
  console.log(`  Baseline (allowed legacy):      ${baseline.size}`)
  console.log(`  NEW violators (CI BLOCKER):     ${newViolators.length}`)
  console.log(`  Fixed since baseline:           ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolators.length > 0) {
    console.log('NEW violators (these fail CI):')
    for (const r of newViolators) console.log(`  ${r.rel}`)
    console.log()
    console.log('Fix: either')
    console.log('  (a) import the canonical DAL function from @/lib/data, or')
    console.log('  (b) add `// @data-free` to the top of the file if the page genuinely needs no data')
  }
  if (fixedSinceBaseline.length > 0 && REPORT) {
    console.log()
    console.log('Pages fixed since baseline (can be removed from baseline):')
    for (const rel of fixedSinceBaseline.slice(0, 20)) console.log(`  ${rel}`)
    if (fixedSinceBaseline.length > 20) console.log(`  ... +${fixedSinceBaseline.length - 20} more`)
    console.log()
    console.log('Run `node scripts/check-page-dal.mjs --write-baseline` to rebase the baseline.')
  }

  if (REPORT) process.exit(0)
  process.exit(newViolators.length === 0 ? 0 : 1)
}

main()
