#!/usr/bin/env node
/**
 * Mixed-source Instrument stamp lock.
 *
 * An Instrument that prints mart composition and live MOS must not wear one
 * "updated" date. Founding case: /housing-market Aug 10 vs Aug 16
 * (fleet d0c34f643bdd02efa55823aa94c5b590).
 *
 * Also locks the median-sale chart x-axis under the plot, not in the Y gutter
 * (fleet bcc6d678f9450f01b95dc77a20a9b9cc).
 *
 *   node scripts/check-publish-mixed-instrument-stamp.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-mixed-instrument-stamp.ts')
checks.push({
  label: 'publishInstrumentStamp withholds a stamp when clocks differ',
  ok:
    /export function publishInstrumentStamp/.test(helper) &&
    helper.includes('unique.length !== 1') &&
    helper.includes('d0c34f643bdd02efa55823aa94c5b590'),
})

const hub = src('app/housing-market/page.tsx')
checks.push({
  label: 'housing-market hub lead stamp gates through publishInstrumentStamp',
  ok:
    /from ['"]@\/lib\/market\/publish-mixed-instrument-stamp['"]/.test(hub) &&
    // The live section's stamp is COMPOSED from its two market-truth rows via
    // the chokepoint (withhold on a clock mismatch) — never by ?? coalescing,
    // which prints the first clock and ages the other row's figures.
    /publishInstrumentStamp\(\[/.test(hub) &&
    !/computedAt \?\? \S*computedAt/.test(hub),
})

const region = src('app/housing-market/central-oregon/page.tsx')
checks.push({
  label: 'region report lead stamp gates through publishInstrumentStamp',
  ok:
    /from ['"]@\/lib\/market\/publish-mixed-instrument-stamp['"]/.test(region) &&
    /publishInstrumentStamp\(\[/.test(region) &&
    !/computedAt \?\? \S*computedAt/.test(region),
})

const chartCss = src('components/site/v3/V3Chart.css')
checks.push({
  label: 'V3Chart x-axis sits under the plot (grid-column 2)',
  ok:
    /grid-column:\s*2/.test(chartCss) &&
    chartCss.includes('.v3-chart__x') &&
    chartCss.includes('justify-content: space-between'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-mixed-instrument-stamp: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-mixed-instrument-stamp: ${checks.length}/${checks.length}`)
