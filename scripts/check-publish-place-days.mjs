#!/usr/bin/env node
/**
 * Place days-to-pending publish lock.
 *
 * Pulse medians can be .5. A place page that prints that pulse twice must
 * run publishPlaceDays so the market card cannot invent a second integer
 * while the hero and FAQ keep the half-day.
 * Founding case: /communities/black-butte-ranch card 40 vs FAQ 39.5
 * (fleet 5b1120c4e25c70f0b99e75b956370319).
 *
 *   node scripts/check-publish-place-days.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-place-days.ts')
checks.push({
  label: 'publishPlaceDays keeps half-days and does not integer-round',
  ok:
    /export function publishPlaceDays/.test(helper) &&
    /export function formatPlaceDays/.test(helper) &&
    helper.includes('Math.round(value * 10) / 10') &&
    !/Math\.round\(\s*value\s*\)/.test(helper),
})

const surfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community glance gates days through formatPlaceDays',
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city glance gates days through formatPlaceDays',
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood glance gates days through formatPlaceDays',
  },
  {
    path: 'components/site/kb/KbMarketHud.client.tsx',
    label: 'KbMarketHud gates Median to pending through formatPlaceDays',
  },
  {
    path: 'lib/site/market-faq.ts',
    label: 'buildMarketFaq publishes days through publishPlaceDays',
  },
  {
    path: 'components/site/primitives/DaysCount.tsx',
    label: 'DaysCount formats pulse days through formatPlaceDays',
  },
  {
    path: 'components/landing/ExpiredMarketStatStrip.tsx',
    label: 'expired LP strip gates days through formatPlaceDays',
  },
  {
    path: 'lib/crm/market-report-format.ts',
    label: 'CRM market-report days use formatPlaceDays',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-place-days['"]/.test(text) &&
      (/publishPlaceDays\(/.test(text) || /formatPlaceDays\(/.test(text)),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-days: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-days: ${checks.length}/${checks.length}`)
