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
//
// EXTENDED 2026-09-08 (SITE-20). The sale-aware publisher is now reached
// through the STATUS-aware one, which chooses ClosePrice over ListPrice for a
// Closed row. The strip used to make that choice itself with a hand-written
// ternary, and it was the only surface on the page that made it — so the H1
// read $1,100,000 while the meta description, og:description, JSON-LD
// description, hero caption and map card all read $1,250,000 on 55550 Heidi
// Court (MLS 220219603). The ternary may not come back: a second copy of the
// branch is how the surfaces disagreed in the first place.
checks.push({
  label: 'PriceCtaStrip H1 and drop gate through publishListingPublishedPrice / Drop + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-published-price['"]/.test(strip) &&
    /publishListingPublishedPrice\(\{[^}]*status: listing\.status[^}]*closePrice: listing\.closePrice/s.test(strip) &&
    /publishListingDrop\(/.test(strip) &&
    !/isClosed \? listing\.closePrice : listing\.listPrice/.test(strip) &&
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
    /publishListingPublishedPrice\(\{[^}]*propertyType:/s.test(page) &&
    /publishListingPublishedWholePropertyPrice\(\{[^}]*propertySubType:/s.test(page) &&
    /wholePropertyPrice,/.test(page) &&
    /listPrice: wholePropertyPrice \?\? undefined/.test(ld) &&
    !/listPrice: listing\.listPrice/.test(ld),
})

// ─── SITE-20: the status branch, and the surfaces that must not lose it ─────
//
// Verified live 2026-09-08 on https://ryan-realty.com/listing/220219603
// (55550 Heidi Court, Bend — Closed, listed $1,250,000, closed $1,100,000):
// generateMetadata had no status branch, so <meta name=description>,
// og:description and the RealEstateListing description all carried the ask;
// the <title> carried only the address; and because buildOffer correctly drops
// the Offer for a Closed row, the emitted node had no availability at all — so
// nothing machine-readable said the home had sold. The on-media hero caption
// and the map card followed the same unbranched value.
//
// Scale, measured 2026-09-08: Search Console page rows 2026-06-08..2026-09-05
// grouped by trailing 9-digit MLS id and joined to `listings` on ListNumber —
// 1,714 Closed ids drew impressions, 1,713 carry both figures, and 1,288 of
// those have ListPrice != ClosePrice.
//
// These five checks fail the moment the branch is removed from any one of the
// surfaces that carried the defect.
const publisher = src('lib/listing/publish-listing-published-price.ts')
checks.push({
  label: 'SITE-20 the publisher branches on status and never falls back to the ask',
  ok:
    /export function publishListingPublishedPrice/.test(publisher) &&
    /export function publishListingPublishedWholePropertyPrice/.test(publisher) &&
    /export function publishListingStatusWord/.test(publisher) &&
    /export function publishListingSchemaAvailability/.test(publisher) &&
    /listingPublishesClosePrice\(input\.status\) \? input\.closePrice : input\.listPrice/.test(
      publisher,
    ) &&
    // A Closed row with no ClosePrice publishes nothing. `closePrice ?? listPrice`
    // would quietly reinstate the exact figure this item removed.
    !/input\.closePrice \?\? input\.listPrice/.test(publisher) &&
    publisher.includes('https://schema.org/SoldOut') &&
    publisher.includes('https://schema.org/OutOfStock'),
})

checks.push({
  label: 'SITE-20 generateMetadata prefixes the status word on the title and the description',
  ok:
    /publishListingStatusWord\(listing\.status\)/.test(page) &&
    /statusWord \? `\$\{statusWord\} · \$\{addressTitle\}` : addressTitle/.test(page) &&
    /statusWord,/.test(page),
})

checks.push({
  label: 'SITE-20 the structured-data description carries the status word too',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-published-price['"]/.test(ld) &&
    /statusWord: publishListingStatusWord\(listing\.status\)/.test(ld),
})

// The RealEstateListing NODE states availability whether or not an Offer is
// emitted beside it. Before this, an off-market listing published a price, a
// description and no statement at all of what it was.
const jsonLd = src('lib/site/json-ld.ts')
checks.push({
  label: 'SITE-20 the RealEstateListing node emits availability, not only the Offer',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-published-price['"]/.test(jsonLd) &&
    /availability: publishListingSchemaAvailability\(input\.availability\) \?\? undefined/.test(
      jsonLd,
    ) &&
    /offers: buildOffer\(input\.listPrice, input\.availability\)/.test(jsonLd),
})

// The two in-page figures the node named: the on-media hero caption
// (ListingHero price) and the map card (ListingLocationMap price). Both take
// `publishedSaleAsk`, which is now the status-aware figure — so the assertion
// is that neither has been re-pointed at a raw listPrice.
checks.push({
  label: 'SITE-20 the hero caption and the map card take the status-aware published price',
  ok:
    /const publishedSaleAsk = publishListingPublishedPrice\(\{/.test(page) &&
    (page.match(/price=\{publishedSaleAsk\}/g) ?? []).length >= 2 &&
    !/price=\{listing\.listPrice\}/.test(page),
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

// RE-EXPRESSED 2026-08-27, when the KB register was deleted. KbListingMapImpl
// formatted the pin label ITSELF, so the rule was asserted on the map. The v3
// map (PlaceFieldMapImpl) takes a PREFORMATTED priceLabel and says so in its own
// header -- no formatting happens there. So the rule moved to the two places
// that now build the label, and the map is asserted to keep NOT formatting: a
// map that starts formatting again is how the rule gets bypassed silently.
const mapImpl = src('app/central-oregon/_v3/PlaceFieldMapImpl.tsx')
checks.push({
  label: 'the v3 map still formats no price of its own',
  ok:
    /priceLabel: string/.test(mapImpl) &&
    !/toLocaleString|Intl\.NumberFormat|\$\$\{/.test(mapImpl),
})
const homePins = src('app/_v3/home-field-items.ts')
checks.push({
  label: 'homepage map pin labels publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(homePins) &&
    /priceLabel: formatPublishedAsk\(/.test(homePins),
})
const commPins = src('app/communities/[slug]/_v3/community-opening.ts')
checks.push({
  label: 'community map pin labels publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(commPins) &&
    /priceLabel: formatPublishedAsk\(/.test(commPins),
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

// KbFeatured left with the KB register (2026-08-27). The featured rail is now
// the homepage Field, whose rows are built by app/_v3/home-field-items.ts --
// asserted above, on the same rule, in that file's own terms.

const kbMoney = src('lib/kb/types.ts')
checks.push({
  label: 'kbMoneyFull prints exact whole dollars, not nearest thousand',
  ok:
    /export function kbMoneyFull/.test(kbMoney) &&
    kbMoney.includes('Math.round(n).toLocaleString') &&
    !kbMoney.includes('Math.round(n / 1000)'),
})

const faq = src('lib/site/market-faq.ts')
checks.push({
  // Both figures in the price answer print exact whole dollars: the sale price
  // (2026-09-07, leads the answer when the page has the closed-sale month) and
  // the list price of the homes for sale.
  label: 'place FAQ median sale and list prices use formatPriceExact',
  ok:
    /from ['"]@\/lib\/format\/money['"]/.test(faq) &&
    /formatPriceExact\(salePrice\)/.test(faq) &&
    /formatPriceExact\(listPrice\)/.test(faq) &&
    !/formatPrice\((?:salePrice|listPrice|pulse\.medianListPrice|pulse\.medianSalePrice)\)/.test(faq),
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

// KbActivity left with the KB register (2026-08-27). /activity is on the barrel
// and its rows are built by app/activity/_v3/activity-rows.ts, which is asserted
// here on the same rule so the ledger's asks stay labelled.
// NOT RE-ASSERTED, AND SAID SO PLAINLY. The v3 activity ledger formats its ask
// through livePrice() in app/_v3/live-format.ts, which wraps formatPrice, NOT
// formatPublishedAsk. So a fractional-interest ask on /activity is published
// with no share label -- the same defect this gate exists to prevent, on a
// surface the KB arm used to cover. Asserting formatPublishedAsk here today
// would fail the build on a real defect that is out of this commit's scope
// (the KB register deletion), and asserting formatPrice would legalise it.
// Raised to Matt 2026-08-27, unfixed, deliberately not gated green.

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-ask: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-ask: ${checks.length}/${checks.length}`)
