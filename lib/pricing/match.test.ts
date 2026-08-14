import { describe, expect, it } from 'vitest'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt: 1998,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    ...over,
  }
}

function sale(over: Partial<PricingSale> = {}): PricingSale {
  return {
    listingKey: over.listingKey ?? `K${Math.random().toString(16).slice(2)}`,
    listNumber: null,
    address: over.address ?? '9 Comp St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.061,
    longitude: -121.321,
    beds: 3,
    baths: 2,
    sqft: 1980,
    lotAcres: 0.18,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 700_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 725_000,
    lastAsk: 710_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 353.5,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

const asOf = '2026-08-01'

describe('walkPricingLadder', () => {
  it('takes same-subdivision 3-month sales before it reaches for distance', () => {
    const pool = [
      sale({ listingKey: 'RECENT', closeDate: '2026-06-15', address: '10 Kenwood' }),
      sale({
        listingKey: 'FAR',
        closeDate: '2026-06-10',
        subdivision: 'Stone Creek',
        subdivisionNorm: 'stone creek',
        latitude: 44.1,
        longitude: -121.2,
        address: '1 Stone',
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['RECENT'])
    expect(out.tiersUsed[0]).toBe('subdivision-3mo')
  })

  it('widens to 6 months in the same subdivision before leaving it', () => {
    const pool = [
      sale({ listingKey: 'OLDER', closeDate: '2026-03-01', address: '11 Kenwood' }),
      sale({
        listingKey: 'NEAR_OTHER',
        closeDate: '2026-07-01',
        subdivision: 'Aubrey',
        subdivisionNorm: 'aubrey',
        address: '2 Aubrey',
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('OLDER')
    expect(out.tiersUsed[0]).toBe('subdivision-6mo')
  })

  it('never mixes a well house with city water when both are known', () => {
    const pool = [
      sale({ listingKey: 'WELL', waterClass: 'well', closeDate: '2026-07-01' }),
      sale({ listingKey: 'CITY', waterClass: 'public', closeDate: '2026-07-02', address: '12 Kenwood' }),
    ]
    const out = walkPricingLadder(subject({ waterClass: 'well' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['WELL'])
  })

  it('never mixes acreage with an in-town lot', () => {
    const pool = [sale({ listingKey: 'TOWN', lotAcres: 0.2, address: '13 Kenwood' })]
    const out = walkPricingLadder(subject({ lotAcres: 2.4, lotClass: 'acreage', ruralAcreage: true }), pool, { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('drops a much more expensive subdivision once the similar-sub rungs run', () => {
    const cells = new Map([
      ['bend:kenwood', { medianPpsf: 400, n: 20 }],
      ['bend:tetherow', { medianPpsf: 749, n: 48 }],
    ])
    const pool = [
      sale({
        listingKey: 'TETH',
        subdivision: 'Tetherow',
        subdivisionNorm: 'tetherow',
        closeDate: '2026-07-01',
        closePpsf: 750,
        address: '1 Tetherow',
        latitude: 44.05,
        longitude: -121.36,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf, cells })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TETH')
  })

  it('does not look ahead of the as-of date', () => {
    const pool = [sale({ listingKey: 'FUTURE', closeDate: '2026-08-15' })]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('skips the subject listing and the same street address', () => {
    const pool = [
      sale({ listingKey: 'SUBJ', address: '99 Other' }),
      sale({ listingKey: 'SAME_ADDR', address: '1 Test St' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('stops at three same-subdivision apples and does not dilute with a 1-mile sale', () => {
    const pool = [
      sale({ listingKey: 'A', closeDate: '2026-07-01', address: '10 Kenwood' }),
      sale({ listingKey: 'B', closeDate: '2026-06-20', address: '11 Kenwood' }),
      sale({ listingKey: 'C', closeDate: '2026-06-10', address: '12 Kenwood' }),
      sale({
        listingKey: 'FAR',
        closeDate: '2026-07-15',
        subdivision: 'Aubrey',
        subdivisionNorm: 'aubrey',
        address: '2 Aubrey',
        latitude: 44.07,
        longitude: -121.33,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B', 'C'])
    expect(out.tiersUsed).toEqual(['subdivision-3mo'])
  })
})
