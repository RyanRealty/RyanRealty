import { describe, expect, it } from 'vitest'
import {
  bandVersusClosedCompsCheck,
  evaluateLetterConsistencyContract,
  recommendedAtOrBelowBandCheck,
} from '@/lib/cma/letter-consistency'
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

  it('Keats shape (a legacy min-max row): a printed table weight sets the band, not the stored weight of zero', () => {
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

  it('the pin keeps the trimmed rule and never counts a set-aside sale (the band is always trimmed, Matt 2026-10-07)', () => {
    const comps = [
      { listingKey: 'LOW', address: '1 Low St', adjustedPrice: 580_000, closePrice: 580_000, weight: 0.1 },
      { listingKey: 'A', address: '2 Mid St', adjustedPrice: 603_227, closePrice: 535_000, weight: 0.25 },
      { listingKey: 'B', address: '3 Mid St', adjustedPrice: 620_206, closePrice: 605_000, weight: 0.3 },
      { listingKey: 'C', address: '4 Mid St', adjustedPrice: 639_871, closePrice: 637_000, weight: 0.25 },
      { listingKey: 'HIGH', address: '5 High St', adjustedPrice: 660_000, closePrice: 660_000, weight: 0.1 },
    ]
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 603_000,
        valueHigh: 640_000,
        recommended: 630_000,
        conservative: 603_000,
        highEnd: 640_000,
        setAside: [
          { listingKey: 'LOW', address: '1 Low St', adjustedPrice: 580_000, end: 'low', reason: 'The lowest.' },
          { listingKey: 'HIGH', address: '5 High St', adjustedPrice: 660_000, end: 'high', reason: 'The highest.' },
        ],
        rangeRule: {
          rule: 'trimmed-one-each-end' as const,
          n: 5,
          kept: 3,
          adjustedLow: 603_000,
          adjustedHigh: 640_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence:
            'The range is the spread of the three sale prices behind this price, adjusted for date and size: $603,000 to $640,000. Two of the five sales sat outside every one of them and were set aside, so no single sale could set the range.',
        },
      },
      comps,
    )
    // The set-aside sales still carry weight on the printed rows; the pin
    // reads them by name and never lets one set an end.
    expect(pinned.valueLow).toBe(603_227)
    expect(pinned.valueHigh).toBe(639_871)
    expect(pinned.rangeRule?.rule).toBe('trimmed-one-each-end')
    expect(pinned.rangeRule?.n).toBe(5)
    expect(pinned.rangeRule?.kept).toBe(3)
    expect(pinned.rangeRule?.sentence).toContain('three sale prices')
    expect(pinned.rangeRule?.sentence).toContain('Two of the five')
    expect(pinned.rangeRule?.sentence).toContain('$603,227')
    expect(pinned.rangeRule?.sentence).toContain('$639,871')
    expect(pinned.rangeRule?.sentence).not.toContain('$580,000')
    expect(pinned.rangeRule?.sentence).not.toContain('$660,000')
    expect(pinned.rangeRule?.sentence).not.toMatch(/[—–]/)
  })

  it('pulls a list that rounded one step above the highest setting sale back inside that sale', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 603_000,
        valueHigh: 640_000,
        recommended: 640_000,
        conservative: 629_000,
        highEnd: 640_000,
        failedAsk: 649_900,
        rangeRule: {
          rule: 'min-max' as const,
          n: 5,
          kept: 5,
          adjustedLow: 603_000,
          adjustedHigh: 640_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence:
            'The range is the spread of all five sale prices adjusted for date and size: $603,000 to $640,000.',
        },
      },
      [
        { adjustedPrice: 603_227, closePrice: 535_000, weight: 0.14 },
        { adjustedPrice: 620_206, closePrice: 605_000, weight: 0.36 },
        { adjustedPrice: 639_871, closePrice: 637_000, weight: 0.3 },
      ],
    )
    expect(pinned.valueHigh).toBe(639_871)
    expect(pinned.valueLow).toBe(603_227)
    expect(pinned.recommended).toBe(639_000)
    expect(pinned.recommended!).toBeLessThanOrEqual(pinned.valueHigh)
    expect(pinned.recommended!).toBeGreaterThanOrEqual(pinned.valueLow)
    expect(pinned.highEnd).toBeLessThanOrEqual(639_871)
    expect(pinned.highEnd!).toBeGreaterThanOrEqual(pinned.recommended!)
    expect(pinned.conservative).toBeLessThanOrEqual(pinned.recommended!)
    expect(
      recommendedAtOrBelowBandCheck({
        recommended: pinned.recommended,
        valueLow: pinned.valueLow,
        valueHigh: pinned.valueHigh,
      }).pass,
    ).toBe(true)
  })

  it('refuses a recommended list that still sits above the sales, and keeps one the failed ask pulled under', () => {
    const above = recommendedAtOrBelowBandCheck({
      recommended: 640_000,
      valueLow: 603_227,
      valueHigh: 639_871,
    })
    expect(above.pass).toBe(false)
    expect(above.detail).toMatch(/above the highest sale/)
    expect(
      recommendedAtOrBelowBandCheck({
        recommended: 609_000,
        valueLow: 620_000,
        valueHigh: 635_000,
      }).pass,
    ).toBe(true)
  })

  it('leaves a recommendation the failed ask already pulled under the sales', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 620_000,
        valueHigh: 635_000,
        recommended: 609_000,
        conservative: 620_000,
        highEnd: 635_000,
        rangeRule: {
          rule: 'min-max' as const,
          n: 2,
          kept: 2,
          adjustedLow: 620_000,
          adjustedHigh: 635_000,
          saleToAskRatio: null,
          saleToAskSource: 'none' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of all two sale prices adjusted for date and size: $620,000 to $635,000.',
        },
      },
      [
        { adjustedPrice: 620_000, closePrice: 620_000, weight: 0.5 },
        { adjustedPrice: 635_000, closePrice: 635_000, weight: 0.5 },
      ],
    )
    expect(pinned.recommended).toBe(609_000)
    expect(pinned.valueLow).toBe(620_000)
    expect(pinned.valueHigh).toBe(635_000)
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

