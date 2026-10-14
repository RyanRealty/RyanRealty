import { describe, expect, it } from 'vitest'
import { closedCompWeight } from '@/lib/pricing/closed-comp-weight'
import { listPriceFromEngine } from '@/lib/pricing/estimate'
import { PLAT_SQFT_BAND, PLAT_WIDE_SQFT_BAND } from '@/lib/pricing/ladder'
import {
  clearlyDifferentSize,
  communityRefusalReason,
  PRICE_SET_SQFT_BAND,
  priceSetRefusal,
  pricingFailureMessage,
  productRefusalReason,
  recommendationOutsideSaleSet,
  saleSetsThePrice,
  sizeRefusalReason,
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


describe('a shared subdivision name is the same plat only when it is a real name on the same side of the community line (review, 2026-10-07)', () => {
  const sizes = { subjectSqft: 2000, saleSqft: 1980, subjectLotAcres: 0.2, saleLotAcres: 0.18 }

  it('does not read two sentinel names as one plat, so a Tetherow sale never prices a home outside it', () => {
    // The reviewer's probe: 'N/A' on both rows used to short-circuit to true
    // before the community test ran.
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: 'N/A',
      saleSubdivision: 'N/A',
      subjectCommunity: null,
      saleCommunity: 'tetherow',
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(false)
    for (const sentinel of ['None', 'Not In Subdivision', '-', 'n/a', 'Unknown']) {
      expect(saleSetsThePrice({
        ownPlat: false,
        subjectSubdivision: sentinel,
        saleSubdivision: sentinel,
        subjectCommunity: null,
        saleCommunity: 'tetherow',
        subjectCommunityLocated: true,
        saleCommunityLocated: true,
        ...sizes,
      }), sentinel).toBe(false)
    }
  })

  it('does not let a real shared MLS name carry a sale across the community line, either way', () => {
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: 'Plain',
      saleSubdivision: 'Plain',
      subjectCommunity: null,
      saleCommunity: 'tetherow',
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(false)
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: 'Plain',
      saleSubdivision: 'Plain',
      subjectCommunity: 'tetherow',
      saleCommunity: null,
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(false)
  })

  it('still reads a real shared name as the same plat when both sit outside every community, or in the same one', () => {
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: 'Plain',
      saleSubdivision: 'Plain',
      subjectCommunity: null,
      saleCommunity: null,
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(true)
    expect(saleSetsThePrice({
      ownPlat: false,
      subjectSubdivision: 'Plain',
      saleSubdivision: 'plain ',
      subjectCommunity: 'tetherow',
      saleCommunity: 'tetherow',
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(true)
  })

  it('keeps the selector own-plat decision ahead of the community test', () => {
    expect(saleSetsThePrice({
      ownPlat: true,
      subjectSubdivision: 'N/A',
      saleSubdivision: 'N/A',
      subjectCommunity: null,
      saleCommunity: 'tetherow',
      subjectCommunityLocated: true,
      saleCommunityLocated: true,
      ...sizes,
    })).toBe(true)
  })
})

describe('one size limit for any sale that sets the price: the picker\'s 35% (Matt 2026-10-09)', () => {
  // 2382 Jackson, 2,016 sqft. 2225 Indigo, 1,393 sqft, is 30.9% smaller.
  // The wide rung searches that far. The price uses the same line.
  const jackson = { subjectSqft: 2016, ownPlat: true, subjectSubdivision: 'Home Plat', saleSubdivision: 'Home Plat' }

  it('is the wide search band, defined once', () => {
    expect(PRICE_SET_SQFT_BAND).toBe(0.35)
    expect(PRICE_SET_SQFT_BAND).toBe(PLAT_WIDE_SQFT_BAND)
    expect(PRICE_SET_SQFT_BAND).not.toBe(PLAT_SQFT_BAND)
  })

  it('2225 Indigo, 30.9% smaller, sets the price on the own plat and on a wider rung', () => {
    expect(clearlyDifferentSize(2016, 1393)).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 1393 })).toBe(true)
    expect(saleSetsThePrice({ ...jackson, ownPlat: false, saleSubdivision: 'Touching Plat', saleSqft: 1393 })).toBe(true)
    expect(closedCompWeight({ ...jackson, saleSqft: 1393, monthsSinceClose: 1, selectionTier: 'subdivision-3mo-wide' })).toBeGreaterThan(0)
    expect(closedCompWeight({ ...jackson, saleSqft: 1393, monthsSinceClose: 1, ownPlat: false, selectionTier: 'adjacent-sub-6mo' })).toBeGreaterThan(0)
  })

  it('2735 Crossing at 28% and 2764 Spring Water at 31% set the price', () => {
    // 2339 Labiche, 1,001 sq ft. 2735 Crossing, 1,282 sq ft, is 28% larger.
    expect(clearlyDifferentSize(1001, 1282)).toBe(false)
    expect(saleSetsThePrice({ subjectSqft: 1001, saleSqft: 1282, ownPlat: true })).toBe(true)
    // 2745 Aldrich, 1,201 sq ft. 2764 Spring Water, 1,574 sq ft, is 31% larger.
    expect(clearlyDifferentSize(1201, 1574)).toBe(false)
    expect(saleSetsThePrice({ subjectSqft: 1201, saleSqft: 1574, ownPlat: true })).toBe(true)
    expect(priceSetRefusal({ subjectSqft: 1201, saleSqft: 1574, ownPlat: true })).toBeNull()
  })

  it('a sale 17.9% smaller still sets it', () => {
    expect(clearlyDifferentSize(2016, 1655)).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 1655 })).toBe(true)
    expect(closedCompWeight({ ...jackson, saleSqft: 1655, monthsSinceClose: 1 })).toBeGreaterThan(0)
  })

  it('exactly 35% sets the price; just past 35% does not, smaller or larger', () => {
    // 2,016 x 0.65 = 1,310.4 and 2,016 x 1.35 = 2,721.6. 1,311 and 2,721 sit inside.
    expect((2016 - 1311) / 2016).toBeLessThanOrEqual(0.35)
    expect((2721 - 2016) / 2016).toBeLessThanOrEqual(0.35)
    expect(clearlyDifferentSize(2016, 1311)).toBe(false)
    expect(clearlyDifferentSize(2016, 2721)).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 1311 })).toBe(true)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 2721 })).toBe(true)
    // Just past the line either way.
    expect((2016 - 1310) / 2016).toBeGreaterThan(0.35)
    expect((2722 - 2016) / 2016).toBeGreaterThan(0.35)
    expect(clearlyDifferentSize(2016, 1310)).toBe(true)
    expect(clearlyDifferentSize(2016, 2722)).toBe(true)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 1310 })).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 2722 })).toBe(false)
    expect(closedCompWeight({ ...jackson, saleSqft: 1310, monthsSinceClose: 1 })).toBe(0)
  })

  it('names a sale past 35% in the words the letter prints, and does not call 35% a miss', () => {
    // 1,201 x 1.36 = 1,633.36. 1,634 is 36% larger.
    const past = sizeRefusalReason(1201, 1634)
    expect(past).toBe(
      '1,634 sq ft, 36% larger than this home; sales more than 35% larger or smaller do not set the price',
    )
    expect(priceSetRefusal({ subjectSqft: 1201, saleSqft: 1634, ownPlat: true })).toEqual({
      code: 'size',
      reason: past,
    })
    expect(saleSetsThePrice({ subjectSqft: 1201, saleSqft: 1634, ownPlat: true })).toBe(false)
    // Just past the line, a rounded 35 would say the sale is inside the band.
    const barely = sizeRefusalReason(10000, 13510)
    expect(clearlyDifferentSize(10000, 13510)).toBe(true)
    expect(barely).toContain('35.1% larger')
    expect(barely).not.toContain(', 35% larger')
    expect(productRefusalReason(0.2, 5)).toBe(
      "5 acres against this home's 0.2 acres; a cottage and an acreage property do not set each other's price",
    )
    expect(communityRefusalReason()).toBe(
      'a different community than this home; a sale in another community does not set the price',
    )
  })

  it('a sale between the old 25% door and 35% sets the price', () => {
    // 2,016 x 0.70 = 1,411: 30% smaller. 2,620 is 30% larger.
    expect(clearlyDifferentSize(2016, 1411)).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 1411 })).toBe(true)
    expect(clearlyDifferentSize(2016, 2620)).toBe(false)
    expect(saleSetsThePrice({ ...jackson, saleSqft: 2620 })).toBe(true)
  })
})
