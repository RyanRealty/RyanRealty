#!/usr/bin/env node
/**
 * Listing contact-key publish lock.
 *
 * Public contact hrefs use ListNumber. /contact?listingKey= resolves
 * ListingKey or ListNumber. Founding case: Hilmer Creek 220222626
 * (fleet 1400f2fa89d1a2082646e324d4b8d8ba).
 *
 *   node scripts/check-publish-listing-contact-key.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-contact-key.ts')
checks.push({
  label: 'publishListingContactKey prefers ListNumber',
  ok:
    /export function publishListingContactKey/.test(helper) &&
    helper.includes('input.listNumber') &&
    /export function listingContactHref/.test(helper),
})

const strip = src('components/site/listing-detail/PriceCtaStrip.tsx')
checks.push({
  label: 'PriceCtaStrip tour/ask hrefs use publishListingContactKey',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-contact-key['"]/.test(strip) &&
    /publishListingContactKey\(/.test(strip) &&
    /listingContactHref\(/.test(strip),
})

const page = src('app/listing/[listingKey]/page.tsx')
checks.push({
  label: 'listing page broker/footer share publishListingContactKey',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-contact-key['"]/.test(page) &&
    /publishListingContactKey\(/.test(page) &&
    /listingKey=\{contactKey\}/.test(page),
})

const contact = src('app/contact/page.tsx')
checks.push({
  label: 'contact page resolves listingKeys and listNumbers',
  ok:
    /listingKeys: \[key\]/.test(contact) &&
    /listNumbers: \[key\]/.test(contact),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-contact-key: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-contact-key: ${checks.length}/${checks.length}`)
