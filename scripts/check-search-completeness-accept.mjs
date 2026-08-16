#!/usr/bin/env node
/**
 * G15 lock: FILTER_COMPLETENESS accept ledger stays complete.
 * Every long-tail concept from registry-report.json is dispositioned.
 * Prod TTFB p75 is recorded and under 600ms.
 *
 *   node scripts/check-search-completeness-accept.mjs
 */
import { readFileSync } from 'node:fs'

const ACCEPT_IDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']
const LONG_TAIL_TOTAL = 268
const TTFB_TARGET_MS = 600

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const dal = src('lib/data/loop/search-completeness.ts')
checks.push({
  label: 'search-completeness DAL exports completeness + A1–A11 + 268 + 600ms',
  ok:
    /export function searchCompletenessComplete/.test(dal) &&
    /export function readSearchCompletenessAccept/.test(dal) &&
    ACCEPT_IDS.every((id) => dal.includes(`'${id}'`)) &&
    /G15_LONG_TAIL_TOTAL = 268/.test(dal) &&
    /G15_TTFB_TARGET_MS = 600/.test(dal),
})

const signals = src('lib/data/loop/signals.ts')
checks.push({
  label: 'scoreboard reads the search-completeness DAL',
  ok: /readSearchCompletenessAccept/.test(signals) && /searchCompleteness:/.test(signals),
})

const packet = src('docs/plans/COMPANY_SCOREBOARD.md')
checks.push({
  label: 'packet cites the search-completeness accept file',
  ok: /search-completeness-accept\.json/.test(packet),
})
checks.push({
  label: 'packet writes 268 long-tail concepts and TTFB p75 under 600ms',
  ok:
    /268/.test(packet) &&
    /TTFB p75/i.test(packet) &&
    !/Search completeness[^\n]*UNKNOWN/i.test(packet),
})

const loop = src('app/admin/(protected)/loop/page.tsx')
checks.push({
  label: 'admin loop surfaces search completeness',
  ok: /readSearchCompletenessAccept/.test(loop) && /Search completeness/.test(loop),
})

const ledgerRaw = src('docs/plans/ENTERPRISE_MAP/search-completeness-accept.json')
let ledger
try {
  ledger = JSON.parse(ledgerRaw)
} catch {
  ledger = null
}
const accept = Array.isArray(ledger?.acceptItems) ? ledger.acceptItems : []
const rows = Array.isArray(ledger?.longTail?.rows) ? ledger.longTail.rows : []
checks.push({
  label: 'accept JSON parses with A1–A11 closed and 268 long-tail rows',
  ok:
    ledger?.status === 'ok' &&
    ledger?.versionGap === 'G15' &&
    ledger?.longTail?.disposedCount === LONG_TAIL_TOTAL &&
    ledger?.longTail?.unexplainedCount === 0 &&
    rows.length === LONG_TAIL_TOTAL &&
    ACCEPT_IDS.every((id) => {
      const item = accept.find((row) => row.id === id)
      return item && item.disposition && item.disposition !== 'open' && String(item.reason ?? '').trim()
    }),
})

const homes = ledger?.perf?.p75?.ttfbHomesForSaleMs
const bend = ledger?.perf?.p75?.ttfbBendMs
checks.push({
  label: 'prod TTFB p75 is recorded and under 600ms',
  ok:
    typeof homes === 'number' &&
    typeof bend === 'number' &&
    homes <= TTFB_TARGET_MS &&
    bend <= TTFB_TARGET_MS &&
    Number(ledger?.perf?.samples) >= 8,
})

const report = JSON.parse(src('data/search-metadata/registry-report.json'))
const reportConcepts = new Set(
  [
    ...(report.longTail?.customSearchableUnregistered?.concepts ?? []),
    ...(report.longTail?.standardSearchableIdxUnregistered?.concepts ?? []),
  ]
    .map((concept) => String(concept ?? '').trim())
    .filter(Boolean),
)
const ledgerConcepts = new Set(rows.map((row) => String(row.concept ?? '').trim()))
const missingConcepts = [...reportConcepts].filter((concept) => !ledgerConcepts.has(concept))
checks.push({
  label: 'every registry-report long-tail concept is in the ledger',
  ok: reportConcepts.size > 0 && missingConcepts.length === 0,
})

const manifest = src('docs/plans/ENTERPRISE_MAP/VERSION-1.md')
checks.push({
  label: 'VERSION-1 G15 is DONE with a date',
  ok: /G15/.test(manifest) && /DONE 2026-08-16/.test(manifest) && /268/.test(manifest),
})

const register = src('docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md')
checks.push({
  label: 'R-099 and R-100 are no longer MISSING',
  ok: !/\|\s*R-099\s*\|[^|]*\|[^|]*\|\s*MISSING\s*\|/.test(register) &&
    !/\|\s*R-100\s*\|[^|]*\|[^|]*\|\s*MISSING\s*\|/.test(register),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  if (missingConcepts.length) {
    console.error(`missing concepts (${missingConcepts.length}): ${missingConcepts.slice(0, 8).join(', ')}`)
  }
  console.error(`\n${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} passed`)
