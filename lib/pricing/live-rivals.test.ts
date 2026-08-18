import { describe, expect, it } from 'vitest'
import { livePassesUsedRungs, liveRivalSearchLabel, tiersFromUsedNames } from '@/lib/pricing/live-rivals'
import type { PricingSale, PricingSubject } from '@/lib/pricing/match'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '648 Douglas',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Clear Sky Estates',
    subdivisionNorm: 'clear sky estates',
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 1,
    sqft: 1056,
    lotAcres: 0.2,
    yearBuilt: 1978,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    ...over,
  }
}

function sale(over: Partial<PricingSale> = {}): PricingSale {
  return {
    listingKey: over.listingKey ?? 'L1',
    listNumber: null,
    address: over.address ?? '10 Pine',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: over.subdivision ?? 'Other',
    subdivisionNorm: over.subdivisionNorm ?? 'other',
    latitude: over.latitude ?? 44.051,
    longitude: over.longitude ?? -121.301,
    beds: over.beds ?? 3,
    baths: over.baths ?? 2,
    sqft: over.sqft ?? 1100,
    lotAcres: 0.18,
    yearBuilt: 1978,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 449000,
    closeDate: '1970-01-01',
    concessionsAmount: null,
    concessionsYn: null,
    originalAsk: 449000,
    lastAsk: 449000,
    daysToOffer: null,
    cdom: null,
    dropCount: 0,
    closePpsf: 408,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

describe('livePassesUsedRungs', () => {
  const asOf = '2026-08-17'
  const cells = new Map()

  it('keeps a 3/2 inside the 2-mile rung that priced the house, drops a 5-mile house', () => {
    const tiers = tiersFromUsedNames(['subdivision-3mo', 'nearby-2mi-3mo'])
    const near = sale({ listingKey: 'NEAR', baths: 2, sqft: 1100 })
    const far = sale({
      listingKey: 'FAR',
      address: '1 Distant',
      latitude: 44.12,
      longitude: -121.26,
      baths: 1,
      sqft: 1050,
    })
    expect(livePassesUsedRungs(subject(), near, tiers, asOf, cells)).toBe(true)
    expect(livePassesUsedRungs(subject(), far, tiers, asOf, cells)).toBe(false)
  })

  it('does not invent a search when pricing used no rungs', () => {
    expect(livePassesUsedRungs(subject(), sale(), [], '2026-08-17', new Map())).toBe(false)
  })
})

describe('liveRivalSearchLabel', () => {
  it('names the same search the priced set used', () => {
    expect(liveRivalSearchLabel('Clear Sky Estates', ['nearby-2mi-3mo'])).toMatch(/2-mile search/)
    expect(liveRivalSearchLabel('Clear Sky Estates', ['subdivision-3mo'])).toMatch(/Clear Sky Estates/)
  })
})
