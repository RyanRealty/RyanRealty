#!/usr/bin/env node
/**
 * check-heading-display.mjs — CI gate: display headings use the brand font.
 *
 * Page H1s and section H2s must use the Amboqia display face via the
 * H1/H2/DisplayHeading primitives (components/site/primitives), the way the
 * landing pages + mockups do. A raw `<h1>/<h2>` styled with `font-bold` /
 * `font-semibold` and NO `font-display` is a plain-Geist heading — that is why
 * those pages "look plainer than the landing pages."
 *
 * Flags any `<h1>/<h2>` element whose class list has font-bold/font-semibold but
 * not font-display. The primitives (capitalized <H1>/<H2>/<DisplayHeading>, and
 * their internal font-display markup) are not flagged.
 *
 * Ratcheted: pre-existing raw headings are baselined; NEW ones fail CI. The
 * baseline shrinks as page sweeps route headings through the primitives.
 *
 * Usage:
 *   node scripts/check-heading-display.mjs            # CI
 *   node scripts/check-heading-display.mjs --report
 *   node scripts/check-heading-display.mjs --json
 *   node scripts/check-heading-display.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/heading-display-baseline.json')
const SCAN_DIRS = ['app', 'components']
// Skip non-brand-facing trees: admin/account/dashboard internals (don't need the
// display face), render trees, and the mockup preview. Public site pages only.
const SKIP_SEGMENTS = ['node_modules', '.next', 'mockup-preview', 'admin', 'account', 'dashboard']

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
      if (SKIP_SEGMENTS.includes(entry)) continue
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
    // Raw lowercase <h1 / <h2 JSX open tag (NOT the <H1>/<H2> primitives).
    if (!/<h[12](\s|>)/.test(lines[i])) continue
    let tag = lines[i]
    let j = i
    while (!/>/.test(tag) && j < i + 8 && j + 1 < lines.length) {
      j++
      tag += '\n' + lines[j]
    }
    const tagOpen = tag.slice(0, tag.indexOf('>') + 1 || tag.length)
    const bold = /font-bold|font-semibold/.test(tagOpen)
    const display = /font-display/.test(tagOpen)
    if (bold && !display) violations.push(`${rel}:${i + 1}`)
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
        reason: 'Raw font-bold <h1>/<h2> (plain Geist, not the brand font-display) at gate-creation time. NEW raw display headings fail CI; this list only shrinks as page sweeps route them through the H1/H2/DisplayHeading primitives.',
        total: violations.length,
        violators: violations,
      }, null, 2) + '\n'
    )
    console.log(`Wrote baseline: ${violations.length} raw display headings at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newViolations = violations.filter((v) => !baseline.has(v))
  const fixedSinceBaseline = [...baseline].filter((v) => !violations.includes(v))

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: violations.length, baselineSize: baseline.size, newViolations, fixedSinceBaseline }, null, 2))
    process.exit(newViolations.length === 0 ? 0 : 1)
  }

  console.log('Display-heading font check (ratcheted)')
  console.log('======================================')
  console.log()
  console.log(`Raw font-bold <h1>/<h2> (no font-display):  ${violations.length}`)
  console.log(`  Baseline (tracked debt):                  ${baseline.size}`)
  console.log(`  NEW raw display headings (CI BLOCKER):     ${newViolations.length}`)
  console.log(`  Fixed since baseline:                      ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolations.length > 0) {
    console.log('NEW raw display headings (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log()
    console.log('Fix: use the H1 / H2 / DisplayHeading primitives from @/components/site/primitives')
    console.log('(they carry font-display), not a raw <h1>/<h2> with font-bold.')
  }

  if (REPORT) process.exit(0)
  process.exit(newViolations.length === 0 ? 0 : 1)
}

main()
