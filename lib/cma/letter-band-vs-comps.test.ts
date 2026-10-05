import { describe, expect, it } from 'vitest'
import { bandVersusClosedCompsCheck, evaluateLetterConsistencyContract } from '@/lib/cma/letter-consistency'
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

  it('Keats shape: a printed table weight sets the band, not the stored weight of zero', () => {
    const comps = [
      { adjustedPrice: 590_400, closePrice: 590_400, weight: 0.4 },
      { adjustedPrice: 510_735, closePrice: 510_735, weight: 0, printedWeight: 0.2 },
      { adjustedPrice: 571_936, closePrice: 571_936, weight: 0, printedWeight: 0.15 },
      { adjustedPrice: 611_320, closePrice: 611_320, weight: 0.35 },
      { adjustedPrice: 596_518, closePrice: 596_518, weight: 0, printedWeight: 0.1 },
    ]
    const check = bandVersusClosedCompsCheck({ valueLow: 590_400, valueHigh: 611_320 }, comps)
    expect(check.pass).toBe(false)
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 590_400,
        valueHigh: 611_320,
        rangeRule: {
          rule: 'min-max' as const,
          n: 2,
          kept: 2,
          adjustedLow: 590_400,
          adjustedHigh: 611_320,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of all two sale prices adjusted for date and size: $590,400 to $611,320.',
        },
      },
      comps,
    )
    expect(pinned.valueLow).toBe(510_735)
    expect(pinned.valueHigh).toBe(611_320)
    expect(pinned.rangeRule?.sentence).toMatch(/all five/)
    expect(pinned.rangeRule?.sentence).not.toMatch(/all two/)
    expect(pinned.rangeRule?.sentence).not.toContain('adjusted for')
  })

  it('does not say adjusted for date and size when only the date moved', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 500_000,
        valueHigh: 600_000,
        rangeRule: {
          rule: 'min-max' as const,
          n: 2,
          kept: 2,
          adjustedLow: 500_000,
          adjustedHigh: 600_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of all two sale prices adjusted for date and size: $500,000 to $600,000.',
        },
      },
      [
        {
          adjustedPrice: 500_000,
          closePrice: 480_000,
          weight: 0.5,
          timeAdjustment: 20_000,
          sizeAdjustment: 0,
          storyAdjustment: 0,
        },
        {
          adjustedPrice: 610_000,
          closePrice: 600_000,
          weight: 0.5,
          timeAdjustment: -4_000,
          sizeAdjustment: 0,
          storyAdjustment: 0,
        },
      ],
    )
    expect(pinned.rangeRule?.sentence).not.toContain('adjusted for date and size')
    expect(pinned.rangeRule?.sentence).toContain('adjusted for date')
  })
})

describe('adjustment claim versus the adjustment lines', () => {
  const pricing = { recommended: 560_000, valueLow: 510_735, valueHigh: 611_320 }

  it('fails when the letter says size and story do not adjust and also adjusted for date and size', () => {
    const both = evaluateLetterConsistencyContract({
      html: 'Size and story class do not adjust. The range is the spread of all five sale prices adjusted for date and size: $510,735 to $611,320.',
      names: null,
      identity: null,
      pricing,
    })
    const failed = both.checks.find((c) => c.id === 'adjustment-claim-matches-lines')
    expect(failed?.pass).toBe(false)
    expect(both.pass).toBe(false)
    const oneLine = evaluateLetterConsistencyContract({
      html: 'Size and story class do not adjust. The range is the spread of all five sale prices adjusted for date: $510,735 to $611,320.',
      names: null,
      identity: null,
      pricing,
    })
    expect(oneLine.checks.find((c) => c.id === 'adjustment-claim-matches-lines')?.pass).toBe(true)
    expect(oneLine.pass).toBe(true)
  })
})
