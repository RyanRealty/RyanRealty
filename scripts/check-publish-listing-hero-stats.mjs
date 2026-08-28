#!/usr/bin/env node
/**
 * Listing hero exact price + land acres.
 *
 * Founding cases:
 *   2949 Flagstone $568,900 printed $569K in the hero next to $568,900 in the body
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
  label: 'publishListingHeroPrice / KeyStats carry founding fingerprints',
  ok:
    /export function publishListingHeroPrice/.test(helper) &&
    /export function publishListingHeroKeyStats/.test(helper) &&
    helper.includes('568,900') &&
    helper.includes('19.77') &&
    helper.includes('1.35'),
})

const hero = src('components/site/listing-detail/ListingHero.tsx')
checks.push({
  label: 'ListingHero publishes exact price + key stats',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hero-stats['"]/.test(hero) &&
    /publishListingHeroPrice\(/.test(hero) &&
    /publishListingHeroKeyStats\(/.test(hero) &&
    !/function formatPrice\(/.test(hero),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail passes lotSizeAcres into the hero',
  ok: /acres=\{listing\.lotSizeAcres\}/.test(page),
})

const market = src('components/site/listing-detail/NeighborhoodMarketContext.tsx')
checks.push({
  label: 'listing market line prints exact list price, not thousand-round',
  ok:
    /<Price value=\{thisListPrice\} exact/.test(market) &&
    !/<Price value=\{thisListPrice\} \/>/.test(market),
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
