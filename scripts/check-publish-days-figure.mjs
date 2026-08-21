#!/usr/bin/env node
/**
 * Days-figure publish lock.
 *
 * One pulse days number must print as one string. FAQ interpolates tenths.
 * Math.round on the card printed 40 next to FAQ 39.5.
 * Founding case: /communities/black-butte-ranch (fleet 5b1120c4e25c70f0b99e75b956370319).
 *
 *   node scripts/check-publish-days-figure.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-days-figure.ts')
checks.push({
  label: 'publishDaysFigure keeps tenths and does not integer-round',
  ok:
    /export function publishDaysFigure/.test(helper) &&
    /export function publishDaysLabel/.test(helper) &&
    helper.includes('Math.round(days * 10) / 10') &&
    !/Math\.round\(\s*days\s*\)/.test(helper),
})

const surfaces = [
  {
    path: 'components/site/kb/KbMarketHud.client.tsx',
    label: 'KbMarketHud gates KPI days through publishDaysLabel',
  },
  {
    path: 'components/site/kb/KbHero.client.tsx',
    label: 'KbHero gates Pending-in days through publishDaysLabel',
  },
  {
    path: 'lib/site/market-faq.ts',
    label: 'buildMarketFaq interpolates publishDaysFigure',
  },
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community about-facts gate days through publishDaysLabel',
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city about-facts gate days through publishDaysLabel',
  },
  {
    // hood-d moved the neighborhood day-figure assembly out of page.tsx into
    // the _v3 model, following the city/neighborhood *-sections.ts pattern.
    path: 'app/cities/[slug]/[neighborhoodSlug]/_v3/hood-d-model.ts',
    label: 'neighborhood compare facts gate days through publishDaysLabel',
  },
  {
    path: 'app/cities/[slug]/_v3/city-sections.ts',
    label: 'city Instrument days gate through publishDaysFigure',
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts',
    label: 'neighborhood Instrument days gate through publishDaysFigure',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  const usesFigure =
    /from ['"]@\/lib\/market\/publish-days-figure['"]/.test(text) &&
    (/publishDaysFigure\(/.test(text) || /publishDaysLabel\(/.test(text))
  const stillRounds =
    /Math\.round\([^)]*(?:[Dd]ays|medianDays|daysToPending|medianDom)/.test(text)
  checks.push({
    label: surface.label,
    ok: usesFigure && !stillRounds,
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-days-figure: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-days-figure: ${checks.length}/${checks.length}`)
