#!/usr/bin/env node
/**
 * Listing rooms publish lock.
 *
 * Hero and facts must share publishListingRooms. 23 bd / 22 ba on 1,000 sqft
 * (7800 Rogue River) withholds. Ordinary 3/2 and 4/3 keep.
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
  label: 'publishListingRooms withholds dense 8-plus room counts',
  ok:
    /export function publishListingRooms/.test(helper) &&
    helper.includes('count >= 8') &&
    helper.includes('livingSqft / count') &&
    helper.includes('100') &&
    helper.includes('80'),
})

const facts = src('components/site/listing-detail/PropertySpecs.tsx')
checks.push({
  label: 'PropertySpecs overview rooms gate through publishListingRooms',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-rooms['"]/.test(facts) &&
    /publishListingRooms\(/.test(facts) &&
    /rooms\.beds/.test(facts) &&
    /rooms\.baths/.test(facts),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing hero and JSON-LD rooms gate through publishListingRooms',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-rooms['"]/.test(page) &&
    /publishListingRooms\(/.test(page) &&
    /beds=\{rooms\.beds\}/.test(page) &&
    /baths=\{rooms\.baths\}/.test(page),
})

const card = src('components/site/ListingCard.tsx')
checks.push({
  label: 'ListingCard meta rooms gate through publishListingRooms',
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
