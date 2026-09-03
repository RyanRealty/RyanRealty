import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8')

describe('listing remainder composition', () => {
  it('states the thesis on the route', () => {
    expect(PAGE).toMatch(/One house, one living map of its place, one instrument/)
  })

  it('composes one instrument, one living map, doors, and a listing-row strip', () => {
    expect(PAGE).toMatch(/ListingAskInstrument|V3Instrument/)
    expect(PAGE).toMatch(/id="location"/)
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
  })
})
