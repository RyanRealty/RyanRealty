import { describe, expect, it } from 'vitest'
import { distanceMiles } from '@/lib/cma/market-area'
import { SUBDIVISION_TIER_RATIO } from '@/lib/pricing/classes'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import { CUSTOM_FACTS_POOL_MONTHS, factsPoolCloseAfter, ORDINARY_FACTS_POOL_MONTHS } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'
import { crossesNamedRiver } from '@/lib/pricing/river-cross'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    // East of the Deschutes, off the water: the synthetic pair used to sit on
    // the river itself, which the river wall (correctly) refused to comp across.
    latitude: 44.06,
    longitude: -121.3,
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

let saleSeq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  // A DISTINCT ADDRESS PER SALE unless the test names one. The ladder now
  // refuses a second row for the same address at the same close price — one
  // closed sale may not enter a set twice — and every fixture built on the old
  // shared '9 Comp St' default was two sales of one house.
  saleSeq += 1
  return {
    listingKey: over.listingKey ?? `K${Math.random().toString(16).slice(2)}`,
    listNumber: null,
    address: over.address ?? `${saleSeq} Comp St`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.061,
    longitude: -121.301,
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

  /**
   * THE ONE ROOM RULE (Matt 2026-09-10: adjust inside, wall outside). The old
   * invariant here was "never prices a one-bath house from a two-bath sale"
   * anywhere. That wall cut 438 nearby sales on 23 Benaiah and pushed the
   * search into four other neighborhoods. What replaces it: one bath apart is
   * used on the subject's OWN plat and recorded on the comp, and never from
   * outside it.
   */
  it('uses a one-bath difference from inside the subject’s own plat, and records it', () => {
    const pool = [
      sale({ listingKey: 'TWO', baths: 2, address: '14 Kenwood' }),
      sale({ listingKey: 'ONE', baths: 1, address: '15 Kenwood' }),
    ]
    const out = walkPricingLadder(subject({ baths: 1 }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['ONE', 'TWO'])
    expect(out.comps.find((c) => c.listingKey === 'TWO')?.roomDifference).toEqual(['baths'])
    expect(out.comps.find((c) => c.listingKey === 'ONE')?.roomDifference).toBeNull()
  })

  it('never takes that one-bath difference from outside the subject’s ground', () => {
    const pool = [
      sale({
        listingKey: 'AWAY',
        baths: 2,
        address: '9 Stone',
        subdivision: 'Stone Creek',
        subdivisionNorm: 'stone creek',
        latitude: 44.12,
        longitude: -121.18,
      }),
    ]
    const out = walkPricingLadder(subject({ baths: 1, marketArea: null }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('AWAY')
  })

  it('refuses two whole baths apart even inside the subject’s own plat', () => {
    const pool = [sale({ listingKey: 'FOUR', baths: 4, address: '16 Kenwood' })]
    const out = walkPricingLadder(subject({ baths: 2 }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('FOUR')
  })

  it('still refuses two whole baths apart outside the plat', () => {
    const pool = [
      sale({
        listingKey: 'FOUR_AWAY',
        baths: 4,
        address: '16 Stone',
        subdivision: 'Stone Creek',
        subdivisionNorm: 'stone creek',
        latitude: 44.062,
        longitude: -121.302,
      }),
    ]
    const out = walkPricingLadder(subject({ baths: 2, marketArea: null }), pool, { asOf })
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

  /**
   * D12 — the same cut, on a sale whose SubdivisionName is an MLS placeholder.
   * 291 Bluff ('N/A', $695/sqft) walked into the Plaza's set because no name
   * means no cell and the median-vs-median guard fails open.
   */
  it('D12 — drops an unnamed-subdivision sale a tier off the subject once the wider rungs run', () => {
    const cells = new Map([['bend:kenwood', { medianPpsf: 400, n: 20 }]])
    const pool = [
      sale({
        listingKey: 'UNNAMED',
        subdivision: 'N/A',
        subdivisionNorm: null,
        closeDate: '2026-07-01',
        closePpsf: 695,
        closePrice: 1_376_100,
        address: '291 Bluff',
        // Same neighborhood polygon as the subject, so the mapped-area cut
        // above is not what removes it. The tier cut is.
        latitude: 44.06,
        longitude: -121.3,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf, cells })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UNNAMED')
  })

  it('D12 — keeps an unnamed-subdivision sale that sits in the subject price tier', () => {
    const cells = new Map([['bend:kenwood', { medianPpsf: 400, n: 20 }]])
    const pool = [
      sale({
        listingKey: 'UNNAMED_OK',
        subdivision: 'N/A',
        subdivisionNorm: null,
        closeDate: '2026-07-01',
        closePpsf: 410,
        closePrice: 811_800,
        address: '12 Riverfront',
        latitude: 44.06,
        longitude: -121.3,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf, cells })
    expect(out.comps.map((c) => c.listingKey)).toContain('UNNAMED_OK')
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
    // Hayloft 1927 against 2500 is 22.9%, inside the plat band Matt widened to
    // 25% on 2026-09-10, so the plain rung takes it and the -wide rung is not
    // needed. What the test locks either way: the plat comes before the ring.
    expect(out.tiersUsed[0]!.startsWith('subdivision-')).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-'))).toBe(false)
  })

  it('does not stop a rural subject on the city-5mi rung', () => {
    const pool = [
      sale({
        listingKey: 'CITY',
        subdivision: 'Other',
        subdivisionNorm: 'other',
        latitude: 44.06,
        longitude: -121.3,
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
    // Outside the plat on purpose: the plat band and the bracket band are both
    // 25% since 2026-09-10, so a same-plat sale the rung refuses is a sale the
    // bracket refuses too. The nearby rungs sit at 15%, which is the gap the
    // bracket exists to close.
    const smaller = sale({
      listingKey: 'SMALL',
      address: '40 Aubrey',
      subdivision: 'Aubrey',
      subdivisionNorm: 'aubrey',
      closeDate: '2026-06-15',
      sqft: 1600,
    })
    const out = walkPricingLadder(subject({ sqft: 2000 }), [...larger, smaller], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('SMALL')
    expect(out.comps.some((c) => c.sqft > 2000)).toBe(true)
    expect(out.comps).toHaveLength(5)
    expect(out.comps.filter((c) => c.listingKey.startsWith('BIG'))).toHaveLength(4)
  })

  it('never keeps more than five priced sales', () => {
    const pool = Array.from({ length: 12 }, (_, i) =>
      sale({
        listingKey: `N${i}`,
        address: `${10 + i} Kenwood`,
        closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
      }),
    )
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(5)
  })

  it('drops the price outlier once five closer sales are in', () => {
    const tight = [700_000, 710_000, 720_000, 735_000, 748_000]
    const pool = [
      ...tight.map((closePrice, i) =>
        sale({
          listingKey: `T${i}`,
          address: `${10 + i} Kenwood`,
          closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
          closePrice,
        }),
      ),
      sale({
        listingKey: 'HIGH',
        address: '90 Kenwood',
        closeDate: '2026-05-01',
        closePrice: 980_000,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(5)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('HIGH')
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
        // Outside the 0.25 mi street cluster, inside the 1-mile ring — three
        // plat sales are not a reason to stop before that ring.
        latitude: 44.06 + 0.5 / 69,
        longitude: -121.3,
        marketArea: 'bend-old-bend',
        closeDate: '2026-07-15',
      }),
    ]
    const out = walkPricingLadder(subject({ sqft: 2500, marketArea: 'bend-old-bend' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('NEAR')
    // 1927 against 2500 is inside the 25% plat band now, so these arrive on the
    // plain rung rather than the -wide one. The point stands: three plat sales
    // at the edge of the band are not a reason to stop before the ring.
    expect(out.tiersUsed.some((t) => t.startsWith('subdivision-'))).toBe(true)
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

  it('takes a sale inside the community when the MLS plat name differs, and not one that only mentions it', () => {
    // Membership is the boundary, for every community. Not the subdivision
    // string and not a remark. The community rung is the one that may take
    // the inside sale; a mile ring is not allowed to go first.
    const inside = (listingKey: string, subdivision: string, over: Partial<PricingSale> = {}) =>
      sale({
        listingKey,
        subdivision,
        subdivisionNorm: subdivision.toLowerCase(),
        address: `${listingKey} Fairway`,
        communitySlug: 'sample-community',
        communityLocated: true,
        marketArea: 'test-area',
        latitude: 44.06,
        longitude: -121.29,
        closeDate: '2026-06-01',
        ...over,
      })
    const out = walkPricingLadder(
      subject({
        subdivision: 'Subject Plat',
        subdivisionNorm: 'subject plat',
        communitySlug: 'sample-community',
        communityLocated: true,
        communityMemberPlats: ['member-plat'],
        marketArea: 'test-area',
        latitude: 44.06,
        longitude: -121.3,
      }),
      [
        inside('BY_BOUNDARY', 'Wildwood Park'),
        inside('BY_PLAT', 'Another Plat', {
          communitySlug: null,
          subdivisionSlug: 'member-plat',
        }),
        inside('ALSO_IN', 'Third Plat'),
        inside('STILL_IN', 'Fourth Plat'),
        inside('FIFTH', 'Fifth Plat'),
        sale({
          listingKey: 'REMARKS_ONLY',
          subdivision: 'Timber Ridge',
          subdivisionNorm: 'timber ridge',
          address: '9 Remarks Only',
          communitySlug: null,
          communityLocated: true,
          subdivisionSlug: 'not-a-member',
          marketArea: 'test-area',
          latitude: 44.06,
          longitude: -121.29,
          closeDate: '2026-06-02',
          publicRemarks: 'Charming home in the sample community, walk to the clubhouse.',
        }),
      ],
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('BY_BOUNDARY')
    expect(keys).toContain('BY_PLAT')
    expect(keys).not.toContain('REMARKS_ONLY')
    expect(out.comps.every((c) => c.selectionTier.startsWith('community-'))).toBe(true)
    const firstAdded = out.rungs.find((r) => r.added > 0)
    expect(firstAdded?.tier.startsWith('community-')).toBe(true)
    expect(out.rungs.some((r) => r.added > 0 && /\dmi/.test(r.tier))).toBe(false)
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
    // North Rim peers resolve into Awbrey Butte. Whole-bath match: a 3-bath
    // Perspective sale is one off this 4-bath subject and off its ground, which
    // the one-room rule refuses. This test is year/quality, not the retired
    // custom ±1 bath window.
    const perspective = sale({
      listingKey: 'PERSPECTIVE',
      address: '2060 NW Perspective Dr',
      beds: 4,
      baths: 4,
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
    // Third same-gen peer so the live MIN_COMPS=3 floor can clear without
    // falling back to the listings ladder that killed Perspective on baths.
    const northRim2021 = sale({
      listingKey: 'NORTH_RIM_2021',
      address: '1900 NW North Rim',
      beds: 4,
      baths: 4,
      yearBuilt: 2021,
      subdivision: 'Bend North Rim',
      subdivisionNorm: 'bend north rim',
      sqft: 4200,
      lotAcres: 1.05,
      publicRemarks: 'Custom built modern home.',
      closePrice: 2_950_000,
      lastAsk: 2_950_000,
      closePpsf: 702,
      latitude: 44.089,
      longitude: -121.34,
      marketArea: 'bend-awbrey-butte',
      closeDate: '2025-03-01',
    })
    // In-town lot must still die on lot character even for custom subjects.
    const intownCustom = sale({
      listingKey: 'INTOWN_CUSTOM',
      address: '500 NW In Town Custom',
      beds: 4,
      baths: 4,
      yearBuilt: 2022,
      subdivision: 'Downtown',
      subdivisionNorm: 'downtown',
      sqft: 4800,
      lotAcres: 0.2,
      publicRemarks: 'Custom built modern home.',
      closePrice: 2_100_000,
      lastAsk: 2_100_000,
      latitude: 44.058,
      longitude: -121.315,
      marketArea: 'bend-old-bend',
      closeDate: '2025-08-01',
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '19365 Rim View',
        subdivision: 'Lakes At Tanager PUD',
        subdivisionNorm: 'lakes at tanager pud',
        yearBuilt: 2024,
        // LIVE: NewConstructionYN can be null/false in fragile feeds — remarks
        // (mid-century / to-be-built) and year must still classify custom/new.
        newConstruction: false,
        propertySubType: 'Single Family Residence',
        sqft: 4972,
        lotAcres: 2,
        lotClass: 'acreage',
        ruralAcreage: true,
        beds: 4,
        baths: 4,
        publicRemarks:
          'Introducing a stunning mid-century modern home perched over a turn in Tumalo Creek that has views of ancient rock outcroppings. This to-be-built masterpiece offers 4 beds, 3.5 baths, a study, and rec room spread across 4972 sf of luxurious living.',
        waterClass: 'public',
        sewerClass: 'unknown',
        hoaClass: 'hoa',
        // Live subject sits outside every mapped Bend polygon.
        marketArea: null,
        latitude: 44.1005,
        longitude: -121.356541,
      }),
      [...oldStock, perspective, greenleaf, northRim2021, intownCustom],
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
    expect(keys).not.toContain('INTOWN_CUSTOM')
    expect(keys).toContain('PERSPECTIVE')
    expect(keys).toContain('GREENLEAF')
    expect(keys).toContain('NORTH_RIM_2021')
    // Live admin floor is MIN_COMPS=3. Ladder "starved" means under TARGET 8.
    expect(out.comps.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps Perspective when live yearBuilt is null and NewConstructionYN is null (to-be-built remarks)', () => {
    const perspective = sale({
      listingKey: 'PERSPECTIVE',
      address: '2060 NW Perspective Dr',
      beds: 4,
      baths: 4,
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
    const northRim2021 = sale({
      listingKey: 'NORTH_RIM_2021',
      address: '1900 NW North Rim',
      beds: 4,
      baths: 4,
      yearBuilt: 2021,
      subdivision: 'Bend North Rim',
      subdivisionNorm: 'bend north rim',
      sqft: 4200,
      lotAcres: 1.05,
      publicRemarks: 'Custom built modern home.',
      closePrice: 2_950_000,
      lastAsk: 2_950_000,
      closePpsf: 702,
      latitude: 44.089,
      longitude: -121.34,
      marketArea: 'bend-awbrey-butte',
      closeDate: '2025-03-01',
    })
    const summit = sale({
      listingKey: 'SUMMIT',
      address: '1990 NW Summit Dr',
      beds: 4,
      baths: 4,
      yearBuilt: 1990,
      subdivision: 'Awbrey Butte',
      subdivisionNorm: 'awbrey butte',
      sqft: 4800,
      lotAcres: 2,
      closePrice: 1_800_000,
      lastAsk: 1_800_000,
      marketArea: 'bend-awbrey-butte',
      closeDate: '2025-08-01',
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '19365 Rim View',
        subdivision: 'Lakes At Tanager PUD',
        subdivisionNorm: 'lakes at tanager pud',
        yearBuilt: null,
        newConstruction: null,
        propertySubType: 'Single Family Residence',
        sqft: 4972,
        lotAcres: 2,
        lotClass: 'acreage',
        ruralAcreage: true,
        beds: 4,
        baths: 4,
        publicRemarks:
          'Introducing a stunning mid-century modern home perched over Tumalo Creek. This to-be-built masterpiece offers 4 beds and 3.5 baths.',
        waterClass: 'public',
        sewerClass: 'unknown',
        hoaClass: 'hoa',
        marketArea: null,
        latitude: 44.1005,
        longitude: -121.356541,
      }),
      [summit, perspective, greenleaf, northRim2021],
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).not.toContain('SUMMIT')
    expect(keys).toContain('PERSPECTIVE')
    expect(keys).toContain('GREENLEAF')
    expect(keys).toContain('NORTH_RIM_2021')
    expect(out.comps.length).toBeGreaterThanOrEqual(3)
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
      longitude: -121.3002,
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

describe('containment — the plats next to the subject, then the boundary (Matt 2026-09-08)', () => {
  const asOf = '2026-09-01'
  // River West, so every non-subdivision rung is boundary-cut.
  const RIVER_WEST = { latitude: 44.0645, longitude: -121.3237, marketArea: 'bend-river-west' }

  it('a sale in a touching plat is taken by the adjacent rung, before any mile ring', () => {
    const subj = subject({ ...RIVER_WEST, subdivisionSlug: 'kenwood', adjacentSubdivisionSlugs: ['kenwood-first-addition', 'roanoke'] })
    const pool = [
      // Outside the 0.25 mi street cluster so the adjacent rung, not pocket, is the one that fires.
      sale({
        ...RIVER_WEST,
        latitude: RIVER_WEST.latitude + 0.4 / 69,
        subdivision: 'Roanoke',
        subdivisionNorm: 'roanoke',
        subdivisionSlug: 'roanoke',
        closeDate: '2026-07-15',
      }),
      sale({
        ...RIVER_WEST,
        latitude: RIVER_WEST.latitude + 0.8 / 69,
        subdivision: 'Aubrey Heights',
        subdivisionNorm: 'aubrey heights',
        subdivisionSlug: 'aubrey-heights',
        closeDate: '2026-07-15',
      }),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    const tiers = out.comps.map((c) => [c.subdivisionNorm, c.selectionTier])
    expect(tiers).toContainEqual(['roanoke', 'adjacent-sub-3mo'])
    // The non-adjacent plat inside the same polygon still enters, later, on a mile ring.
    expect(tiers.find((t) => t[0] === 'aubrey heights')?.[1]).toMatch(/^nearby-/)
  })

  it('the adjacent rung skips when no ring is known, and the walk says why', () => {
    const subj = subject({ ...RIVER_WEST, adjacentSubdivisionSlugs: [] })
    const out = walkPricingLadder(subj, [sale({ ...RIVER_WEST, subdivisionNorm: 'roanoke', subdivisionSlug: 'roanoke' })], { asOf })
    const adj = out.rungs.find((r) => r.tier === 'adjacent-sub-3mo')!
    expect(adj.ran).toBe(false)
    expect(adj.skippedReason).toMatch(/no plat next to/)
  })

  it('never leaves the boundary while it supplied the minimum; crosses only when it did not', () => {
    // Awbrey Butte: another mapped polygon on the same bank, about a mile away.
    const outside = { latitude: 44.075, longitude: -121.33, marketArea: 'bend-awbrey-butte' }
    const inside = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        sale({ ...RIVER_WEST, subdivisionNorm: `plat-${i}`, subdivisionSlug: `plat-${i}`, listingKey: `IN${i}`, closeDate: '2026-06-01' }),
      )
    const strangers = Array.from({ length: 4 }, (_, i) =>
      sale({ ...outside, subdivision: 'Awbrey Woods', subdivisionNorm: 'awbrey woods', subdivisionSlug: 'awbrey-woods', listingKey: `OUT${i}`, closeDate: '2026-06-01' }),
    )
    const subj = subject(RIVER_WEST)
    const held = walkPricingLadder(subj, [...inside(5), ...strangers], { asOf })
    expect(held.comps.every((c) => c.listingKey.startsWith('IN'))).toBe(true)
    expect(held.comps).toHaveLength(5)
    const beyond = held.rungs.find((r) => r.tier === 'beyond-2mi-12mo')
    // Five inside sales fill the set, so the walk stops before the boundary
    // rung. If that rung is still recorded, it did not run.
    if (beyond) {
      expect(beyond.ran).toBe(false)
      expect(beyond.skippedReason).toMatch(/stayed (inside|exclusive)|already has/)
    }

    const crossed = walkPricingLadder(subj, [...inside(3), ...strangers], { asOf })
    expect(crossed.comps.some((c) => c.selectionTier.startsWith('beyond-'))).toBe(true)
    expect(crossed.trace.join(' ')).toMatch(/crossed its boundary/)
  })
})

describe('Delta 4 — rural homes are read as property (Matt 2026-09-09)', () => {
  const asOf = '2026-09-01'
  const rural = { lotAcres: 5, lotClass: 'acreage' as const, ruralAcreage: true, marketArea: null, waterClass: 'well' as const, sewerClass: 'septic' as const }

  it('farm or forest zoning never prices a rural-residential parcel, or the reverse', () => {
    const subj = subject({ ...rural, zoning: 'EFUTRB', publicRemarks: 'Farm home on 5 irrigated acres with a barn.' })
    const pool = [
      sale({ ...rural, zoning: 'RR10', publicRemarks: 'Five irrigated acres with a barn.', listingKey: 'RR' }),
      sale({ ...rural, zoning: 'EFU', publicRemarks: 'Five irrigated acres with a barn.', listingKey: 'EFU' }),
      sale({ ...rural, zoning: null, publicRemarks: 'Five irrigated acres with a barn.', listingKey: 'UNK' }),
    ]
    const keys = walkPricingLadder(subj, pool, { asOf }).comps.map((c) => c.listingKey)
    expect(keys).not.toContain('RR')
    expect(keys).toContain('EFU')
    expect(keys).toContain('UNK')
  })

  it('a shop-and-barn property and a bare house on land are different products', () => {
    // No barn on the subject: the horse/barn split (already live) stays out of this case.
    const subj = subject({ ...rural, publicRemarks: 'Dry 5 acres with a 40x60 shop.' })
    const pool = [
      sale({ ...rural, publicRemarks: 'Dry five acres, quiet, views.', listingKey: 'BARE' }),
      sale({ ...rural, publicRemarks: 'Dry five acres with a shop.', listingKey: 'SHOP' }),
      sale({ ...rural, publicRemarks: '', listingKey: 'SILENT' }),
    ]
    const keys = walkPricingLadder(subj, pool, { asOf }).comps.map((c) => c.listingKey)
    expect(keys).not.toContain('BARE')
    expect(keys).toContain('SHOP')
    expect(keys).toContain('SILENT')
  })

  it('lava rock does not price level pasture', () => {
    const subj = subject({ ...rural, publicRemarks: 'Dry acreage, level pasture, fully fenced.' })
    const pool = [
      sale({ ...rural, publicRemarks: 'Dry acreage of lava rock and juniper, steep at the back.', listingKey: 'ROCK' }),
      sale({ ...rural, publicRemarks: 'Dry acreage, level and usable ground.', listingKey: 'LEVEL' }),
    ]
    const keys = walkPricingLadder(subj, pool, { asOf }).comps.map((c) => c.listingKey)
    expect(keys).not.toContain('ROCK')
    expect(keys).toContain('LEVEL')
  })

  it('in town the splits do not run', () => {
    const subj = subject({ publicRemarks: 'Detached shop in the back yard.', zoning: 'RS' })
    const pool = [sale({ publicRemarks: 'Nice yard.', zoning: 'RS', listingKey: 'TOWN' })]
    expect(walkPricingLadder(subj, pool, { asOf }).comps.map((c) => c.listingKey)).toContain('TOWN')
  })
})

describe('one sale, one row', () => {
  it('refuses a relisting of the same closed sale, whatever its listing key says', () => {
    const pool = [
      sale({ listingKey: 'FIRST', address: '2745 Ordway', closePrice: 799_000, sqft: 1926, closeDate: '2026-06-22' }),
      sale({ listingKey: 'RELIST', address: '2745 Ordway', closePrice: 799_000, sqft: 1925, closeDate: '2026-03-14' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(1)
    expect(out.comps[0]!.listingKey).toBe('FIRST')
  })

  it('keeps two real sales of the same house at different prices', () => {
    const pool = [
      sale({ listingKey: 'A', address: '2745 Ordway', closePrice: 799_000, closeDate: '2026-06-22' }),
      sale({ listingKey: 'B', address: '2745 Ordway', closePrice: 640_000, closeDate: '2025-09-14' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B'])
  })
})

describe('a custom subject keeps the floor and loses the ceiling', () => {
  function customSubject() {
    return subject({
      sqft: 2685,
      yearBuilt: 2024,
      newConstruction: true,
      publicRemarks: 'Custom built modern home.',
      subdivision: null,
      subdivisionNorm: null,
      marketArea: 'bend-century-west',
    })
  }
  // A neighborhood median the anchor can actually read: 19479 Campbell's own
  // is $489/sqft over 132 Century West sales.
  function neighbors(n: number, ppsf: number) {
    return Array.from({ length: n }, (_, i) =>
      sale({
        listingKey: `N${i}`,
        address: `${100 + i} Century`,
        sqft: 2600,
        closePrice: Math.round(2600 * ppsf) + i,
        closePpsf: ppsf,
        yearBuilt: 2022,
        newConstruction: true,
        publicRemarks: 'Custom built.',
        subdivision: null,
        subdivisionNorm: null,
        marketArea: 'bend-century-west',
        closeDate: '2026-06-01',
      }),
    )
  }

  it('refuses a sale at 0.45 of the neighborhood rate', () => {
    const cheap = sale({
      listingKey: 'CHEAP',
      address: '61289 Bronze Meadow',
      sqft: 3000,
      closePrice: 665_000,
      closePpsf: 222,
      yearBuilt: 2021,
      newConstruction: true,
      publicRemarks: 'Custom built.',
      subdivision: null,
      subdivisionNorm: null,
      marketArea: 'bend-century-west',
      closeDate: '2026-07-04',
    })
    const out = walkPricingLadder(customSubject(), [...neighbors(8, 489), cheap], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('CHEAP')
  })

  it('keeps a same-generation custom peer far ABOVE that rate', () => {
    const dear = sale({
      listingKey: 'DEAR',
      address: '2060 NW Perspective Dr',
      sqft: 2800,
      closePrice: 2_332_400,
      closePpsf: 833,
      yearBuilt: 2023,
      newConstruction: true,
      publicRemarks: 'Custom built modern home.',
      subdivision: null,
      subdivisionNorm: null,
      marketArea: 'bend-century-west',
      closeDate: '2026-07-04',
    })
    const out = walkPricingLadder(customSubject(), [...neighbors(8, 489), dear], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('DEAR')
  })
})

describe('the GLA bracket obeys the 24-month wall', () => {
  it('will not swap in a sale the accuracy contract would hard-fail as stale', () => {
    // Every kept sale smaller than the subject, so the bracket wants a larger
    // one. The only larger sale on offer closed 27 months ago.
    const smaller = Array.from({ length: 3 }, (_, i) =>
      sale({ listingKey: `S${i}`, address: `${i} Kenwood`, sqft: 1800, closeDate: '2026-06-01' }),
    )
    const staleBigger = sale({
      listingKey: 'STALE',
      address: '99 Kenwood',
      sqft: 2300,
      closeDate: '2024-05-01',
    })
    const out = walkPricingLadder(subject({ sqft: 2000 }), [...smaller, staleBigger], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('STALE')
  })

  it('still swaps in a larger sale inside the window', () => {
    const smaller = Array.from({ length: 3 }, (_, i) =>
      sale({ listingKey: `S${i}`, address: `${i} Kenwood`, sqft: 1800, closeDate: '2026-06-01' }),
    )
    const fresh = sale({ listingKey: 'FRESH', address: '98 Kenwood', sqft: 2300, closeDate: '2026-05-01' })
    const out = walkPricingLadder(subject({ sqft: 2000 }), [...smaller, fresh], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('FRESH')
  })
})

describe('your own street comes first', () => {
  it('finds the twin next door on the first rung, whatever the MLS calls the tract', () => {
    const twin = sale({
      listingKey: 'TWIN',
      address: '31 Benaiah',
      sqft: 2080,
      beds: 4,
      baths: 2,
      closeDate: '2025-07-08',
      closePrice: 512_000,
      lastAsk: 499_000,
      subdivision: null,
      subdivisionNorm: null,
    })
    const elsewhere = Array.from({ length: 8 }, (_, i) =>
      sale({
        listingKey: `OTHER${i}`,
        address: `${i} Tanglewood`,
        subdivision: 'Tanglewood',
        subdivisionNorm: 'tanglewood',
        latitude: 44.12,
        longitude: -121.3,
        sqft: 1900,
        closeDate: '2026-07-01',
      }),
    )
    const subj = subject({ streetAddress: '23 Benaiah', sqft: 2080, subdivision: null, subdivisionNorm: null })
    const out = walkPricingLadder(subj, [...elsewhere, twin], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('TWIN')
    expect(out.tiersUsed[0]).toBe('own-street-24mo')
  })

  it('does not take a same-street sale of a very different size', () => {
    const big = sale({ listingKey: 'BIG', address: '31 Benaiah', sqft: 3400, subdivisionNorm: null })
    const subj = subject({ streetAddress: '23 Benaiah', sqft: 2080, subdivision: null, subdivisionNorm: null })
    const out = walkPricingLadder(subj, [big], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('BIG')
  })
})

describe('blank SubdivisionName infers the pocket before mile rings', () => {
  const SISTERS = { latitude: 44.2908, longitude: -121.5493, city: 'Sisters', citySlug: 'sisters' }

  it('takes Rolling Horse Meadow on subdivision rungs and SaddleStone on pocket rungs before Crossroads', () => {
    const rhm = (i: number) =>
      sale({
        ...SISTERS,
        latitude: 44.2908 + 0.04 / 69,
        longitude: -121.5493,
        listingKey: `RHM${i}`,
        address: `${200 + i} Rolling Horse Dr`,
        subdivision: 'Rolling Horse Meadow',
        subdivisionNorm: 'rolling horse meadow',
        closeDate: '2026-06-01',
      })
    const saddle = sale({
      ...SISTERS,
      latitude: 44.2908 + 0.2 / 69,
      listingKey: 'SAD1',
      address: '1 SaddleStone Ln',
      subdivision: 'SaddleStone',
      subdivisionNorm: 'saddlestone',
      closeDate: '2026-06-01',
    })
    const far = sale({
      ...SISTERS,
      latitude: 44.2908 + 3.7 / 69,
      listingKey: 'FAR1',
      address: '1 Crossroads Loop',
      subdivision: 'Crossroads',
      subdivisionNorm: 'crossroads',
      closeDate: '2026-06-15',
    })
    const subj = subject({
      ...SISTERS,
      streetAddress: '1121 Canter Ct',
      subdivision: null,
      subdivisionNorm: null,
    })
    const out = walkPricingLadder(subj, [far, saddle, rhm(1), rhm(2), rhm(3)], { asOf })
    expect(out.inferredPocket?.inferred).toBe(true)
    expect(out.inferredPocket?.subdivision).toBe('Rolling Horse Meadow')
    expect(out.tiersUsed.some((t) => t.startsWith('subdivision-'))).toBe(true)
    expect(out.tiersUsed.find((t) => t.startsWith('subdivision-'))).toBeTruthy()
    expect(out.comps.filter((c) => c.listingKey.startsWith('RHM')).every((c) => c.selectionTier.startsWith('subdivision-')))
      .toBe(true)
    const saddleComp = out.comps.find((c) => c.listingKey === 'SAD1')
    expect(saddleComp?.selectionTier.startsWith('pocket-')).toBe(true)
    expect(out.tiersUsed[0]).toMatch(/^subdivision-/)
    const farComp = out.comps.find((c) => c.listingKey === 'FAR1')
    if (farComp) {
      expect(farComp.selectionTier).not.toMatch(/^nearby-/)
    }
  })
})

describe('named subdivision pocket-first (Matt 2026-09-15 Canter / SaddleStone)', () => {
  const CANTER = { latitude: 44.2908, longitude: -121.5493, city: 'Sisters', citySlug: 'sisters' }
  const FLEX_GOLD = [
    { mls: '220218584', name: 'SaddleStone', miles: 0.06, price: 649_000 },
    { mls: '220214720', name: 'SaddleStone', miles: 0.09, price: 655_000 },
    { mls: '220224488', name: 'Horse Back', miles: 0.11, price: 662_000 },
    { mls: '220216121', name: 'Horse Back', miles: 0.14, price: 668_000 },
    { mls: '220221029', name: 'Ranch', miles: 0.16, price: 670_000 },
    { mls: '220228243', name: 'Ranch', miles: 0.18, price: 672_000 },
    { mls: '220228324', name: 'SaddleStone', miles: 0.08, price: 675_000 },
  ] as const

  function goldSale(row: (typeof FLEX_GOLD)[number], i: number) {
    return sale({
      ...CANTER,
      latitude: CANTER.latitude + row.miles / 69,
      listingKey: `GOLD-${row.mls}`,
      listNumber: row.mls,
      address: `${100 + i} ${row.name} Ln`,
      subdivision: row.name,
      subdivisionNorm: row.name.toLowerCase(),
      yearBuilt: 2006,
      sqft: 1980 + (i % 5) * 40,
      closePrice: row.price,
      lastAsk: row.price,
      closePpsf: row.price / (1980 + (i % 5) * 40),
      closeDate: `2026-0${5 + (i % 3)}-${String(10 + i).padStart(2, '0')}`,
    })
  }

  function upmarket(name: string, miles: number, price: number) {
    return sale({
      ...CANTER,
      latitude: CANTER.latitude + miles / 69,
      listingKey: `UP-${name.replace(/\s+/g, '')}`,
      listNumber: name === 'Clearpine' ? '220199001' : '220199002',
      address: `191 ${name} Dr`,
      subdivision: name,
      subdivisionNorm: name.toLowerCase(),
      yearBuilt: 2021,
      sqft: 2100,
      closePrice: price,
      lastAsk: price,
      closePpsf: price / 2100,
      closeDate: '2026-07-01',
      publicRemarks: 'Custom built modern home.',
    })
  }

  const canterSubject = () =>
    subject({
      ...CANTER,
      streetAddress: '1130 E Canter',
      subdivision: 'SaddleStone',
      subdivisionNorm: 'saddlestone',
      yearBuilt: 2006,
      sqft: 2050,
      beds: 3,
      baths: 2,
      lotAcres: 0.22,
    })

  it('prefers the Flex gold SaddleStone / Horse Back / Ranch set over Clearpine and Forest Edge', () => {
    const gold = FLEX_GOLD.map((row, i) => goldSale(row, i))
    const decoys = [upmarket('Clearpine', 2.2, 890_000), upmarket('Forest Edge', 2.5, 860_000)]
    const out = walkPricingLadder(canterSubject(), [...decoys, ...gold], { asOf })
    const numbers = out.comps.map((c) => c.listNumber)
    expect(out.comps).toHaveLength(5)
    expect(numbers.every((n) => FLEX_GOLD.some((g) => g.mls === n))).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-ForestEdge')
    expect(out.comps.every((c) => !/clearpine|forest edge/i.test(c.subdivision ?? ''))).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('similar-sub') || t.startsWith('city-'))).toBe(
      false,
    )
    expect(out.pocketStarved).toBe(false)
    expect(out.exclusiveCount).toBeGreaterThanOrEqual(5)
    const closes = out.comps.map((c) => c.closePrice).sort((a, b) => a - b)
    const mid = closes[Math.floor(closes.length / 2)]!
    expect(mid).toBeGreaterThanOrEqual(649_000)
    expect(mid).toBeLessThanOrEqual(675_000)
    expect(mid).toBeLessThan(846_000)
  })

  it('keeps year/quality from outranking radius while the pocket is filled', () => {
    const gold = FLEX_GOLD.map((row, i) => goldSale(row, i))
    const decoys = [upmarket('Clearpine', 2.2, 890_000), upmarket('Forest Edge', 2.5, 860_000)]
    const customCanter = subject({
      ...canterSubject(),
      yearBuilt: 2020,
      publicRemarks: 'Custom built modern home.',
    })
    const out = walkPricingLadder(customCanter, [...decoys, ...gold], { asOf })
    expect(out.pocketStarved).toBe(false)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-ForestEdge')
    expect(out.comps.some((c) => c.listNumber && FLEX_GOLD.some((g) => g.mls === c.listNumber))).toBe(true)
  })
})

describe('year/quality outranks radius only when the pocket is starved', () => {
  it('still takes a farther same-generation custom peer when the named pocket has no sales', () => {
    const nearbyOlder = sale({
      listingKey: 'NEAR_OLDER',
      address: '10 Nearby Older',
      yearBuilt: 2000,
      subdivision: 'Old Tract',
      subdivisionNorm: 'old tract',
      sqft: 4900,
      lotAcres: 2,
      latitude: 44.0602,
      longitude: -121.3002,
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
    expect(out.pocketStarved).toBe(true)
    expect(out.exclusiveCount).toBe(0)
    expect(out.comps.map((c) => c.listingKey)).toEqual(['FAR_CUSTOM'])
  })
})

describe('a full plat is not replaced by a cheaper quarter-mile pocket', () => {
  const asOf = '2026-09-28'

  it('keeps the plat sales when the plat already has five and the pocket is cheaper', () => {
    const plat = [770_000, 780_000, 790_000, 800_000, 810_000, 820_000].map((closePrice, i) =>
      sale({
        listingKey: `PLAT${i}`,
        address: `${100 + i} Redtail`,
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        closePrice,
        closeDate: '2026-06-01',
        sqft: 2100,
      }),
    )
    const pocket = [610_000, 615_000, 620_000, 625_000, 630_000, 635_000, 640_000, 645_000].map(
      (closePrice, i) =>
        sale({
          listingKey: `POCKET${i}`,
          address: `${200 + i} Badger`,
          subdivision: 'North Trailside',
          subdivisionNorm: 'north trailside',
          closePrice,
          closeDate: '2026-06-01',
          sqft: 2000,
        }),
    )
    const out = walkPricingLadder(
      subject({
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        streetAddress: '3759 45th',
        sqft: 2186,
        pocketSubdivisionNorms: ['north trailside'],
      }),
      [...plat, ...pocket],
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys.every((k) => k.startsWith('PLAT'))).toBe(true)
    expect(keys.some((k) => k.startsWith('POCKET'))).toBe(false)
    const pocketRung = out.rungs.find((r) => r.tier === 'pocket-9mo')
    expect(pocketRung?.ran).toBe(false)
    expect(pocketRung?.skippedReason).toMatch(/own plat already has/)
  })

  it('still uses the quarter-mile pocket when the plat has fewer than five sales', () => {
    const plat = [770_000, 790_000].map((closePrice, i) =>
      sale({
        listingKey: `PLAT${i}`,
        address: `${300 + i} Redtail`,
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        closePrice,
        closeDate: '2026-06-01',
        sqft: 2100,
      }),
    )
    const pocket = [610_000, 620_000, 630_000].map((closePrice, i) =>
      sale({
        listingKey: `POCKET${i}`,
        address: `${400 + i} Badger`,
        subdivision: 'North Trailside',
        subdivisionNorm: 'north trailside',
        closePrice,
        closeDate: '2026-06-01',
        sqft: 2000,
      }),
    )
    const out = walkPricingLadder(
      subject({
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        sqft: 2186,
        pocketSubdivisionNorms: ['north trailside'],
      }),
      [...plat, ...pocket],
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys.some((k) => k.startsWith('POCKET'))).toBe(true)
    expect(keys.some((k) => k.startsWith('PLAT'))).toBe(true)
  })
})

describe('a comp from the wrong house', () => {
  const asOf = '2026-08-01'
  const here = { latitude: 44.06, longitude: -121.3 }
  const at = (milesNorth: number, milesEast = 0) => ({
    latitude: here.latitude + milesNorth / 69.093,
    longitude: here.longitude + milesEast / (69.093 * Math.cos((here.latitude * Math.PI) / 180)),
  })

  it('does not let the GLA bracket replace a same-plat sale with a different plat almost two miles away', () => {
    // 3028 Indian, Juniper Glen, 2526 sqft. Every kept sale is smaller, so the
    // bracket wants one larger house inside ±25% GLA. 2834 Indian is the
    // farthest of those. 4570 Yew is Forked Horn Butte, 1.89 mi, on the same
    // side of the river and the highway, and its $/sqft sits inside the tier.
    const smallPlat = sale({
      listingKey: 'INDIAN-2834',
      address: '2834 Indian',
      subdivision: 'Juniper Glen',
      subdivisionNorm: 'juniper glen',
      sqft: 1668,
      closePrice: 497_000,
      closePpsf: 497_000 / 1668,
      closeDate: '2026-06-01',
      ...at(0.04),
    })
    const plat = [740_000, 760_000, 780_000, 800_000].map((closePrice, i) =>
      sale({
        listingKey: `GLEN${i}`,
        address: `${2800 + i} Glen`,
        subdivision: 'Juniper Glen',
        subdivisionNorm: 'juniper glen',
        sqft: 2200,
        closePrice,
        closePpsf: closePrice / 2200,
        closeDate: '2026-06-01',
        ...at(0.05 + i * 0.01),
      }),
    )
    const yew = sale({
      listingKey: 'YEW-4570',
      address: '4570 Yew',
      subdivision: 'Forked Horn Butte',
      subdivisionNorm: 'forked horn butte',
      sqft: 2800,
      closePrice: 789_000,
      closePpsf: 789_000 / 2800,
      closeDate: '2026-05-01',
      ...at(0, 1.89),
    })
    const yewPoint = { lat: yew.latitude, lng: yew.longitude }
    const origin = { lat: here.latitude, lng: here.longitude }
    const miles = distanceMiles(origin, yewPoint)
    expect(miles).toBeGreaterThan(1.8)
    expect(miles).toBeLessThan(2)
    if (yew.latitude == null || yew.longitude == null) {
      throw new Error('4570 Yew has no coordinates')
    }
    const yewLatLng = { lat: yew.latitude, lng: yew.longitude }
    expect(crossesNamedRiver(origin, yewLatLng)).toBe(false)
    expect(crossesUs97(origin, yewLatLng) || differentUs97Bank(origin, yewLatLng)).toBe(false)
    const out = walkPricingLadder(
      subject({
        streetAddress: '3028 Indian',
        city: 'Redmond',
        citySlug: 'redmond',
        subdivision: 'Juniper Glen',
        subdivisionNorm: 'juniper glen',
        sqft: 2526,
        ...here,
      }),
      [smallPlat, ...plat, yew].map((row) => ({ ...row, city: 'Redmond', citySlug: 'redmond' })),
      { asOf },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('INDIAN-2834')
    expect(keys).not.toContain('YEW-4570')
    expect(out.tiersUsed).not.toContain('gla-bracket')
  })

  it('does not let a quarter-mile pocket rung add a close whose price is far from the plat set', () => {
    // Both pocket plats have a median $/sqft inside the subject's tier, which
    // is the check the ladder already runs. The sale's own close is not. Vine
    // Maple at $1,510,000 is about 32% over the Fairway Crest closes. 3331
    // Juniper at $475,000 is far under the middle of Juniper Glen, and the one
    // small plat close does not pull that middle down to meet it.
    const crest = [1_100_000, 1_184_000].map((closePrice, i) =>
      sale({
        listingKey: `CREST${i}`,
        address: `${18010 + i} Tan Oak`,
        subdivision: 'Fairway Crest Village',
        subdivisionNorm: 'fairway crest village',
        sqft: 1980,
        closePrice,
        closePpsf: closePrice / 1980,
        closeDate: '2026-06-01',
        ...at(0.03 + i * 0.01),
      }),
    )
    const near = sale({
      listingKey: 'POCKET-NEAR',
      address: '18100 Cedar',
      subdivision: 'Forest Park',
      subdivisionNorm: 'forest park',
      sqft: 1900,
      closePrice: 1_200_000,
      closePpsf: 1_200_000 / 1900,
      closeDate: '2026-07-01',
      ...at(0.12),
    })
    const vine = sale({
      listingKey: 'VINE-MAPLE',
      address: '57692 Vine Maple',
      subdivision: 'Meadow Village',
      subdivisionNorm: 'meadow village',
      sqft: 1920,
      closePrice: 1_510_000,
      closePpsf: 1_510_000 / 1920,
      closeDate: '2026-07-02',
      ...at(0.16),
    })
    const highCells = new Map([
      ['sunriver:fairway crest village', { medianPpsf: 570, n: 20 }],
      ['sunriver:forest park', { medianPpsf: 580, n: 12 }],
      ['sunriver:meadow village', { medianPpsf: 590, n: 12 }],
    ])
    const high = walkPricingLadder(
      subject({
        streetAddress: '18004 Tan Oak',
        city: 'Sunriver',
        citySlug: 'sunriver',
        subdivision: 'Fairway Crest Village',
        subdivisionNorm: 'fairway crest village',
        sqft: 2000,
        ...here,
      }),
      [near, vine, ...crest].map((row) => ({ ...row, city: 'Sunriver', citySlug: 'sunriver' })),
      { asOf, cells: highCells },
    )
    expect(high.comps.map((c) => c.listingKey)).toContain('POCKET-NEAR')
    expect(high.comps.map((c) => c.listingKey)).not.toContain('VINE-MAPLE')
    expect(high.comps.find((c) => c.listingKey === 'POCKET-NEAR')?.selectionTier.startsWith('pocket-')).toBe(true)

    const glen = [497_000, 740_000, 780_000].map((closePrice, i) => {
      const sqft = i === 0 ? 1668 : 2200
      return sale({
        listingKey: `GLEN${i}`,
        address: `${2830 + i} Glen`,
        subdivision: 'Juniper Glen',
        subdivisionNorm: 'juniper glen',
        sqft,
        closePrice,
        closePpsf: closePrice / sqft,
        closeDate: '2026-06-01',
        ...at(0.04 + i * 0.01),
      })
    })
    const juniper = sale({
      listingKey: 'JUNIPER-3331',
      address: '3331 Juniper',
      subdivision: 'Willow Springs',
      subdivisionNorm: 'willow springs',
      sqft: 2400,
      closePrice: 475_000,
      closePpsf: 475_000 / 2400,
      closeDate: '2026-07-01',
      ...at(0.19),
    })
    const willowNear = sale({
      listingKey: 'WILLOW-NEAR',
      address: '3340 Willow',
      subdivision: 'Willow Springs',
      subdivisionNorm: 'willow springs',
      sqft: 2400,
      closePrice: 760_000,
      closePpsf: 760_000 / 2400,
      closeDate: '2026-07-02',
      ...at(0.18),
    })
    const lowCells = new Map([
      ['redmond:juniper glen', { medianPpsf: 320, n: 15 }],
      ['redmond:willow springs', { medianPpsf: 300, n: 10 }],
    ])
    const low = walkPricingLadder(
      subject({
        streetAddress: '3028 Indian',
        city: 'Redmond',
        citySlug: 'redmond',
        subdivision: 'Juniper Glen',
        subdivisionNorm: 'juniper glen',
        sqft: 2526,
        ...here,
      }),
      [juniper, willowNear, ...glen].map((row) => ({ ...row, city: 'Redmond', citySlug: 'redmond' })),
      { asOf, cells: lowCells },
    )
    expect(low.comps.map((c) => c.listingKey)).toContain('WILLOW-NEAR')
    expect(low.comps.map((c) => c.listingKey)).toContain('GLEN0')
    expect(low.comps.map((c) => c.listingKey)).not.toContain('JUNIPER-3331')
    expect(low.comps.find((c) => c.listingKey === 'WILLOW-NEAR')?.selectionTier.startsWith('pocket-')).toBe(true)
  })

  it('Vine Maple post-swap: does not let the GLA bracket replace a kept own-plat sale with a different plat about 32% over', () => {
    // 18004 Tan Oak. The own-plat closes are already kept, and every one of
    // them is smaller than the subject, so the bracket wants one larger house.
    // 17901 Red Cedar is the farthest of those. 57692 Vine Maple is a different
    // plat, inside a mile, on the missing side of the GLA, and its close is
    // 32% over the median of those own-plat closes ($1,100,000). The mile ring
    // would allow the swap. The plat close check has to refuse it after the
    // bracket, and Red Cedar stays.
    const ownPlat = [
      { listingKey: 'CATKIN', address: '17902 Catkin', sqft: 2000, closePrice: 1_000_000 },
      { listingKey: 'FIR-CONE', address: '57837 Fir Cone', sqft: 1950, closePrice: 1_170_000 },
      { listingKey: 'RED-CEDAR', address: '17901 Red Cedar', sqft: 1700, closePrice: 1_100_000 },
    ].map((row, i) =>
      sale({
        ...row,
        subdivision: 'Fairway Crest Village',
        subdivisionNorm: 'fairway crest village',
        closePpsf: row.closePrice / row.sqft,
        closeDate: '2026-06-01',
        city: 'Sunriver',
        citySlug: 'sunriver',
        ...at(0.04 + i * 0.02),
      }),
    )
    const medianOwnPlat = 1_100_000
    const vineClose = Math.round(medianOwnPlat * 1.32)
    const vine = sale({
      listingKey: 'VINE-MAPLE',
      address: '57692 Vine Maple',
      subdivision: 'Meadow Village',
      subdivisionNorm: 'meadow village',
      sqft: 2500,
      closePrice: vineClose,
      closePpsf: vineClose / 2500,
      closeDate: '2026-07-02',
      city: 'Sunriver',
      citySlug: 'sunriver',
      ...at(0.14),
    })
    const origin = { lat: here.latitude, lng: here.longitude }
    const vineMiles = distanceMiles(origin, { lat: vine.latitude, lng: vine.longitude })
    expect(vineMiles).not.toBeNull()
    expect(vineMiles!).toBeLessThanOrEqual(1)
    expect(vine.closePrice / medianOwnPlat).toBeGreaterThan(SUBDIVISION_TIER_RATIO)
    const cells = new Map([
      ['sunriver:fairway crest village', { medianPpsf: 560, n: 20 }],
      ['sunriver:meadow village', { medianPpsf: 570, n: 12 }],
    ])
    const out = walkPricingLadder(
      subject({
        streetAddress: '18004 Tan Oak',
        city: 'Sunriver',
        citySlug: 'sunriver',
        subdivision: 'Fairway Crest Village',
        subdivisionNorm: 'fairway crest village',
        sqft: 2200,
        ...here,
      }),
      [...ownPlat, vine],
      { asOf, cells },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('RED-CEDAR')
    expect(keys).toContain('CATKIN')
    expect(keys).toContain('FIR-CONE')
    expect(keys).not.toContain('VINE-MAPLE')
    expect(out.tiersUsed).not.toContain('gla-bracket')
  })

  it('Juniper last-own-plat-swap: does not drop the last own-plat sale and then keep Juniper', () => {
    // 3028 Indian. One own-plat sale is left, and it is the small house the
    // bracket would drop. The only larger sale inside a mile is off-plat and
    // fails the 1.3 close check against that own-plat close. 3331 Juniper is
    // the cheap Willow Springs sale in the quarter-mile pocket. It clears the
    // subdivision-median tier, so it stays out while that own-plat sale is
    // still in the set. The 1.3 band is read before any swap removes it.
    const ownClose = 740_000
    const ownPlat = sale({
      listingKey: 'INDIAN-2834',
      address: '2834 Indian',
      subdivision: 'Juniper Glen',
      subdivisionNorm: 'juniper glen',
      sqft: 2000,
      closePrice: ownClose,
      closePpsf: ownClose / 2000,
      closeDate: '2026-06-01',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0.04),
    })
    const juniperClose = 475_000
    const juniper = sale({
      listingKey: 'JUNIPER-3331',
      address: '3331 Juniper',
      subdivision: 'Willow Springs',
      subdivisionNorm: 'willow springs',
      sqft: 2400,
      closePrice: juniperClose,
      closePpsf: juniperClose / 2400,
      closeDate: '2026-07-01',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0.19),
    })
    const fixSqft = 2800
    const fixPpsf = 460
    const fixClose = fixPpsf * fixSqft
    const sizeFix = sale({
      listingKey: 'FIELDSTONE-388',
      address: '388 29th',
      subdivision: 'Fieldstone',
      subdivisionNorm: 'fieldstone',
      sqft: fixSqft,
      closePrice: fixClose,
      closePpsf: fixPpsf,
      closeDate: '2026-05-01',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0, 0.82),
    })
    const origin = { lat: here.latitude, lng: here.longitude }
    const fixMiles = distanceMiles(origin, { lat: sizeFix.latitude, lng: sizeFix.longitude })
    expect(fixMiles).not.toBeNull()
    expect(fixMiles!).toBeGreaterThan(0.35)
    expect(fixMiles!).toBeLessThanOrEqual(1)
    expect(juniperClose / ownClose).toBeLessThan(1 / SUBDIVISION_TIER_RATIO)
    expect(fixClose / ownClose).toBeGreaterThan(SUBDIVISION_TIER_RATIO)
    const cells = new Map([
      ['redmond:juniper glen', { medianPpsf: 370, n: 15 }],
      ['redmond:willow springs', { medianPpsf: 360, n: 10 }],
      ['redmond:fieldstone', { medianPpsf: 365, n: 10 }],
    ])
    const out = walkPricingLadder(
      subject({
        streetAddress: '3028 Indian',
        city: 'Redmond',
        citySlug: 'redmond',
        subdivision: 'Juniper Glen',
        subdivisionNorm: 'juniper glen',
        sqft: 2526,
        pocketSubdivisionNorms: ['willow springs'],
        ...here,
      }),
      [ownPlat, juniper, sizeFix],
      { asOf, cells },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('INDIAN-2834')
    expect(keys).not.toContain('JUNIPER-3331')
    expect(keys).not.toContain('FIELDSTONE-388')
  })

  it('drops a cheap different-plat pocket sale when no own-plat sale is kept', () => {
    // 3028 Indian. 2834 Indian is outside the wide plat size band, so it never
    // anchors an own-plat median, and this check must not pull it back in.
    // 3331 Juniper at $475,000 is the quarter-mile pocket sale. 1216 SW 32nd,
    // Hayden View, at $550,000 is in the pool. Juniper is inside 30% of that
    // close, so the own-plat 1.3 band is not what removes it. It still has to
    // sit with the comps that were kept, and it loses to Hayden.
    const subjectSqft = 2526
    const tooSmall = sale({
      listingKey: 'INDIAN-2834',
      address: '2834 Indian',
      subdivision: 'Copper Ridge',
      subdivisionNorm: 'copper ridge',
      sqft: 1400,
      closePrice: 497_000,
      closePpsf: 497_000 / 1400,
      closeDate: '2026-06-01',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0.04),
    })
    const juniperClose = 475_000
    const juniper = sale({
      listingKey: 'JUNIPER-3331',
      address: '3331 Juniper',
      subdivision: 'Willow Springs',
      subdivisionNorm: 'willow springs',
      sqft: 2400,
      closePrice: juniperClose,
      closePpsf: juniperClose / 2400,
      closeDate: '2026-07-01',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0.19),
    })
    const haydenClose = 550_000
    const haydenSqft = 2386
    const hayden = sale({
      listingKey: 'HAYDEN-1216',
      address: '1216 SW 32nd',
      subdivision: 'Hayden View',
      subdivisionNorm: 'hayden view',
      sqft: haydenSqft,
      closePrice: haydenClose,
      closePpsf: haydenClose / haydenSqft,
      closeDate: '2026-07-02',
      city: 'Redmond',
      citySlug: 'redmond',
      ...at(0.17),
    })
    const origin = { lat: here.latitude, lng: here.longitude }
    const haydenMiles = distanceMiles(origin, { lat: hayden.latitude, lng: hayden.longitude })
    expect(haydenMiles).not.toBeNull()
    expect(haydenMiles!).toBeGreaterThan(0.15)
    expect(haydenMiles!).toBeLessThan(0.2)
    expect(juniperClose / haydenClose).toBeGreaterThan(1 / SUBDIVISION_TIER_RATIO)
    expect(tooSmall.sqft).toBeLessThan(subjectSqft * (1 - 0.35))
    const cells = new Map([
      ['redmond:copper ridge', { medianPpsf: 230, n: 15 }],
      ['redmond:willow springs', { medianPpsf: 220, n: 12 }],
      ['redmond:hayden view', { medianPpsf: 230, n: 10 }],
    ])
    const out = walkPricingLadder(
      subject({
        streetAddress: '3028 Indian',
        city: 'Redmond',
        citySlug: 'redmond',
        subdivision: 'Copper Ridge',
        subdivisionNorm: 'copper ridge',
        sqft: subjectSqft,
        ...here,
      }),
      [tooSmall, juniper, hayden],
      { asOf, cells },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('HAYDEN-1216')
    expect(keys).not.toContain('JUNIPER-3331')
    expect(keys).not.toContain('INDIAN-2834')
  })
})

describe('the facts pool reaches the rung that names it', () => {
  it('loads a sale one day outside 18 months, and does not load one past 24', () => {
    const asOf = '2026-10-01'
    const ordinary = factsPoolCloseAfter(asOf, false)
    const custom = factsPoolCloseAfter(asOf, true)
    expect(ORDINARY_FACTS_POOL_MONTHS).toBe(24)
    expect(CUSTOM_FACTS_POOL_MONTHS).toBe(30)
    // 1367 Milwaukee closed 2025-03-31, one day before the old 18-month floor.
    expect(ordinary <= '2025-03-31').toBe(true)
    // 1125 Columbia closed about 24.6 months out.
    expect(ordinary > '2024-09-13').toBe(true)
    // Custom/new still reaches past the ordinary floor. Do not shrink it.
    expect(custom < ordinary).toBe(true)
    expect(custom <= '2024-09-13').toBe(true)
  })

  it('keeps a sale one day outside 18 months on a 24-month rung, and a shorter rung does not', () => {
    const asOf = '2026-10-01'
    const milwaukee = sale({
      listingKey: 'MILWAUKEE',
      address: '1367 Milwaukee',
      city: 'Jacksonville',
      citySlug: 'jacksonville',
      subdivision: 'Northwest Townsite',
      subdivisionNorm: 'northwest townsite',
      sqft: 923,
      closePrice: 280_000,
      closePpsf: 280_000 / 923,
      closeDate: '2025-03-31',
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '1400 Jacksonville',
        city: 'Jacksonville',
        citySlug: 'jacksonville',
        subdivision: 'Northwest Townsite',
        subdivisionNorm: 'northwest townsite',
        sqft: 923,
      }),
      [milwaukee],
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).toEqual(['MILWAUKEE'])
    expect(out.comps[0]!.selectionTier).toBe('subdivision-24mo')
    const eighteen = out.rungs.find((r) => r.tier === 'subdivision-18mo')
    expect(eighteen?.ran).toBe(true)
    expect(eighteen?.added).toBe(0)
    expect(out.rungs.find((r) => r.tier === 'subdivision-12mo')?.added).toBe(0)
  })

  it('does not keep a sale past 24 months', () => {
    const asOf = '2026-10-01'
    const columbia = sale({
      listingKey: 'COLUMBIA',
      address: '1125 Columbia',
      city: 'Jacksonville',
      citySlug: 'jacksonville',
      subdivision: 'Northwest Townsite',
      subdivisionNorm: 'northwest townsite',
      sqft: 923,
      baths: 1,
      closePrice: 250_000,
      closePpsf: 250_000 / 923,
      closeDate: '2024-09-13',
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '1400 Jacksonville',
        city: 'Jacksonville',
        citySlug: 'jacksonville',
        subdivision: 'Northwest Townsite',
        subdivisionNorm: 'northwest townsite',
        sqft: 923,
        baths: 2,
      }),
      [columbia],
      { asOf },
    )
    expect(factsPoolCloseAfter(asOf, false) > columbia.closeDate).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('COLUMBIA')
    expect(out.rungs.find((r) => r.tier === 'subdivision-24mo')?.added).toBe(0)
  })
})

describe('Petrosa-shaped resale still prices with brand-new homes in the subdivision', () => {
  const asOfPetrosa = '2026-08-01'
  function petrosaSale(over: Partial<PricingSale>): PricingSale {
    return sale({
      subdivision: 'Petrosa',
      subdivisionNorm: 'petrosa',
      city: 'Bend',
      citySlug: 'bend',
      sqft: 2000,
      lotAcres: 0.15,
      beds: 4,
      baths: 3,
      storyClass: 'two',
      closeDate: '2026-06-15',
      closePrice: 650000,
      ...over,
    })
  }

  it('keeps same-subdivision never-owned sales for a 2021 resale', () => {
    const pool = [
      petrosaSale({
        listingKey: 'tellus-2026',
        address: '3847 Tellus',
        yearBuilt: 2026,
        newConstruction: true,
        closePrice: 659900,
      }),
      petrosaSale({
        listingKey: 'oakside-2025',
        address: '3903 Oakside',
        yearBuilt: 2025,
        newConstruction: true,
        closePrice: 649900,
      }),
      petrosaSale({
        listingKey: 'tellus-2022',
        address: '3759 Tellus',
        yearBuilt: 2022,
        newConstruction: false,
        closePrice: 659000,
      }),
      petrosaSale({
        listingKey: 'tellus-2024',
        address: '3831 Tellus',
        yearBuilt: 2024,
        newConstruction: false,
        closePrice: 645000,
      }),
    ]
    const out = walkPricingLadder(
      subject({
        streetAddress: '3722 NE Petrosa',
        subdivision: 'Petrosa',
        subdivisionNorm: 'petrosa',
        yearBuilt: 2021,
        newConstruction: false,
        sqft: 2000,
        beds: 4,
        baths: 3,
        storyClass: 'two',
        lotAcres: 0.15,
      }),
      pool,
      { asOf: asOfPetrosa },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toContain('tellus-2026')
    expect(keys).toContain('oakside-2025')
    expect(keys).toContain('tellus-2022')
    expect(keys).toContain('tellus-2024')
  })

  it('drops never-owned sales once the resale is past the 5-year window', () => {
    const pool = [
      petrosaSale({
        listingKey: 'tellus-2026',
        address: '3847 Tellus',
        yearBuilt: 2026,
        newConstruction: true,
        closePrice: 659900,
      }),
      petrosaSale({
        listingKey: 'oakside-2023',
        address: '3903 Oakside',
        yearBuilt: 2023,
        newConstruction: true,
        closePrice: 649900,
      }),
      petrosaSale({
        listingKey: 'tellus-2022',
        address: '3759 Tellus',
        yearBuilt: 2022,
        newConstruction: false,
        closePrice: 659000,
      }),
    ]
    const out = walkPricingLadder(
      subject({
        streetAddress: '100 Older',
        subdivision: 'Petrosa',
        subdivisionNorm: 'petrosa',
        yearBuilt: 2017,
        newConstruction: false,
        sqft: 2000,
        beds: 4,
        baths: 3,
        storyClass: 'two',
        lotAcres: 0.15,
      }),
      pool,
      { asOf: asOfPetrosa },
    )
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).not.toContain('tellus-2026')
    expect(keys).not.toContain('oakside-2023')
    expect(keys).toContain('tellus-2022')
  })
})
