import { describe, expect, it } from 'vitest'
import { closedCompWeight, fillShortSetWeights } from '@/lib/pricing/closed-comp-weight'
import { listPriceFromEngine } from '@/lib/pricing/estimate'
import {
  compsTheLetterPrints,
  pricingFailureMessage,
  recommendationOutsideSaleSet,
  saleSetsThePrice,
  sourceSalesTheLetterKeeps,
} from '@/lib/pricing/price-set'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'

const subject = {
  subjectSqft: 1800,
  saleSqft: 1750,
  monthsSinceClose: 2,
  subjectSubdivision: 'Home Plat',
  subjectCommunity: 'sample-community',
  subjectCommunityLocated: true,
  subjectLotAcres: 0.18,
}

describe('a sale sets the price only when it is this home', () => {
  it('does not let a different community move the price, and still lets a different plat name inside the community', () => {
    const inside = closedCompWeight({
      ...subject,
      saleSubdivision: 'Member Plat',
      saleCommunity: 'sample-community',
      saleCommunityLocated: true,
      ownPlat: false,
      saleLotAcres: 0.2,
    })
    const otherCommunity = closedCompWeight({
      ...subject,
      saleSubdivision: 'Other Community Plat',
      saleCommunity: 'other-community',
      saleCommunityLocated: true,
      ownPlat: false,
      saleLotAcres: 0.2,
    })
    const outside = closedCompWeight({
      ...subject,
      saleSubdivision: 'Not A Member',
      saleCommunity: null,
      saleCommunityLocated: true,
      ownPlat: false,
      saleLotAcres: 0.2,
    })
    expect(inside).toBeGreaterThan(0)
    expect(otherCommunity).toBe(0)
    expect(outside).toBe(0)

    const point = weightedAdjustedPrice([
      { adjustedPrice: 620_000, weight: inside },
      { adjustedPrice: 1_070_000, weight: otherCommunity },
      { adjustedPrice: 410_000, weight: outside },
    ])
    expect(point).toBe(620_000)
    expect(saleSetsThePrice({
      ...subject,
      saleSubdivision: 'Member Plat',
      saleCommunity: 'sample-community',
      saleCommunityLocated: true,
      ownPlat: false,
    })).toBe(true)
  })

  it('does not let a much smaller house or a cottage versus acreage set the price', () => {
    expect(saleSetsThePrice({
      subjectSqft: 1800,
      saleSqft: 1000,
      ownPlat: true,
      subjectSubdivision: 'Home Plat',
      saleSubdivision: 'Home Plat',
    })).toBe(false)
    expect(closedCompWeight({
      subjectSqft: 1800,
      saleSqft: 1000,
      monthsSinceClose: 1,
      ownPlat: true,
      subjectSubdivision: 'Home Plat',
      saleSubdivision: 'Home Plat',
    })).toBe(0)
    expect(saleSetsThePrice({
      subjectSqft: 1800,
      saleSqft: 1700,
      subjectLotAcres: 0.2,
      saleLotAcres: 3,
      ownPlat: false,
      subjectCommunity: 'creek-community',
      saleCommunity: 'creek-community',
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
    })).toBe(false)
    // An adjacent sale with no community on either side still sets the price.
    expect(saleSetsThePrice({
      subjectSqft: 1800,
      saleSqft: 1700,
      ownPlat: false,
      subjectSubdivision: 'Home Plat',
      saleSubdivision: 'Next Plat',
    })).toBe(true)
  })

  it('does not emit a price under or over every sale that set it, and does not invent one when none did', () => {
    expect(recommendationOutsideSaleSet(409_000, [500_000, 520_000, 540_000])).toBe('under')
    expect(recommendationOutsideSaleSet(1_073_000, [1_200_000, 1_260_000])).toBe('under')
    expect(recommendationOutsideSaleSet(700_000, [500_000, 520_000, 540_000])).toBe('over')
    expect(recommendationOutsideSaleSet(520_000, [500_000, 520_000, 540_000])).toBeNull()

    const empty = listPriceFromEngine({
      subjectSqft: 1800,
      lastAsk: null,
      adjusted: [
        { ppsfTimeAdjusted: 280, adjustedPrice: 500_000, weight: 0 },
        { ppsfTimeAdjusted: 290, adjustedPrice: 520_000, weight: 0 },
        { ppsfTimeAdjusted: 300, adjustedPrice: 540_000, weight: 0 },
      ],
      saleToAskRatios: [],
      qualitySet: false,
    })
    expect(empty.recommendedList).toBeNull()
    expect(empty.predictedClose).toBeNull()
    expect(empty.compsImpliedClose).toBeNull()
    expect(empty.outsideSaleSet).toBe('empty')
    expect(empty.source).toBe('none')
  })
})

