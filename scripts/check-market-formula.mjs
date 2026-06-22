#!/usr/bin/env node
/**
 * check-market-formula.mjs (ci:market-formula) — audit p0.4.
 *
 * Months of supply is active listings / (homes closed in the last 6 months / 6)
 * per CLAUDE.md §0 — NEVER "active listings divided by (closed last 30 days
 * times 2)". Public market surfaces must use MOS_METHODOLOGY_CLAUSE /
 * MOS_THRESHOLD_CLAUSE / marketVerdict() from lib/market/classify.ts so the
 * published methodology can never drift from the canonical formula again.
 */
import { readFileSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BAD_FORMULA = /closed last 30 days (times 2|\* ?2)/i
const SELF = new Set([
  'lib/market/classify.ts',
  'lib/market/classify.test.ts',
  'scripts/check-market-formula.mjs',
])

const files = [...walkFiles('app'), ...walkFiles('lib')].filter((f) => !SELF.has(f))
const formulaHits = files.filter((f) => BAD_FORMULA.test(readFileSync(f, 'utf8')))

// Ban inline MoS verdict thresholds in the data layer (audit p0.4b) — the
// <=4 / <6 / >=6 boundaries live ONLY in lib/market/classify.ts (marketVerdict).
// Scoped to the reusable data layer; page-prose verdict sites are a tracked
// follow-up (correct today, article-variation labels).
const THRESHOLD = /\bmos\b\s*(<=\s*4|<\s*6|>=\s*6)/i
const dataFiles = [...walkFiles('lib/data'), ...walkFiles('lib/site')].filter((f) => !SELF.has(f))
const thresholdHits = dataFiles.filter((f) => THRESHOLD.test(readFileSync(f, 'utf8')))

console.log('market MoS-formula gate (ci:market-formula)')
console.log('===========================================')
let failed = false
if (formulaHits.length) {
  failed = true
  console.error('Files publishing the WRONG months-of-supply formula ("closed last 30 days times 2"):')
  for (const h of formulaHits) console.error(`  ✗ ${h}`)
  console.error('  Use MOS_METHODOLOGY_CLAUSE from lib/market/classify.ts (canonical §0 formula).')
}
if (thresholdHits.length) {
  failed = true
  console.error('Data-layer files with inline MoS thresholds (use marketVerdict() from lib/market/classify.ts):')
  for (const h of thresholdHits) console.error(`  ✗ ${h}`)
}
if (failed) {
  console.error('\nFAILED.')
  process.exit(1)
}
console.log('OK — canonical MoS formula + data-layer verdicts via lib/market/classify.ts.')
process.exit(0)
