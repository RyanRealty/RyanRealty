#!/usr/bin/env node
/**
 * Complete-month median publish lock.
 *
 * An in-progress monthly cache row with a null median must not hide the last
 * complete month. The Instrument labels the current month only when that row
 * has a verified median. Otherwise it prints "{Month} median sale".
 * Founding case: /housing-market/powell-butte (fleet 19ac3db1d801907c92b9f705bf5ab49c).
 *
 *   node scripts/check-publish-complete-month-median.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-complete-month-median.ts')
checks.push({
  label: 'publishCompleteMonthMedian falls back to a named complete month',
  ok:
    /export function publishCompleteMonthMedian/.test(helper) &&
    /export function completeMonthMedianLabel/.test(helper) &&
    helper.includes("label: 'this month median sale'") &&
    helper.includes('lastComplete') &&
    helper.includes('Powell Butte'),
})

const figures = src('app/housing-market/[...slug]/_v3/geo-figures.ts')
checks.push({
  label: 'city period figures gate the month median through publishCompleteMonthMedian',
  ok:
    /from ['"]@\/lib\/market\/publish-complete-month-median['"]/.test(figures) &&
    /publishCompleteMonthMedian\(/.test(figures) &&
    /currentMonthKey/.test(figures) &&
    !/priceFigure\(args\.monthly\?\.medianSalePrice, 'this month median sale'\)/.test(figures),
})

const page = src('app/housing-market/[...slug]/page.tsx')
checks.push({
  label: 'housing-market geo page fetches the last complete monthly row',
  ok:
    /getCompleteMonthlyMarketDetail/.test(page) &&
    /lastComplete: lastCompleteMonthly/.test(page) &&
    /currentMonthKey/.test(page),
})

const community = src('app/housing-market/[...slug]/_v3/community-view.tsx')
checks.push({
  label: 'community market view passes lastComplete into buildClosedFigures',
  ok:
    /lastComplete/.test(community) &&
    /buildClosedFigures\(detail, lastComplete, currentMonthKey\)/.test(community),
})

const dal = src('lib/data/market/getCityMarketDetail.ts')
checks.push({
  label: 'DAL exposes getCompleteMonthlyMarketDetail (period_start before current month)',
  ok:
    /export const getCompleteMonthlyMarketDetail/.test(dal) &&
    dal.includes(".lt('period_start', before)"),
})

const agent = src('lib/agent/tools/market.ts')
checks.push({
  label: 'SMS market_stats tool gates sale median through publishCompleteMonthMedian',
  ok:
    /from ['"]@\/lib\/market\/publish-complete-month-median['"]/.test(agent) &&
    /publishCompleteMonthMedian\(/.test(agent) &&
    /getCompleteMonthlyMarketDetail/.test(agent),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-complete-month-median: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-complete-month-median: ${checks.length}/${checks.length}`)
