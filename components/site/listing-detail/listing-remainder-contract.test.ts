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
      '<ListingSimilarStrip',
      '<ListingBrokerCTA',
      '<ListingAttribution',
    ]
    const positions = order.map((token) => main.indexOf(token))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(PAGE).toMatch(/showEstPayment=\{false\}/)
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
    expect(PAGE).not.toMatch(/<ListingLikeThisAlerts/)
    expect(PAGE).not.toMatch(/id="lot"/)
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
