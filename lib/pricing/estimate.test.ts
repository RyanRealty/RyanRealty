import { describe, expect, it } from 'vitest'
import {
  adjustCompAlongMarket,
  predictedCloseFromAdjusted,
  reconcileAskAndComps,
  trimPpsfOutliers,
} from '@/lib/pricing/estimate'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import type { CmaSubject } from '@/lib/cma/types'

const subject = {
  listingKey: 'S',
  mlsNumber: null,
  streetAddress: '1 Test',
  city: 'Bend',
  state: 'OR',
  postalCode: null,
  subdivision: 'Kenwood',
  latitude: 44.06,
  longitude: -121.32,
  beds: 3,
  baths: 2,
  sqft: 2000,
  lotAcres: 0.2,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Closed',
  lastListPrice: 700000,
  lastListDate: null,
  listingHistoryLine: null,
} as CmaSubject

function sale(over: Partial<SelectedPricingComp> = {}): SelectedPricingComp {
  return {
    listingKey: 'C1',
    listNumber: null,
    address: '9 Comp',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 500_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2021-01-15',
    originalAsk: 490_000,
    lastAsk: 500_000,
    daysToOffer: 7,
    cdom: 10,
    dropCount: 0,
    closePpsf: 250,
    photoUrl: null,
    publicRemarks: null,
    selectionTier: 'subdivision-3mo',
    proximity: '0.10 miles',
    monthsBeforeAsOf: 4,
    ...over,
  }
}

describe('adjustCompAlongMarket', () => {
  it('lifts a sale that closed in a +3%/month run up to the as-of month', () => {
    const points = [
      { month: '2021-01-01', ppsf: 300, n: 40 },
      { month: '2021-02-01', ppsf: 309, n: 40 },
      { month: '2021-03-01', ppsf: 318, n: 40 },
      { month: '2021-04-01', ppsf: 328, n: 40 },
      { month: '2021-05-01', ppsf: 338, n: 40 },
    ]
    const { adjusted, path } = adjustCompAlongMarket({
      subject,
      subjectStory: 'one',
      sale: sale(),
      saleStory: 'one',
      points,
      asOf: '2021-05-15',
    })
    expect(path.regime).toBe('rising')
    expect(adjusted.timeAdjustedPrice).toBeGreaterThan(550_000)
    expect(adjusted.timeAdjustment).toBeGreaterThan(50_000)
  })

  it('leaves a flat-market sale near its close price', () => {
    const points = [
      { month: '2023-01-01', ppsf: 350, n: 40 },
      { month: '2023-06-01', ppsf: 350, n: 40 },
    ]
    const { adjusted, path } = adjustCompAlongMarket({
      subject,
      subjectStory: 'one',
      sale: sale({ closeDate: '2023-01-15', closePrice: 600_000 }),
      saleStory: 'one',
      points,
      asOf: '2023-06-15',
    })
    expect(path.regime).toBe('flat')
    expect(adjusted.timeAdjustedPrice).toBeGreaterThan(590_000)
    expect(adjusted.timeAdjustedPrice).toBeLessThan(610_000)
  })
})

describe('predictedCloseFromAdjusted', () => {
  it('uses median time-adjusted $/sqft times subject GLA', () => {
    const predicted = predictedCloseFromAdjusted(2000, [
      { ppsfTimeAdjusted: 350 },
      { ppsfTimeAdjusted: 360 },
      { ppsfTimeAdjusted: 370 },
    ])
    expect(predicted).toBe(720_000)
  })

  it('drops a 12%+ $/sqft outlier before the median', () => {
    const rows = [
      { ppsfTimeAdjusted: 350, id: 'a' },
      { ppsfTimeAdjusted: 355, id: 'b' },
      { ppsfTimeAdjusted: 360, id: 'c' },
      { ppsfTimeAdjusted: 500, id: 'out' },
    ]
    expect(trimPpsfOutliers(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(predictedCloseFromAdjusted(2000, rows)).toBe(710_000)
  })

  it('refuses a sell price on one or two sales', () => {
    expect(predictedCloseFromAdjusted(2000, [{ ppsfTimeAdjusted: 466 }])).toBeNull()
    expect(
      predictedCloseFromAdjusted(2000, [{ ppsfTimeAdjusted: 350 }, { ppsfTimeAdjusted: 360 }]),
    ).toBeNull()
  })
})

describe('reconcileAskAndComps', () => {
  it('uses last ask times 0.98 when the home is listed, even if the set sold over ask', () => {
    const out = reconcileAskAndComps({
      compClose: 700_000,
      lastAsk: 1_200_000,
      medianSaleToAsk: 1.1818,
    })
    expect(out.source).toBe('ask')
    expect(out.close).toBe(1_176_000)
  })

  it('uses last ask times 0.98 when the ask agrees with the comps', () => {
    const out = reconcileAskAndComps({ compClose: 700_000, lastAsk: 710_000, medianSaleToAsk: 0.99 })
    expect(out.source).toBe('ask')
    expect(out.close).toBe(696_000)
  })

  it('keeps the ask even when a tight set disagrees — comps do not override a listed ask', () => {
    const out = reconcileAskAndComps({
      compClose: 500_000,
      lastAsk: 800_000,
      medianSaleToAsk: 0.98,
      qualitySet: true,
    })
    expect(out.source).toBe('ask')
    expect(out.close).toBe(784_000)
    expect(out.offMarketAsk).toBe(true)
  })

  it('keeps the ask when the ladder is wide and the comps disagree', () => {
    const out = reconcileAskAndComps({
      compClose: 631_000,
      lastAsk: 320_000,
      medianSaleToAsk: 0.98,
      qualitySet: false,
    })
    expect(out.source).toBe('ask')
    expect(out.close).toBe(314_000)
    expect(out.offMarketAsk).toBe(false)
  })
})
