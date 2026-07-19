#!/usr/bin/env node
/**
 * check-page-action-imports.mjs — CI gate: pages read through the DAL, not
 * through app/actions shadow read-layers.
 *
 * Audit finding #4: the DAL-boundary gate blanket-exempts app/actions/, so
 * read-only query code (getListings, getCityFromSlug, getCommunityBySlug, …)
 * accumulated in 2000-line action god-files that public ISR pages import
 * directly, bypassing the cached lib/data contract. The DAL-boundary gate is
 * structurally blind to this (it only looks for raw `.from()`).
 *
 * This gate closes that blind spot from the consumer side: an app/../page.tsx
 * (or layout/metadata) may NOT import a read symbol (name starting with get,
 * list, fetch, find, search, or load) FROM an app/actions/ module. Move the read
 * into lib/data and import it from '@/lib/data' instead.
 *
 * Ratcheted against a baseline (like check-dal-boundary / check-static-params):
 * existing offenders are recorded and may only SHRINK; a NEW page→action read
 * import fails CI.
 *
 * Usage:
 *   node scripts/check-page-action-imports.mjs                 # CI mode
 *   node scripts/check-page-action-imports.mjs --report        # human-readable, never exits 1
 *   node scripts/check-page-action-imports.mjs --json
 *   node scripts/check-page-action-imports.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const APP_DIR = join(ROOT, 'app')
const BASELINE_PATH = join(ROOT, 'scripts/page-action-imports-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

// Files that count as "a page" (SEO/render surfaces + their data seams).
const PAGE_FILES = new Set(['page.tsx', 'page.ts', 'layout.tsx', 'layout.ts'])
const READ_PREFIX = /^(get|list|fetch|find|search|load)/
const ACTION_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]((?:@\/app\/actions\/|(?:\.\.?\/)+actions\/)[^'"]+)['"]/g
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist'])

function walkPages(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walkPages(full, acc)
    else if (PAGE_FILES.has(entry)) acc.push(full)
  }
  return acc
}

function violationsInFile(pagePath) {
  const src = readFileSync(pagePath, 'utf8')
  const rel = relative(ROOT, pagePath)
  const hits = []
  for (const m of src.matchAll(ACTION_IMPORT)) {
    const specifiers = m[1]
    const source = m[2]
    for (const raw of specifiers.split(',')) {
      // strip `type ` and ` as alias`; the ORIGINAL imported name decides.
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (name && READ_PREFIX.test(name)) hits.push(`${rel} :: ${name} <- ${source}`)
    }
  }
  return hits
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return new Set(raw.violations ?? [])
}

function main() {
  const pages = walkPages(APP_DIR)
  const all = pages.flatMap(violationsInFile)

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason: 'Audit #4: pages importing read symbols from app/actions instead of @/lib/data. Ratchet — may only shrink as reads migrate to the DAL.',
      total: all.length,
      violations: [...all].sort(),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`Wrote baseline: ${all.length} page→action read imports recorded.`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const current = new Set(all)
  const newViolations = all.filter((v) => !baseline.has(v))
  const fixed = [...baseline].filter((v) => !current.has(v))

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: all.length, baseline: baseline.size, newViolations, fixed }, null, 2))
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('page→action read-import check (ratcheted)')
  console.log('=========================================')
  console.log(`  Total page→action read imports:  ${all.length}`)
  console.log(`  Baseline:                        ${baseline.size}`)
  console.log(`  NEW (CI BLOCKER):                ${newViolations.length}`)
  console.log(`  Fixed since baseline:            ${fixed.length}`)
  if (newViolations.length > 0) {
    console.log('\nNEW page→action read imports (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log('\nFix: move the read into lib/data and import it from \'@/lib/data\'.')
  }
  if (REPORT) process.exit(0)
  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
