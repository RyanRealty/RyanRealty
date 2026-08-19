#!/usr/bin/env node
/**
 * Featured plat-strip publish lock.
 *
 * Featured /subdivisions tiles prefer verified SFR inventory over empty
 * sibling aliases. Zero-inventory plats stay on A-Z, not the featured strip.
 * Founding case: /subdivisions printed 7 of 12 featured tiles as 0 ACTIVE
 * (fleet 85d5a3fa03607cc61dfe981d2da84308).
 *
 *   node scripts/check-publish-featured-plat-inventory.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-featured-plat-inventory.ts')
checks.push({
  label: 'publishFeaturedPlats prefers inventory over empty aliases',
  ok:
    /export function publishFeaturedPlats/.test(helper) &&
    /export function featuredPlatCount/.test(helper) &&
    helper.includes('featuredPlatCount(plat, activeCountByKey) > 0') &&
    helper.includes('inventoryOk'),
})

const page = src('app/subdivisions/page.tsx')
checks.push({
  label: 'subdivisions index featured strip gates through publishFeaturedPlats',
  ok:
    /from ['"]@\/lib\/market\/publish-featured-plat-inventory['"]/.test(page) &&
    /publishFeaturedPlats\(/.test(page) &&
    !/function pickFeaturedPlats/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-featured-plat-inventory: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-featured-plat-inventory: ${checks.length}/${checks.length}`)
