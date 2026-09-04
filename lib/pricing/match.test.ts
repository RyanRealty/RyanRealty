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

  it('never prices a one-bath house from a two-bath sale', () => {
    const pool = [
      sale({ listingKey: 'TWO', baths: 2, address: '14 Kenwood' }),
      sale({ listingKey: 'ONE', baths: 1, address: '15 Kenwood' }),
    ]
    const out = walkPricingLadder(subject({ baths: 1 }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['ONE'])
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

  it('does not stop at three same-subdivision sales; a fourth same-sub sale still enters until 8', () => {
    const pool = [
      sale({ listingKey: 'A', closeDate: '2026-07-01', address: '10 Kenwood' }),
      sale({ listingKey: 'B', closeDate: '2026-06-20', address: '11 Kenwood' }),
      sale({ listingKey: 'C', closeDate: '2026-06-10', address: '12 Kenwood' }),
      sale({ listingKey: 'D', closeDate: '2026-03-01', address: '13 Kenwood' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(out.comps).toHaveLength(4)
  })

  it('excludes a townhouse sale for a detached SFR subject', () => {
    const pool = [
      sale({ listingKey: 'TOWN', productClass: 'townhouse', address: '10 Kenwood' }),
      sale({ listingKey: 'SFR', productClass: 'detached', address: '11 Kenwood' }),
    ]
    const out = walkPricingLadder(subject({ productClass: 'detached' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['SFR'])
  })

  it('excludes a Larkspur sale for an Awbrey Butte subject (Parkway / US-97)', () => {
    const pool = [
      sale({
        listingKey: 'LARK',
        address: '10 Larkspur',
        marketArea: 'bend-larkspur',
      }),
      sale({
        listingKey: 'AWBREY',
        address: '11 Awbrey',
        marketArea: 'bend-awbrey-butte',
      }),
    ]
    const out = walkPricingLadder(subject({ marketArea: 'bend-awbrey-butte' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['AWBREY'])
  })

  it('excludes an Old Bend sale for a River West subject (Deschutes)', () => {
    const pool = [
      sale({
        listingKey: 'OLD',
        address: '10 Old Bend',
        marketArea: 'bend-old-bend',
      }),
      sale({
        listingKey: 'RIVER',
        address: '11 River West',
        marketArea: 'bend-river-west',
      }),
    ]
    const out = walkPricingLadder(subject({ marketArea: 'bend-river-west' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['RIVER'])
  })

  it('excludes RS vs RM when both zoning strings are set', () => {
    const pool = [
      sale({ listingKey: 'RM', address: '10 Kenwood', zoning: 'RM' }),
      sale({ listingKey: 'RS', address: '11 Kenwood', zoning: ' rs ' }),
    ]
    const out = walkPricingLadder(subject({ zoning: 'RS' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['RS'])
  })

  it('allows a sale when either zoning is missing', () => {
    const pool = [
      sale({ listingKey: 'NONE', address: '10 Kenwood', zoning: null }),
      sale({ listingKey: 'BLANK', address: '11 Kenwood', zoning: '  ' }),
    ]
    const out = walkPricingLadder(subject({ zoning: 'RS' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['BLANK', 'NONE'])
  })

  it('allows same-side Awbrey Butte and River West sales', () => {
    const pool = [
      sale({
        listingKey: 'RIVER',
        address: '11 River West',
        marketArea: 'bend-river-west',
      }),
    ]
    const out = walkPricingLadder(subject({ marketArea: 'bend-awbrey-butte' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['RIVER'])
  })

  it('excludes a condo sale for a townhouse subject', () => {
    const pool = [
      sale({ listingKey: 'CONDO', productClass: 'condo', address: '10 Kenwood' }),
      sale({ listingKey: 'TOWN', productClass: 'townhouse', address: '11 Kenwood' }),
    ]
    const out = walkPricingLadder(subject({ productClass: 'townhouse' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['TOWN'])
  })

  it('pulls in one smaller sale when every selected comp is larger', () => {
    const larger = Array.from({ length: 8 }, (_, i) =>
      sale({
        listingKey: `BIG${i}`,
        address: `${10 + i} Kenwood`,
        closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
        sqft: 2200,
      }),
    )
    const smaller = sale({
      listingKey: 'SMALL',
      address: '40 Kenwood',
      closeDate: '2026-06-15',
      sqft: 1600,
    })
    const out = walkPricingLadder(subject({ sqft: 2000 }), [...larger, smaller], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('SMALL')
    expect(out.comps.some((c) => c.sqft > 2000)).toBe(true)
    expect(out.comps.filter((c) => c.listingKey.startsWith('BIG'))).toHaveLength(7)
  })

  it('never keeps more than 10 priced sales', () => {
    const pool = Array.from({ length: 12 }, (_, i) =>
      sale({
        listingKey: `N${i}`,
        address: `${10 + i} Kenwood`,
        closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
      }),
    )
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(10)
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

  it('keeps Pronghorn comps inside Pronghorn and Caldera comps inside Caldera Springs', () => {
    const pronghorn = walkPricingLadder(
      subject({ subdivision: 'Pronghorn', subdivisionNorm: 'pronghorn' }),
      [
        sale({ listingKey: 'PRONG', subdivision: 'Pronghorn', subdivisionNorm: 'pronghorn', address: '1 Pronghorn' }),
        sale({ listingKey: 'TOWN', subdivision: 'Kenwood', subdivisionNorm: 'kenwood', address: '2 Kenwood' }),
      ],
      { asOf },
    )
    expect(pronghorn.comps.map((c) => c.listingKey)).toEqual(['PRONG'])

    const caldera = walkPricingLadder(
      subject({
        subdivision: 'Caldera Springs',
        subdivisionNorm: 'caldera springs',
        city: 'Sunriver',
        citySlug: 'sunriver',
      }),
      [
        sale({
          listingKey: 'CALD',
          subdivision: 'Caldera Springs',
          subdivisionNorm: 'caldera springs',
          city: 'Sunriver',
          citySlug: 'sunriver',
          address: '1 Caldera',
        }),
        sale({
          listingKey: 'PLAIN',
          subdivision: 'Deschutes River Recreation Homesites',
          subdivisionNorm: 'deschutes river recreation homesites',
          city: 'Sunriver',
          citySlug: 'sunriver',
          address: '2 Homesites',
        }),
      ],
      { asOf },
    )
    expect(caldera.comps.map((c) => c.listingKey)).toEqual(['CALD'])
  })

  it('does not keep a dry acreage sale for an irrigated subject', () => {
    const pool = [
      sale({
        listingKey: 'DRY',
        address: '10 Dry Acre',
        lotAcres: 10,
        publicRemarks: 'Dry lot. No irrigation. No water rights.',
      }),
      sale({
        listingKey: 'WET',
        address: '11 Irrigated',
        lotAcres: 12,
        publicRemarks: 'Irrigated pasture with water rights.',
      }),
    ]
    const out = walkPricingLadder(
      subject({
        lotAcres: 10,
        lotClass: 'ranch',
        ruralAcreage: true,
        publicRemarks: 'Irrigated hay ground.',
        irrigationClass: 'irrigated',
      }),
      pool,
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).toEqual(['WET'])
  })

  it('does not keep the Rim View 1977–2000 set for a 2024 custom subject', () => {
    const oldStock = [
      sale({
        listingKey: 'SUMMIT',
        address: '1627 Summit',
        beds: 4,
        baths: 4,
        yearBuilt: 1990,
        subdivision: 'Awbrey Butte',
        subdivisionNorm: 'awbrey butte',
        sqft: 3866,
        lotAcres: 1.01,
        closePrice: 1_600_000,
        lastAsk: 1_600_000,
        marketArea: 'bend-awbrey-butte',
      }),
      sale({
        listingKey: 'FALCON',
        address: '3645 Falcon Ridge',
        beds: 3,
        baths: 3,
        yearBuilt: 1999,
        subdivision: 'Wyndemere',
        subdivisionNorm: 'wyndemere',
        sqft: 3274,
        lotAcres: 1.12,
        closePrice: 1_245_000,
        lastAsk: 1_245_000,
        marketArea: 'bend-awbrey-butte',
      }),
      sale({
        listingKey: 'HOPPER',
        address: '65057 Hopper',
        beds: 5,
        baths: 5,
        yearBuilt: 1977,
        subdivision: 'Rockwood',
        subdivisionNorm: 'rockwood',
        sqft: 4011,
        lotAcres: 1.42,
        closePrice: 1_275_000,
        lastAsk: 1_275_000,
        marketArea: null,
      }),
      sale({
        listingKey: 'HUNNELL',
        address: '64835 Hunnell',
        beds: 4,
        baths: 4,
        yearBuilt: 1980,
        subdivision: null,
        subdivisionNorm: null,
        sqft: 4382,
        lotAcres: 2.82,
        publicRemarks: 'Irrigated horse property with a barn.',
        closePrice: 1_800_000,
        lastAsk: 1_800_000,
        marketArea: null,
      }),
      sale({
        listingKey: 'WILD_RYE_2006',
        address: '1838 NW Wild Rye',
        beds: 4,
        baths: 4,
        yearBuilt: 2006,
        subdivision: 'Bend North Rim',
        subdivisionNorm: 'bend north rim',
        sqft: 3515,
        lotAcres: 1.15,
        closePrice: 2_973_000,
        lastAsk: 2_973_000,
        marketArea: 'bend-awbrey-butte',
        latitude: 44.090024,
        longitude: -121.337082,
      }),
      sale({
        listingKey: 'FAREWELL_2000',
        address: '1748 NW Farewell',
        beds: 6,
        baths: 6,
        yearBuilt: 2000,
        subdivision: 'Awbrey Butte',
        subdivisionNorm: 'awbrey butte',
        sqft: 4549,
        lotAcres: 1.13,
        closePrice: 2_375_000,
        lastAsk: 2_375_000,
        marketArea: 'bend-awbrey-butte',
      }),
      sale({
        listingKey: 'OKANE_1996',
        address: '1742 NW Okane',
        beds: 4,
        baths: 4,
        yearBuilt: 1996,
        subdivision: 'Awbrey Butte',
        subdivisionNorm: 'awbrey butte',
        sqft: 3723,
        lotAcres: 1.01,
        closePrice: 2_100_000,
        lastAsk: 2_100_000,
        marketArea: 'bend-awbrey-butte',
      }),
    ]
    // Live starve: Rim View is outside Bend GIS (null mesh) while same-gen
    // North Rim peers resolve into Awbrey Butte. Perspective is 3 baths.
    const perspective = sale({
      listingKey: 'PERSPECTIVE',
      address: '2060 NW Perspective Dr',
      beds: 4,
      baths: 3,
      yearBuilt: 2023,
      subdivision: 'Bend North Rim',
      subdivisionNorm: 'bend north rim',
      sqft: 3963,
      lotAcres: 1.19,
      publicRemarks: 'Custom built modern home.',
      closePrice: 3_300_000,
      lastAsk: 3_300_000,
      closePpsf: 833,
      latitude: 44.086736,
      longitude: -121.342439,
      marketArea: 'bend-awbrey-butte',
      closeDate: '2025-07-31',
    })
    const greenleaf = sale({
      listingKey: 'GREENLEAF',
      address: '3481 Greenleaf',
      beds: 4,
      baths: 4,
      yearBuilt: 2020,
      subdivision: 'Bend North Rim',
      subdivisionNorm: 'bend north rim',
      sqft: 4515,
      lotAcres: 1,
      publicRemarks: 'Custom built home.',
      closePrice: 3_740_000,
      lastAsk: 3_740_000,
      closePpsf: 828,
      latitude: 44.091874,
      longitude: -121.336916,
      marketArea: 'bend-awbrey-butte',
      closeDate: '2025-07-15',
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '19365 Rim View',
        subdivision: 'Lakes At Tanager PUD',
        subdivisionNorm: 'lakes at tanager pud',
        yearBuilt: 2024,
        newConstruction: true,
        sqft: 4972,
        lotAcres: 2,
        lotClass: 'acreage',
        ruralAcreage: true,
        beds: 4,
        baths: 4,
        publicRemarks: 'Custom built modern home.',
        // Live subject sits outside every mapped Bend polygon.
        marketArea: null,
        latitude: 44.095,
        longitude: -121.345,
      }),
      [...oldStock, perspective, greenleaf],
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).not.toContain('SUMMIT')
    expect(keys).not.toContain('FALCON')
    expect(keys).not.toContain('HOPPER')
    expect(keys).not.toContain('HUNNELL')
    expect(keys).not.toContain('WILD_RYE_2006')
    expect(keys).not.toContain('FAREWELL_2000')
    expect(keys).not.toContain('OKANE_1996')
    expect(keys).toContain('PERSPECTIVE')
    expect(keys).toContain('GREENLEAF')
  })

  it('takes a farther same-generation custom peer before nearby 2000 stock', () => {
    const nearbyOlder = sale({
      listingKey: 'NEAR_OLDER',
      address: '10 Nearby Older',
      yearBuilt: 2000,
      subdivision: 'Old Tract',
      subdivisionNorm: 'old tract',
      sqft: 4900,
      lotAcres: 2,
      latitude: 44.0602,
      longitude: -121.3202,
      marketArea: 'bend-north-rim',
      closeDate: '2026-07-01',
    })
    const farCustom = sale({
      listingKey: 'FAR_CUSTOM',
      address: '80 Custom Far',
      yearBuilt: 2017,
      subdivision: 'Custom Far',
      subdivisionNorm: 'custom far',
      sqft: 5000,
      lotAcres: 2,
      publicRemarks: 'Custom built home.',
      latitude: 44.09,
      longitude: -121.29,
      marketArea: 'bend-north-rim',
      closeDate: '2026-06-01',
    })
    const out = walkPricingLadder(
      subject({
        yearBuilt: 2018,
        newConstruction: false,
        sqft: 4972,
        lotAcres: 2,
        lotClass: 'acreage',
        publicRemarks: 'Custom built modern home.',
        subdivision: 'Lakes At Tanager PUD',
        subdivisionNorm: 'lakes at tanager pud',
        marketArea: 'bend-north-rim',
      }),
      [nearbyOlder, farCustom],
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).toEqual(['FAR_CUSTOM'])
  })

  it('does not let a rural unmapped point fail open against a known Parkway bank', () => {
    const pool = [
      sale({
        listingKey: 'LARK',
        address: '10 Larkspur',
        lotAcres: 6,
        marketArea: 'bend-larkspur',
        subdivision: 'Larkspur',
        subdivisionNorm: 'larkspur',
      }),
    ]
    const out = walkPricingLadder(
      subject({
        lotAcres: 6.5,
        lotClass: 'ranch',
        ruralAcreage: true,
        marketArea: null,
        subdivision: null,
        subdivisionNorm: null,
        latitude: 44.2,
        longitude: -121.4,
      }),
      pool,
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).not.toContain('LARK')
  })
})
