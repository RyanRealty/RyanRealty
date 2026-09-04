import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')

describe('listing remainder composition', () => {
  it('states the thesis on the route', () => {
    expect(PAGE).toMatch(/One house, Redfin's section order, our data/)
  })

  it('composes Redfin order: about, payment, map, schools, parks, market, details, history', () => {
    expect(PAGE).toMatch(/ListingAskInstrument|V3Instrument/)
    expect(PAGE).toMatch(/id="location"/)
    expect(PAGE).toMatch(/SchoolsBlock/)
    expect(PAGE).toMatch(/ListingAroundHere/)
    expect(PAGE).toMatch(/DescriptionBlock/)
    expect(PAGE).toMatch(/MortgageCalculator/)
    expect(PAGE).toMatch(/PropertySpecs/)
    expect(PAGE).toMatch(/PropertyHistory/)
    expect(PAGE).toMatch(/ListingMoreDoors|V3Doors/)
    expect(PAGE).toMatch(/ListingSimilarStrip|V3ListingRow/)
    expect(PAGE).toMatch(/leftoverHudKpis/)
    expect(PAGE).toMatch(/publishListingSaleAsk/)
  })

  it('does not restack the KPI page or a second lot map or the poster grid', () => {
    expect(PAGE).not.toMatch(/<NeighborhoodMarketContext/)
    expect(PAGE).not.toMatch(/<LivePricingRead/)
    expect(PAGE).not.toMatch(/<ListingFeaturedHomes/)
    expect(PAGE).not.toMatch(/id="lot"/)
    expect(PAGE).not.toMatch(/Median to pending/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
  })

  it('uses the place trail and drops the extra tour card', () => {
    expect(PAGE).toMatch(/listingPlaceTrail/)
    expect(PAGE).toMatch(/listingAtlasHeadline/)
    expect(PAGE).toMatch(/buildListingPriceBandChart/)
    expect(PAGE).not.toMatch(/<ListingTourCard/)
    expect(PAGE).not.toMatch(/label: 'Home'/)
    expect(PAGE).not.toMatch(/label: 'Homes for sale'/)
  })
})
