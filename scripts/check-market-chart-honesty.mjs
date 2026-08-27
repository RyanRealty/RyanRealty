#!/usr/bin/env node
/**
 * check-market-chart-honesty.mjs — anti-regression lock for the market chart.
 *
 * The market chart regressed twice (wavy over-smoothing, off-brand rainbow
 * spaghetti). This gate makes the 2026-06-19 fix permanent by asserting the
 * invariants that, if broken, reproduce the regression.
 *
 * RE-EXPRESSED 2026-08-27, when the KB register was deleted. The old gate read
 * components/site/kb/KbMarketChart.client.tsx and lib/kb/year-series.ts. The
 * chart is now components/site/v3/V3Chart.tsx and the sparse-geo volume floor
 * moved DOWN to the data layer (lib/data/market/getCityArchive.ts), which is a
 * better home for it: a floor applied in the chart protects one chart, a floor
 * applied at the read protects every consumer of the read. The four invariants
 * are unchanged; only where each is asserted moved. Nothing was dropped in the
 * swap, which is the whole reason the old gate hard-failed on a missing file
 * instead of skipping.
 *
 *   1. The line path is the BROKEN polyline — no spline/curve smoothing.
 *      Smoothing invents medians that do not exist (section 0).
 *   2. Line ink comes from the two-color token set, never a multi-hue palette.
 *   3. The sparse-geo volume floor is applied on the read, with its guard.
 *   4. soldCount rides through buildYearSeries, else the floor is a no-op.
 *
 * Usage: node scripts/check-market-chart-honesty.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const CHART  = 'components/site/v3/V3Chart.tsx'
const SERIES = 'lib/kb/year-series.ts'
const ARCHIVE = 'lib/data/market/getCityArchive.ts'

for (const required of [CHART, SERIES, ARCHIVE]) {
  if (existsSync(required)) continue
  console.error(
    `✗ market-chart-honesty: ${required} is missing, so the market chart's honesty ` +
      `invariants (no spline, token ink, volume floor, soldCount pass-through) are ` +
      `enforced by nothing. Repoint this gate at the replacement file.`,
  )
  process.exit(1)
}

const chart = readFileSync(CHART, 'utf8')
const series = readFileSync(SERIES, 'utf8')
const archive = readFileSync(ARCHIVE, 'utf8')
const fails = []

// 1. No spline. A curve builder between real points draws medians nobody measured.
const SPLINE = /\b(curveCardinal|curveCatmullRom|curveBasis|curveMonotone|d3\.curve|type="monotone"|type='monotone'|smoothing|bezierCurveTo|\bQ\s*\$\{|cubicTo)\b/
if (SPLINE.test(chart.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''))) {
  fails.push(`${CHART}: a spline/curve builder is back. The path between two monthly medians must be straight — a curve invents values between them (section 0).`)
}

// 2. Ink from tokens, never a hue palette. Comments stripped first: this repo has
//    twice shipped a gate that fired on its own explanatory prose.
const code = chart.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
const arrays = code.match(/\[\s*(?:['"]#[0-9a-fA-F]{3,6}['"]\s*,\s*){2,}['"]#[0-9a-fA-F]{3,6}['"]\s*\]/g) || []
for (const a of arrays) {
  const hues = [...a.matchAll(/#[0-9a-fA-F]{3,6}/g)].map((m) => m[0].toLowerCase())
    .filter((h) => !['#faf8f4', '#102742', '#ffffff', '#fff'].includes(h))
  if (new Set(hues).size >= 3) {
    fails.push(`${CHART}: a multi-hue color array (${[...new Set(hues)].slice(0, 4).join(', ')}...) looks like the rainbow line palette regression. Series are distinguished by brightness and dash, never by hue.`)
  }
}

// 3. The sparse-geo floor, on the read.
if (!/export const MONTHLY_VOLUME_FLOOR\s*=\s*\d+/.test(archive)) {
  fails.push(`${ARCHIVE}: MONTHLY_VOLUME_FLOOR is gone. A month with one or two closings contributes a "median" that is one sale price, and the line zigzags on noise.`)
}
if (!/soldCount\s*\?\?\s*0\)\s*>=\s*MONTHLY_VOLUME_FLOOR/.test(archive)) {
  fails.push(`${ARCHIVE}: the MONTHLY_VOLUME_FLOOR guard no longer filters months by soldCount, so the constant is decorative.`)
}

// 4. soldCount rides through, else the floor above can never be applied.
if (!/soldCount/.test(series)) {
  fails.push(`${SERIES}: soldCount must ride through buildYearSeries — without it nothing downstream can apply the volume floor.`)
}

if (fails.length) {
  console.error('✗ market-chart-honesty')
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log('✓ market-chart-honesty: no spline, token ink, volume floor applied on the read, soldCount rides through.')
