import { describe, expect, it } from 'vitest'
import { computePricing } from '@/lib/cma/pricing'
import {
  adjustCompAlongMarket,
  applyEngineRecommendedList,
  currentListAsk,
  estimateClosePrice,
  listPriceFromEngine,
  predictedCloseFromAdjusted,
  priceCmaSet,
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

describe('estimateClosePrice n<3', () => {
  const points = [
    { month: '2025-12-01', ppsf: 350, n: 40 },
    { month: '2026-01-01', ppsf: 350, n: 40 },
  ]

  it('refuses comps-implied numbers on an unlisted subject with two sales', () => {
    const out = estimateClosePrice({
      subject: { ...subject, lastListPrice: null },
      subjectStory: 'one',
      comps: [sale(), sale({ listingKey: 'C2' })],
      compStories: ['one', 'one'],
      points,
      asOf: '2026-01-15',
      market: null,
    })
    expect(out.predictedClose).toBeNull()
    expect(out.recommendedList).toBeNull()
    expect(out.pricing).toBeNull()
  })

  it('keeps the ask haircut on a listed subject with two sales', () => {
    const out = estimateClosePrice({
      subject: { ...subject, standardStatus: 'Active' },
      subjectStory: 'one',
      comps: [sale(), sale({ listingKey: 'C2' })],
      compStories: ['one', 'one'],
      points,
      asOf: '2026-01-15',
      market: null,
    })
    expect(out.predictedClose).toBe(686_000)
    expect(out.compsImpliedClose).toBeNull()
    expect(out.pricing).toBeNull()
  })

  it('ignores a closed last ask and prices from the sales', () => {
    const out = estimateClosePrice({
      subject: { ...subject, standardStatus: 'Closed', lastListPrice: 429_000, sqft: 2000 },
      subjectStory: 'one',
      comps: [
        sale({ sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
        sale({ listingKey: 'C2', sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
        sale({ listingKey: 'C3', sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
      ],
      compStories: ['one', 'one', 'one'],
      points,
      asOf: '2026-01-15',
      market: null,
    })
    expect(out.predictedClose).toBe(out.compsImpliedClose)
    expect(out.predictedClose).not.toBe(420_000)
    expect(out.compsImpliedClose).toBeGreaterThan(0)
  })
})

describe('estimateClosePrice compsImpliedClose', () => {
  it('keeps the comps-implied close separate from the ask haircut', () => {
    const out = estimateClosePrice({
      subject: { ...subject, standardStatus: 'Active' },
      subjectStory: 'one',
      comps: [
        sale({ sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
        sale({ listingKey: 'C2', sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
        sale({ listingKey: 'C3', sqft: 2000, closePrice: 700_000, closeDate: '2025-12-01' }),
      ],
      compStories: ['one', 'one', 'one'],
      points: [
        { month: '2025-12-01', ppsf: 350, n: 40 },
        { month: '2026-01-01', ppsf: 350, n: 40 },
      ],
      asOf: '2026-01-15',
      market: null,
    })
    expect(out.predictedClose).toBe(686_000)
    expect(out.compsImpliedClose).toBeGreaterThan(0)
    expect(out.compsImpliedClose).not.toBe(out.predictedClose)
  })
})

describe('currentListAsk', () => {
  it('returns the ask only while the home is on the market', () => {
    expect(currentListAsk({ lastListPrice: 429_000, standardStatus: 'Closed' })).toBeNull()
    expect(currentListAsk({ lastListPrice: 429_000, standardStatus: 'Expired' })).toBeNull()
    expect(currentListAsk({ lastListPrice: 438_000, standardStatus: 'Active' })).toBe(438_000)
    expect(currentListAsk({ lastListPrice: 438_000, standardStatus: 'Pending' })).toBe(438_000)
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

describe('listPriceFromEngine is the only cover number', () => {
  const points = [
    { month: '2025-12-01', ppsf: 290, n: 40, saleToOriginal: 0.98 },
    { month: '2026-01-01', ppsf: 290, n: 40, saleToOriginal: 0.98 },
  ]
  const comps = [
    sale({ sqft: 1600, closePrice: 430_000, originalAsk: 440_000, closeDate: '2025-12-01' }),
    sale({ listingKey: 'C2', sqft: 1600, closePrice: 440_000, originalAsk: 450_000, closeDate: '2025-12-01' }),
    sale({ listingKey: 'C3', sqft: 1600, closePrice: 450_000, originalAsk: 460_000, closeDate: '2025-12-01' }),
  ]

  it('does not use Method 3 as the list price when a last ask exists', () => {
    const out = estimateClosePrice({
      subject: { ...subject, standardStatus: 'Active', sqft: 1602, lastListPrice: 505_100 },
      subjectStory: 'one',
      comps,
      compStories: ['one', 'one', 'one'],
      points,
      asOf: '2026-01-15',
      market: null,
    })
    expect(out.pricing).not.toBeNull()
    expect(out.recommendedList).toBe(505_000)
    expect(out.pricing!.recommended).not.toBe(out.recommendedList)
    expect(out.pricing!.method3).not.toBe(out.recommendedList)
  })

  it('writes the engine list onto the CMA cover and leaves a broker override alone', () => {
    const out = estimateClosePrice({
      subject: { ...subject, standardStatus: 'Active', sqft: 1602, lastListPrice: 505_100 },
      subjectStory: 'one',
      comps,
      compStories: ['one', 'one', 'one'],
      points,
      asOf: '2026-01-15',
      market: null,
    })
    const engine = listPriceFromEngine({
      subjectSqft: 1602,
      lastAsk: 505_100,
      adjusted: out.pricing
        ? [
            { ppsfTimeAdjusted: 270 },
            { ppsfTimeAdjusted: 275 },
            { ppsfTimeAdjusted: 280 },
          ]
        : [],
      saleToAskRatios: comps.map((c) => c.closePrice / c.originalAsk!),
      asOfSaleToOriginal: 0.98,
      qualitySet: true,
      methodFallback: out.pricing!.method3,
    })
    expect(engine.recommendedList).toBe(505_000)

    const cover = applyEngineRecommendedList(out.pricing!, engine, { priceOverride: null })
    expect(cover.recommended).toBe(505_000)
    expect(cover.predictedClose).toBe(495_000)
    expect(cover.notes[0]).toMatch(/pricing engine/i)
    expect(cover.method3).toBe(out.pricing!.method3)

    const overridden = computePricing(
      { ...subject, sqft: 1602, lastListPrice: 505_100 },
      out.pricing
        ? [
            sale({ listingKey: 'A', sqft: 1600, closePrice: 430_000, originalAsk: 440_000 }),
            sale({ listingKey: 'B', sqft: 1600, closePrice: 440_000, originalAsk: 450_000 }),
            sale({ listingKey: 'C', sqft: 1600, closePrice: 450_000, originalAsk: 460_000 }),
          ].map((c) => ({
            ...c,
            monthsSinceClose: 1,
            timeAdjustment: 0,
            timeAdjustedPrice: c.closePrice,
            ppsfTimeAdjusted: c.closePrice / c.sqft,
            sizeAdjustment: 0,
            adjustedPrice: c.closePrice,
            weight: 1,
            listPrice: c.originalAsk,
            mlsNumber: null,
            propertySubType: 'Single Family Residence',
            photoUrl: null,
            publicRemarks: null,
            viewDescription: null,
            taxAnnual: null,
            domTotal: c.cdom,
          }))
        : [],
      null,
      { priceOverride: 489_000 },
    )!
    const left = applyEngineRecommendedList(overridden, engine, { priceOverride: 489_000 })
    expect(left.recommended).toBe(490_000)
    expect(left.predictedClose).toBe(495_000)

    const built = priceCmaSet({
      subject: { ...subject, standardStatus: 'Active', sqft: 1602, lastListPrice: 505_100 },
      adjusted: overridden
        ? [
            { ppsfTimeAdjusted: 270 },
            { ppsfTimeAdjusted: 275 },
            { ppsfTimeAdjusted: 280 },
          ].map((row, i) => ({
            ...sale({ listingKey: `P${i}` }),
            monthsSinceClose: 1,
            timeAdjustment: 0,
            timeAdjustedPrice: 430_000 + i * 10_000,
            ppsfTimeAdjusted: row.ppsfTimeAdjusted,
            sizeAdjustment: 0,
            adjustedPrice: 430_000 + i * 10_000,
            weight: 1,
            listPrice: 440_000 + i * 10_000,
            mlsNumber: null,
            propertySubType: 'Single Family Residence',
            photoUrl: null,
            publicRemarks: null,
            viewDescription: null,
            taxAnnual: null,
            domTotal: 10,
          }))
        : [],
      market: null,
      input: { priceOverride: null },
      selection: {
        pricingSales: comps,
        tiersUsed: ['subdivision-3mo'],
      },
      marketIndex: points,
      asOf: '2026-01-15',
    })
    expect(built?.recommended).toBe(505_000)
    expect(built?.predictedClose).toBe(495_000)
    expect(built?.method3).not.toBe(505_000)
  })

  it('off-market cover is sale ÷ sale-to-list, not Method 3, and the list band stays a band', () => {
    const adjusted = [
      { ppsfTimeAdjusted: 425 },
      { ppsfTimeAdjusted: 428 },
      { ppsfTimeAdjusted: 440 },
    ]
    const engine = listPriceFromEngine({
      subjectSqft: 1056,
      lastAsk: null,
      adjusted,
      saleToAskRatios: [1.18],
      asOfSaleToOriginal: 0.957,
      qualitySet: true,
      methodFallback: 458_000,
    })
    expect(engine.source).toBe('comps')
    expect(engine.predictedClose).toBe(452_000)
    expect(engine.recommendedList).toBe(472_000)
    expect(engine.conservativeList).toBeLessThan(engine.recommendedList!)
    expect(engine.highEndList).toBeGreaterThan(engine.recommendedList!)

    const board = computePricing(
      { ...subject, standardStatus: 'Closed', sqft: 1056, lastListPrice: 429_000 },
      adjusted.map((row, i) => ({
        ...sale({ listingKey: `D${i}` }),
        monthsSinceClose: 2,
        timeAdjustment: 0,
        timeAdjustedPrice: row.ppsfTimeAdjusted * 1056,
        ppsfTimeAdjusted: row.ppsfTimeAdjusted,
        sizeAdjustment: 0,
        adjustedPrice: row.ppsfTimeAdjusted * 1056,
        weight: 1,
        listPrice: 490_000,
        mlsNumber: null,
        propertySubType: 'Single Family Residence',
        photoUrl: null,
        publicRemarks: null,
        viewDescription: null,
        taxAnnual: null,
        domTotal: 10,
      })),
      null,
    )!
    const cover = applyEngineRecommendedList(board, engine)
    expect(cover.recommended).toBe(472_000)
    expect(cover.predictedClose).toBe(452_000)
    expect(cover.conservative).toBe(engine.conservativeList)
    expect(cover.highEnd).toBe(engine.highEndList)
    expect(cover.highEnd).toBeGreaterThan(cover.recommended)
    expect(cover.method3).not.toBe(cover.recommended)
  })
})
