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
  it('leads with the number, then how the matcher works, then the tiers', () => {
    const page = pricingPage({
      subject,
      comps,
      market,
      pricing,
      tiersUsed: ['subdivision-3mo'],
    })
    expect(page.toc).toBe('How this home is priced')
    const html = page.body
    expect(html).toContain('How this home is priced')
    expect(html).toContain('How we priced this')
    expect(html).toContain('Expected sale')
    expect(html).toContain('$640,000')
    expect(html).toContain('$655,000')
    expect(html).toContain('We stayed inside the Cascade Vista subdivision')
    expect(html).toContain('The close is the contract price.')
    expect(html).toContain('Closed MLS sales only. Automated estimates are not used.')
    expect(html).toContain('The market read is Redmond.')
    expect(html).not.toMatch(/not the ZIP/i)
    expect(html).not.toMatch(/Confidence:/)
    expect(html).toContain('15 percent')
    expect(html).toContain('30 percent')
    expect(html).toContain('98.9 percent of list')
    expect(html).toContain('What each sale becomes on your house')
    expect(html).toContain('3344 SW Cascade Vista')
    expect(html).toContain('$636,000')
    expect(html).toContain('Recommended list')
    expect(html).toContain('The three checks')
    expect(html).not.toContain('Method 1 ·')
    expect(html.replace(/&[a-zA-Z]+;/g, '')).not.toMatch(/[—;]/)
  })
})
