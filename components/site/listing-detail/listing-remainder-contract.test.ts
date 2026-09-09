import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')

describe('listing remainder composition', () => {
  it('states the 12-section house page on the route', () => {
    expect(PAGE).toMatch(/PAGE_INVENTORY listing \(house URL\), 12 rows/)
  })

  it('composes inventory order: media, ask, facts, payment, map, schools, parks, tax, CC&Rs, similar, broker', () => {
    const main = PAGE.slice(PAGE.indexOf('const main = ('), PAGE.indexOf('const floating ='))
    // SITE-21 put a SECOND ListingSimilarStrip mount high in the page for the
    // off-market composition, so the on-market rail is the last one, not the
    // first. lastIndexOf, deliberately: indexOf would now read the off-market
    // mount and call the on-market page reordered when it is not.
    const order = [
      '<PriceCtaStrip',
      '<PropertySpecs',
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
