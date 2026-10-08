/**
 * ONE 20% LINE (Matt 2026-10-08): the comp search and the comparability review
 * read a sale's price tier from one helper, against the home's independent
 * anchor, never from the kept sales or the other candidates.
 */
import { describe, expect, it } from 'vitest'
import {
  PRICE_TIER_BAND,
  describePriceTierLine,
  insidePriceTier,
  priceTierLine,
  priceTierPosition,
  salePpsf,
} from '@/lib/pricing/price-tier'

describe('the one 20% price line', () => {
  it('is 20% either side of the anchor, in whole dollars', () => {
    expect(PRICE_TIER_BAND).toBe(0.2)
    // 1648 Pheasant: a $498 anchor over 62 sales.
    expect(priceTierLine(498)).toEqual({ anchor: 498, floor: 398, ceiling: 598 })
    // 20676 Wild Rose: $335 over 407 sales.
    expect(priceTierLine(335)).toEqual({ anchor: 335, floor: 268, ceiling: 402 })
    // An unrounded anchor is rounded first, so the search and the review (which
    // is handed the stored whole-dollar figure) draw the same line.
    expect(priceTierLine(497.6)).toEqual(priceTierLine(498))
  })

  it('has no line without an anchor', () => {
    expect(priceTierLine(null)).toBeNull()
    expect(priceTierLine(undefined)).toBeNull()
    expect(priceTierLine(0)).toBeNull()
    expect(priceTierLine(Number.NaN)).toBeNull()
  })

  it('keeps a sale 19% off the anchor and skips one 21% off, on either side', () => {
    const line = priceTierLine(500)!
    expect(insidePriceTier(500 * 0.81, line)).toBe(true)
    expect(insidePriceTier(500 * 1.19, line)).toBe(true)
    expect(insidePriceTier(500 * 0.79, line)).toBe(false)
    expect(insidePriceTier(500 * 1.21, line)).toBe(false)
    expect(priceTierPosition(500 * 0.79, line)).toBe('below')
    expect(priceTierPosition(500 * 1.21, line)).toBe('above')
    expect(priceTierPosition(500, line)).toBe('inside')
  })

  it('includes the floor and the ceiling themselves', () => {
    const line = priceTierLine(500)!
    expect(insidePriceTier(400, line)).toBe(true)
    expect(insidePriceTier(600, line)).toBe(true)
    expect(insidePriceTier(399.99, line)).toBe(false)
    expect(insidePriceTier(600.01, line)).toBe(false)
  })

  it('cuts the sales the 2026-10-08 diagnostic named, and only those', () => {
    const pheasant = priceTierLine(498)!
    // 2400 Jones: $500,000 over 1,314 sqft is $381, 23.5% under.
    expect(insidePriceTier(salePpsf(500_000, 1_314), pheasant)).toBe(false)
    // 660 Innes, $512: inside.
    expect(insidePriceTier(salePpsf(575_000, 1_124), pheasant)).toBe(true)
    const wildRose = priceTierLine(335)!
    // 20606 Songbird ($281) and 61131 Brown Trout ($282): 16% under, inside.
    expect(insidePriceTier(salePpsf(675_000, 2_400), wildRose)).toBe(true)
    expect(insidePriceTier(salePpsf(547_000, 1_941), wildRose)).toBe(true)
  })

  it('custom and new keep the floor and lose the ceiling', () => {
    const line = priceTierLine(489)!
    expect(insidePriceTier(833, line, { floorOnly: true })).toBe(true)
    expect(insidePriceTier(222, line, { floorOnly: true })).toBe(false)
  })

  it('cannot grade a sale with no living area, and passes it as the old gap did', () => {
    const line = priceTierLine(500)!
    expect(salePpsf(500_000, 0)).toBeNull()
    expect(salePpsf(null, 2_000)).toBeNull()
    expect(priceTierPosition(null, line)).toBeNull()
    expect(insidePriceTier(null, line)).toBe(true)
  })

  it('reads close price over living area, before any date adjustment', () => {
    expect(salePpsf(600_000, 2_000)).toBe(300)
  })

  it('names the line in plain words', () => {
    expect(describePriceTierLine(priceTierLine(498)!)).toBe('$398 to $598 a square foot (within 20% of $498)')
  })
})