describe('the letter prints the sales that set the price', () => {
  it('drops a sale that does not set the price once three sales do', () => {
    const rows = [
      { weight: 1, address: 'a' },
      { weight: 2, address: 'b' },
      { weight: 3, address: 'c' },
      { weight: 0, address: 'd' },
    ]
    expect(compsTheLetterPrints(rows).map((r) => r.address)).toEqual(['a', 'b', 'c'])
  })

  it('keeps a short set so the minimum can still fail it', () => {
    expect(compsTheLetterPrints([{ weight: 1 }, { weight: 2 }, { weight: 0 }])).toHaveLength(3)
  })

  it('does not hand a dropped sale back to the next price', () => {
    const source = [
      { listingKey: 'a' },
      { listingKey: 'b' },
      { listingKey: 'c' },
      { listingKey: 'd' },
    ]
    const priced = [
      { listingKey: 'a', weight: 1 },
      { listingKey: 'b', weight: 2 },
      { listingKey: 'c', weight: 3 },
      { listingKey: 'd', weight: 0 },
    ]
    expect(sourceSalesTheLetterKeeps(source, priced).map((row) => row.listingKey)).toEqual(['a', 'b', 'c'])
  })
})

describe('pricing failure message', () => {
  it('does not call a thin price-setting set a missing sqft', () => {
    const thin = pricingFailureMessage({ sqft: 1748 }, [{ weight: 0 }, { weight: 0 }, { weight: 0 }])
    expect(thin).toContain('0 of 3 comps set the price')
    expect(thin).not.toContain('sqft missing')
    expect(pricingFailureMessage({ sqft: null }, [])).toContain('subject sqft missing')
    expect(pricingFailureMessage({ sqft: 1748 }, [{ weight: 1 }, { weight: 1 }, { weight: 1 }])).toContain(
      'outside the sales that set it',
    )
  })
})

describe('a short plat does not stand alone', () => {
  const home = {
    sqft: 1748,
    beds: 3,
    lotAcres: 0.2,
    subdivision: 'Home Plat',
    communitySlug: 'sample-community',
    communityLocated: true,
  }
  const inside = {
    weight: 2.4,
    sqft: 1656,
    beds: 3,
    lotAcres: 0.18,
    subdivision: 'Member Plat',
    communitySlug: 'sample-community',
    communityLocated: true,
    ownPlat: false,
    selectionTier: 'pocket-12mo',
    monthsSinceClose: 11,
  }
  const outside = (sqft = 1900) => ({
    weight: 0,
    sqft,
    beds: 3,
    lotAcres: 0.2,
    subdivision: 'Other Tract',
    communitySlug: null as string | null,
    communityLocated: true,
    ownPlat: false,
    selectionTier: 'beyond-2mi-12mo',
    monthsSinceClose: 2,
  })

  it('writes that filled weight onto the sale the letter already holds', () => {
    const admitted = outside()
    fillShortSetWeights(home, [inside, outside(), outside(2000), admitted])
    expect(admitted.weight).toBeGreaterThan(0)
  })

  it('keeps the inside sale and lets the admitted next rung set the price', () => {
    const filled = fillShortSetWeights(home, [inside, outside(), outside(2000), outside(1600)])
    expect(filled[0]?.weight).toBe(2.4)
    expect(filled.slice(1).every((comp) => comp.weight > 0)).toBe(true)
    expect(closedCompWeight({
      subjectSqft: home.sqft,
      saleSqft: 1900,
      monthsSinceClose: 2,
      subjectCommunity: home.communitySlug,
      subjectCommunityLocated: true,
      saleCommunity: null,
      saleCommunityLocated: true,
      subjectSubdivision: home.subdivision,
      saleSubdivision: 'Other Tract',
    })).toBe(0)
  })

  it('still refuses a different size, and does not open the next rung once three sales set the price', () => {
    const tooBig = outside(2756)
    const filled = fillShortSetWeights(home, [inside, outside(), outside(1800), tooBig])
    expect(filled[3]?.weight).toBe(0)
    expect(filled.filter((comp) => comp.weight > 0)).toHaveLength(3)
    const three = [1, 2, 3].map((weight) => ({ ...inside, weight }))
    const held = fillShortSetWeights(home, [...three, outside()])
    expect(held[3]?.weight).toBe(0)
    expect(held.slice(0, 3).map((comp) => comp.weight)).toEqual([1, 2, 3])
  })
})

