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
    // The cover rounds $639,871 up to $640,000. That step is the sale.
    expect(recommendationOutsideSaleSet(640_000, [603_227, 620_206, 639_871])).toBeNull()
    expect(recommendationOutsideSaleSet(645_000, [603_227, 620_206, 639_871])).toBe('over')
    expect(recommendationOutsideSaleSet(603_000, [603_227, 639_871])).toBeNull()
    expect(recommendationOutsideSaleSet(602_000, [603_227, 639_871])).toBe('under')

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
    const thin = pricingFailureMessage({ sqft: 1748 }, [{ weight: 0 }, { weight: 0 }, { weight: 0 }, { weight: 0 }, { weight: 0 }])
    expect(thin).toContain('0 of 5 comps set the price')
    expect(thin).toContain('this home needs 5')
    expect(thin).not.toContain('sqft missing')
    expect(pricingFailureMessage({ sqft: null }, [])).toContain('subject sqft missing')
    // Four setters is still a shortage (Matt 2026-10-07); five that set it
    // and no price is the recommendation sitting outside them.
    expect(pricingFailureMessage({ sqft: 1748 }, [{ weight: 1 }, { weight: 1 }, { weight: 1 }, { weight: 1 }])).toContain(
      '4 of 4 comps set the price, and this home needs 5',
    )
    expect(
      pricingFailureMessage({ sqft: 1748 }, [{ weight: 1 }, { weight: 1 }, { weight: 1 }, { weight: 1 }, { weight: 1 }]),
    ).toContain('outside the sales that set it')
  })
})

describe('a sale from another community never sets the price, however short the set (rule 20, Matt 2026-10-07)', () => {
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

  const weightOf = (sale: ReturnType<typeof outside> | typeof inside) =>
    closedCompWeight({
      subjectSqft: home.sqft,
      saleSqft: sale.sqft,
      monthsSinceClose: sale.monthsSinceClose,
      subjectBeds: home.beds,
      saleBeds: sale.beds,
      subjectSubdivision: home.subdivision,
      saleSubdivision: sale.subdivision,
      selectionTier: sale.selectionTier,
      ownPlat: sale.ownPlat,
      subjectCommunity: home.communitySlug,
      saleCommunity: sale.communitySlug,
      subjectCommunityLocated: home.communityLocated,
      saleCommunityLocated: sale.communityLocated,
      subjectLotAcres: home.lotAcres,
      saleLotAcres: sale.lotAcres,
    })

  it('weighs the outside sale at zero with one inside sale and with none, so the setters are exactly the inside set', () => {
    // The fill that once re-weighted an outside sale when fewer than three
    // set the price is gone: under five setters the build is a comp shortage.
    expect(weightOf(inside)).toBeGreaterThan(0)
    expect(weightOf(outside())).toBe(0)
    expect(weightOf(outside(2000))).toBe(0)
    expect(weightOf(outside(1600))).toBe(0)
    const set = [inside, outside(), outside(2000), outside(1600)].map((sale) => ({ ...sale, weight: weightOf(sale) }))
    expect(set.filter((comp) => comp.weight > 0)).toHaveLength(1)
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: home.subdivision,
      saleSubdivision: 'Other Tract',
      subjectCommunity: home.communitySlug,
      saleCommunity: null,
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      subjectSqft: home.sqft,
      saleSqft: 1900,
    })).toBe(false)
  })

  it('still refuses a clearly different size, and an outside sale stays at zero beside five setters', () => {
    const tooBig = { ...inside, sqft: 2756 }
    expect(weightOf(tooBig)).toBe(0)
    const five = [1, 2, 3, 4, 5].map((weight) => ({ ...inside, weight: weightOf(inside) * weight }))
    const held = [...five, { ...outside(), weight: weightOf(outside()) }]
    expect(held[5]?.weight).toBe(0)
    expect(held.filter((comp) => comp.weight > 0)).toHaveLength(5)
  })
})

