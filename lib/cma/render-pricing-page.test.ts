import { describe, expect, it } from 'vitest'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '3480 SW 45th',
  city: 'Redmond',
  subdivision: 'Cascade Vista',
  sqft: 1631,
} as CmaSubject

const comps = [
  {
    address: '3344 SW Cascade Vista',
    closePrice: 655000,
    timeAdjustment: 0,
    sizeAdjustment: -23200,
    adjustedPrice: 636000,
  },
] as CmaAdjustedComp[]

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
    const page = pricingPage({
      subject,
      comps,
      market,
      pricing,
      tiersUsed: ['subdivision-3mo'],
    })
    expect(page.toc).toBe('How we got the price')
    const html = page.body
    expect(html).toContain('How we got the price')
    expect(html).toContain('What we searched')
    expect(html).not.toContain('How we priced this')
    expect(html).not.toContain('Expected close')
    expect(html).toContain('$655,000')
    expect(html).toContain('We stayed inside the Cascade Vista subdivision')
    expect(html).not.toContain('The close is the contract price.')
    expect(html).toContain('Closed MLS sales only. Automated estimates are not used.')
    expect(html).toContain('The market read is Redmond.')
    expect(html).not.toMatch(/not the ZIP/i)
    expect(html).not.toMatch(/Confidence:/)
    expect(html).toContain('15 percent')
    expect(html).toContain('30 percent')
    expect(html).toContain('1,631 sq ft')
    expect(html).toContain('$640,000')
    expect(html).toContain('$392 per square foot')
    expect(html).toContain('At 98.9 percent of list that is $655,000')
    expect(html).not.toContain('Marker key')
    expect(html).toContain('The sales that set the list')
    expect(html).toContain('3344 SW Cascade Vista')
    expect(html).toContain('$636,000')
    expect(html).toContain('Adjusted close')
    expect(html).toContain('Recommended list')
    expect(html).toContain('List low')
    expect(html).toContain('List high')
    expect(html).toContain('List $639,000 to $669,000. Recommended list $655,000')
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
    expect(page(land).toc).toBe('How we got the price')
  })
})
