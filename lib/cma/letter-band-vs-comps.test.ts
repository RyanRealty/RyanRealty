import { describe, expect, it } from 'vitest'
import { bandVersusClosedCompsCheck, dateSentenceMatchesGridCheck } from '@/lib/cma/letter-consistency'
import { pinPrintedBandToSettingSales } from '@/lib/pricing/estimate'

describe('band overlaps closed comps', () => {
  it('Marys Grace shape: a band under every closed comp fails', () => {
    const check = bandVersusClosedCompsCheck(
      { valueLow: 531_000, valueHigh: 577_000 },
      [
        { adjustedPrice: 610_000, closePrice: 610_000 },
        { adjustedPrice: 640_000, closePrice: 640_000 },
        { adjustedPrice: 665_000, closePrice: 665_000 },
      ],
    )
    expect(check.id).toBe('band-overlaps-closed-comps')
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/entirely below/)
  })

  it('passes when the band overlaps the comps, and when a band sits over all of them it fails', () => {
    expect(
      bandVersusClosedCompsCheck(
        { valueLow: 620_000, valueHigh: 640_000 },
        [{ adjustedPrice: 610_000 }, { adjustedPrice: 665_000 }],
      ).pass,
    ).toBe(true)
    const above = bandVersusClosedCompsCheck(
      { valueLow: 700_000, valueHigh: 740_000 },
      [{ closePrice: 610_000 }, { closePrice: 665_000 }],
    )
    expect(above.pass).toBe(false)
    expect(above.detail).toMatch(/entirely above/)
  })

  it('passes when there are no comps to grade', () => {
    expect(bandVersusClosedCompsCheck({ valueLow: 531_000, valueHigh: 577_000 }, []).pass).toBe(true)
  })

  it('the printed band is the exact adjusted sales that set the price', () => {
    const comps = [
      { adjustedPrice: 599_350, closePrice: 600_000, weight: 0.3 },
      { adjustedPrice: 653_097, closePrice: 670_000, weight: 0.2 },
      { adjustedPrice: 724_343, closePrice: 732_000, weight: 0.4 },
      { adjustedPrice: 932_256, closePrice: 925_000, weight: 0 },
    ]
    const rounded = bandVersusClosedCompsCheck({ valueLow: 599_000, valueHigh: 725_000 }, comps)
    expect(rounded.pass).toBe(false)
    expect(rounded.detail).toMatch(/does not set the price/)
    const setters = comps.filter((c) => c.weight > 0)
    const exact = bandVersusClosedCompsCheck({ valueLow: 599_350, valueHigh: 724_343 }, setters)
    expect(exact.pass).toBe(true)
  })

  it('pins the range sentence to those exact dollars', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 599_000,
        valueHigh: 725_000,
        recommended: 681_000,
        highEnd: 725_000,
        rangeRule: {
          rule: 'min-max' as const,
          n: 4,
          kept: 4,
          adjustedLow: 599_000,
          adjustedHigh: 725_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of four sale prices adjusted for date and size: $599,000 to $725,000.',
        },
      },
      [
        { adjustedPrice: 599_350, closePrice: 600_000, weight: 0.3 },
        { adjustedPrice: 724_343, closePrice: 732_000, weight: 0.7 },
      ],
    )
    expect(pinned.valueLow).toBe(599_350)
    expect(pinned.valueHigh).toBe(724_343)
    expect(pinned.highEnd).toBe(724_343)
    expect(pinned.rangeRule?.sentence).toContain('$599,350')
    expect(pinned.rangeRule?.sentence).toContain('$724,343')
    expect(pinned.rangeRule?.sentence).not.toContain('$725,000')
    expect(pinned.rangeRule?.sentence).not.toContain('$599,000')
  })

  it('does not say the sales were adjusted for size when size did not move', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 510_000,
        valueHigh: 612_000,
        recommended: 581_000,
        highEnd: 612_000,
        rangeRule: {
          rule: 'min-max' as const,
          n: 2,
          kept: 2,
          adjustedLow: 510_000,
          adjustedHigh: 612_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of two sale prices adjusted for date and size: $510,000 to $612,000.',
        },
      },
      [
        { adjustedPrice: 510_735, closePrice: 557_000, weight: 2, timeAdjustment: -38_265, sizeAdjustment: 0, storyAdjustment: 0 },
        { adjustedPrice: 611_320, closePrice: 637_000, weight: 3, timeAdjustment: -8_680, sizeAdjustment: 0, storyAdjustment: 0 },
      ],
    )
    expect(pinned.rangeRule?.sentence).toContain('adjusted for date')
    expect(pinned.rangeRule?.sentence).not.toContain('adjusted for date and size')
  })
})

describe('date sentence matches the grid', () => {
  it('refuses a line that moves every sale when one sale stayed put', () => {
    const check = dateSentenceMatchesGridCheck(
      'Over the last 12 months that index rose to a peak in May 2026 and has come back 7.0 percent since, so every sale below moves down.',
      [{ timeAdjustment: 0 }, { timeAdjustment: -16_771 }],
    )
    expect(check.pass).toBe(false)
    expect(check.severity).toBe('hard')
  })

  it('allows the same grid under a sentence that leaves today\'s sales put', () => {
    const check = dateSentenceMatchesGridCheck(
      'so sales that closed from June 2025 to July 2026 move down, and a sale that closed at today\'s level stays put.',
      [{ timeAdjustment: 0 }, { timeAdjustment: -16_771 }],
    )
    expect(check.pass).toBe(true)
  })
})
