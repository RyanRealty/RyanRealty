#!/usr/bin/env node
/**
 * check-hero-image.mjs — CI gate: no flat content hero.
 *
 * ContentPageHero falls back to the brand hero so it is never a flat navy bar,
 * but pages should pass a page-specific imageUrl rather than rely on the
 * fallback everywhere (that is how tools/appreciation + tools/mortgage shipped
 * with no image). This gate flags any `<ContentPageHero ...>` usage that does
 * not pass an `imageUrl` prop.
 *
 * Ratcheted: pre-existing imageless usages are baselined; NEW ones fail CI.
 *
 * Usage:
 *   node scripts/check-hero-image.mjs            # CI
 *   node scripts/check-hero-image.mjs --report
 *   node scripts/check-hero-image.mjs --json
 *   node scripts/check-hero-image.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/hero-image-baseline.json')
const SCAN_DIRS = ['app', 'components']

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, acc)
    } else if (/\.(tsx|jsx)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

function classifyFile(file) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const rel = relative(ROOT, file)
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    if (!/<ContentPageHero(\s|>|$)/.test(lines[i])) continue
    // Capture the JSX opening tag (until the closing `>` / `/>`).
    let block = lines[i]
    let j = i
    while (!/\/?>/.test(lines[j]) && j < i + 25 && j + 1 < lines.length) {
      j++
      block += '\n' + lines[j]
    }
    if (!/\bimageUrl\b/.test(block)) violations.push(`${rel}:${i + 1}`)
  }
  return violations
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).violators ?? [])
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  const violations = files.flatMap(classifyFile).sort()

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reason: 'ContentPageHero usages without an imageUrl at gate-creation time. NEW imageless heroes fail CI; this list only shrinks.',
        total: violations.length,
        violators: violations,
      }, null, 2) + '\n'
    )
    console.log(`Wrote baseline: ${violations.length} imageless ContentPageHero usages at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolations = violations.filter((v) => !baseline.has(v))
  const fixedSinceBaseline = [...baseline].filter((v) => !violations.includes(v))

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: violations.length, baselineSize: baseline.size, newViolations, fixedSinceBaseline }, null, 2))
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('Content hero image check (ratcheted)')
  console.log('====================================')
  console.log()
  console.log(`Imageless ContentPageHero usages:  ${violations.length}`)
  console.log(`  Baseline (tracked debt):         ${baseline.size}`)
  console.log(`  NEW imageless (CI BLOCKER):       ${newViolations.length}`)
  console.log(`  Fixed since baseline:             ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolations.length > 0) {
    console.log('NEW ContentPageHero without imageUrl (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log()
    console.log('Fix: pass a page-specific imageUrl (a local /images/... brand or Central Oregon photo).')
  }

  if (REPORT) process.exit(0)
  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
