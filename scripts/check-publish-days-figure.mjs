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
    label: 'city page prints no hand-rounded days figure',
    // MOVED, NOT DROPPED (2026-08-26). The v3 city page dropped the KB
    // about-facts row, so every days figure it prints flows through the
    // route's _v3/city-sections.ts builders — the surface two entries down,
    // which still hard-requires the publisher. What the page file itself
    // still owes is the negative half: no raw Math.round on a days value,
    // which is the founding 40-vs-39.5 defect.
    negativeOnly: true,
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood page prints no hand-rounded days figure',
    // MOVED, NOT DROPPED (2026-08-26). The v3 neighborhood page dropped the KB
    // about-facts row; its days figures flow through the shared
    // leftoverMarketFigures builder in app/cities/[slug]/_v3/city-sections.ts,
    // the surface below, which still hard-requires the publisher.
    negativeOnly: true,
  },
  {
    path: 'app/cities/[slug]/_v3/city-sections.ts',
    label: 'city Instrument days gate through publishDaysFigure',
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts',
    label: 'neighborhood sections module prints no hand-rounded days figure',
    // The module's own days figures left with the pulse builders (2026-08-26):
    // the Instrument figures are built by the shared city-sections module, the
    // surface above, which still hard-requires publishDaysFigure. What this
    // file still owes is the negative half.
    negativeOnly: true,
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
    ok: surface.negativeOnly ? !stillRounds : usesFigure && !stillRounds,
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
