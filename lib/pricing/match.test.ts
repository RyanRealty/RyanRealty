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
    marketArea: null,
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

  it('drops a close that is a data bug against its own last ask', () => {
    const pool = [
      sale({
        listingKey: 'BUG',
        closePrice: 1_625,
        lastAsk: 1_680_000,
        closePpsf: 0.58,
        address: '56302 Sable Rock',
      }),
      sale({ listingKey: 'REAL', closePrice: 1_795_000, lastAsk: 1_795_000, address: '56155 Sable Rock' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['REAL'])
  })

  it('does not mix Boyd Acres with Awbrey Butte once the search leaves the subdivision', () => {
    const pool = [
      sale({
        listingKey: 'AWBREY',
        subdivision: 'Awbrey Village',
        subdivisionNorm: 'awbrey village',
        latitude: 44.081947,
        longitude: -121.331962,
        address: '1 Awbrey',
        closeDate: '2026-07-01',
      }),
    ]
    const out = walkPricingLadder(
      subject({
        subdivision: 'Ponderous Pines',
        subdivisionNorm: 'ponderous pines',
        latitude: 44.099742,
        longitude: -121.291434,
        marketArea: 'bend-boyd-acres',
      }),
      pool,
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).not.toContain('AWBREY')
  })

  it('does not price a 2005 resale off a 2026 new-construction sale', () => {
    const pool = [
      sale({ listingKey: 'NEW', yearBuilt: 2026, address: '1 New Kenwood', closeDate: '2026-07-01' }),
      sale({ listingKey: 'RESALE', yearBuilt: 2005, address: '12 Kenwood', closeDate: '2026-06-01' }),
    ]
    const out = walkPricingLadder(subject({ yearBuilt: 2005 }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['RESALE'])
  })

  it('widens same-subdivision GLA before it opens a mile ring', () => {
    const pool = [
      sale({
        listingKey: 'SAME_STREET',
        sqft: 1927,
        address: '21435 Hayloft',
        closeDate: '2026-07-01',
      }),
      sale({
        listingKey: 'NEXT_TRACT',
        sqft: 2500,
        subdivision: 'Petrosa',
        subdivisionNorm: 'petrosa',
        address: '3043 Brownstone',
        latitude: 44.081947,
        longitude: -121.331962,
        closeDate: '2026-07-15',
      }),
    ]
    const out = walkPricingLadder(subject({ sqft: 2500, streetAddress: '21451 Hayloft' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['SAME_STREET'])
    expect(out.tiersUsed[0]).toBe('subdivision-3mo-wide')
  })

  it('does not stop a rural subject on the city-5mi rung', () => {
    const pool = [
      sale({
        listingKey: 'CITY',
        subdivision: 'Other',
        subdivisionNorm: 'other',
        latitude: 44.06,
        longitude: -121.32,
        address: '1 City',
        closeDate: '2026-07-01',
        lotAcres: 5,
      }),
      sale({
        listingKey: 'RURAL',
        subdivision: 'Ranch',
        subdivisionNorm: 'ranch',
        city: 'Tumalo',
        citySlug: 'tumalo',
        latitude: 44.15,
        longitude: -121.33,
        address: '1 Ranch',
        closeDate: '2026-06-01',
        lotAcres: 8,
      }),
    ]
    const out = walkPricingLadder(
      subject({
        lotAcres: 6.73,
        lotClass: 'ranch',
        ruralAcreage: true,
        subdivision: null,
        subdivisionNorm: null,
        latitude: 44.12,
        longitude: -121.34,
      }),
      pool,
      { asOf },
    )
    expect(out.tiersUsed.some((t) => t.startsWith('rural-'))).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).toContain('RURAL')
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

  it('does not treat three wide-GLA same-subdivision sales as a quality stop', () => {
    const pool = [
      sale({ listingKey: 'W1', sqft: 1927, address: '10 Kenwood', closeDate: '2026-07-01' }),
      sale({ listingKey: 'W2', sqft: 1910, address: '11 Kenwood', closeDate: '2026-06-20' }),
      sale({ listingKey: 'W3', sqft: 1940, address: '12 Kenwood', closeDate: '2026-06-10' }),
      sale({
        listingKey: 'NEAR',
        sqft: 2480,
        subdivision: 'Aubrey',
        subdivisionNorm: 'aubrey',
        address: '2 Aubrey',
        latitude: 44.0604,
        longitude: -121.3204,
        marketArea: 'bend-old-bend',
        closeDate: '2026-07-15',
      }),
    ]
    const out = walkPricingLadder(subject({ sqft: 2500, marketArea: 'bend-old-bend' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('NEAR')
    expect(out.tiersUsed.some((t) => t.endsWith('-wide'))).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-'))).toBe(true)
  })

  it('does not let a sale with no coordinates pass a mile ring', () => {
    const pool = [
      sale({
        listingKey: 'NO_GEO',
        subdivision: 'Aubrey',
        subdivisionNorm: 'aubrey',
        address: '2 Aubrey',
        latitude: null,
        longitude: null,
        closeDate: '2026-07-01',
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('NO_GEO')
  })

  it('does not price Awbrey Butte custom off Awbrey Woods tract in the same polygon', () => {
    const cells = new Map([
      ['bend:awbrey butte', { medianPpsf: 457.29, n: 86 }],
      ['bend:awbrey woods', { medianPpsf: 381.85, n: 7 }],
    ])
    const pool = [
      sale({
        listingKey: 'DEBRON',
        subdivision: 'Awbrey Woods',
        subdivisionNorm: 'awbrey woods',
        address: '20366 Debron',
        latitude: 44.081947,
        longitude: -121.331962,
        marketArea: 'bend-awbrey-butte',
        closeDate: '2026-07-01',
        closePpsf: 382,
      }),
    ]
    const out = walkPricingLadder(
      subject({
        subdivision: 'Awbrey Butte',
        subdivisionNorm: 'awbrey butte',
        latitude: 44.081947,
        longitude: -121.331962,
        marketArea: 'bend-awbrey-butte',
      }),
      pool,
      { asOf, cells },
    )
    expect(out.comps.map((c) => c.listingKey)).not.toContain('DEBRON')
  })

  it('does not mix a mapped Bend neighborhood with an unmapped Highway 20 sale', () => {
    const pool = [
      sale({
        listingKey: 'HWY20',
        subdivision: 'Deschutes River Woods',
        subdivisionNorm: 'deschutes river woods',
        address: '1 Highway 20',
        latitude: 44.12,
        longitude: -121.26,
        closeDate: '2026-07-01',
      }),
    ]
    const out = walkPricingLadder(
      subject({
        subdivision: 'Ponderous Pines',
        subdivisionNorm: 'ponderous pines',
        latitude: 44.099742,
        longitude: -121.291434,
        marketArea: 'bend-boyd-acres',
      }),
      pool,
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).not.toContain('HWY20')
  })
})
