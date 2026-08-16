#!/usr/bin/env node
/**
 * Plat live-figure publish lock.
 *
 * A plat hero/sell figure must come from the plat counted set. City and
 * community pulse are other geographies and must not fill unlabeled
 * pending-days or 30-day sold on the plat page.
 * Founding case: /subdivisions/ridge-at-eagle-crest printed Pending in
 * 19.5 days (Redmond city pulse) next to the plat $910,000 median
 * (fleet 6a52801e3ef9e0d041b830497794290d).
 *
 *   node scripts/check-publish-plat-figures.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-plat-figures.ts')
checks.push({
  label: 'publishPlatFigures withholds parent-pulse pending and sold',
  ok:
    /export function publishPlatFigures/.test(helper) &&
    helper.includes('medianDaysToPending: null') &&
    helper.includes('soldCount30d: null') &&
    helper.includes('asPositiveMedian(input.platMedianListPrice)'),
})

const place = src('app/subdivisions/[slug]/page.tsx')
checks.push({
  label: 'plat page gates hero/sell figures through publishPlatFigures',
  ok:
    /from ['"]@\/lib\/market\/publish-plat-figures['"]/.test(place) &&
    /publishPlatFigures\(/.test(place) &&
    /platFigures\.medianListPrice/.test(place) &&
    /platFigures\.medianDaysToPending/.test(place) &&
    /platFigures\.soldCount30d/.test(place),
})

checks.push({
  label: 'plat page does not fill hero/sell from city or community pulse',
  ok:
    !/cityPulse\?\.medianListPrice/.test(place) &&
    !/communityPulse\?\.medianListPrice/.test(place) &&
    !/cityPulse\?\.medianDaysToPending/.test(place) &&
    !/communityPulse\?\.medianDaysToPending/.test(place) &&
    !/cityPulse\?\.closedLast30Days/.test(place) &&
    !/fetchSubdivMarketExtras/.test(place),
})

const extras = src('lib/explore/subdivision-page-extras.ts')
checks.push({
  label: 'subdivision extras no longer fetch parent pulse for the plat hero',
  ok: !/export async function fetchSubdivMarketExtras/.test(extras),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-plat-figures: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-plat-figures: ${checks.length}/${checks.length}`)