describe('the trimmed band (Matt 2026-10-07: the printed band is always the trimmed range)', () => {
  // 3037 Purcell's shape on the five-sale floor: five sales set the price,
  // the highest and lowest are set aside, and the band is the middle three.
  const comps = [
    { listingKey: 'A', address: '1 Low St', adjustedPrice: 503_611, closePrice: 503_611, weight: 0.2 },
    { listingKey: 'B', address: '2 Mid St', adjustedPrice: 507_638, closePrice: 507_638, weight: 0.2 },
    { listingKey: 'C', address: '3 Mid St', adjustedPrice: 521_000, closePrice: 521_000, weight: 0.2 },
    { listingKey: 'D', address: '4 Mid St', adjustedPrice: 530_424, closePrice: 530_424, weight: 0.2 },
    { listingKey: 'E', address: '5 High St', adjustedPrice: 611_484, closePrice: 611_484, weight: 0.2 },
  ]
  const setAside = [
    { listingKey: 'A', address: '1 Low St', adjustedPrice: 503_611, reason: 'lowest' },
    { listingKey: 'E', address: '5 High St', adjustedPrice: 611_484, reason: 'highest' },
  ]

  it('passes when the band is the kept sales, the highest and lowest set aside', () => {
    const check = bandVersusClosedCompsCheck({ valueLow: 507_638, valueHigh: 530_424, setAside }, comps)
    expect(check.pass).toBe(true)
    expect(check.detail).toContain('the highest and lowest set aside')
  })

  it('reads the set-aside rows from rangeRule too, as the pin does', () => {
    const check = bandVersusClosedCompsCheck(
      { valueLow: 507_638, valueHigh: 530_424, rangeRule: { setAside } },
      comps,
    )
    expect(check.pass).toBe(true)
  })

  it('fails a band that still spans the set-aside ends', () => {
    expect(bandVersusClosedCompsCheck({ valueLow: 503_611, valueHigh: 611_484, setAside }, comps).pass).toBe(false)
  })

  it('agrees with the pin: the pinned band always passes the check', () => {
    const pinned = pinPrintedBandToSettingSales(
      { valueLow: 500_000, valueHigh: 615_000, recommended: 521_000, setAside },
      comps,
    )
    expect(pinned.valueLow).toBe(507_638)
    expect(pinned.valueHigh).toBe(530_424)
    expect(bandVersusClosedCompsCheck(pinned, comps).pass).toBe(true)
  })
})
