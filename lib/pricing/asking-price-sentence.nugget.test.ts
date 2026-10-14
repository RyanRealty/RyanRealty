import { describe, expect, it } from 'vitest'
import { listPriceFromEngine } from '@/lib/pricing/estimate'
import { pricingMethodSentences } from '@/lib/cma/pricing-method'
import type { CmaPricing } from '@/lib/cma/types'

/**
 * Nugget (cma-19815-nugget), pass 3: the range sentence said each figure was
 * "carried to an asking price at 96.7 percent" while the printed band was the
 * adjusted sale prices. The band is every seated sale, $700,000 to $880,000.
 */
describe('asking-price sentence, Nugget shape', () => {
  it('says the band is the adjusted sale prices and does not carry them at 96.7 percent', () => {
    const engine = listPriceFromEngine({
      subjectSqft: 2020,
      lastAsk: null,
      // Five price-setting sales. The $700,000 and $880,000 ends stay in
      // the price (Matt 2026-10-09). They are the range.
      adjusted: [
        { ppsfTimeAdjusted: 347, adjustedPrice: 700_000, weight: 0.1 },
        { ppsfTimeAdjusted: 362, adjustedPrice: 734_657, weight: 0.257 },
        { ppsfTimeAdjusted: 382, adjustedPrice: 775_000, weight: 0.4 },
        { ppsfTimeAdjusted: 413, adjustedPrice: 844_000, weight: 0.343 },
        { ppsfTimeAdjusted: 436, adjustedPrice: 880_000, weight: 0.1 },
      ],
      saleToAskRatios: [],
      asOfSaleToOriginal: 0.967,
      qualitySet: false,
    })
    const sentence = engine.rangeRule?.sentence ?? ''
    expect(engine.rangeRule?.rule).toBe('min-max')
    expect(engine.rangeRule?.kept).toBe(5)
    expect(engine.rangeRule?.adjustedLow).toBe(700_000)
    expect(engine.rangeRule?.adjustedHigh).toBe(880_000)
    expect(sentence).toContain('$700,000 to $880,000')
    expect(sentence).toContain('all five sale prices')
    expect(sentence).toContain('96.7 percent')
    expect(sentence).toMatch(/adjusted sale prices/)
    expect(sentence).toMatch(/not applied to this range/)
    expect(sentence).not.toMatch(/carried to an asking price/)
    expect(sentence).not.toMatch(/set aside/)
    expect(sentence).not.toMatch(/[—–]/)

    const carriedLow = Math.round(700_000 / 0.967)
    expect(sentence).not.toContain(`$${carriedLow.toLocaleString('en-US')}`)

    const printed = pricingMethodSentences({
      pricing: { rangeRule: engine.rangeRule } as CmaPricing,
    }).join(' ')
    expect(printed).toContain('$700,000 to $880,000')
    expect(printed).not.toMatch(/carried to an asking price/)
  })
})
