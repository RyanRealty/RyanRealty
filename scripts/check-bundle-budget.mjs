#!/usr/bin/env node
/**
 * check-bundle-budget.mjs — bundle-size budget per docs/EXECUTION_PLAN.md §1.
 *
 * Plan target: "Initial JS bundle ≤ 250 KB per route." Per-route precision
 * requires mapping Next.js chunks back to routes via app-build-manifest, which
 * Next does not always emit in every build mode. This gate uses a simpler
 * proxy that catches accidental regressions:
 *
 *   - Total .next/static JS size ≤ TOTAL_BUDGET (default 10 MB)
 *   - Largest single chunk ≤ CHUNK_BUDGET (default 600 KB)
 *
 * Tighten the thresholds as the codebase shrinks. A baseline file
 * (scripts/bundle-budget-baseline.json) records current state so the
 * gate only fails on NEW chunks that exceed the budget or on a total
 * that exceeds the baseline + 10%.
 *
 * Requires .next/ to exist (run `npm run build` first).
 *
 * Usage:
 *   npm run build && node scripts/check-bundle-budget.mjs
 *   node scripts/check-bundle-budget.mjs --report          # never exit non-zero
 *   node scripts/check-bundle-budget.mjs --json
 *   node scripts/check-bundle-budget.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const NEXT_STATIC = join(ROOT, '.next/static')
const BASELINE_PATH = join(ROOT, 'scripts/bundle-budget-baseline.json')

const TOTAL_BUDGET = Number(process.env.BUNDLE_TOTAL_BUDGET ?? 10 * 1024 * 1024)
const CHUNK_BUDGET = Number(process.env.BUNDLE_CHUNK_BUDGET ?? 600 * 1024)
const TOTAL_GROWTH_PCT = 10

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

function walkJs(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkJs(full, acc)
    else if (entry.name.endsWith('.js')) {
      acc.push({ rel: relative(NEXT_STATIC, full), size: statSync(full).size })
    }
  }
  return acc
}

function fmtBytes(b) {
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB'
  return (b / 1024).toFixed(1) + ' KB'
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

function main() {
  if (!existsSync(NEXT_STATIC)) {
    console.error('.next/static not found. Run `npm run build` first.')
    if (REPORT) process.exit(0)
    process.exit(2)
  }

  const chunks = walkJs(NEXT_STATIC).sort((a, b) => b.size - a.size)
  const total = chunks.reduce((s, c) => s + c.size, 0)
  const oversize = chunks.filter((c) => c.size > CHUNK_BUDGET)

  if (WRITE_BASELINE) {
    const payload = {
      generatedAt: new Date().toISOString(),
      totalBytes: total,
      chunkCount: chunks.length,
      top20: chunks.slice(0, 20).map((c) => ({ rel: c.rel, bytes: c.size })),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
    console.log(`Wrote baseline: total=${fmtBytes(total)} chunks=${chunks.length}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const baselineTotal = baseline?.totalBytes ?? total
  const growthBytes = total - baselineTotal
  const growthPct = baselineTotal > 0 ? (growthBytes / baselineTotal) * 100 : 0
  const totalOver = total > TOTAL_BUDGET
  const grewTooMuch = growthPct > TOTAL_GROWTH_PCT
  const failed = totalOver || oversize.length > 0 || grewTooMuch

  if (JSON_OUT) {
    console.log(JSON.stringify({
      total,
      totalBudget: TOTAL_BUDGET,
      chunkBudget: CHUNK_BUDGET,
      chunkCount: chunks.length,
      oversize: oversize.map((c) => ({ rel: c.rel, bytes: c.size })),
      baselineTotal,
      growthBytes,
      growthPct,
      failed,
    }, null, 2))
    process.exit(failed ? 1 : 0)
  }

  console.log('Bundle budget check')
  console.log('===================')
  console.log()
  console.log(`Total .next/static JS:    ${fmtBytes(total)}`)
  console.log(`  Total budget:           ${fmtBytes(TOTAL_BUDGET)}`)
  console.log(`  Baseline:               ${baseline ? fmtBytes(baselineTotal) : '(none — first run)'}`)
  console.log(`  Growth vs baseline:     ${growthBytes >= 0 ? '+' : ''}${fmtBytes(growthBytes)} (${growthPct.toFixed(1)}%)`)
  console.log(`Chunks scanned:           ${chunks.length}`)
  console.log(`  Per-chunk budget:       ${fmtBytes(CHUNK_BUDGET)}`)
  console.log(`  Largest chunk:          ${fmtBytes(chunks[0]?.size ?? 0)} (${chunks[0]?.rel ?? '-'})`)
  console.log(`  Chunks over budget:     ${oversize.length}`)
  console.log()

  if (oversize.length > 0) {
    console.log('Chunks exceeding per-chunk budget:')
    for (const c of oversize.slice(0, 10)) {
      console.log(`  ${fmtBytes(c.size).padStart(10)}  ${c.rel}`)
    }
    console.log()
  }
  if (grewTooMuch) {
    console.log(`Total bundle grew by ${growthPct.toFixed(1)}% — exceeds ${TOTAL_GROWTH_PCT}% growth budget.`)
    console.log(`Either: investigate the new dependency / route, or re-baseline if intentional.`)
    console.log()
  }
  if (totalOver) {
    console.log(`Total bundle exceeds hard ceiling ${fmtBytes(TOTAL_BUDGET)}.`)
    console.log()
  }
  if (failed && !REPORT) {
    console.log('Fix: investigate the regression, or run `node scripts/check-bundle-budget.mjs --write-baseline`')
    console.log('to accept the new baseline (only when intentional).')
  }

  if (REPORT) process.exit(0)
  process.exit(failed ? 1 : 0)
}

main()
