#!/usr/bin/env node
/**
 * Place-in-city publish lock.
 *
 * Do not append the page city when the venue already names a city.
 * Founding case: /central-oregon/events/sunriver-music-festival printed
 * "Tower Theatre, Bend in Sunriver" (fleet 14861a063d46a650327c0388a5f36bb5).
 *
 *   node scripts/check-publish-place-in-city.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/place/publish-place-in-city.ts')
checks.push({
  label: 'publishPlaceInCity withholds a repeated city',
  ok:
    /export function publishPlaceInCity/.test(helper) &&
    /export function publishPlaceWithCity/.test(helper) &&
    /export function placeAlreadyNamesCity/.test(helper),
})

const faq = src('lib/events-format.ts')
checks.push({
  label: 'event FAQ Where answer gates through publishPlaceInCity',
  ok:
    /from ['"]@\/lib\/place\/publish-place-in-city['"]/.test(faq) &&
    /publishPlaceInCity\(e\.venue, e\.city\)/.test(faq) &&
    !faq.includes('${e.venue} in ${e.city}'),
})

const detail = src('app/central-oregon/events/[slug]/page.tsx')
checks.push({
  label: 'event detail Where body gates through publishPlaceInCity',
  ok:
    /from ['"]@\/lib\/place\/publish-place-in-city['"]/.test(detail) &&
    /publishPlaceInCity\(event\.venue, event\.city\)/.test(detail) &&
    !detail.includes('${event.venue} in ${event.city}'),
})

const index = src('app/central-oregon/events/page.tsx')
checks.push({
  label: 'events index where line gates through publishPlaceWithCity',
  ok:
    /from ['"]@\/lib\/place\/publish-place-in-city['"]/.test(index) &&
    /publishPlaceWithCity\(event\.venue, event\.city\)/.test(index),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-in-city: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-in-city: ${checks.length}/${checks.length}`)
