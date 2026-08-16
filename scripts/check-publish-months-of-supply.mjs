#!/usr/bin/env node
/**
 * Pulse months-of-supply publish lock.
 *
 * Pulse MOS uses that row's active_count as the numerator. A place page that
 * prints a different active count (or a 12-month sold count the implied
 * six-month closes cannot sit inside) must run publishMonthsOfSupply before
 * the HUD, FAQ, or Dataset see the figure.
 * Founding case: /communities/tetherow 4.6 MOS + 35 actives + 36 sold/12mo
 * (fleet 5d55abbd72a67d25a5d7232b46fd2fb0).
 *
 *   node scripts/check-publish-months-of-supply.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-months-of-supply.ts')
checks.push({
  label: 'publishMonthsOfSupply withholds a mismatched numerator and impossible six-month closes',
  ok:
    /export function publishMonthsOfSupply/.test(helper) &&
    /export function impliedSixMonthCloses/.test(helper) &&
    helper.includes('pulseActive !== shownActive') &&
    helper.includes('implied > sold'),
})

const surfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page gates HUD + FAQ MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood page gates HUD + FAQ MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page gates HUD + FAQ MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/page.tsx',
    label: 'homepage HUD gates MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/housing-market/[...slug]/page.tsx',
    label: 'housing-market geo gates MOS through publishMonthsOfSupply',
  },
  {
    path: 'lib/site/market-faq.ts',
    label: 'buildMarketFaq refuses an impossible MOS + sold year',
  },
  {
    path: 'lib/data/crm/getMarketReportData.ts',
    label: 'CRM market-report block gates live MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/api/reports/export/route.ts',
    label: 'report export gates live MOS through publishMonthsOfSupply',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-months-of-supply['"]/.test(text) &&
      /publishMonthsOfSupply\(/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-months-of-supply: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-months-of-supply: ${checks.length}/${checks.length}`)
