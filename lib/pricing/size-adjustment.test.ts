import { describe, expect, it } from 'vitest'
import { NO_LIVING_AREA_CELL, renderCompMatrixHtml, sizeAdjustmentCell } from '@/lib/cma/comp-matrix'
import { adjustComps } from '@/lib/cma/pricing'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import { adjustCmaCompAlongMarket } from '@/lib/pricing/estimate'
import { SIZE_ADJ_FACTOR, sizeAdjustmentFor } from '@/lib/pricing/size-adjustment'

/**
 * Matt 2026-10-08, "Adjust on both paths": every sale is adjusted for size the
 * same way, whichever search found it. The facts-ladder walk
 * (adjustCmaCompAlongMarket) and the listings-ladder fallback with no city
 * index (adjustComps) both go through sizeAdjustmentFor.
 */

const AS_OF = '2026-10-08'
const AS_OF_MS = new Date(AS_OF).getTime()

// 3037 Purcell's living area, and 2107 Carrie's: 1,880 against 1,590 is 18% larger.
const subject = {
  streetAddress: '3037 Purcell',
  city: 'Bend',
  subdivision: 'Silver Sage',
  propertySubType: 'Single Family Residence',
  beds: 3,
  baths: 2,
  sqft: 1590,
  yearBuilt: 2005,
} as CmaSubject

function sale(over: Partial<CmaComp>): CmaComp {
  return {
    listingKey: 'L1',
    address: '2107 Carrie',
    city: 'Bend',
    subdivision: 'Silver Sage',
    propertySubType: 'Single Family Residence',
    closePrice: 672_500,
    listPrice: 675_000,
    closeDate: '2026-08-01',
    beds: 3,
    baths: 2,
    sqft: 1880,
    yearBuilt: 2005,
    selectionTier: 'nearby-1mi-12mo',
    ...over,
  } as CmaComp
}

function factsWalk(comp: CmaComp, exclusivePocket = false) {
  return adjustCmaCompAlongMarket({
    subject,
    subjectStory: 'unknown',
    comp,
    saleStory: 'unknown',
    points: [],
    asOf: AS_OF,
    exclusivePocket,
  }).adjusted
}

describe('sizeAdjustmentFor', () => {
  it('moves half the date-adjusted price per square foot times the living-area gap, to the dollar', () => {
    const r = sizeAdjustmentFor({ subjectSqft: 1590, saleSqft: 1880, timeAdjustedPrice: 672_500 })
    expect(r.basis).toBe('adjusted')
    expect(SIZE_ADJ_FACTOR).toBe(0.5)
    // 672,500 / 1,880 = $357.71 a foot; (1,590 - 1,880) x 357.71 x 0.5 = -51,868.35
    expect(r.sizeAdjustment).toBe(-51_868)
    expect(r.ppsfTimeAdjusted).toBeCloseTo(672_500 / 1880, 6)
  })

  it('moves nothing for a sale with no living area recorded, and says why', () => {
    for (const saleSqft of [null, undefined, 0, Number.NaN]) {
      const r = sizeAdjustmentFor({ subjectSqft: 1590, saleSqft, timeAdjustedPrice: 500_000 })
      expect(r).toEqual({ sizeAdjustment: 0, ppsfTimeAdjusted: 0, basis: 'no-sale-living-area' })
    }
  })

  it('keeps the exclusive-pocket exception (Matt 2026-09-17)', () => {
    const r = sizeAdjustmentFor({
      subjectSqft: 1590,
      saleSqft: 1880,
      timeAdjustedPrice: 672_500,
      exclusivePocket: true,
    })
    expect(r.sizeAdjustment).toBe(0)
    expect(r.basis).toBe('exclusive-pocket')
  })
})

