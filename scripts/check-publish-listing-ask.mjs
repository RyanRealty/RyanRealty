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

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-ask: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-ask: ${checks.length}/${checks.length}`)
