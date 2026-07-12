import { describe, expect, it } from 'vitest'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps } from '@/lib/cma/judge'
import { parseCmaAddress } from '@/lib/cma/subject'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '220000001',
    streetAddress: '123 Test Ln',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.25,
    yearBuilt: 2005,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 700000,
    lastListDate: null,
    listingHistoryLine: null,
    ...overrides,
  }
}

function comp(overrides: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: `K${Math.random()}`,
    mlsNumber: null,
    address: '1 Comp St',
    city: 'Bend',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.25,
    yearBuilt: 2004,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 710000,
    closePrice: 700000,
    closeDate: new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10),
    daysToOffer: 10,
    domTotal: 40,
    selectionTier: 'city-12mo',
    ...overrides,
  }
}

const market: CmaMarketContext = {
  geoSlug: 'bend',
  geoLabel: 'Bend',
  periodStart: '2025-07-07',
  periodEnd: '2026-07-07',
  soldCount365: 1200,
  medianSalePrice: 725000,
  medianDom: 25,
  medianPpsf: 380,
  saleToListRatio: 0.96,
  yoyMedianPriceDeltaPct: 6,
  activeCount: 400,
  pendingCount: 100,
  monthsOfSupply: 4,
  mosFormula: 'market_pulse_live.months_of_supply (canonical: active / (closed_last_6_months / 6))',
  marketVerdict: 'balanced',
  methodologyVersion: 'v3',
  computedAt: new Date().toISOString(),
  pulseUpdatedAt: new Date().toISOString(),
}

describe('adjustComps', () => {
  it('applies the market-conditions time adjustment from the verified YoY rate', () => {
    const closed12moAgo = new Date(Date.now() - 365.25 * 86_400_000).toISOString().slice(0, 10)
    const [adj] = adjustComps(subject(), [comp({ closeDate: closed12moAgo, closePrice: 700000 })], market)
    // 12 months old at +6% YoY: adjustment near 700000 * 0.06 = 42000.
    expect(adj!.timeAdjustment).toBeGreaterThan(38000)
    expect(adj!.timeAdjustment).toBeLessThan(46000)
    expect(adj!.timeAdjustedPrice).toBe(adj!.closePrice + adj!.timeAdjustment)
  })

  it('applies no time adjustment when no verified YoY rate exists', () => {
    const [adj] = adjustComps(subject(), [comp()], null)
    expect(adj!.timeAdjustment).toBe(0)
  })

  it('size-adjusts at half the adjusted $/sqft rate', () => {
    const [adj] = adjustComps(subject({ sqft: 2200 }), [comp({ sqft: 2000, closePrice: 700000 })], null)
    // (2200-2000) * (700000/2000) * 0.5 = 35000
    expect(adj!.sizeAdjustment).toBe(35000)
    expect(adj!.adjustedPrice).toBe(735000)
  })
})

describe('computePricing', () => {
  const comps = [
    comp({ closePrice: 690000, sqft: 1950 }),
    comp({ closePrice: 700000, sqft: 2000 }),
    comp({ closePrice: 710000, sqft: 2050 }),
    comp({ closePrice: 720000, sqft: 2100 }),
    comp({ closePrice: 680000, sqft: 1900 }),
  ]

  it('converges the three methods on a tight comp set', () => {
    const adjusted = adjustComps(subject(), comps, market)
    const pricing = computePricing(subject(), adjusted, market)
    expect(pricing).not.toBeNull()
    expect(pricing!.converged).toBe(true)
    expect(pricing!.recommended).toBeGreaterThan(650000)
    expect(pricing!.recommended).toBeLessThan(800000)
    expect(pricing!.conservative).toBeLessThanOrEqual(pricing!.recommended)
    expect(pricing!.highEnd).toBeGreaterThanOrEqual(pricing!.recommended)
    expect(pricing!.recommended % 5000).toBe(0)
  })

  it('re-anchors the tier grid on a broker price override', () => {
    const adjusted = adjustComps(subject(), comps, market)
    const pricing = computePricing(subject(), adjusted, market, { priceOverride: 750000 })
    expect(pricing!.recommended).toBe(750000)
    expect(pricing!.priceOverride).toBe(750000)
    expect(pricing!.conservative).toBeLessThanOrEqual(750000)
    expect(pricing!.highEnd).toBeGreaterThanOrEqual(750000)
  })

  it('pulls the high end in on a buyer market', () => {
    const buyerMarket: CmaMarketContext = { ...market, monthsOfSupply: 7.2, marketVerdict: 'buyer' }
    const adjusted = adjustComps(subject(), comps, buyerMarket)
    const pricing = computePricing(subject(), adjusted, buyerMarket)
    expect(pricing!.highEnd).toBeLessThanOrEqual(Math.round((pricing!.recommended * 1.04) / 5000) * 5000)
  })

  it('returns null with no comps or no sqft', () => {
    expect(computePricing(subject({ sqft: null }), [], market)).toBeNull()
  })

  it('does not flag a tight comp set for review', () => {
    const adjusted = adjustComps(subject(), comps, market)
    const pricing = computePricing(subject(), adjusted, market)
    expect(pricing!.needsReview).toBe(false)
    expect(pricing!.compPpsfCv).toBeLessThan(0.18)
  })

  it('flags a heterogeneous comp set for broker review and floors confidence', () => {
    // Same sqft as the subject (so no size adjustment), null market (no time
    // adjustment) — the only signal is the raw $/sqft spread: $230 to $412.
    const wide = [
      comp({ closePrice: 460000, sqft: 2000 }),
      comp({ closePrice: 530000, sqft: 2000 }),
      comp({ closePrice: 610000, sqft: 2000 }),
      comp({ closePrice: 710000, sqft: 2000 }),
      comp({ closePrice: 775000, sqft: 2000 }),
      comp({ closePrice: 825000, sqft: 2000 }),
    ]
    const adjusted = adjustComps(subject({ sqft: 2000 }), wide, null)
    const pricing = computePricing(subject({ sqft: 2000 }), adjusted, null)
    expect(pricing!.needsReview).toBe(true)
    expect(pricing!.confidence).toBe('Supportable')
    expect(pricing!.reviewReason).toBeTruthy()
    expect(pricing!.compPpsfCv).toBeGreaterThan(0.18)
  })
})

describe('judgeComps (fail-open contract)', () => {
  it('returns null when ANTHROPIC_API_KEY is absent, so a build never blocks', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const result = await judgeComps(subject(), [comp(), comp(), comp()], market)
      expect(result).toBeNull()
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
    }
  })

  it('returns null with an empty comp set', async () => {
    expect(await judgeComps(subject(), [], market)).toBeNull()
  })
})

describe('parseCmaAddress', () => {
  it('parses street number, name tokens, city, and zip', () => {
    const parsed = parseCmaAddress('16111 Lava, La Pine, OR 97739')
    expect(parsed).not.toBeNull()
    expect(parsed!.streetNumber).toBe('16111')
    expect(parsed!.streetNameTokens).toEqual(['lava'])
    expect(parsed!.city).toBe('La Pine')
    expect(parsed!.postalCode).toBe('97739')
  })

  it('drops trailing street suffixes for matchability', () => {
    const parsed = parseCmaAddress('21042 Robin Ave, Bend, OR 97703')
    expect(parsed!.streetNameTokens).toEqual(['robin'])
  })

  it('rejects text without a leading street number', () => {
    expect(parseCmaAddress('Arid Ave, Oregon 97703, USA')).toBeNull()
  })
})
