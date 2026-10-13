import { describe, expect, it } from 'vitest'
import {
  PRICE_CUT_SANITY_MAX_PCT,
  isDecimalShiftPriceChange,
  isPlausibleAskingPriceCut,
} from './price-drop-sanity'

describe('isDecimalShiftPriceChange', () => {
  it('flags the Hunnell typo: $16.49M to $1.649M is exactly 10x', () => {
    expect(isDecimalShiftPriceChange(16_490_000, 1_649_000)).toBe(true)
  })

  it('flags the inverse (an extra zero) as a decimal shift too', () => {
    expect(isDecimalShiftPriceChange(1_649_000, 16_490_000)).toBe(true)
  })

  it('flags a rounded 10x correction', () => {
    expect(isDecimalShiftPriceChange(16_490_000, 1_650_000)).toBe(true)
  })

  it('leaves a normal markdown alone', () => {
    expect(isDecimalShiftPriceChange(599_000, 549_000)).toBe(false)
    expect(isDecimalShiftPriceChange(1_250_000, 1_100_000)).toBe(false)
  })

  it('does not treat a 2x or 5x move as a decimal shift', () => {
    expect(isDecimalShiftPriceChange(800_000, 400_000)).toBe(false)
    expect(isDecimalShiftPriceChange(500_000, 100_000)).toBe(false)
  })
})

describe('isPlausibleAskingPriceCut', () => {
  it('keeps a 3.3% Bend-typical cut', () => {
    expect(isPlausibleAskingPriceCut(599_000, 579_000)).toBe(true)
  })

  it(`keeps a cut of exactly ${PRICE_CUT_SANITY_MAX_PCT}%`, () => {
    expect(isPlausibleAskingPriceCut(500_000, 300_000)).toBe(true)
  })

  it(`excludes a cut over ${PRICE_CUT_SANITY_MAX_PCT}%`, () => {
    expect(isPlausibleAskingPriceCut(500_000, 299_000)).toBe(false)
    expect(isPlausibleAskingPriceCut(16_490_000, 1_649_000)).toBe(false)
  })

  it('excludes a decimal-shift even when the percent would otherwise pass', () => {
    // 10x is 90%, already over the cap; this pins the dedicated reason.
    expect(isDecimalShiftPriceChange(16_490_000, 1_649_000)).toBe(true)
    expect(isPlausibleAskingPriceCut(16_490_000, 1_649_000)).toBe(false)
  })

  it('excludes a recovered or raised ask', () => {
    expect(isPlausibleAskingPriceCut(299_000, 299_000)).toBe(false)
    expect(isPlausibleAskingPriceCut(350_000, 400_000)).toBe(false)
  })

  it('excludes missing or non-positive prices', () => {
    expect(isPlausibleAskingPriceCut(0, 500_000)).toBe(false)
    expect(isPlausibleAskingPriceCut(500_000, 0)).toBe(false)
    expect(isPlausibleAskingPriceCut(Number.NaN, 500_000)).toBe(false)
  })
})
