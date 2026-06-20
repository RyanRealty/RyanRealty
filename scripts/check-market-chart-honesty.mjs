#!/usr/bin/env node
/**
 * check-market-chart-honesty.mjs — anti-regression lock for KbMarketChart.
 *
 * The market chart regressed twice (wavy over-smoothing, off-brand rainbow
 * spaghetti). This gate makes the 2026-06-19 fix permanent by asserting the exact
 * invariants that, if broken, reproduce the regression. Each check maps to a real
 * defect — this is a crash-guard, not green-grep theater.
 *
 *   1. Line ink is CREAM (the two-color brand system), not a multi-hue rainbow.
 *   2. The line path is the BROKEN polyline (linear, lifts across gaps) — no spline
 *      curve builder (smoothing invents medians that don't exist → §0 violation).
 *   3. The sparse-geo VOLUME_FLOOR + soldCount suppression is present.
 *   4. soldCount rides through buildYearSeries (else the floor is a silent no-op).
 *
 * Usage: node scripts/check-market-chart-honesty.mjs
 */
import { readFileSync } from 'node:fs'

const CHART = 'components/site/kb/KbMarketChart.client.tsx'
const SERIES = 'lib/kb/year-series.ts'
const chart = readFileSync(CHART, 'utf8')
const series = readFileSync(SERIES, 'utf8')
const fails = []

// 1. Cream ink, no rainbow palette.
if (!/const\s+LINE_INK\s*=\s*['"]#faf8f4['"]/.test(chart)) {
  fails.push(`${CHART}: LINE_INK must be the cream brand ink ('#faf8f4'). The year lines are distinguished by brightness (recency), never by hue.`)
}
if (!/color:\s*LINE_INK/.test(chart)) {
  fails.push(`${CHART}: each year line's color must be LINE_INK (cream). Do not reintroduce a per-year hue.`)
}
// A multi-hue palette array of line colors = the rainbow regression. Flag an array
// literal holding 3+ distinct non-cream hex colors.
const arrays = chart.match(/\[\s*(?:['"]#[0-9a-fA-F]{3,6}['"]\s*,\s*){2,}['"]#[0-9a-fA-F]{3,6}['"]\s*\]/g) || []
for (const a of arrays) {
  const hues = [...a.matchAll(/#[0-9a-fA-F]{3,6}/g)].map((m) => m[0].toLowerCase()).filter((h) => h !== '#faf8f4')
  if (new Set(hues).size >= 3) {
    fails.push(`${CHART}: a multi-hue color array (${[...new Set(hues)].slice(0, 4).join(', ')}…) looks like the rainbow line palette regression. Year lines must be cream-only.`)
  }
}

// 2. Broken linear path, no spline.
if (!/function\s+brokenPath\s*\(/.test(chart) || !/path:\s*brokenPath\(/.test(chart)) {
  fails.push(`${CHART}: the line path must be built by brokenPath() (linear segments that lift across month gaps). Removing it reintroduces drawing-through-gaps.`)
}
// Guard against a cubic/quadratic curve builder sneaking into a path string (template
// or concatenation emitting C/Q/S/T commands). brokenPath emits only M/L.
if (/[`'"][^`'"]*\b[CQST]\$\{/.test(chart) || /['"`]\s*\+\s*['"`]?[CQST]/.test(chart)) {
  fails.push(`${CHART}: a path builder emits a curve command (C/Q/S/T). Median trend lines must be linear — splines overshoot and invent values (§0).`)
}

// 3. Volume floor + suppression.
if (!/const\s+VOLUME_FLOOR\s*=\s*\d+/.test(chart)) {
  fails.push(`${CHART}: VOLUME_FLOOR must be defined — sparse-geo months below it are noise and must be suppressed.`)
}
if (!/soldCount\s*==\s*null\s*\|\|\s*p\.soldCount\s*>=\s*VOLUME_FLOOR/.test(chart.replace(/\s+/g, ' ')) &&
    !/p\.soldCount\s*>=\s*VOLUME_FLOOR/.test(chart)) {
  fails.push(`${CHART}: the sparse-geo suppression filter (soldCount < VOLUME_FLOOR → drop) is missing.`)
}

// 4. soldCount carried through the series builder.
if (!/soldCount/.test(series)) {
  fails.push(`${SERIES}: buildYearSeries must carry soldCount per point, or the chart's volume floor is a silent no-op.`)
}

console.log('Market-chart honesty gate (KbMarketChart)')
console.log('=========================================')
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} regression guard(s) tripped:\n`)
  for (const f of fails) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('Cream-ink lines, linear broken path (no spline), sparse-geo volume floor, soldCount carried. Honest.')
