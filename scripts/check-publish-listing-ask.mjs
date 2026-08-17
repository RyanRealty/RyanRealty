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
checks.push({
  label: 'PriceCtaStrip H1 and drop gate through publishListingAsk / Drop + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(strip) &&
    /publishListingAsk\(/.test(strip) &&
    /publishListingDrop\(/.test(strip) &&
    strip.includes('<Price value={headlinePrice} exact />') &&
    strip.includes('<Price value={publishedDrop.drop} exact />'),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing JSON-LD offer uses listing.listPrice (exact ask)',
  ok: /listPrice: listing\.listPrice/.test(page),
})

const split = src('components/site/explore/PlaceMapListSplit.client.tsx')
checks.push({
  label: 'place list cards publish formatPublishedAsk, not formatPrice',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(split) &&
    /formatPublishedAsk\(row\.price\)/.test(split) &&
    !/formatPrice\(row\.price\)/.test(split),
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
