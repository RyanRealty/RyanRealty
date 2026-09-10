import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')
const HERO = readFileSync(resolve('components/site/listing-detail/ListingHero.tsx'), 'utf8')

describe('listing remainder composition', () => {
  it('does not start the listing hero on a 320 Spark thumb', () => {
    expect(HERO).toContain('preferListingMosaicPhotoUrl')
    expect(HERO).toMatch(/const live = preferListingMosaicPhotoUrl\(src\)/)
    expect(PAGE).toContain('LISTING_FIELD_LEAD_PHOTO_SIZE')
  })

  it('states the 13-section house page on the route', () => {
    // 12 became 13 on 2026-09-09 when the MLS public remarks came back as row 5
    // (Matt: "mls descriptions must come back"; CLAUDE.md §2). The count and the
    // comment move together, which is the whole point of pinning it here.
    expect(PAGE).toMatch(/PAGE_INVENTORY listing \(house URL\), 13 rows/)
    expect(PAGE).toMatch(/<DescriptionBlock publicRemarks=\{listing\.publicRemarks\} \/>/)
  })

  it('composes inventory order: media, ask, facts, about, payment, map, schools, parks, tax, CC&Rs, similar, broker', () => {
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    // SITE-21 put a SECOND ListingSimilarStrip mount high in the page for the
    // off-market composition, so the on-market rail is the last one, not the
    // first. lastIndexOf, deliberately: indexOf would now read the off-market
    // mount and call the on-market page reordered when it is not.
    const order = [
      '<PriceCtaStrip',
      '<PropertySpecs',
      '<DescriptionBlock',
      '<MortgageCalculator',
      '{atlasBlock}',
      '<SchoolsBlock',
      '<ListingAroundHere',
      '<ListingAskInstrument',
      '<ListingTaxHistory',
      '<GoverningDocumentsBlock',
    ]
    const positions = [
      ...order.map((token) => main.indexOf(token)),
      main.lastIndexOf('<ListingSimilarStrip'),
      main.indexOf('<ListingBrokerCTA'),
      main.indexOf('<ListingAttribution'),
    ]
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(PAGE).toMatch(/showEstPayment=\{false\}/)
  })

  it('composes the OFF-MARKET order: price, sold facts, homes for sale, saved search', () => {
    // SITE-21 / MASTER_SPEC §4.9. A home that is not for sale leads with what
    // happened to it, then the homes a reader can actually buy, then the ask
    // that replaces the tour. Everything after that is the house's own record.
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    const order = [
      '<PriceCtaStrip',
      '<ListingOffMarketFacts',
      '<ListingSimilarStrip',
      '<ListingLikeThisAlerts',
      '<PropertySpecs',
    ]
    const positions = order.map((token) => main.indexOf(token))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  /**
   * SITE-33 (Matt 2026-09-08). The out-of-area listing tier: the block renders,
   * the page still serves, robots is "noindex, follow" (never nofollow), and
   * both halves read the SAME predicate as the sitemap.
   */
  it('discloses the market on an out-of-area home, before it says anything else about it', () => {
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    const notice = main.indexOf('<ListingOutOfAreaNotice')
    expect(notice).toBeGreaterThan(-1)
    // Under the price strip and above every other claim the page makes.
    expect(notice).toBeGreaterThan(main.indexOf('<PriceCtaStrip'))
    for (const later of ['<ListingOffMarketFacts', '<PropertySpecs', '{atlasBlock}']) {
      expect(notice).toBeLessThan(main.indexOf(later))
    }
  })

  it('decides the block and the robots directive with one predicate', () => {
    expect(PAGE).toMatch(/import \{ outOfAreaListingPolicy \} from '@\/lib\/data\/listings\/service-area'/)
    // Once in generateMetadata, once in the render.
    expect(PAGE.match(/outOfAreaListingPolicy\(listing\.city\)/g)).toHaveLength(2)
    expect(PAGE).toMatch(/buildListingOutOfAreaNotice\(/)
  })

  it('leaves the index WITH follow preserved, and keeps the page serving', () => {
    expect(PAGE).toMatch(/noindex: outOfArea !== null/)
    // `nofollow` is a SEPARATE pageMetadata flag (SITE-25) and is not wanted:
    // the /oregon referral pages link IN to these pages, and these pages link
    // back out to the place, plat and city they sit in. Setting it would throw
    // both away. Matched as the property, so the word may still be explained
    // in a comment.
    expect(PAGE).not.toMatch(/nofollow\s*:/)
    // The policy never refuses the row — the page renders in full either way.
    expect(PAGE).not.toMatch(/outOfArea[\s\S]{0,80}<ListingUnavailable/)
    expect(PAGE).not.toMatch(/outOfArea[\s\S]{0,80}notFound\(\)/)
  })

  it('does not restack leftover HUD, CMA, rental, or a second lot map', () => {
    expect(PAGE).not.toMatch(/<NeighborhoodMarketContext/)
    expect(PAGE).not.toMatch(/<LivePricingRead/)
    expect(PAGE).not.toMatch(/<ListingFeaturedHomes/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
    // Ask claim uses ListingAskInstrument + leftoverHudKpis (ci:publish-listing-share).
    expect(PAGE).toMatch(/<ListingAskInstrument/)
    expect(PAGE).toMatch(/buildListingAskClaim/)
    expect(PAGE).toMatch(/leftoverHudKpis/)
    expect(PAGE).not.toMatch(/<PublishedCmaSection/)
    expect(PAGE).not.toMatch(/<RentalAnalysis/)
    expect(PAGE).not.toMatch(/id="lot"/)
  })

  it('carries the saved search on OFF-MARKET rows only, never as a second on-market ask', () => {
    // SITE-21. The alerts sheet was off this page because an on-market listing
    // already has one ask (Tour / Call / Text) and a second capture under it is
    // the stacked-ask tell. Off market there is no first ask, so this is it.
    expect(PAGE).toMatch(/<ListingLikeThisAlerts/)
    const mount = PAGE.slice(PAGE.indexOf('<ListingLikeThisAlerts') - 200, PAGE.indexOf('<ListingLikeThisAlerts'))
    expect(mount).toMatch(/\{offMarket \?/)
  })

  it('uses the place trail and Atlas for this lot', () => {
    expect(PAGE).toMatch(/listingPlaceTrail/)
    expect(PAGE).toMatch(/listingAtlasHeadline/)
    expect(PAGE).toMatch(/<V3Atlas/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
    expect(PAGE).not.toMatch(/label: 'Home'/)
    expect(PAGE).not.toMatch(/label: 'Homes for sale'/)
  })
})
