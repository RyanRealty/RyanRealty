#!/usr/bin/env node
/**
 * Street-line publish lock.
 *
 * Visitor street lines withhold MLS house number 0. Keep the street name.
 * Founding case: /cities/bend/awbrey-butte printed 0 Moonshadow Court
 * (fleet 3545811a84a2445587694783602cebc1).
 *
 *   node scripts/check-publish-street-line.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-street-line.ts')
checks.push({
  label: 'publishStreetLine withholds placeholder 0',
  ok:
    /export function publishStreetNumber/.test(helper) &&
    /export function publishStreetLine/.test(helper) &&
    helper.includes('/^0+$/') &&
    /export function publishUnparsedStreetLine/.test(helper),
})

const nbh = src('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts')
checks.push({
  label: 'neighborhood field titles gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(nbh) &&
    /publishStreetLine\(/.test(nbh),
})

const city = src('app/cities/[slug]/_v3/city-field-items.ts')
checks.push({
  label: 'city field titles gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(city) &&
    /publishStreetLine\(/.test(city),
})

const card = src('lib/site/listing-card.ts')
checks.push({
  label: 'listing-card addressLine gates through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(card) &&
    /publishStreetLine\(/.test(card),
})

const looking = src('lib/crm/looking-at.ts')
checks.push({
  label: 'looking-at address gates through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(looking) &&
    /publishStreetLine\(/.test(looking),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-street-line: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-street-line: ${checks.length}/${checks.length}`)
