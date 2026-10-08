import { describe, expect, it } from 'vitest'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const SENTENCE =
  'This home is basically a new home, but it is competing with brand-new homes that have had no previous owner, at that same price point, so it will likely sell for less.'

const pricing = {
  method1Low: 640000,
  method1Mid: 652000,
  method1High: 660000,
  method2: 650000,
  method3: 655000,
  conservative: 645000,
  recommended: 650000,
  highEnd: 660000,
  valueLow: 645000,
  valueHigh: 660000,
  confidence: 'High',
  confidenceReason: 'Closed sales in Petrosa.',
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
  sellerNet: null,
  predictedClose: 650000,
} as unknown as CmaPricing

const market = { geoLabel: 'Bend', saleToListRatio: 0.99 } as CmaMarketContext

function comp(over: Partial<CmaAdjustedComp>): CmaAdjustedComp {
  return {
    listingKey: 'k',
    address: '1 Test',
    city: 'Bend',
    subdivision: 'Petrosa',
    sqft: 2000,
    yearBuilt: 2022,
    newConstructionYn: false,
    closePrice: 650000,
    closeDate: '2026-06-01',
    timeAdjustment: 0,
    sizeAdjustment: 0,
    adjustedPrice: 650000,
    weight: 1,
    monthsSinceClose: 2,
    timeAdjustedPrice: 650000,
    ppsfTimeAdjusted: 325,
    ...over,
  } as CmaAdjustedComp
}

describe('seller letter for a Petrosa-shaped resale', () => {
  const subject = {
    streetAddress: '3722 NE Petrosa',
    city: 'Bend',
    subdivision: 'Petrosa',
    sqft: 2000,
    yearBuilt: 2021,
    newConstructionYn: false,
    propertySubType: 'Single Family Residence',
    standardStatus: 'Expired',
  } as CmaSubject

  const comps = [
    comp({
      listingKey: 'tellus-2026',
      address: '3847 Tellus',
      yearBuilt: 2026,
      newConstructionYn: true,
      closePrice: 659900,
    }),
    comp({
      listingKey: 'oakside-2025',
      address: '3903 Oakside',
      yearBuilt: 2025,
      newConstructionYn: true,
      closePrice: 649900,
    }),
    comp({
      listingKey: 'tellus-2022',
      address: '3759 Tellus',
      yearBuilt: 2022,
      newConstructionYn: false,
      closePrice: 659000,
    }),
    comp({
      listingKey: 'tellus-2024',
      address: '3831 Tellus',
      yearBuilt: 2024,
      newConstructionYn: false,
      closePrice: 645000,
    }),
  ]

  it('prints the never-owned note in the letter and names the new homes in the set', () => {
    const page = pricingPage({
      subject,
      comps,
      market,
      pricing,
      tiersUsed: ['subdivision-3mo'],
      asOfIso: '2026-08-01',
    })
    expect(page.body).toContain(SENTENCE)
    const start = page.body.indexOf(SENTENCE)
    const note = page.body.slice(start, page.body.indexOf('</p>', start))
    expect(note).toContain('3847 Tellus')
    expect(note).toContain('3903 Oakside')
    expect(note).not.toContain('3759 Tellus')
    expect(note).not.toContain('3831 Tellus')
    expect(note).not.toMatch(/\$\d/)
  })

  it('does not print that note for a resale past the waiting period', () => {
    const page = pricingPage({
      subject: { ...subject, yearBuilt: 2017 },
      comps,
      market,
      pricing,
      tiersUsed: ['subdivision-3mo'],
      asOfIso: '2026-08-01',
    })
    expect(page.body).not.toContain(SENTENCE)
    expect(page.body).not.toContain('no previous owner')
  })
})
