#!/usr/bin/env node
/**
 * Share / interval ownership on listing hero + price strip.
 *
 * Founding cases:
 *   2390 Snowgoose (220215519) $5K / $4/sqft, Tenancy in Common
 *     fleet:ae66a0f065d3affe2713352b2f71e1b5
 *   2250 Snowgoose (220188968) $3K / $3/sqft, Tenancy in Common
 *     fleet:41fed0ac49bcf207696a8c1990faf07f
 *
 *   node scripts/check-publish-listing-share.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-share.ts')
checks.push({
  label: 'publishListingShareKind / PricePerSqft carry founding fingerprints',
  ok:
    /export function publishListingShareKind/.test(helper) &&
    /export function publishListingSharePricePerSqft/.test(helper) &&
    helper.includes('ae66a0f065d3affe2713352b2f71e1b5') &&
    helper.includes('220215519') &&
    helper.includes('220188968') &&
    helper.includes('Tenancy in Common') &&
    helper.includes('Timeshare') &&
    helper.includes('Do not invent') &&
    // The sub-type list moved into the figure contract 2026-08-19 (one rule,
    // executed by ci:listing-figure-publish); this module must ask it rather
    // than keep a second copy that can drift.
    /listingPriceIsFractionalShare/.test(helper),
})

const hero = src('components/site/listing-detail/ListingHero.tsx')
checks.push({
  label: 'ListingHero publishes share kind next to the ask',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-share['"]/.test(hero) &&
    /publishListingShareKind\(propertySubType\)/.test(hero) &&
    /\{shareKind\}/.test(hero),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail passes propertySubType into the hero',
  ok: /propertySubType=\{listing\.propertySubType\}/.test(page),
})

const strip = src('components/site/listing-detail/PriceCtaStrip.tsx')
checks.push({
  label: 'PriceCtaStrip withholds share ppsf and prints the kind',
  ok:
    /publishListingShareKind\(listing\.propertySubType\)/.test(strip) &&
    /publishListingSharePricePerSqft\(/.test(strip) &&
    /\{shareKind\}/.test(strip) &&
    /publishedPpsf/.test(strip),
})

const block = src('components/site/listing-detail/PriceBlock.tsx')
checks.push({
  label: 'PriceBlock withholds share ppsf',
  ok: /publishListingSharePricePerSqft\(/.test(block),
})

const specs = src('components/site/listing-detail/PropertySpecs.tsx')
checks.push({
  label: 'PropertySpecs withholds share ppsf',
  ok: /publishListingSharePricePerSqft\(/.test(specs),
})

const card = src('components/site/ListingCard.tsx')
// The publisher took (propertySubType, pricePerSqft) positionally until
// 2026-08-19, when propertyType became a REQUIRED third field: on MLS
// PropertyType 'G' (Commercial Lease) the price is rent, so a derived $/sq ft is
// a lease rate wearing a sale label. The card must now hand over BOTH fields.
checks.push({
  label: 'ListingCard withholds share ppsf when the tile carries a subtype or a lease type',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-share['"]/.test(card) &&
    /publishListingSharePricePerSqft\(\{[^}]*propertySubType:\s*listing\.propertySubType/s.test(card) &&
    /publishListingSharePricePerSqft\(\{[^}]*propertyType:\s*listing\.propertyType/s.test(card),
})

const houseme = src('components/site/listing-detail/HouseMeReport.tsx')
checks.push({
  label: 'HouseMeReport withholds share ppsf',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-share['"]/.test(houseme) &&
    /publishListingSharePricePerSqft\(/.test(houseme),
})

const live = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail passes propertySubType into LivePricingRead',
  ok: /propertySubType=\{listing\.propertySubType\}/.test(live),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-share: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-share: ${checks.length}/${checks.length}`)
