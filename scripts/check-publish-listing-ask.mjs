#!/usr/bin/env node
/**
 * Listing ask publish lock.
 *
 * Hero H1, drop line, and JSON-LD must share the exact ListPrice.
 * Founding cases: 3366 7th ($424,990 vs $425,000) and 895 Hudspeth
 * ($629,500 vs $630,000 / $16,000 drop).
 *
 *   node scripts/check-publish-listing-ask.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-ask.ts')
checks.push({
  label: 'publishListingAsk and publishListingDrop keep exact whole dollars',
  ok:
    /export function publishListingAsk/.test(helper) &&
    /export function publishListingDrop/.test(helper) &&
    helper.includes('original - ask') &&
    !helper.includes('Math.round(n / 1000)'),
})

const strip = src('components/site/listing-detail/PriceCtaStrip.tsx')
// The H1 moved from publishListingAsk(number) to publishListingSaleAsk({price,
// propertyType}) on 2026-08-19: MLS PropertyType 'G' is a Commercial Lease, so
// its ListPrice is rent and there is no sale ask to print. 735 Purcell (MLS
// 220174840) published an H1 of "$3" off a $2.50/sq ft lease rate. The strip
// must use the SALE-aware publisher, not the bare one.
checks.push({
  label: 'PriceCtaStrip H1 and drop gate through publishListingSaleAsk / Drop + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(strip) &&
    /publishListingSaleAsk\(\{[^}]*propertyType:/s.test(strip) &&
    /publishListingDrop\(/.test(strip) &&
    strip.includes('<Price value={headlinePrice} exact />') &&
    strip.includes('<Price value={publishedDrop.drop} exact />'),
})

// The JSON-LD moved into a sibling builder when the page hit its file-size
// budget. The offer must carry an exact, already-published figure — withheld
// when there is none — never a raw ListPrice that may be a lease rate.
//
// Narrowed 2026-08-19 from the page's sale ask to its WHOLE-PROPERTY price. The
// visible ask is printed beside a "Tenancy in common" badge; a machine node has
// no badge, and MLS 220190868 (a $1 fractional interest at Eagle Crest) shipped
// offers.price 1 on a SingleFamilyResidence.
const page = src('app/listing/[listingKey]/page.tsx')
const ld = src('app/listing/[listingKey]/listing-json-ld.ts')
checks.push({
  label: 'listing JSON-LD offer uses the published whole-property price (exact, or withheld)',
  ok:
    /publishListingSaleAsk\(\{[^}]*propertyType:/s.test(page) &&
    /publishWholePropertyAmount\(\{[^}]*propertySubType:/s.test(page) &&
    /wholePropertyPrice,/.test(page) &&
    /listPrice: wholePropertyPrice \?\? undefined/.test(ld) &&
    !/listPrice: listing\.listPrice/.test(ld),
})

// PlaceMapListSplit left with the KB register (2026-08-26). The place-page
// list rows are the v3 Field builders now, and each is armed below
// (neighborhood-sections, city-field-items, community-opening).
const commField = src('app/communities/[slug]/_v3/community-opening.ts')
checks.push({
  label: 'community list priceLabel uses formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(commField) &&
    /formatPublishedAsk\(tile\.listPrice\)/.test(commField),
})

const map = src('components/site/kb/KbListingMapImpl.tsx')
checks.push({
  label: 'place map pins publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(map) &&
    /formatPublishedAsk\(n\)/.test(map),
})

const nbh = src('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts')
checks.push({
  label: 'neighborhood list priceLabel uses formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(nbh) &&
    /formatPublishedAsk\(t\.listPrice\)/.test(nbh),
})

const cityField = src('app/cities/[slug]/_v3/city-field-items.ts')
checks.push({
  label: 'city field rows publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(cityField) &&
    /formatPublishedAsk\(tile\.listPrice\)/.test(cityField),
})

const communityField = src('app/communities/[slug]/_v3/community-opening.ts')
checks.push({
  label: 'community field rows publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(communityField) &&
    /formatPublishedAsk\(tile\.listPrice\)/.test(communityField),
})

const platField = src('app/subdivisions/[slug]/_v3/subdivision-rows.ts')
checks.push({
  label: 'plat field rows publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(platField) &&
    /formatPublishedAsk\(tile\.listPrice\)/.test(platField),
})

const featured = src('components/site/kb/KbFeatured.client.tsx')
checks.push({
  label: 'featured rail publishes formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(featured) &&
    /formatPublishedAsk\(it\.price\)/.test(featured) &&
    !/kbMoneyFull\(it\.price\)/.test(featured),
})

const kbMoney = src('components/site/kb/types.ts')
checks.push({
  label: 'kbMoneyFull prints exact whole dollars, not nearest thousand',
  ok:
    /export function kbMoneyFull/.test(kbMoney) &&
    kbMoney.includes('Math.round(n).toLocaleString') &&
    !kbMoney.includes('Math.round(n / 1000)'),
})

const faq = src('lib/site/market-faq.ts')
checks.push({
  label: 'place FAQ median list uses formatPriceExact',
  ok:
    /from ['"]@\/lib\/format\/money['"]/.test(faq) &&
    /formatPriceExact\(pulse\.medianListPrice\)/.test(faq) &&
    !/formatPrice\(pulse\.medianListPrice\)/.test(faq),
})

// The card moved from formatPublishedAsk(number) to the SALE-aware publisher on
// 2026-08-19: MLS PropertyType 'G' is a Commercial Lease, so its ListPrice is
// rent per square foot, and /homes-for-sale?city=Redmond&maxPrice=10000 rendered
// seven lease cards at "$1" and "$2" beside homes for sale.
const listingCard = src('components/site/ListingCard.tsx')
checks.push({
  label: 'search/site ListingCard publishes formatPublishedSaleAsk, not formatPrice',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(listingCard) &&
    /formatPublishedSaleAsk\(\{[^}]*propertyType: listing\.propertyType/s.test(listingCard) &&
    !/formatPrice\(listing\.price\)/.test(listingCard) &&
    !/formatPublishedAsk\(listing\.price\)/.test(listingCard),
})

const videoCard = src('components/site/VideoListingCard.tsx')
checks.push({
  label: 'VideoListingCard publishes formatPublishedSaleAsk, not formatPrice',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(videoCard) &&
    /formatPublishedSaleAsk\(\{[^}]*propertyType: listing\.propertyType/s.test(videoCard) &&
    !/formatPrice\(listing\.price\)/.test(videoCard) &&
    !/formatPublishedAsk\(listing\.price\)/.test(videoCard),
})

const activity = src('components/site/kb/KbActivity.client.tsx')
checks.push({
  label: 'activity ledger publishes formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(activity) &&
    /formatPublishedAsk\(it\.price\)/.test(activity) &&
    !/kbMoneyFull\(it\.price\)/.test(activity),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-ask: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-ask: ${checks.length}/${checks.length}`)
