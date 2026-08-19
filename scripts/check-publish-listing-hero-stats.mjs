#!/usr/bin/env node
/**
 * Listing hero compact price + land acres.
 *
 * Founding cases:
 *   195 Roosevelt (220225285) $999,900 printed $1000K
 *     fleet:2ceabe03a3cc759cc09d94d2bd1e442a
 *   33725 Columbus (220226514) 19.77 acres, no beds — hero omitted lot size
 *     fleet:639e24f1d222997d0f59f2e137981de8
 *   0 Kouns Drive (220220757) 1.35 acres, no beds — hero omitted lot size
 *     fleet:57b38d188f133fe2c93c05ca6150d5d9
 *
 *   node scripts/check-publish-listing-hero-stats.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const money = src('lib/format/money.ts')
checks.push({
  label: 'formatPriceCompact promotes thousand-round >= 1000 to millions',
  ok:
    /export function formatPriceCompact/.test(money) &&
    money.includes('thousands >= 1_000') &&
    money.includes('never print $1000K'),
})

const helper = src('lib/listing/publish-listing-hero-stats.ts')
checks.push({
  label: 'publishListingHeroCompactPrice / KeyStats carry founding fingerprints',
  ok:
    /export function publishListingHeroCompactPrice/.test(helper) &&
    /export function publishListingHeroKeyStats/.test(helper) &&
    helper.includes('2ceabe03a3cc759cc09d94d2bd1e442a') &&
    helper.includes('220225285') &&
    helper.includes('19.77') &&
    helper.includes('1.35'),
})

const hero = src('components/site/listing-detail/ListingHero.tsx')
checks.push({
  label: 'ListingHero publishes compact price + key stats',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hero-stats['"]/.test(hero) &&
    /publishListingHeroCompactPrice\(/.test(hero) &&
    /publishListingHeroKeyStats\(/.test(hero) &&
    !/function formatPrice\(/.test(hero),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail passes lotSizeAcres into the hero',
  ok: /acres=\{listing\.lotSizeAcres\}/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-hero-stats: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-hero-stats: ${checks.length}/${checks.length}`)
