#!/usr/bin/env node
/**
 * Street-line publish lock.
 *
 * Visitor street lines withhold MLS house number 0. Keep the street name.
 * Founding case: /cities/bend/awbrey-butte printed 0 Moonshadow Court
 * (fleet 3545811a84a2445587694783602cebc1).
 *
 *   node scripts/check-publish-street-line.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-street-line.ts')
checks.push({
  label: 'publishStreetLine withholds placeholder 0',
  ok:
    /export function publishStreetNumber/.test(helper) &&
    /export function publishStreetLine/.test(helper) &&
    helper.includes('/^0+$/') &&
    /export function publishUnparsedStreetLine/.test(helper),
})

const nbh = src('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts')
checks.push({
  label: 'neighborhood field titles gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(nbh) &&
    /publishStreetLine\(/.test(nbh),
})

const city = src('app/cities/[slug]/_v3/city-field-items.ts')
checks.push({
  label: 'city field titles gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(city) &&
    /publishStreetLine\(/.test(city),
})

const card = src('lib/site/listing-card.ts')
checks.push({
  label: 'listing-card addressLine gates through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(card) &&
    /publishStreetLine\(/.test(card),
})

const looking = src('lib/crm/looking-at.ts')
checks.push({
  label: 'looking-at address gates through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(looking) &&
    /publishStreetLine\(/.test(looking),
})

const split = src('lib/explore/subdivision-page-extras.ts')
checks.push({
  label: 'place-page dual-pane titles gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(split) &&
    /publishStreetLine\(/.test(split) &&
    !split.includes('[t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join'),
})

const ticker = src('lib/kb/place-sections.ts')
checks.push({
  label: 'KB ticker / map / activity addresses gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(ticker) &&
    /publishStreetLine\(/.test(ticker) &&
    !ticker.includes('[t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join'),
})

const featured = src('lib/kb/resolve-featured-items.ts')
checks.push({
  label: 'KB featured addresses gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(featured) &&
    /publishStreetLine\(/.test(featured),
})

const slug = src('lib/slug.ts')
checks.push({
  label: 'listing URL segments withhold placeholder 0 via publishStreetNumber',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(slug) &&
    /publishStreetNumber\(/.test(slug) &&
    !slug.includes('[parts?.streetNumber, parts?.streetName].filter(Boolean).join'),
})

const teamLedger = src('app/team/[slug]/_v3/sale-rows.ts')
checks.push({
  label: 'team closing ledger addresses gate through publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(teamLedger) &&
    /publishStreetLine\(/.test(teamLedger),
})

const teamPage = src('app/team/[slug]/page.tsx')
checks.push({
  label: 'team page publishes every own closing (no 9-row card cap)',
  ok:
    /publishOwnClosingRows\(brokerSales\)/.test(teamPage) &&
    /getBrokerSales\(\{ email: broker\.email, mlsId: broker\.mls_id \}\)/.test(teamPage) &&
    !/getBrokerSales\([^)]*limit:/.test(teamPage) &&
    !teamPage.includes('.slice(0, 9)'),
})

const searchCards = src('components/search/SearchResults.tsx')
checks.push({
  label: 'search result cards withhold placeholder 0 via publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(searchCards) &&
    /publishStreetLine\(/.test(searchCards) &&
    !searchCards.includes('[listing.StreetNumber, listing.StreetName, listing.StreetSuffix].filter(Boolean).join'),
})

const mapCards = src('components/search/MapSearchView.tsx')
checks.push({
  label: 'map-search cards withhold placeholder 0 via publishStreetLine',
  ok:
    /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(mapCards) &&
    /publishStreetLine\(/.test(mapCards) &&
    !mapCards.includes('[l.StreetNumber, l.StreetName, l.StreetSuffix].filter(Boolean).join'),
})

/**
 * THE RULE FOLLOWS THE BUILDER (2026-08-26). The plat page used to assemble its
 * own map-pin properties, so this arm read the page. On the v3 barrel the rows
 * and the pins are ONE mapper — _v3/subdivision-rows.ts, deliberately, so a row
 * and its pin cannot disagree about the address they print — and the page hands
 * it tiles. The assertion follows: whichever of the two builds the address must
 * build it through publishStreetLine, and neither may hand-join the three parts,
 * which is what puts a placeholder 0 street number on a public page.
 */
const platMapFiles = [
  src('app/subdivisions/[slug]/page.tsx'),
  src('app/subdivisions/[slug]/_v3/subdivision-rows.ts'),
]
checks.push({
  label: 'plat map pin addresses withhold placeholder 0 via publishStreetLine',
  ok:
    platMapFiles.some(
      (text) =>
        /from ['"]@\/lib\/listing\/publish-street-line['"]/.test(text) &&
        /publishStreetLine\(/.test(text),
    ) &&
    platMapFiles.every(
      (text) => !text.includes('[t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join'),
    ),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-street-line: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-street-line: ${checks.length}/${checks.length}`)
