#!/usr/bin/env node
/**
 * check-heading-display.mjs — CI gate: display headings use the brand font.
 *
 * Page H1s and section H2s must use the Amboqia display face via the
 * H1/H2/DisplayHeading primitives (components/site/primitives), the way the
 * landing pages + mockups do. A raw `<h1>/<h2>` that is sized/weighted like a
 * display heading but carries NO `font-display` is a plain-Geist heading — that
 * is why those pages "look plainer than the landing pages."
 *
 * WEIGHT-AGNOSTIC (since 2026-06-09): a raw `<h1>/<h2>` is flagged when it is a
 * display heading AND lacks `font-display`. "Display heading" = carries any
 * explicit weight (`font-bold` / `font-semibold` / `font-medium`) OR a
 * heading-scale size (`text-xl`..`text-9xl`, or an arbitrary `text-[Npx/rem]`
 * with N >= 20px / 1.25rem). Small utility labels (`text-lg`/`base`/`sm`/`xs`
 * with no bold weight) are NOT display headings and are not flagged — they are
 * eyebrows / captions, not the brand display face. Previously only
 * `font-bold|font-semibold` were inspected, so `font-medium` and weightless
 * sized headings (e.g. `text-2xl text-primary sm:text-3xl`) escaped — they no
 * longer do.
 *
 * The primitives (capitalized <H1>/<H2>/<DisplayHeading>, and their internal
 * font-display markup) are not flagged. A raw heading that genuinely must stay
 * Geist (rare) can opt out with a `// heading-display-ok` comment on the same
 * line or the line immediately above.
 *
 * RATCHET — two independent guards, both must hold:
 *   1. No NEW violator path beyond the baseline set (the classic line-level
 *      ratchet).
 *   2. The TOTAL live count must not EXCEED the baseline `total`. Even if a
 *      sweep moves a heading (changing its line number, so the path leaves the
 *      baseline set) the count ceiling stops the debt from silently growing.
 *   The count ceiling can only shrink: re-baseline with --write-baseline after
 *   a real reduction (or after a detection change that legitimately re-counts).
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
// Skip non-brand-facing trees: admin/account/dashboard/console internals (don't
// need the display face), render trees, and the mockup preview. Public site pages
// only. `console` is the neutral admin chrome (ConsoleShell + components/console/*),
// explicitly NOT brand-font-styled per Matt's 2026-06-15 directive — same class as
// `admin`, so it belongs in the skip list.
const SKIP_SEGMENTS = ['node_modules', '.next', 'mockup-preview', 'admin', 'account', 'dashboard', 'console']

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

// A heading-scale Tailwind size (text-xl and up). text-lg / base / sm / xs are
// utility-label sizes, NOT the display face — excluded so eyebrows/captions
// don't get false-flagged.
const HEADING_SIZE_TOKEN = /\btext-(xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/
// Arbitrary size like text-[34px] / text-[2.5rem] — heading-scale when >= 20px
// (1.25rem). Below that it is body/label scale.
const ARBITRARY_SIZE = /\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g
// Any explicit display weight. font-medium is INCLUDED now (it escaped before).
const WEIGHT_TOKEN = /\bfont-(bold|semibold|medium)\b/

function hasHeadingScaleSize(cls) {
  if (HEADING_SIZE_TOKEN.test(cls)) return true
  let m
  ARBITRARY_SIZE.lastIndex = 0
  while ((m = ARBITRARY_SIZE.exec(cls)) !== null) {
    const n = parseFloat(m[1])
    const px = m[2] === 'rem' ? n * 16 : n
    if (px >= 20) return true
  }
  return false
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
    // Per-heading opt-out: `// heading-display-ok` on the tag line, the line
    // above, or anywhere inside the (possibly multi-line) open tag.
    const exemptWindow = (i > 0 ? lines[i - 1] + '\n' : '') + tag
    if (/heading-display-ok/.test(exemptWindow)) continue
    const display = /font-display/.test(tagOpen)
    if (display) continue
    // Weight-agnostic: a display heading is one with an explicit weight OR a
    // heading-scale size. Plain-Geist display heading = no font-display => flag.
    const isDisplayHeading = WEIGHT_TOKEN.test(tagOpen) || hasHeadingScaleSize(tagOpen)
    if (isDisplayHeading) violations.push(`${rel}:${i + 1}`)
  }
  return violations
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { set: new Set(), total: 0 }
  const data = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const violators = data.violators ?? []
  // total is the count ceiling. Fall back to the violator-list length if an
  // older baseline file omitted it.
  return { set: new Set(violators), total: data.total ?? violators.length }
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  const violations = files.flatMap(classifyFile).sort()

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reason: 'Raw sized/weighted <h1>/<h2> (plain Geist, not the brand font-display) at re-baseline time (weight-agnostic detection: any explicit weight OR heading-scale size, not just font-bold/semibold). NEW raw display headings fail CI AND the total may never exceed `total` (count ceiling). Both can only shrink as page sweeps route headings through the H1/H2/DisplayHeading primitives.',
        total: violations.length,
        violators: violations,
      }, null, 2) + '\n'
    )
    console.log(`Wrote baseline: ${violations.length} raw display headings at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const { set: baselineSet, total: ceiling } = loadBaseline()
  const newViolations = violations.filter((v) => !baselineSet.has(v))
  const fixedSinceBaseline = [...baselineSet].filter((v) => !violations.includes(v))
  // Count-ceiling ratchet: the live total may never exceed the baseline total.
  const overCeiling = Math.max(0, violations.length - ceiling)
  const failed = newViolations.length > 0 || overCeiling > 0

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: violations.length, ceiling, baselineSize: baselineSet.size, overCeiling, newViolations, fixedSinceBaseline }, null, 2))
    process.exit(failed ? 1 : 0)
  }

  console.log('Display-heading font check (ratcheted, weight-agnostic)')
  console.log('======================================================')
  console.log()
  console.log(`Raw display <h1>/<h2> (no font-display):     ${violations.length}`)
  console.log(`  Baseline ceiling (count may not exceed):   ${ceiling}`)
  console.log(`  Tracked debt (baselined paths):            ${baselineSet.size}`)
  console.log(`  NEW raw display headings (CI BLOCKER):      ${newViolations.length}`)
  console.log(`  Over the count ceiling (CI BLOCKER):        ${overCeiling}`)
  console.log(`  Fixed since baseline:                       ${fixedSinceBaseline.length}`)
  console.log()
  if (newViolations.length > 0) {
    console.log('NEW raw display headings (these fail CI):')
    for (const v of newViolations) console.log(`  ${v}`)
    console.log()
  }
  if (overCeiling > 0) {
    console.log(`Count rose above the baseline ceiling by ${overCeiling}. The debt can only shrink.`)
    console.log()
  }
  if (failed) {
    console.log('Fix: use the H1 / H2 / DisplayHeading primitives from @/components/site/primitives')
    console.log('(they carry font-display), not a raw sized/weighted <h1>/<h2>.')
  }

  if (REPORT) process.exit(0)
  process.exit(failed ? 1 : 0)
}

main()
