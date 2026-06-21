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
import { readFileSync, readdirSync } from 'node:fs'

function walk(dir, acc = []) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) {
      if (!/(^|\/)(node_modules|\.next|\.git)(\/|$)/.test(p)) walk(p, acc)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      acc.push(p)
    }
  }
  return acc
}

const BAD_FORMULA = /closed last 30 days (times 2|\* ?2)/i
const SELF = new Set([
  'lib/market/classify.ts',
  'lib/market/classify.test.ts',
  'scripts/check-market-formula.mjs',
])

const files = [...walk('app'), ...walk('lib')].filter((f) => !SELF.has(f))
const hits = files.filter((f) => BAD_FORMULA.test(readFileSync(f, 'utf8')))

console.log('market MoS-formula gate (ci:market-formula)')
console.log('===========================================')
if (hits.length) {
  console.error('Files publishing the WRONG months-of-supply formula ("closed last 30 days times 2"):')
  for (const h of hits) console.error(`  ✗ ${h}`)
  console.error('\nUse MOS_METHODOLOGY_CLAUSE from lib/market/classify.ts (canonical §0 formula).')
  process.exit(1)
}
console.log('OK — no surface publishes the wrong MoS formula.')
process.exit(0)
