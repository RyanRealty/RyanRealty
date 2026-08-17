#!/usr/bin/env node
/**
 * Listing-detail history lock.
 *
 * Public listing timelines must merge listing_history with the live
 * status_history + price_history tables and OnMarketDate. Reading only
 * listing_history hides recent listings (empty until strict verify).
 * Founding cases: Borden 220225742, Rockway 220226183, Mountain Breezes 220226708.
 *
 *   node scripts/check-publish-listing-history.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-history.ts')
checks.push({
  label: 'publishListingHistory merges live status/price + listed OnMarketDate',
  ok:
    /export function publishListingHistory/.test(helper) &&
    helper.includes('statusHistory') &&
    helper.includes('priceHistory') &&
    helper.includes("event: 'listed'") &&
    helper.includes('onMarketDate'),
})

const dal = src('lib/data/listings/getListingDetailBundles.ts')
checks.push({
  label: 'getListingDetailHistory publishes the merge, not listing_history alone',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-history['"]/.test(dal) &&
    /publishListingHistory\(/.test(dal) &&
    dal.includes(".from('status_history')") &&
    dal.includes(".from('price_history')") &&
    dal.includes('OnMarketDate'),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail renders PropertyHistory from getListingDetailHistory',
  ok:
    /getListingDetailHistory/.test(page) &&
    /<PropertyHistory history=\{history\}/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-history: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-history: ${checks.length}/${checks.length}`)
