#!/usr/bin/env node
/**
 * Subdivision closed-sale price publish lock (REGISTRY §4).
 *
 * Plats publish counts and individual sales, never a price statistic.
 * Founding remainder after 23y: /subdivisions/[slug] printed yearly median
 * close from an MLS SubdivisionName join next to membership counts.
 *
 *   node scripts/check-publish-subdivision-closed-price.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-subdivision-closed-price.ts')
checks.push({
  label: 'publishSubdivisionClosedPrice withholds every closed-sale price',
  ok:
    /export function publishSubdivisionClosedPrice/.test(helper) &&
    /return null/.test(helper) &&
    helper.includes('REGISTRY'),
})

const history = src('app/subdivisions/[slug]/SubdivisionSalesHistory.tsx')
checks.push({
  label: 'sales-history ledger gates closed prices through the helper and has no median column',
  ok:
    /from ['"]@\/lib\/market\/publish-subdivision-closed-price['"]/.test(history) &&
    /publishSubdivisionClosedPrice\(/.test(history) &&
    !/Median close price/.test(history) &&
    !/Median sale price/.test(history),
})

const figures = src('app/subdivisions/[slug]/_v3/subdivision-figures.ts')
checks.push({
  label: 'plat stats figures gate closed prices through the helper',
  ok:
    /from ['"]@\/lib\/market\/publish-subdivision-closed-price['"]/.test(figures) &&
    /publishSubdivisionClosedPrice\(/.test(figures) &&
    !/median sale price/.test(figures) &&
    !/median price, year over year/.test(figures),
})

const charts = src('app/subdivisions/[slug]/_v3/subdivision-charts-data.ts')
checks.push({
  label: 'plat chart-room does not draw a closed-sale median line or vs-area price card',
  ok:
    !/switcher:/.test(charts) &&
    /REGISTRY/.test(charts) &&
    /return undefined/.test(charts) &&
    !/Median close price by year/.test(charts),
})

const compute = src(
  'supabase/migrations/20260823260000_compute_market_metrics_subdivision.sql',
)
checks.push({
  label: 'subdivision compute still writes counts only',
  ok:
    /'closed_count'/.test(compute) &&
    !/median_close/.test(compute) &&
    !/months_of_supply/.test(compute),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-subdivision-closed-price: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-subdivision-closed-price: ${checks.length}/${checks.length}`)
