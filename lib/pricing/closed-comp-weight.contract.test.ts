/**
 * Matt 2026-09-17: Recommended weighted toward more recent/similar closeds.
 * Market cool: heavy recent half-life (~3 mo). Tip Ready:
 * node scripts/lib/taste-receipt.mjs --ship lib/pricing/closed-comp-weight.parity.json
 */
import { describe, expect, it } from 'vitest'
import {
  CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS,
  closedCompWeight,
} from '@/lib/pricing/closed-comp-weight'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import { clampRecommendedToClosedBand } from '@/lib/pricing/recommended-in-band'

describe('closed-comp Recommended weighting', () => {
  it('contract: more-recent-closed-weighs-more', () => {
    expect(CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS).toBe(3)
    const recent = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1800,
      monthsSinceClose: 1,
    })
    const older = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1800,
      monthsSinceClose: 12,
    })
    expect(recent).toBeGreaterThan(older)
    // Heavy cool: 6-month sale is ~¼ fresh recency (half-life 3).
    const sixMo = closedCompWeight({ subjectSqft: 1883, saleSqft: 1883, monthsSinceClose: 6 })
    const fresh = closedCompWeight({ subjectSqft: 1883, saleSqft: 1883, monthsSinceClose: 0 })
    expect(sixMo / fresh).toBeLessThan(0.3)
  })

  it('contract: more-similar-size-weighs-more', () => {
    const similar = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1850,
      monthsSinceClose: 3,
    })
    const far = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 2400,
      monthsSinceClose: 3,
    })
    expect(similar).toBeGreaterThan(far)
  })

  it('contract: weighted-point-pulls-toward-recent-similar-then-in-band', () => {
    // 2,300 sqft is 22% over the 1,883 subject, inside the one 25%
    // price-setting band; 2,400 (27.5%) would weigh 0 (Matt 2026-10-08).
    const cheapOld = {
      adjustedPrice: 650_000,
      weight: closedCompWeight({ subjectSqft: 1883, saleSqft: 2300, monthsSinceClose: 18 }),
    }
    const recentSimilar = {
      adjustedPrice: 690_000,
      weight: closedCompWeight({ subjectSqft: 1883, saleSqft: 1850, monthsSinceClose: 2 }),
    }
    const point = weightedAdjustedPrice([cheapOld, recentSimilar])
    expect(point).not.toBeNull()
    expect(point!).toBeGreaterThan(670_000)
    expect(point!).toBeLessThan(690_000)

    const clamped = clampRecommendedToClosedBand({
      valueLow: 675_000,
      valueHigh: 705_000,
      recommended: Math.min(point!, 650_000),
    })
    expect(clamped.recommended).toBeGreaterThanOrEqual(675_000)
    expect(clamped.recommended).toBeLessThanOrEqual(705_000)
  })

  it('same-subdivision sale pulls the recommended price harder than an equal-weight average with a neighborhood sale', () => {
    const subjectSqft = 2000
    const monthsSinceClose = 3
    const same = closedCompWeight({
      subjectSqft,
      saleSqft: subjectSqft * 1.2,
      monthsSinceClose,
      subjectBeds: 3,
      saleBeds: 4,
      locationMatch: 'same-subdivision',
    })
    const adjacent = closedCompWeight({
      subjectSqft,
      saleSqft: subjectSqft,
      monthsSinceClose,
      subjectBeds: 3,
      saleBeds: 3,
      locationMatch: 'adjacent-subdivision',
    })
    const neighborhood = closedCompWeight({
      subjectSqft,
      saleSqft: subjectSqft,
      monthsSinceClose,
      subjectBeds: 3,
      saleBeds: 3,
      locationMatch: 'neighborhood-or-community',
    })
    // Location order holds even when the neighborhood sale is the closer size and bed match.
    expect(same).toBeGreaterThan(adjacent)
    expect(adjacent).toBeGreaterThan(neighborhood)

    const samePrice = 640_000
    const neighborhoodPrice = 520_000
    const weighted = weightedAdjustedPrice([
      { adjustedPrice: samePrice, weight: same },
      { adjustedPrice: neighborhoodPrice, weight: neighborhood },
    ])
    const equal = (samePrice + neighborhoodPrice) / 2
    expect(weighted).not.toBeNull()
    expect(weighted!).toBeGreaterThan(equal)
    expect(weighted!).toBeLessThan(samePrice)
  })

  it('a same-subdivision sale that matches size, age, baths, and lot outweighs one that does not', () => {
    const shared = {
      subjectSqft: 2275,
      saleSqft: 2275,
      monthsSinceClose: 3,
      subjectBeds: 3,
      saleBeds: 3,
      locationMatch: 'same-subdivision' as const,
      subjectYearBuilt: 2002,
      subjectBaths: 3,
      subjectLotAcres: 0.12,
    }
    const close = closedCompWeight({
      ...shared,
      saleYearBuilt: 2004,
      saleBaths: 3,
      saleLotAcres: 0.11,
    })
    const loose = closedCompWeight({
      ...shared,
      saleYearBuilt: 1982,
      saleBaths: 2,
      saleLotAcres: 0.4,
    })
    expect(close).toBeGreaterThan(loose)
  })

  it('a home within 350 sqft weighs clearly more than one twice that far, and one square foot does not swing it', () => {
    const shared = {
      subjectSqft: 2000,
      monthsSinceClose: 0,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 3,
      saleBaths: 3,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
      locationMatch: 'same-subdivision' as const,
    }
    const atBand = closedCompWeight({ ...shared, saleSqft: 2000 + 350 })
    const justPast = closedCompWeight({ ...shared, saleSqft: 2000 + 351 })
    const twiceAsFar = closedCompWeight({ ...shared, saleSqft: 2000 + 700 })
    const atBandDown = closedCompWeight({ ...shared, saleSqft: 2000 - 350 })
    const twiceAsFarDown = closedCompWeight({ ...shared, saleSqft: 2000 - 700 })
    expect(atBand).toBeGreaterThan(twiceAsFar + 0.25)
    expect(atBandDown).toBeGreaterThan(twiceAsFarDown + 0.25)
    expect(Math.abs(atBand - justPast)).toBeLessThan(0.02)
    expect(atBand).toBeCloseTo(atBandDown, 4)
  })

  it('inside five years, the same build year weighs more than a home five years off, and the sixth year steps down', () => {
    const shared = {
      subjectSqft: 2275,
      saleSqft: 2275,
      monthsSinceClose: 0,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 3,
      saleBaths: 3,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
      subjectYearBuilt: 2002,
      locationMatch: 'same-subdivision' as const,
    }
    const sameYear = closedCompWeight({ ...shared, saleYearBuilt: 2002 })
    const fiveYears = closedCompWeight({ ...shared, saleYearBuilt: 1997 })
    const sixYears = closedCompWeight({ ...shared, saleYearBuilt: 1996 })
    expect(sameYear).toBeGreaterThan(fiveYears)
    expect(fiveYears).toBeGreaterThan(sixYears + 0.1)
  })

  it('a matching lot weighs more than a clearly different lot, and a closer lot weighs more inside that match', () => {
    const shared = {
      subjectSqft: 2275,
      saleSqft: 2275,
      monthsSinceClose: 0,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 3,
      saleBaths: 3,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      locationMatch: 'same-subdivision' as const,
    }
    const sameLot = closedCompWeight({ ...shared, saleLotAcres: 0.12 })
    const closeLot = closedCompWeight({ ...shared, saleLotAcres: 0.13 })
    const differentLot = closedCompWeight({ ...shared, saleLotAcres: 0.4 })
    expect(sameLot).toBeGreaterThan(closeLot)
    expect(closeLot).toBeGreaterThan(differentLot + 0.15)
  })

  it('one bath apart stays close, and an extra bedroom weighs less than that', () => {
    const shared = {
      subjectSqft: 2275,
      saleSqft: 2275,
      monthsSinceClose: 0,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
      locationMatch: 'same-subdivision' as const,
    }
    const full = closedCompWeight({
      ...shared,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 3,
      saleBaths: 3,
    })
    const oneBath = closedCompWeight({
      ...shared,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 3,
      saleBaths: 4,
    })
    const extraBedroom = closedCompWeight({
      ...shared,
      subjectBeds: 3,
      saleBeds: 4,
      subjectBaths: 3,
      saleBaths: 3,
    })
    expect(oneBath).toBeGreaterThan(0)
    expect(oneBath).toBeLessThan(full)
    expect(extraBedroom).toBeGreaterThan(0)
    expect(extraBedroom).toBeLessThan(oneBath)
  })

  it('a full match in the subdivision outweighs a newer adjacent home with an extra bedroom', () => {
    const match = {
      subjectSqft: 2275,
      saleSqft: 2275,
      subjectBeds: 3,
      subjectBaths: 3,
      saleBaths: 3,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
    }
    const fullMatch = closedCompWeight({
      ...match,
      saleBeds: 3,
      monthsSinceClose: 12,
      locationMatch: 'same-subdivision',
    })
    const adjacentExtraBedroom = closedCompWeight({
      ...match,
      saleBeds: 4,
      monthsSinceClose: 0,
      locationMatch: 'adjacent-subdivision',
    })
    const fourBedSameSubdivision = closedCompWeight({
      ...match,
      saleBeds: 4,
      monthsSinceClose: 3,
      locationMatch: 'same-subdivision',
    })
    const threeBedTwin = closedCompWeight({
      ...match,
      saleBeds: 3,
      monthsSinceClose: 3,
      locationMatch: 'same-subdivision',
    })
    const perfectNeighborhood = closedCompWeight({
      ...match,
      saleBeds: 3,
      monthsSinceClose: 0,
      locationMatch: 'neighborhood-or-community',
    })
    // 500 sqft over is 22%, inside the one 25% price-setting band; 700 over
    // (30.8%) never sets the price and weighs 0 (Matt 2026-10-08).
    const looseSameSubdivision = closedCompWeight({
      subjectSqft: 2275,
      saleSqft: 2275 + 500,
      subjectBeds: 3,
      saleBeds: 4,
      subjectBaths: 3,
      saleBaths: 2,
      subjectYearBuilt: 2002,
      saleYearBuilt: 1982,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.4,
      monthsSinceClose: 12,
      locationMatch: 'same-subdivision',
    })
    expect(fullMatch).toBeGreaterThan(adjacentExtraBedroom)
    expect(fourBedSameSubdivision).toBeGreaterThan(adjacentExtraBedroom)
    expect(fourBedSameSubdivision).toBeLessThan(threeBedTwin)
    expect(looseSameSubdivision).toBeGreaterThan(perfectNeighborhood)
    expect(looseSameSubdivision).toBeGreaterThan(0)
  })

  it('a flat market keeps a 12-month same-subdivision match nearly as heavy as its 3-month twin', () => {
    // Same house, same plat. The index did not move, so the calendar does not
    // throw the older sale out. It still weighs a little less.
    const flat = {
      subjectSqft: 2000,
      saleSqft: 2000,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 2,
      saleBaths: 2,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
      locationMatch: 'same-subdivision' as const,
      marketPathSource: 'index' as const,
      marketMonthlyRate: 0,
      marketReversed: false,
    }
    const three = closedCompWeight({ ...flat, monthsSinceClose: 3 })
    const six = closedCompWeight({ ...flat, monthsSinceClose: 6 })
    const twelve = closedCompWeight({ ...flat, monthsSinceClose: 12 })
    expect(three).toBeGreaterThan(six)
    expect(six).toBeGreaterThan(twelve)
    expect(twelve).toBeGreaterThan(three * 0.95)
  })

  it('a market running about 1 percent a month keeps the short half-life across 3, 6, and 12 months', () => {
    const running = {
      subjectSqft: 2000,
      saleSqft: 2000,
      subjectBeds: 3,
      saleBeds: 3,
      subjectBaths: 2,
      saleBaths: 2,
      subjectYearBuilt: 2002,
      saleYearBuilt: 2002,
      subjectLotAcres: 0.12,
      saleLotAcres: 0.12,
      locationMatch: 'same-subdivision' as const,
      marketPathSource: 'index' as const,
      marketMonthlyRate: 0.012,
      marketReversed: false,
    }
    const three = closedCompWeight({ ...running, monthsSinceClose: 3 })
    const six = closedCompWeight({ ...running, monthsSinceClose: 6 })
    const twelve = closedCompWeight({ ...running, monthsSinceClose: 12 })
    expect(three).toBeGreaterThan(six)
    expect(six).toBeGreaterThan(twelve)
    expect(twelve).toBeLessThan(three * 0.9)
  })

  it('a reversed or missing index does not treat an old sale as a flat-market match', () => {
    const same = {
      subjectSqft: 2000,
      saleSqft: 2000,
      subjectBeds: 3,
      saleBeds: 3,
      locationMatch: 'same-subdivision' as const,
      marketMonthlyRate: 0,
    }
    const reversed = closedCompWeight({
      ...same,
      monthsSinceClose: 12,
      marketPathSource: 'index',
      marketReversed: true,
    })
    const missing = closedCompWeight({
      ...same,
      monthsSinceClose: 12,
      marketPathSource: 'none',
    })
    const calm = closedCompWeight({
      ...same,
      monthsSinceClose: 12,
      marketPathSource: 'index',
      marketReversed: false,
    })
    const capped = closedCompWeight({
      ...same,
      monthsSinceClose: 12,
      marketPathSource: 'index',
      marketReversed: false,
      marketCapped: true,
    })
    expect(calm).toBeGreaterThan(reversed)
    expect(reversed).toBe(missing)
    expect(capped).toBe(missing)
  })
})
