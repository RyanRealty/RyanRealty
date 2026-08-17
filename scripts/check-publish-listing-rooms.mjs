#!/usr/bin/env node
/**
 * Listing rooms publish lock.
 *
 * Hero, Facts, and JSON-LD must share publishListingRooms. Founding case:
 * 7800 Rogue River 23 bd / 22 ba / 1,000 sqft. Keep living area. Withhold
 * the lodge-count pair.
 *
 *   node scripts/check-publish-listing-rooms.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-rooms.ts')
checks.push({
  label: 'publishListingRooms withholds dense lodge-count pairs',
  ok:
    /export function publishListingRooms/.test(helper) &&
    helper.includes('DENSE_ROOM_FLOOR') &&
    helper.includes('MIN_SQFT_PER_BED') &&
    helper.includes('MIN_SQFT_PER_BATH'),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing hero and JSON-LD gate rooms through publishListingRooms',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-rooms['"]/.test(page) &&
    /publishListingRooms\(/.test(page) &&
    /beds=\{publishedRooms\.beds\}/.test(page) &&
    /beds: publishedRooms\.beds/.test(page),
})

const facts = src('components/site/listing-detail/PropertySpecs.tsx')
checks.push({
  label: 'PropertySpecs overview gates rooms through publishListingRooms',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-rooms['"]/.test(facts) &&
    /publishListingRooms\(/.test(facts) &&
    /rooms\.beds/.test(facts),
})

const card = src('components/site/ListingCard.tsx')
checks.push({
  label: 'ListingCard meta gates rooms through publishListingRooms',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-rooms['"]/.test(card) &&
    /publishListingRooms\(/.test(card),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-rooms: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-rooms: ${checks.length}/${checks.length}`)
