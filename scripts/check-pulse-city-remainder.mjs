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
    path: 'app/page.tsx',
    label: 'homepage fetches all city pulse rows and passes regionActive',
    regionActive: /regionActive:\s*pulse\?\.activeCount/,
  },
  {
    path: 'app/housing-market/page.tsx',
    label: 'housing-market hub fetches all city pulse rows and passes regionActive',
    regionActive: /regionActive:\s*regionPulse\?\.activeCount/,
  },
  {
    path: 'app/housing-market/central-oregon/page.tsx',
    label: 'central-oregon report fetches all city pulse rows and passes regionActive',
    regionActive: /regionActive:\s*regionPulse\?\.activeCount/,
  },
  {
    path: 'app/housing-market/annual-review/page.tsx',
    label: 'annual-review fetches all city pulse rows and passes regionActive',
    regionActive: /regionActive:\s*regionPulse\?\.activeCount/,
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
 * Homepage hero: the count IS the region pulse row, so the sentence it sits in
 * may not name the town doors.
 *
 * Founding case (fleet, 2026-08-17): the hero read "1,834 homes for sale Bend,
 * Redmond, Sisters, Sunriver, La Pine, and Terrebonne." 1,834 was
 * market_pulse_live geo_type='region'; those six towns summed to 927. Fixed in
 * 30b0a926 by relabelling the lead — with nothing mechanical holding it, because
 * the remainder checks below only cover the town TABLE, and ci:place-hero-grain
 * covers the place pages, not app/page.tsx. The town list is read out of the
 * page's own TOWN_ORDER so a new town door cannot slip past this.
 */
{
  const text = src('app/page.tsx')
  const heroMatch = /<(?:HomeDHero|KbHero)\b[\s\S]*?\/>/.exec(text)
  const hero = heroMatch ? heroMatch[0] : ''
  const leadMatch = /\blead=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(hero)
  const lead = (leadMatch?.[1] ?? leadMatch?.[2] ?? '').toLowerCase()
  const townOrder = /const TOWN_ORDER = \[([^\]]*)\]/.exec(text)?.[1] ?? ''
  const towns = [...townOrder.matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/-/g, ' '))
  const named = towns.filter((town) => lead.includes(town))
  checks.push({
    label: 'homepage hero passes the region pulse count',
    ok: /activeCount:\s*pulse\?\.activeCount/.test(hero),
  })
  checks.push({
    label: 'homepage hero lead names the region, not the town doors',
    ok:
      lead.length > 0 &&
      named.length === 0 &&
      /central oregon/.test(lead),
  })
  if (named.length > 0) {
    console.log(`      hero lead names town door(s): ${named.join(', ')}`)
  }
}

const builders = [
  'app/page.tsx',
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
