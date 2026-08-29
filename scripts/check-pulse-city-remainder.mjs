#!/usr/bin/env node
/**
 * Leftover region inventory vs city-table remainder lock.
 *
 * A page that prints a leftover region inventory total next to a city
 * inventory table must name omitted leftover cities and the leftover
 * remainder. Founding case: /housing-market printed 1,841 next to seven
 * city rows summing to 1,026 (fleet 5439b87e, 2026-08-16). D21: the pile
 * is leftover membership, miss omits.
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
  label: 'namePulseCityRemainder exists and names omitted leftover cities plus remainder',
  ok:
    /export function namePulseCityRemainder/.test(helper) &&
    /omitted leftover cities/i.test(helper) &&
    helper.includes('mapped city') &&
    helper.includes('Also in the regional count and not in the table'),
})

const surfaces = [
  {
    path: 'app/housing-market/page.tsx',
    label: 'housing-market hub fetches leftover city rows and passes leftover regionActive',
    regionActive: /regionActive:\s*hud\.active/,
  },
  {
    path: 'app/housing-market/central-oregon/page.tsx',
    label: 'central-oregon report fetches leftover city rows and passes leftover regionActive',
    regionActive: /regionActive:\s*hud\.active/,
  },
  {
    path: 'app/housing-market/annual-review/page.tsx',
    label: 'annual-review fetches leftover city rows and passes leftover regionActive',
    regionActive: /regionActive:\s*hud\.active/,
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /getMarketPulseAllCitySnapshots\(/.test(text) &&
      surface.regionActive.test(text) &&
      !/getMarketPulseCitySnapshots\(/.test(text),
  })
}

/**
 * Homepage no longer prints a leftover region inventory total next to the
 * town Ledger (Matt 2026-08-28). The founding case — a region count sitting
 * beside six town doors — is gone. Hold the absence so the caption cannot
 * return, and keep the remainder lock on the housing-market surfaces above.
 */
{
  const text = src('app/page.tsx')
  checks.push({
    label: 'homepage Field does not print a leftover inventory caption',
    ok:
      !/HERO_COUNT_LEAD/.test(text) &&
      !/homes for sale across Central Oregon\. Live list prices and days on market/.test(text) &&
      !/\bcount=\{/.test(text),
  })
  checks.push({
    label: 'homepage town Ledger does not print the regional remainder paragraph',
    ok: !/townRemainder/.test(text) && !/namePulseCityRemainder/.test(text),
  })
}

const builders = [
  'app/housing-market/_v3/hub-sections.ts',
  'app/housing-market/central-oregon/_v3/region-sections.ts',
  'app/housing-market/annual-review/_v3/annual-sections.ts',
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
