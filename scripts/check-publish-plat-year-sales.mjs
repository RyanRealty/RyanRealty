#!/usr/bin/env node
/**
 * Plat YTD vs calendar-year table publish lock.
 *
 * A plat sales-history section that prints Year to date next to a year table
 * must run publishPlatYtdStats. Withhold the cache YTD strip when sold count
 * or nearest-thousand median contradicts the current-year table row.
 * Founding case: /subdivisions/ridge-at-eagle-crest YTD 9 / $850,000 next to
 * 2026 17 / $575,000 (fleet 0db0fe1f57c4a353e27acf7a85f41fd6).
 *
 *   node scripts/check-publish-plat-year-sales.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-plat-year-sales.ts')
checks.push({
  label: 'publishPlatYtdStats withholds a contradictory current-year table',
  ok:
    /export function publishPlatYtdStats/.test(helper) &&
    /export function currentYearSalesRow/.test(helper) &&
    helper.includes('ytdSold !== yearRow.closedCount') &&
    helper.includes('nearestThousand'),
})

const surfaces = [
  {
    path: 'app/subdivisions/[slug]/SubdivisionSalesHistory.tsx',
    label: 'plat sales history gates the YTD strip through publishPlatYtdStats',
  },
  {
    path: 'app/subdivisions/[slug]/_v3/subdivision-figures.ts',
    label: 'platStatsFigures gates YTD figures through publishPlatYtdStats',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-plat-year-sales['"]/.test(text) &&
      /publishPlatYtdStats\(/.test(text) &&
      /currentYearSalesRow\(/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-plat-year-sales: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-plat-year-sales: ${checks.length}/${checks.length}`)