describe('one size adjustment on both ladders (Matt 2026-10-08)', () => {
  it('a sale 18% larger than the subject moves the same dollars on the listings path as on the facts path', () => {
    const carrie = sale({})
    expect((carrie.sqft - subject.sqft!) / subject.sqft!).toBeCloseTo(0.182, 3)
    const facts = factsWalk(carrie)
    const [listings] = adjustComps(subject, [carrie], null, AS_OF_MS)
    // Same date basis here (no index, no year-over-year), so the size move is
    // the only thing the two paths could disagree on.
    expect(listings!.timeAdjustedPrice).toBe(facts.timeAdjustedPrice)
    const shared = sizeAdjustmentFor({
      subjectSqft: subject.sqft,
      saleSqft: carrie.sqft,
      timeAdjustedPrice: facts.timeAdjustedPrice,
    })
    expect(shared.sizeAdjustment).toBe(-51_868)
    expect(facts.sizeAdjustment).toBe(shared.sizeAdjustment)
    expect(listings!.sizeAdjustment).toBe(shared.sizeAdjustment)
    expect(listings!.sizeAdjustmentBasis).toBe('adjusted')
    expect(facts.sizeAdjustmentBasis).toBe('adjusted')
    // It flows into the adjusted price on both.
    expect(listings!.adjustedPrice).toBe(listings!.timeAdjustedPrice + shared.sizeAdjustment)
    expect(facts.adjustedPrice).toBe(facts.timeAdjustedPrice + shared.sizeAdjustment)
  })

  it('applies the listings path size move after a year-over-year date move, on that moved price', () => {
    const carrie = sale({ closeDate: '2026-04-08' })
    const market = { yoyMedianPriceDeltaPct: -6 } as Parameters<typeof adjustComps>[2]
    const [listings] = adjustComps(subject, [carrie], market, AS_OF_MS)
    expect(listings!.timeAdjustment).not.toBe(0)
    expect(listings!.sizeAdjustment).toBe(
      sizeAdjustmentFor({
        subjectSqft: subject.sqft,
        saleSqft: carrie.sqft,
        timeAdjustedPrice: listings!.timeAdjustedPrice,
      }).sizeAdjustment,
    )
  })

  it('the exclusive pocket still moves nothing for size on the facts walk', () => {
    const facts = factsWalk(sale({ selectionTier: 'subdivision-24mo' }), true)
    expect(facts.sizeAdjustment).toBe(0)
    expect(facts.sizeAdjustmentBasis).toBe('exclusive-pocket')
  })

  it('the grid prints the size row for a set priced on the listings path', () => {
    const set = adjustComps(
      subject,
      [
        sale({ listingKey: 'L1', address: '2107 Carrie', sqft: 1880 }),
        sale({ listingKey: 'L2', address: '2124 Carrie', sqft: 1558, closePrice: 545_350 }),
        sale({ listingKey: 'L3', address: '2058 Hollow Tree', sqft: 1583, closePrice: 502_500 }),
        sale({ listingKey: 'L4', address: '2110 Carrie', sqft: 1641, closePrice: 589_000 }),
        sale({ listingKey: 'L5', address: '2591 Purcell', sqft: 1655, closePrice: 575_000 }),
      ],
      null,
      AS_OF_MS,
    )
    const html = renderCompMatrixHtml(subject, set)
    expect(html).toContain('Adjusted for size (theirs vs yours)')
    expect(html).toContain('−$51,868')
  })

  it('a sale with no living area recorded stays unadjusted, and its grid cell says so', () => {
    const noArea = sale({ listingKey: 'L9', address: '9 Unknown', sqft: null as unknown as number })
    const [listings] = adjustComps(subject, [noArea], null, AS_OF_MS)
    expect(listings!.sizeAdjustment).toBe(0)
    expect(listings!.sizeAdjustmentBasis).toBe('no-sale-living-area')
    expect(listings!.adjustedPrice).toBe(listings!.timeAdjustedPrice)
    const facts = factsWalk({ ...noArea, sqft: 0 })
    expect(facts.sizeAdjustment).toBe(0)
    expect(facts.sizeAdjustmentBasis).toBe('no-sale-living-area')
    expect(sizeAdjustmentCell(listings!)).toBe(NO_LIVING_AREA_CELL)

    const set = adjustComps(
      subject,
      [
        noArea,
        sale({ listingKey: 'L1', address: '2107 Carrie', sqft: 1880 }),
        sale({ listingKey: 'L2', address: '2124 Carrie', sqft: 1558, closePrice: 545_350 }),
        sale({ listingKey: 'L3', address: '2058 Hollow Tree', sqft: 1583, closePrice: 502_500 }),
        sale({ listingKey: 'L4', address: '2110 Carrie', sqft: 1641, closePrice: 589_000 }),
      ],
      null,
      AS_OF_MS,
    )
    const html = renderCompMatrixHtml(subject, set)
    expect(html).toContain(NO_LIVING_AREA_CELL)
  })
})
