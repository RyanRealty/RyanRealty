#!/usr/bin/env node
/**
 * Listing-detail history lock.
 *
 * Public listing timelines must merge listing_history with the live
 * status_history + price_history tables and OnMarketDate. Reading only
 * listing_history hides recent listings (empty until strict verify).
 * Founding cases: Borden 220225742, Rockway 220226183, Mountain Breezes 220226708.
 * Description lock: 65255 Swalley 220207865 fleet:7e278bfeb28c9806649154eeb32c5567.
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

checks.push({
  label: 'publishListingHistoryDescription withholds raw ListPrice dumps',
  ok:
    /export function publishListingHistoryDescription/.test(helper) &&
    /export function publishListingHistoryDeltaLabel/.test(helper) &&
    helper.includes('7e278bfeb28c9806649154eeb32c5567') &&
    helper.includes('ListPrice:') &&
    helper.includes('220207865') &&
    helper.includes('publishListingHistoryDescription(row.description)'),
})

const dal = src('lib/data/listings/getListingDetailBundles.ts')
checks.push({
  label: 'getListingDetailHistory publishes the merge, not listing_history alone',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-history['"]/.test(dal) &&
    /publishListingHistory\(/.test(dal) &&
    dal.includes(".from('status_history')") &&
    dal.includes(".from('price_history')") &&
    dal.includes('OnMarketDate') &&
    /export function seedListingDetailHistory/.test(dal),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing detail renders PropertyHistory from getListingDetailHistory',
  ok:
    /readListingDetailHistory/.test(page) &&
    /<PropertyHistory history=\{history\}/.test(page),
})

const reader = src('lib/listing/read-listing-detail-history.ts')
checks.push({
  label: 'listing history timeout falls back to OnMarketDate seed, not empty',
  ok:
    /seedListingDetailHistory/.test(reader) &&
    /getListingDetailHistory/.test(reader) &&
    /HISTORY_TIMEOUT_MS/.test(reader) &&
    /seedListingDetailHistory\(listingKey, seed\)/.test(reader),
})

// The app/actions/listing-detail pipeline (getListingDetailData +
// map-published-history-event) was a zero-caller duplicate deleted 2026-09-01.
// The LIVE page reads lib/listing/read-listing-detail-history, whose
// listed/pending discipline lives in publish-listing-history — pinned here.
const liveReader = src('lib/listing/read-listing-detail-history.ts')
checks.push({
  label: 'live listing page publishes history through read-listing-detail-history',
  ok:
    /publishListingHistory/.test(liveReader) &&
    /pending/.test(helper) &&
    /listed/i.test(helper),
})

const historyUi = src('components/site/listing-detail/PropertyHistory.tsx')
checks.push({
  label: 'PropertyHistory publishes description + dollar delta labels',
  ok:
    /publishListingHistoryDescription/.test(historyUi) &&
    /publishListingHistoryDeltaLabel/.test(historyUi) &&
    /publishedDescription/.test(historyUi) &&
    !/<TabularNumber value=\{dropAmount\}/.test(historyUi),
})

const note = src('lib/expired-listing-note.ts')
checks.push({
  label: 'expired-listing note withholds raw history dumps on the CRM plane',
  ok: /publishListingHistoryDescription\(row\.description\)/.test(note),
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
