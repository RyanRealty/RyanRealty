import { describe, expect, it } from 'vitest'
import { pricingPage, salesThatSetItPage } from '@/lib/cma/render-pricing-page'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '3480 SW 45th',
  city: 'Redmond',
  subdivision: 'Cascade Vista',
  sqft: 1631,
} as CmaSubject

const seedComp = {
  address: '3344 SW Cascade Vista',
  closePrice: 655000,
  timeAdjustment: 0,
  sizeAdjustment: -23200,
  adjustedPrice: 636000,
} as CmaAdjustedComp

const comps = Array.from({ length: 5 }, (_, i) => ({
  ...seedComp,
  address: i === 0 ? seedComp.address : `${3300 + i} SW Cascade Vista`,
  listingKey: `C${i + 1}`,
  adjustedPrice: seedComp.adjustedPrice + i * 500,
})) as CmaAdjustedComp[]

const pricing = {
  method1Low: 620000,
  method1Mid: 640000,
  method1High: 644000,
  method2: 630000,
  method3: 650000,
  conservative: 639000,
  recommended: 655000,
  highEnd: 669000,
  valueLow: 639000,
  valueHigh: 669000,
  confidence: 'High',
  confidenceReason: 'Seven closed sales in a tight size band.',
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
  sellerNet: null,
  predictedClose: 640000,
} as unknown as CmaPricing

const market = {
  geoLabel: 'Redmond',
  saleToListRatio: 0.989,
} as CmaMarketContext

describe('pricingPage', () => {
  it('leads with one list sentence, then how the matcher works', () => {
    const input = { subject, comps, market, pricing, tiersUsed: ['subdivision-3mo'] }
    const page = pricingPage(input)
    expect(page.toc).toBe('$655,000.')
    // Delta 3 split the chapter: the number and the method here, the sales
    // that prove it in matrix 1. Both are what a reader meets.
    const html = `${page.body}\n${salesThatSetItPage(input)?.body ?? ''}`
    expect(html).toContain('$655,000.')
    // P5, Matt 2026-09-07: the search story is one sentence, not a bulleted
    // heading whose other items restate the table below it.
    expect(html).not.toContain('What we searched')
    expect(html).not.toContain('How we priced this')
    expect(html).not.toContain('Expected close')
    expect(html).toContain('$655,000')
    expect(html).toContain('We stayed inside the Cascade Vista subdivision')
    expect(html).not.toContain('The close is the contract price.')
    expect(html).not.toContain('Automated estimates are not used.')
    expect(html).not.toContain('The market read is Redmond.')
    expect(html).not.toMatch(/not the ZIP/i)
    expect(html).not.toMatch(/Confidence:/)
    expect(html).not.toContain('15 percent')
    expect(html).not.toContain('Cap is')
    expect(html).toContain('across 1,631 square feet')
    // The Sunstone contract keeps predicted close off the seller document, so
    // the per-foot rate is taken over the recommended list — the one number
    // this chapter is titled with — and the sentence names that basis.
    expect(html).not.toContain('$640,000')
    expect(html).toContain('At $655,000 across 1,631 square feet, that is $402 per square foot.')
    // The sale-to-list figure moved to chapter 5 (This market), where the
    // rest of the city's numbers live.
    expect(html).not.toContain('closing at 98.9 percent of list')
    expect(html).not.toContain('Marker key')
    expect(html).toContain('The sales that set this price')
    expect(html).toContain('3344 SW Cascade Vista')
    expect(html).toContain('$636,000')
    expect(html).toContain('Sale price today')
    // ONE statement of the range, off pricing.valueLow/valueHigh — and on this
    // row the list range IS that pair, so the instruction prints without the
    // figures a second time (tasteReview round two, §1 Words).
    expect(html).toContain('The sales support $639,000 to $669,000.')
    expect(html).toContain('List in that range.')
    expect(html).not.toContain('List between $639,000 and $669,000.')
    // The three-stat strip is gone: the number IS the chapter title and the
    // range is the line under it (CMA_REIMAGINED_2026-09-07.md chapter 3).
    expect(html).not.toContain('List low')
    expect(html).not.toContain('List high')
    expect(html).toContain('per square foot')
    expect(html).not.toContain('Expected close $640,000.')
    expect(html).not.toContain('The three checks')
    expect(html).not.toContain('Quick-sale')
    expect(html).not.toContain('Conservative')
    expect(html).not.toMatch(/anchors the recommendation/)
    expect(html).not.toContain('a check against the expected close, not the list')
    expect(html).not.toContain('Method 1 ·')
    expect(html.replace(/&[a-zA-Z]+;/g, '')).not.toMatch(/;/)
  })
})

describe('pricingPage — no "as your house"', () => {
  const land = { streetAddress: '1 Elkwood', city: 'Chiloquin', subdivision: null, sqft: null, lotAcres: 0.69, propertySubType: 'Residential Lots' } as unknown as CmaSubject
  const page = (s: CmaSubject) => pricingPage({ subject: s, comps, market, pricing, tiersUsed: ['subdivision-3mo'] })

  it('does not say as your house', () => {
    expect(page(subject).body).not.toMatch(/as your house/i)
    expect(page(land).body).not.toMatch(/as your house/i)
    expect(page(land).toc).toBe('$655,000.')
  })
})
