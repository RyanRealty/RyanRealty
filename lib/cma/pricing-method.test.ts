/**
 * Chapter 3's method, and the sales it set aside.
 * docs/plans/CMA_REIMAGINED_2026-09-07.md Delta 1 + research items 2, 3, 5, 10.
 */
import { describe, expect, it } from 'vitest'
import {
  compWeightIndex,
  pricingMethodSentences,
  readRejectedSales,
  renderPricingMethodHtml,
  renderRejectedSalesHtml,
} from '@/lib/cma/pricing-method'
import type { CmaPricing } from '@/lib/cma/types'

const pricing = {
  recommended: 394000,
  conservative: 380000,
  highEnd: 407000,
  valueLow: 372324,
  valueHigh: 398788,
  timeAdjustment: {
    sentence:
      'Prices a square foot in this city have moved down 0.4 percent a month over the last 12 months, across 864 sales.',
    pctPerMonth: -0.4,
  },
  rangeRule: {
    sentence:
      'The range is the spread of all 5 sale prices adjusted for date and size: $372,324 to $398,788.',
  },
  reconciliation: {
    sentence: '840 Quince carries the most weight in this price at 28.8 percent.',
    mostWeighted: 'K-840',
    weights: [
      { listingKey: 'K-730', address: '730 Quince', weight: 16.2, grossAdjustmentPct: 14.8 },
      { listingKey: 'K-840', address: '840 Quince', weight: 28.8, grossAdjustmentPct: 17 },
    ],
  },
  rejected: [
    { listingKey: 'K-2748', address: '2748 6th', reason: '0.18 miles NE from your home' },
    { listingKey: null, address: '725 Redwood', reason: 'sold 14 months ago' },
  ],
} as unknown as CmaPricing

describe('the method, stated before the evidence', () => {
  it('orders which sales, how they were adjusted, then how the range and the price follow', () => {
    expect(
      pricingMethodSentences({
        pricing,
        whichSales: 'There were not enough recent sales inside Diamond Bar Ranch, so we opened to 1 mile.',
      }),
    ).toEqual([
      'There were not enough recent sales inside Diamond Bar Ranch, so we opened to 1 mile.',
      'Prices a square foot in this city have moved down 0.4 percent a month over the last 12 months, across 864 sales.',
      'The range is the spread of all 5 sale prices adjusted for date and size: $372,324 to $398,788.',
      '840 Quince carries the most weight in this price at 28.8 percent.',
    ])
  })

  it('drops a sentence the pricing unit did not write, and never writes one of its own', () => {
    const thin = { ...pricing, timeAdjustment: null, reconciliation: null } as unknown as CmaPricing
    expect(pricingMethodSentences({ pricing: thin })).toEqual([
      'The range is the spread of all 5 sale prices adjusted for date and size: $372,324 to $398,788.',
    ])
    expect(pricingMethodSentences({ pricing: null })).toEqual([])
    expect(renderPricingMethodHtml({ pricing: null })).toBe('')
  })

  it('renders one paragraph per sentence', () => {
    const html = renderPricingMethodHtml({ pricing })
    expect((html.match(/class="method-line"/g) ?? []).length).toBe(3)
  })
})

describe('the weight per sale', () => {
  it('keys the reconciliation weights by listing for the grid', () => {
    const index = compWeightIndex(pricing)
    expect(index.get('K-840')).toEqual({ weight: 28.8, grossAdjustmentPct: 17 })
    expect(index.get('K-730')?.weight).toBe(16.2)
    expect(index.get('nope')).toBeUndefined()
  })

  it('is empty rather than guessed when the row carries no reconciliation', () => {
    expect(compWeightIndex(null).size).toBe(0)
  })
})

describe('considered and not used', () => {
  it('names each sale and what the record says about it', () => {
    const html = renderRejectedSalesHtml(pricing)
    expect(html).toContain('Considered and not used')
    expect(html).toContain('2748 6th')
    expect(html).toContain('0.18 miles NE from your home')
    expect(html).toContain('725 Redwood')
    expect(html).toContain('These 2 sales were looked at and set aside.')
  })

  it('never lists a sale the grid above it just used', () => {
    // 65365 Concorde: the row's rejected list named five of the six sales
    // printed in the grid, so the chapter said "looked at and set aside"
    // under a table that had used them.
    const html = renderRejectedSalesHtml(pricing, [
      { listingKey: 'K-2748', address: '2748 6th' },
    ])
    expect(html).not.toContain('2748 6th')
    expect(html).toContain('725 Redwood')
    expect(html).toContain('This sale was looked at and set aside.')
    // Matched on the address too, for a rejection the row carries no key for.
    expect(renderRejectedSalesHtml(pricing, [{ address: '725 Redwood' }])).not.toContain('725 Redwood')
    expect(
      renderRejectedSalesHtml(pricing, [{ address: '725 Redwood' }, { listingKey: 'K-2748' }]),
    ).toBe('')
  })

  it('omits itself when nothing was set aside', () => {
    expect(renderRejectedSalesHtml({ ...pricing, rejected: [] } as unknown as CmaPricing)).toBe('')
    expect(renderRejectedSalesHtml(null)).toBe('')
    expect(readRejectedSales({ ...pricing, rejected: 'nope' } as unknown as CmaPricing)).toEqual([])
  })
})
