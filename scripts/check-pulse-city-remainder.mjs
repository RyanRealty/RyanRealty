#!/usr/bin/env node
/**
 * Region SFR pulse vs city-table remainder lock.
 *
 * A page that prints a region inventory total next to a city inventory table
 * must name omitted pulse cities and the TIGER/MLS remainder. Founding case:
 * /housing-market printed 1,841 next to seven city rows summing to 1,026
 * (fleet 5439b87e, 2026-08-16).
 *
 *   node scripts/check-pulse-city-remainder.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/pulse-city-remainder.ts')
checks.push({
  label: 'namePulseCityRemainder exists and names omitted cities plus remainder',
  ok:
    /export function namePulseCityRemainder/.test(helper) &&
    /omitted pulse cities/i.test(helper) &&
    helper.includes('incorporated-place boundary') &&
    helper.includes('Also in the region pulse and not in the table'),
})

const surfaces = [
  {
    path: 'app/housing-market/page.tsx',
    label: 'housing-market hub fetches all city pulse rows and passes regionActive',
  },
  {
    path: 'app/housing-market/central-oregon/page.tsx',
    label: 'central-oregon report fetches all city pulse rows and passes regionActive',
  },
  {
    path: 'app/housing-market/annual-review/page.tsx',
    label: 'annual-review fetches all city pulse rows and passes regionActive',
  },
  {
    path: 'app/cities/page.tsx',
    label: 'cities index fetches all city pulse rows and passes regionActive',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /getMarketPulseAllCitySnapshots\(/.test(text) &&
      /regionActive:\s*regionPulse\?\.activeCount/.test(text) &&
      !/getMarketPulseCitySnapshots\(/.test(text),
  })
}

const builders = [
  'app/housing-market/_v3/hub-sections.ts',
  'app/housing-market/central-oregon/_v3/region-sections.ts',
  'app/housing-market/annual-review/_v3/annual-sections.ts',
  'app/cities/city-index-remainder.ts',
]
for (const path of builders) {
  const text = src(path)
  checks.push({
    label: `${path} calls namePulseCityRemainder`,
    ok: /namePulseCityRemainder\(/.test(text) && /from ['"]@\/lib\/market\/pulse-city-remainder['"]/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npulse-city-remainder: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npulse-city-remainder: ${checks.length}/${checks.length}`)
