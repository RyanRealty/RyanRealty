import { describe, expect, it } from 'vitest'
import { closedCompWeight } from '@/lib/pricing/closed-comp-weight'
import { listPriceFromEngine } from '@/lib/pricing/estimate'
import { pricingFailureMessage, recommendationOutsideSaleSet, saleSetsThePrice } from '@/lib/pricing/price-set'
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
