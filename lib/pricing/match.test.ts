import { describe, expect, it } from 'vitest'
import { distanceMiles } from '@/lib/cma/market-area'
import { productClassFromFactsRow, SUBDIVISION_TIER_RATIO } from '@/lib/pricing/classes'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import { CUSTOM_FACTS_POOL_MONTHS, factsPoolCloseAfter, ORDINARY_FACTS_POOL_MONTHS } from '@/lib/pricing/ladder'
import { nextRowSubdivisionSlugs, touchingPlatsForSearch } from '@/lib/data/geo/subdivision-ring'
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
    // The price tier is what keeps it, with or without a plat. A recorded plat
    // whose own rows hold no sale walks on inside the neighborhood (rule 15).
    const out = walkPricingLadder(
      subject({ subdivision: null, subdivisionNorm: null, subdivisionSlug: null }),
      pool,
      { asOf, cells },
    )
    expect(out.comps.map((c) => c.listingKey)).toContain('UNNAMED_OK')
    const platted = walkPricingLadder(subject(), pool, { asOf, cells })
    expect(platted.comps.map((c) => c.listingKey)).toContain('UNNAMED_OK')
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

  it('does not stop at three same-subdivision sales; a fourth and a fifth same-sub sale still enter (five price-setting sales, Matt 2026-10-07)', () => {
    const pool = [
      sale({ listingKey: 'A', closeDate: '2026-07-01', address: '10 Kenwood' }),
      sale({ listingKey: 'B', closeDate: '2026-06-20', address: '11 Kenwood' }),
      sale({ listingKey: 'C', closeDate: '2026-06-10', address: '12 Kenwood' }),
      sale({ listingKey: 'D', closeDate: '2026-03-01', address: '13 Kenwood' }),
      sale({ listingKey: 'E', closeDate: '2026-02-01', address: '14 Kenwood' }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(out.comps).toHaveLength(5)
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
    // Walk to 7 (Matt 2026-10-07): seven seats, one of them swapped for the smaller sale.
    expect(out.comps).toHaveLength(7)
    expect(out.comps.filter((c) => c.listingKey.startsWith('BIG'))).toHaveLength(6)
  })

  it('never keeps more than seven priced sales (walk to 7, price on 5+, Matt 2026-10-07)', () => {
    const pool = Array.from({ length: 12 }, (_, i) =>
      sale({
        listingKey: `N${i}`,
        address: `${10 + i} Kenwood`,
        closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
      }),
    )
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(7)
  })

  it('drops a farther sale once seven nearer sales are in, and a same-distance price does not', () => {
    const near = [700_000, 705_000, 710_000, 715_000, 720_000, 735_000, 980_000]
    const pool = [
      ...near.map((closePrice, i) =>
        sale({
          listingKey: `N${i}`,
          address: `${10 + i} Kenwood`,
          closeDate: `2026-07-${String(20 - i).padStart(2, '0')}`,
          closePrice,
          latitude: 44.061,
          longitude: -121.301,
        }),
      ),
      sale({
        listingKey: 'FAR',
        address: '90 Kenwood',
        closeDate: '2026-07-01',
        closePrice: 720_000,
        latitude: 44.061 + 0.4 / 69,
        longitude: -121.301,
      }),
    ]
    const out = walkPricingLadder(subject(), pool, { asOf })
    expect(out.comps).toHaveLength(7)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('FAR')
    expect(out.comps.map((c) => c.listingKey)).toContain('N6')
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
        // Another plat, past a mile. A recorded subdivision does not open a
        // distance ring to take it, and the size bracket does not reach it.
        latitude: 44.06 + 1.6 / 69,
        longitude: -121.3,
        marketArea: 'bend-old-bend',
        closeDate: '2026-07-15',
      }),
    ]
    const out = walkPricingLadder(subject({ sqft: 2500, marketArea: 'bend-old-bend' }), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('NEAR')
    expect(out.comps.map((c) => c.listingKey)).toEqual(expect.arrayContaining(['W1', 'W2', 'W3']))
    expect(out.tiersUsed.some((t) => t.startsWith('subdivision-'))).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('pocket-'))).toBe(false)
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

  it('walks the community after short plat rows, and never takes a remarks mention', () => {
    // A recorded plat's own rows come first. They hold nothing here, so the
    // community is the next step (rules 15 and 19), and membership is the
    // boundary or a member plat, never a remark.
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
    // The community rung takes them. A mile ring does not go first.
    expect(out.comps.every((c) => c.selectionTier.startsWith('community-'))).toBe(true)
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
    // A third same-gen peer. The floor is five price-setting sales (Matt
    // 2026-10-07); custom/new never falls back to the listings ladder that
    // killed Perspective on baths, so a short custom set fails clean.
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
    // Lakes At Tanager is a recorded plat whose own rows hold no sale, so the
    // walk goes on inside the neighborhood to the same-generation peers.
    expect(keys).toContain('PERSPECTIVE')
    expect(keys).toContain('GREENLEAF')
    expect(keys).toContain('NORTH_RIM_2021')
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
    // Sitting in the same neighborhood is not the next row: Aubrey Heights
    // does not touch, and no neighbor ring names it. The plat rows hold one
    // sale, short of the minimum, so the walk reaches it after every plat row,
    // on a ring inside River West (rule 15).
    expect(out.rungs.some((r) => r.added > 0 && r.tier.startsWith('closer-sub-'))).toBe(false)
    expect(tiers.find((t) => t[0] === 'aubrey heights')?.[1]).toMatch(/^nearby-/)
  })

  it('a short plat keeps walking after one outside rung brings the set to three', () => {
    // Kenwood holds nothing. Roanoke, which touches it, holds two. A cheap
    // quarter-mile pocket sale makes three, and three same-neighborhood sales
    // sit past it. The stop reads the plat rows' own count, not the running
    // total: the walk goes on to the ring sales, so the pocket drop cannot
    // leave a two-sale set behind.
    const subj = subject({
      ...RIVER_WEST,
      subdivisionSlug: 'kenwood',
      adjacentSubdivisionSlugs: ['roanoke'],
      pocketSubdivisionNorms: ['juniper'],
    })
    const roanoke = [0, 1].map((i) =>
      sale({
        ...RIVER_WEST,
        latitude: RIVER_WEST.latitude + 0.4 / 69,
        subdivision: 'Roanoke',
        subdivisionNorm: 'roanoke',
        subdivisionSlug: 'roanoke',
        listingKey: `ROANOKE${i}`,
        closeDate: '2026-07-15',
      }),
    )
    const pocket = sale({
      ...RIVER_WEST,
      latitude: RIVER_WEST.latitude + 0.12 / 69,
      subdivision: 'Juniper',
      subdivisionNorm: 'juniper',
      subdivisionSlug: 'juniper',
      listingKey: 'POCKET',
      closePrice: 640_000,
      closeDate: '2026-07-10',
    })
    const ring = [0, 1, 2].map((i) =>
      sale({
        ...RIVER_WEST,
        latitude: RIVER_WEST.latitude + 0.6 / 69,
        subdivision: 'Aubrey Heights',
        subdivisionNorm: 'aubrey heights',
        subdivisionSlug: 'aubrey-heights',
        listingKey: `RING${i}`,
        closeDate: '2026-07-01',
      }),
    )
    const out = walkPricingLadder(subj, [...roanoke, pocket, ...ring], { asOf })
    expect(out.comps.length).toBeGreaterThanOrEqual(3)
    expect(out.comps.some((c) => c.listingKey.startsWith('RING'))).toBe(true)
    expect(out.rungs.some((r) => r.ran && r.tier.startsWith('nearby-'))).toBe(true)
    expect(out.trace.some((t) => t.includes('short of 5, so the search went on'))).toBe(true)
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
    const subj = subject({ ...RIVER_WEST, subdivision: null, subdivisionNorm: null, subdivisionSlug: null })
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

    const stayed = walkPricingLadder(subj, [...inside(3), ...strangers], { asOf })
    expect(stayed.comps.every((c) => c.listingKey.startsWith('IN'))).toBe(true)
    expect(stayed.comps.some((c) => c.selectionTier.startsWith('beyond-'))).toBe(false)
    expect(stayed.trace.join(' ')).not.toMatch(/crossed its boundary/)
  })
})

describe('parent wall and the subdivision crawl (Matt 2026-10-04)', () => {
  const asOf = '2026-10-04'

  it('takes the subdivision through 12 months, then the closest touching plat, and never a home outside the parent', () => {
    const subj = subject({
      latitude: 44.076219,
      longitude: -121.352101,
      marketArea: 'bend-awbrey-butte',
      subdivision: 'Copperstone',
      subdivisionNorm: 'copperstone',
      subdivisionSlug: 'copperstone-phase-one',
      adjacentSubdivisionSlugs: ['copperstone-phases-2-and-3', 'valhalla-heights'],
      closerSubdivisionSlugs: ['shevlin-court', 'awbrey-butte-homesites'],
      communityLocated: true,
      communitySlug: null,
      sqft: 2275,
    })
    const own = sale({
      listingKey: 'OWN12',
      address: '2550 Locke',
      subdivision: 'Copperstone',
      subdivisionNorm: 'copperstone',
      subdivisionSlug: 'copperstone-phase-one',
      marketArea: 'bend-awbrey-butte',
      latitude: 44.0763,
      longitude: -121.3522,
      closeDate: '2025-12-10',
      closePrice: 732_000,
      sqft: 2200,
    })
    const ownOld = sale({
      listingKey: 'OWN14',
      address: '2500 Locke',
      subdivision: 'Copperstone',
      subdivisionNorm: 'copperstone',
      subdivisionSlug: 'copperstone-phase-one',
      marketArea: 'bend-awbrey-butte',
      latitude: 44.0764,
      longitude: -121.3523,
      closeDate: '2025-08-01',
      closePrice: 710_000,
      sqft: 2200,
    })
    const touching = sale({
      listingKey: 'HAVRE',
      address: '2723 Havre',
      subdivision: 'Copperstone',
      subdivisionNorm: 'copperstone',
      subdivisionSlug: 'copperstone-phases-2-and-3',
      marketArea: 'bend-summit-west',
      communityLocated: true,
      communitySlug: null,
      latitude: 44.076143,
      longitude: -121.352887,
      closeDate: '2026-09-15',
      closePrice: 670_000,
      sqft: 2275,
    })
    const nextInParent = sale({
      listingKey: 'GLEN',
      address: '1 Shevlin',
      subdivision: 'Shevlin Court',
      subdivisionNorm: 'shevlin court',
      subdivisionSlug: 'shevlin-court',
      marketArea: 'bend-awbrey-butte',
      communityLocated: true,
      communitySlug: null,
      latitude: 44.0815,
      longitude: -121.353,
      closeDate: '2026-09-10',
      closePrice: 690_000,
      sqft: 2100,
    })
    const fartherInParent = sale({
      listingKey: 'HOMESITES',
      address: '1 Homesites',
      subdivision: 'Awbrey Butte Homesites',
      subdivisionNorm: 'awbrey butte homesites',
      subdivisionSlug: 'awbrey-butte-homesites',
      marketArea: 'bend-awbrey-butte',
      communityLocated: true,
      communitySlug: null,
      latitude: 44.09,
      longitude: -121.355,
      closeDate: '2026-09-01',
      closePrice: 680_000,
      sqft: 2100,
    })
    const resortInsideTheButte = sale({
      listingKey: 'AWG',
      address: '1 Awbrey Glen',
      subdivision: 'Awbrey Glen',
      subdivisionNorm: 'awbrey glen',
      subdivisionSlug: 'awbrey-glen-homesites',
      marketArea: 'bend-awbrey-butte',
      communityLocated: true,
      communitySlug: 'awbrey-glen',
      latitude: 44.084,
      longitude: -121.354,
      closeDate: '2026-09-12',
      closePrice: 900_000,
      sqft: 2200,
    })
    const outside = sale({
      listingKey: 'PHILS',
      address: '362 Phils',
      subdivision: 'Skyliner Summit',
      subdivisionNorm: 'skyliner summit',
      subdivisionSlug: 'skyliner-summit-at-broken-top',
      marketArea: 'bend-summit-west',
      communityLocated: true,
      communitySlug: 'skyliner-summit-at-broken-top',
      latitude: 44.054568,
      longitude: -121.348688,
      closeDate: '2026-09-01',
      closePrice: 925_000,
      sqft: 2300,
    })
    const out = walkPricingLadder(
      subj,
      [outside, resortInsideTheButte, fartherInParent, nextInParent, touching, ownOld, own],
      { asOf },
    )
    const tierOf = (key: string) => out.comps.find((c) => c.listingKey === key)?.selectionTier
    expect(tierOf('OWN12')).toBe('subdivision-12mo')
    expect(tierOf('HAVRE')).toBe('adjacent-sub-3mo')
    expect(tierOf('GLEN')).toMatch(/^closer-sub-/)
    expect(tierOf('PHILS')).toBeUndefined()
    expect(tierOf('AWG')).toBeUndefined()
    expect(out.comps.some((c) => c.selectionTier.startsWith('beyond-') || c.selectionTier.startsWith('nearby-'))).toBe(false)
    const glenAt = out.comps.findIndex((c) => c.listingKey === 'GLEN')
    const homesitesAt = out.comps.findIndex((c) => c.listingKey === 'HOMESITES')
    if (glenAt >= 0 && homesitesAt >= 0) {
      expect(out.comps[glenAt]!.selectionTier).toBe(out.comps[homesitesAt]!.selectionTier)
    }
    const added = out.rungs.filter((r) => r.added > 0).map((r) => r.tier)
    const adjAt = added.indexOf('adjacent-sub-3mo')
    const oldAt = added.findIndex((t) => t === 'subdivision-18mo' || t === 'subdivision-24mo')
    expect(adjAt).toBeGreaterThanOrEqual(0)
    expect(oldAt).toBeGreaterThanOrEqual(0)
    expect(oldAt).toBeLessThan(adjAt)
  })

  it('never takes a sale outside Tetherow, including a plat that touches the boundary', () => {
    const subj = subject({
      latitude: 44.05,
      longitude: -121.39,
      marketArea: null,
      subdivision: 'Tetherow',
      subdivisionNorm: 'tetherow',
      subdivisionSlug: 'tetherow-phase-1',
      adjacentSubdivisionSlugs: ['outside-touch', 'tetherow-phase-2'],
      communityLocated: true,
      communitySlug: 'tetherow',
    })
    const inside = sale({
      listingKey: 'INSIDE',
      address: '1 Tetherow',
      subdivision: 'Tetherow Phase 2',
      subdivisionNorm: 'tetherow phase 2',
      subdivisionSlug: 'tetherow-phase-2',
      marketArea: null,
      communityLocated: true,
      communitySlug: 'tetherow',
      latitude: 44.051,
      longitude: -121.391,
      closeDate: '2026-09-01',
    })
    const touchingOutside = sale({
      listingKey: 'OUTSIDE',
      address: '1 Outside',
      subdivision: 'Outside Touch',
      subdivisionNorm: 'outside touch',
      subdivisionSlug: 'outside-touch',
      marketArea: null,
      communityLocated: true,
      communitySlug: null,
      latitude: 44.0512,
      longitude: -121.392,
      closeDate: '2026-09-02',
    })
    const out = walkPricingLadder(subj, [touchingOutside, inside], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('INSIDE')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('OUTSIDE')
    expect(out.comps.some((c) => c.selectionTier.startsWith('beyond-') || c.selectionTier.startsWith('nearby-'))).toBe(false)
  })

  it('drops a sale from another community once five sales set the price (rule 20, Matt 2026-10-07)', () => {
    const subj = subject({
      latitude: 44.0645,
      longitude: -121.3237,
      marketArea: null,
      subdivision: 'Plain',
      subdivisionNorm: 'plain',
      subdivisionSlug: 'plain-plat',
      adjacentSubdivisionSlugs: [],
      closerSubdivisionSlugs: [],
      communityLocated: true,
      communitySlug: null,
    })
    const own = (key: string) =>
      sale({
        listingKey: key,
        address: `${key} Plain`,
        subdivision: 'Plain',
        subdivisionNorm: 'plain',
        subdivisionSlug: 'plain-plat',
        communityLocated: true,
        communitySlug: null,
        latitude: 44.0646,
        longitude: -121.3238,
        closeDate: '2026-09-01',
      })
    const outsideCommunity = sale({
      listingKey: 'OUT',
      address: '1 Tetherow',
      subdivision: 'Other Tract',
      subdivisionNorm: 'other tract',
      subdivisionSlug: 'other-tract',
      communityLocated: true,
      communitySlug: 'tetherow',
      latitude: 44.0645,
      longitude: -121.3237 + 0.03,
      closeDate: '2026-09-01',
    })
    const out = walkPricingLadder(subj, [own('A'), own('B'), own('C'), own('D'), own('E'), outsideCommunity], { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(out.comps.map((c) => c.listingKey)).not.toContain('OUT')
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
      sqft: 2020,
      beds: 3,
      baths: 2,
      lotAcres: 0.22,
    })

  // MATT'S CALL, OPEN (2026-10-07, five price-setting sales): SaddleStone
  // holds three gold rows, so the plat rows are short of five and the walk
  // now goes on into the Horse Back and Ranch pocket rows (five across the
  // pocket, decoys still absent). Re-fixture only once Matt chooses between
  // five across the pocket and two more SaddleStone rows.
  it.skip('prefers the Flex gold SaddleStone / Horse Back / Ranch set over Clearpine and Forest Edge', () => {
    const gold = FLEX_GOLD.map((row, i) => goldSale(row, i))
    const decoys = [upmarket('Clearpine', 2.2, 890_000), upmarket('Forest Edge', 2.5, 860_000)]
    const out = walkPricingLadder(canterSubject(), [...decoys, ...gold], { asOf })
    const numbers = out.comps.map((c) => c.listNumber)
    expect(out.comps).toHaveLength(3)
    expect(out.comps.every((c) => c.subdivision === 'SaddleStone')).toBe(true)
    expect(numbers.every((n) => FLEX_GOLD.some((g) => g.mls === n && g.name === 'SaddleStone'))).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-ForestEdge')
    expect(out.comps.every((c) => !/clearpine|forest edge|horse back|^ranch$/i.test(c.subdivision ?? ''))).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('pocket-') || t.startsWith('similar-sub') || t.startsWith('city-'))).toBe(
      false,
    )
    expect(out.pocketStarved).toBe(true)
    expect(out.exclusiveCount).toBe(3)
    const closes = out.comps.map((c) => c.closePrice).sort((a, b) => a - b)
    const mid = closes[Math.floor(closes.length / 2)]!
    expect(mid).toBeGreaterThanOrEqual(649_000)
    expect(mid).toBeLessThanOrEqual(675_000)
    expect(mid).toBeLessThan(846_000)
  })

  // Same open call as above: with five across the pocket the exclusive count
  // is five, so pocketStarved reads false.
  it.skip('keeps year/quality from outranking radius while the pocket is filled', () => {
    const gold = FLEX_GOLD.map((row, i) => goldSale(row, i))
    const decoys = [upmarket('Clearpine', 2.2, 890_000), upmarket('Forest Edge', 2.5, 860_000)]
    const customCanter = subject({
      ...canterSubject(),
      yearBuilt: 2020,
      publicRemarks: 'Custom built modern home.',
    })
    const out = walkPricingLadder(customCanter, [...decoys, ...gold], { asOf })
    expect(out.pocketStarved).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-Clearpine')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UP-ForestEdge')
    expect(out.comps.some((c) => c.subdivision === 'SaddleStone')).toBe(true)
    expect(out.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('pocket-'))).toBe(false)
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

  it('opens the quarter-mile pocket for a named plat only while its rows hold fewer than five price-setting sales (Matt 2026-10-07)', () => {
    const platOf = (prices: number[]) => prices.map((closePrice, i) =>
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
      [...platOf([770_000, 790_000]), ...pocket],
      { asOf },
    )
    // Two plat sales are short of the minimum: the pocket fills the set.
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys.some((k) => k.startsWith('POCKET'))).toBe(true)
    expect(keys.some((k) => k.startsWith('PLAT'))).toBe(true)
    // Three plat sales are still short of five: the pocket opens too.
    const three = walkPricingLadder(
      subject({
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        sqft: 2186,
        pocketSubdivisionNorms: ['north trailside'],
      }),
      [...platOf([770_000, 780_000, 790_000]), ...pocket],
      { asOf },
    )
    expect(three.comps.map((c) => c.listingKey).some((k) => k.startsWith('POCKET'))).toBe(true)
    // Five plat sales hold the floor: the plat rows are the set, the pocket
    // is skipped before it runs, and every rung after the stop says so.
    const full = walkPricingLadder(
      subject({
        subdivision: 'Redtail Ridge',
        subdivisionNorm: 'redtail ridge',
        sqft: 2186,
        pocketSubdivisionNorms: ['north trailside'],
      }),
      [...platOf([770_000, 775_000, 780_000, 785_000, 790_000]), ...pocket],
      { asOf },
    )
    expect(full.comps.map((c) => c.listingKey).some((k) => k.startsWith('POCKET'))).toBe(false)
    expect(full.comps).toHaveLength(5)
    const pocketRung = full.rungs.find((r) => r.tier === 'pocket-3mo')
    expect(pocketRung?.ran).toBe(false)
    expect(pocketRung?.skippedReason).toMatch(/own plat already has 5 price-setting sales/)
    const later = full.rungs.find((r) => r.tier === 'nearby-0.25mi-3mo')
    expect(later?.ran).toBe(false)
    expect(later?.skippedReason).toMatch(/already has 5 price-setting sales/)
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
    // Two plat sales are short of the minimum, so the pocket runs, and the
    // close-price check still keeps Vine Maple out.
    expect(high.comps.map((c) => c.listingKey)).toEqual(expect.arrayContaining(['CREST0', 'CREST1']))
    expect(high.comps.map((c) => c.listingKey)).toContain('POCKET-NEAR')
    expect(high.comps.map((c) => c.listingKey)).not.toContain('VINE-MAPLE')
    expect(high.comps.find((c) => c.listingKey === 'POCKET-NEAR')?.selectionTier.startsWith('pocket-')).toBe(true)

    // Five plat sales (Matt 2026-10-07), so the plat rows hold the floor
    // and the pocket is never opened for a close far from them.
    const glen = [497_000, 740_000, 780_000, 750_000, 765_000].map((closePrice, i) => {
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
    expect(low.comps.map((c) => c.listingKey)).not.toContain('WILLOW-NEAR')
    expect(low.comps.map((c) => c.listingKey)).toContain('GLEN0')
    expect(low.comps.map((c) => c.listingKey)).not.toContain('JUNIPER-3331')
    expect(low.tiersUsed.some((t) => t.startsWith('pocket-'))).toBe(false)
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
    // 3028 Indian sits in Copper Ridge. 2834 Indian is outside the wide plat
    // size band, so the plat rows hold nothing and the walk goes on (rule 15).
    // 3331 Juniper at $475,000 and 1216 SW 32nd (Hayden View) at $550,000 sit
    // inside a quarter mile in other plats. Juniper is inside 30% of Hayden, so
    // the own-plat 1.3 band is not what removes it. It still has to sit with
    // the comps that were kept, and it loses to Hayden.
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

describe('next row is touching plats, not every plat in the parent (Matt 2026-10-06)', () => {
  it('leaves out a plat that merely sits in the parent', () => {
    const next = nextRowSubdivisionSlugs({
      subjectSlug: 'copperstone-phase-one',
      firstRingSlugs: ['copperstone-phases-2-and-3'],
      subjectHasNeighborhood: true,
      neighborRings: [
        {
          homeSlug: 'copperstone-phases-2-and-3',
          plats: [
            { slug: 'shevlin-court', gapM: 0, pointM: 400, inNeighborhood: true },
            { slug: 'copperstone-phase-one', gapM: 0, pointM: 80, inNeighborhood: true },
          ],
        },
      ],
    })
    expect(next).toEqual(['shevlin-court'])
    expect(next).not.toContain('awbrey-glen-homesites')
  })

  it('drops a touching plat whose neighborhood flag is false when the subject has a neighborhood', () => {
    const ring = [
      { slug: 'inside-touch', label: 'Inside Touch', gapM: 0, pointM: 120, inNeighborhood: true, rank: 1 },
      { slug: 'outside-touch', label: 'Outside Touch', gapM: 0, pointM: 40, inNeighborhood: false, rank: 0 },
      { slug: 'untested', label: 'Untested', gapM: 0, pointM: 200, inNeighborhood: null, rank: 2 },
    ]
    expect(touchingPlatsForSearch(ring, true).map((p) => p.slug)).toEqual(['inside-touch', 'untested'])
    expect(touchingPlatsForSearch(ring, false).map((p) => p.slug)).toEqual(['outside-touch', 'inside-touch', 'untested'])
  })

  it('walks a quarter mile before a mile when the subject has no plat', () => {
    const asOf = '2026-10-06'
    const here = { latitude: 44.06, longitude: -121.3, marketArea: null as string | null }
    const close = sale({
      ...here,
      listingKey: 'QUARTER',
      address: '10 Near Lane',
      subdivision: null,
      subdivisionNorm: null,
      latitude: here.latitude + 0.15 / 69,
      closeDate: '2026-09-01',
    })
    const mile = sale({
      ...here,
      listingKey: 'MILE',
      address: '80 Far Lane',
      subdivision: null,
      subdivisionNorm: null,
      latitude: here.latitude + 0.9 / 69,
      closeDate: '2026-09-01',
    })
    const out = walkPricingLadder(
      subject({
        ...here,
        streetAddress: '1 Open Ground',
        subdivision: null,
        subdivisionNorm: null,
        subdivisionSlug: null,
      }),
      [mile, close],
      { asOf },
    )
    const quarterAt = out.rungs.findIndex((r) => r.tier === 'nearby-0.25mi-3mo' && r.added > 0)
    const mileAt = out.rungs.findIndex((r) => r.tier === 'nearby-1mi-3mo' && r.added > 0)
    expect(out.comps.find((c) => c.listingKey === 'QUARTER')?.selectionTier).toBe('nearby-0.25mi-3mo')
    expect(quarterAt).toBeGreaterThanOrEqual(0)
    expect(mileAt).toBeGreaterThan(quarterAt)
    expect(out.comps.find((c) => c.listingKey === 'MILE')?.selectionTier.startsWith('nearby-0.25')).toBe(false)
  })
})

describe('overflow — closest homes, then the plat that resembles this one (Matt 2026-10-06)', () => {
  const asOf = '2026-08-01'
  const here = { latitude: 44.06, longitude: -121.3, communityLocated: true as const, communitySlug: null }

  function atMiles(miles: number) {
    return { latitude: here.latitude + miles / 69, longitude: here.longitude }
  }

  it('keeps the nearer sales when one adjacent plat qualifies more than five', () => {
    const subj = subject({
      ...here,
      subdivision: 'Old Ground',
      subdivisionNorm: 'old ground',
      subdivisionSlug: 'old-ground',
      adjacentSubdivisionSlugs: ['like-neighbors'],
      yearBuilt: 1998,
      sqft: 2000,
    })
    const row = (listingKey: string, miles: number) =>
      sale({
        ...here,
        ...atMiles(miles),
        listingKey,
        address: `${listingKey} Like Ln`,
        subdivision: 'Like Neighbors',
        subdivisionNorm: 'like neighbors',
        subdivisionSlug: 'like-neighbors',
        yearBuilt: 1996,
        sqft: 2000,
        beds: 3,
        baths: 2,
        closeDate: '2026-06-01',
        closePrice: 700_000,
      })
    // Far sales are first in the pool. The walk used to stop at five in that order.
    const pool = [
      ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'].map((key) => row(key, 0.3)),
      ...['N1', 'N2', 'N3'].map((key) => row(key, 0.05)),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    const keys = out.comps.map((c) => c.listingKey)
    // Seven seats (walk to 7, Matt 2026-10-07): the three near sales and four far ones.
    expect(keys).toHaveLength(7)
    expect(keys).toEqual(expect.arrayContaining(['N1', 'N2', 'N3']))
    expect(keys.filter((key) => key.startsWith('F'))).toHaveLength(4)
  })

  it('fills an adjacent row from the plat whose homes match this subdivision before a newer closer plat', () => {
    const subj = subject({
      ...here,
      subdivision: 'Old Ground',
      subdivisionNorm: 'old ground',
      subdivisionSlug: 'old-ground',
      // The newer plat is first. Slug order must not decide the seats.
      adjacentSubdivisionSlugs: ['new-homes', 'like-neighbors'],
      yearBuilt: 1998,
      sqft: 2000,
    })
    const row = (listingKey: string, slug: string, name: string, yearBuilt: number, miles: number) =>
      sale({
        ...here,
        ...atMiles(miles),
        listingKey,
        address: `${listingKey} Adj Ln`,
        subdivision: name,
        subdivisionNorm: name.toLowerCase(),
        subdivisionSlug: slug,
        yearBuilt,
        sqft: 2000,
        beds: 3,
        baths: 2,
        closeDate: '2026-06-01',
        closePrice: 700_000,
      })
    const pool = [
      ...['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5'].map((key) => row(key, 'new-homes', 'New Homes', 2012, 0.2)),
      row('NEWCLOSE', 'new-homes', 'New Homes', 2012, 0.08),
      ...['L1', 'L2', 'L3', 'L4'].map((key) => row(key, 'like-neighbors', 'Like Neighbors', 1997, 0.3)),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    const keys = out.comps.map((c) => c.listingKey)
    // Seven seats: the four like-plat homes first, then the nearest three of the newer plat.
    expect(keys).toHaveLength(7)
    expect(keys).toEqual(expect.arrayContaining(['L1', 'L2', 'L3', 'L4', 'NEWCLOSE']))
    expect(keys.filter((key) => key.startsWith('NEW'))).toHaveLength(3)
  })

  it('keeps the seven closest own-plat sales when a farther cluster sits on the middle price', () => {
    const subj = subject({
      ...here,
      subdivision: 'Old Ground',
      subdivisionNorm: 'old ground',
      subdivisionSlug: 'old-ground',
      yearBuilt: 1998,
      sqft: 2000,
    })
    const row = (listingKey: string, miles: number, closePrice: number) =>
      sale({
        ...here,
        ...atMiles(miles),
        listingKey,
        address: `${listingKey} Own Ln`,
        subdivision: 'Old Ground',
        subdivisionNorm: 'old ground',
        subdivisionSlug: 'old-ground',
        yearBuilt: 1996,
        sqft: 2000,
        beds: 3,
        baths: 2,
        closeDate: '2026-06-01',
        closePrice,
        lastAsk: closePrice,
      })
    const pool = [
      row('C400', 0.04, 400_000),
      row('C450', 0.04, 450_000),
      row('C500', 0.04, 500_000),
      row('C800', 0.04, 800_000),
      row('C900', 0.04, 900_000),
      row('C950', 0.04, 950_000),
      row('C1000', 0.04, 1_000_000),
      row('F640', 0.3, 640_000),
      row('F650', 0.3, 650_000),
      row('F660', 0.3, 660_000),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['C1000', 'C400', 'C450', 'C500', 'C800', 'C900', 'C950'])
  })

  it('does not give an own-plat seat to a closer adjacent sale', () => {
    const subj = subject({
      ...here,
      subdivision: 'Old Ground',
      subdivisionNorm: 'old ground',
      subdivisionSlug: 'old-ground',
      adjacentSubdivisionSlugs: ['like-neighbors'],
      yearBuilt: 1998,
      sqft: 2000,
    })
    const own = ['OWN1', 'OWN2'].map((listingKey) =>
      sale({
        ...here,
        ...atMiles(0.4),
        listingKey,
        address: `${listingKey} Own Ln`,
        subdivision: 'Old Ground',
        subdivisionNorm: 'old ground',
        subdivisionSlug: 'old-ground',
        yearBuilt: 1976,
        sqft: 2000,
        closeDate: '2026-06-01',
        closePrice: 700_000,
      }),
    )
    const adjacent = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'].map((listingKey) =>
      sale({
        ...here,
        ...atMiles(0.05),
        listingKey,
        address: `${listingKey} Adj Ln`,
        subdivision: 'Like Neighbors',
        subdivisionNorm: 'like neighbors',
        subdivisionSlug: 'like-neighbors',
        yearBuilt: 1998,
        sqft: 2000,
        closeDate: '2026-06-01',
        closePrice: 700_000,
      }),
    )
    const out = walkPricingLadder(subj, [...adjacent, ...own], { asOf })
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toHaveLength(7)
    expect(keys).toEqual(expect.arrayContaining(['OWN1', 'OWN2']))
    expect(keys.filter((key) => key.startsWith('A'))).toHaveLength(5)
  })

  it('fills from the same-size adjacent plat before a closer plat of smaller homes', () => {
    const subj = subject({
      ...here,
      subdivision: 'Old Ground',
      subdivisionNorm: 'old ground',
      subdivisionSlug: 'old-ground',
      adjacentSubdivisionSlugs: ['small-homes', 'same-size'],
      yearBuilt: 1998,
      sqft: 2000,
    })
    const row = (listingKey: string, slug: string, name: string, sqft: number, miles: number) =>
      sale({
        ...here,
        ...atMiles(miles),
        listingKey,
        address: `${listingKey} Size Ln`,
        subdivision: name,
        subdivisionNorm: name.toLowerCase(),
        subdivisionSlug: slug,
        yearBuilt: 1996,
        sqft,
        beds: 3,
        baths: 2,
        closeDate: '2026-06-01',
        closePrice: 700_000,
      })
    const pool = [
      ...['S1', 'S2', 'S3', 'S4', 'S5'].map((key) => row(key, 'small-homes', 'Small Homes', 1400, 0.08)),
      ...['M1', 'M2', 'M3', 'M4'].map((key) => row(key, 'same-size', 'Same Size', 2000, 0.28)),
    ]
    const out = walkPricingLadder(subj, pool, { asOf })
    const keys = out.comps.map((c) => c.listingKey)
    expect(keys).toHaveLength(7)
    expect(keys.filter((key) => key.startsWith('M'))).toHaveLength(4)
    expect(keys.filter((key) => key.startsWith('S'))).toHaveLength(3)
  })
})

describe('five price-setting sales is the floor, and a sale that does not set the price never counts (rule 20, Matt 2026-10-07)', () => {
  // Open high desert south-east of Bend: outside every mapped neighborhood
  // polygon, east of US-97 and the Deschutes, so no wall but the community
  // one is in play. One tract, one touching plat, the rest seven miles out.
  const HERE = { latitude: 43.6, longitude: -121.0 }
  const plain = (over: Partial<PricingSubject> = {}) =>
    subject({
      ...HERE,
      marketArea: null,
      subdivision: 'Plain',
      subdivisionNorm: 'plain',
      subdivisionSlug: 'plain-plat',
      adjacentSubdivisionSlugs: ['touch-plat'],
      closerSubdivisionSlugs: [],
      communityLocated: true,
      communitySlug: null,
      ...over,
    })
  const own = (key: string, i: number) =>
    sale({
      listingKey: key,
      address: `${10 + i} Plain Rd`,
      subdivision: 'Plain',
      subdivisionNorm: 'plain',
      subdivisionSlug: 'plain-plat',
      communityLocated: true,
      communitySlug: null,
      latitude: HERE.latitude + (0.02 * (i + 1)) / 69,
      longitude: HERE.longitude,
      closeDate: '2026-07-01',
    })
  const touching = (key: string, i: number) =>
    sale({
      listingKey: key,
      address: `${20 + i} Touch Rd`,
      subdivision: 'Touch',
      subdivisionNorm: 'touch',
      subdivisionSlug: 'touch-plat',
      communityLocated: true,
      communitySlug: null,
      latitude: HERE.latitude + (0.3 + 0.02 * i) / 69,
      longitude: HERE.longitude,
      closeDate: '2026-07-01',
    })
  // Seven miles out: past every ring, the similar-sub four miles, the city
  // five, so only the widened (whenStarved) rung can take it.
  const far = (key: string, i: number, over: Partial<PricingSale> = {}) =>
    sale({
      listingKey: key,
      address: `${30 + i} Far Rd`,
      subdivision: 'Far Plat',
      subdivisionNorm: 'far plat',
      subdivisionSlug: 'far-plat',
      communityLocated: true,
      communitySlug: null,
      latitude: HERE.latitude + (7 + 0.02 * i) / 69,
      longitude: HERE.longitude,
      closeDate: '2026-07-01',
      ...over,
    })
  // A sale whose address sits inside a resort community: a different
  // community than the subject, so it never sets the price (rule 20). The
  // MLS name is not a resort alias; location alone makes it one.
  const inCommunity = (key: string, i: number) =>
    far(key, i, {
      address: `${40 + i} Resort Rd`,
      subdivision: 'Resort Tract',
      subdivisionNorm: 'resort tract',
      subdivisionSlug: 'resort-tract',
      communitySlug: 'tetherow',
    })

  it('a sale that does not set the price is not admitted and does not count toward five; the walk goes on in order', () => {
    const pool = [own('A', 0), own('B', 1), touching('C', 0), touching('D', 1), inCommunity('COMMUNITY', 0), far('E', 1)]
    const out = walkPricingLadder(plain(), pool, { asOf })
    const keys = out.comps.map((c) => c.listingKey).sort()
    expect(keys).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(keys).not.toContain('COMMUNITY')
    expect(out.comps.every((c) => c.setsPrice === true)).toBe(true)
    const widened = out.rungs.find((r) => r.tier === 'widened-disclosed-24mo')
    expect(widened?.ran).toBe(true)
    expect(widened?.notSetting).toBe(1)
    expect(widened?.runningTotal).toBe(5)
    // The touching plats ran before the widening, in the locked order.
    const ranTiers = out.rungs.filter((r) => r.ran).map((r) => r.tier)
    expect(ranTiers.findIndex((t) => t.startsWith('adjacent-sub-'))).toBeGreaterThanOrEqual(0)
    expect(ranTiers.findIndex((t) => t.startsWith('adjacent-sub-'))).toBeLessThan(ranTiers.indexOf('widened-disclosed-24mo'))
    expect(out.trace.some((t) => t.includes('do not set the price'))).toBe(true)
    expect(out.trace.some((t) => t.includes('Comp shortage'))).toBe(false)
    expect(out.reachedTarget).toBe(true)
  })

  it('no wall is crossed to reach five: a confined subject ends short and fails as a comp shortage', () => {
    // Inside a mapped neighborhood, three setters inside it, ten sales
    // outside the parent. The parent wall holds on every rung that could
    // leave it, so the walk ends at three.
    const RIVER_WEST = { latitude: 44.0645, longitude: -121.3237, marketArea: 'bend-river-west' }
    const confined = subject({
      ...RIVER_WEST,
      subdivision: 'Kenwood',
      subdivisionNorm: 'kenwood',
      subdivisionSlug: 'kenwood',
      adjacentSubdivisionSlugs: [],
      closerSubdivisionSlugs: [],
    })
    const inside = [0, 1, 2].map((i) =>
      sale({
        ...RIVER_WEST,
        latitude: RIVER_WEST.latitude + (0.05 * (i + 1)) / 69,
        listingKey: `IN${i}`,
        address: `${50 + i} Kenwood`,
        closeDate: '2026-07-01',
      }),
    )
    const outside = Array.from({ length: 10 }, (_, i) =>
      sale({
        latitude: 44.02 + (0.02 * i) / 69,
        longitude: -121.25,
        marketArea: 'bend-southeast',
        listingKey: `OUT${i}`,
        address: `${60 + i} Far St`,
        subdivision: 'Far Plat',
        subdivisionNorm: 'far plat',
        subdivisionSlug: 'far-plat',
        closeDate: '2026-07-01',
      }),
    )
    const out = walkPricingLadder(confined, [...inside, ...outside], { asOf })
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['IN0', 'IN1', 'IN2'])
    expect(out.starved).toBe(true)
    const leaving = out.rungs.filter(
      (r) => r.tier.startsWith('like-community-') || r.tier.startsWith('beyond-') || r.tier === 'widened-disclosed-24mo',
    )
    expect(leaving.length).toBeGreaterThan(0)
    for (const rung of leaving) {
      expect(rung.ran).toBe(false)
      // The peer-resort rung is refused first for not being a resort; the
      // boundary and widening rungs are refused by the parent wall.
      expect(rung.skippedReason).toMatch(
        /neighborhood or community|outside every mapped boundary|not inside a golf or resort community/,
      )
    }
    expect(out.rungs.find((r) => r.tier === 'widened-disclosed-24mo')?.skippedReason).toMatch(/neighborhood or community/)
    expect(out.trace.some((t) => t.includes('Comp shortage: only 3 price-setting sale(s)'))).toBe(true)
  })

  it('the cap hands its seats to setters only', () => {
    // Six setters, and a community sale met on the way: six seats (under the
    // walk cap of seven), every one a setter.
    const pool = [
      own('A', 0),
      own('B', 1),
      touching('C', 0),
      touching('D', 1),
      inCommunity('COMMUNITY', 0),
      far('E', 1),
      far('F', 2),
    ]
    const out = walkPricingLadder(plain(), pool, { asOf })
    expect(out.comps).toHaveLength(6)
    expect(out.comps.every((c) => c.setsPrice === true)).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('COMMUNITY')
  })

  it('the GLA bracket never imports a sale that does not set the price', () => {
    // Every kept sale is larger than the subject; the only smaller candidate
    // sits in a resort community. The bracket reads rule 20 and leaves the
    // set alone.
    const larger = [0, 1, 2, 3, 4].map((i) => own(`BIG${i}`, i))
    const smallInCommunity = {
      ...own('SMALL', 5),
      address: '99 Resort Rd',
      subdivision: 'Resort Tract',
      subdivisionNorm: 'resort tract',
      subdivisionSlug: 'resort-tract',
      communitySlug: 'tetherow',
      sqft: 1700,
      closePpsf: 700_000 / 1700,
    }
    const out = walkPricingLadder(plain({ sqft: 1850, subdivisionSlug: null }), [...larger, smallInCommunity], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('SMALL')
    expect(out.tiersUsed).not.toContain('gla-bracket')
    expect(out.trace.some((t) => t.startsWith('GLA bracket'))).toBe(false)
  })

  it('four price-setting sales after the full ladder is a comp shortage, not a padded set', () => {
    const pool = [own('A', 0), own('B', 1), touching('C', 0), touching('D', 1), inCommunity('X', 0), inCommunity('Y', 1)]
    const out = walkPricingLadder(plain(), pool, { asOf })
    expect(out.comps).toHaveLength(4)
    expect(out.starved).toBe(true)
    expect(out.trace.some((t) => t.includes('Comp shortage: only 4 price-setting sale(s)'))).toBe(true)
    expect(out.trace.some((t) => /once \d+ sales do/.test(t))).toBe(false)
    const widened = out.rungs.find((r) => r.tier === 'widened-disclosed-24mo')
    expect(widened?.notSetting).toBe(2)
    expect(widened?.added).toBe(0)
  })

  it('a duplex by its remarks never prices a single-family home (rule 23, 1531 10th against 915 Saginaw)', () => {
    const remarks =
      "Exceptional opportunity on Bend's highly desirable Westside! This beautifully updated duplex features a 3 bed/2 bath upper unit and a 1 bed/1 bath lower unit."
    const duplex = {
      ...own('TENTH-1531', 0),
      address: '1531 NW 10th',
      publicRemarks: remarks,
      productClass: productClassFromFactsRow('detached', 'Single Family Residence', remarks),
    }
    expect(duplex.productClass).toBe('multi-unit')
    const pool = [duplex, own('A', 1), own('B', 2), own('C', 3), own('D', 4), own('E', 5)]
    const out = walkPricingLadder(plain(), pool, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TENTH-1531')
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

describe('the GLA bracket never crosses a wall the walk would not cross (review, 2026-10-07)', () => {
  // River West is the parent neighborhood. The subject carries no plat (its
  // MLS row says N/A), so the size swap draws from the pool at large. Every
  // ring rung refuses a sale from the neighboring polygon; the swap has to
  // refuse it by the same wall.
  const RIVER_WEST = { latitude: 44.0645, longitude: -121.3237, marketArea: 'bend-river-west' }
  const home = () =>
    subject({
      ...RIVER_WEST,
      subdivision: 'N/A',
      subdivisionNorm: null,
      subdivisionSlug: null,
      adjacentSubdivisionSlugs: [],
      closerSubdivisionSlugs: [],
      sqft: 2000,
    })
  // Five setters inside River West, every one larger than the subject.
  const larger = [0, 1, 2, 3, 4].map((i) =>
    sale({
      ...RIVER_WEST,
      latitude: RIVER_WEST.latitude + (0.05 * (i + 1)) / 69,
      listingKey: `RW${i}`,
      address: `${70 + i} River West Ln`,
      subdivision: 'N/A',
      subdivisionNorm: null,
      sqft: 2200,
      closePrice: 770_000,
      closePpsf: 350,
      lastAsk: 775_000,
      closeDate: '2026-07-01',
    }),
  )
  const smaller = (over: Partial<PricingSale>) =>
    sale({
      listingKey: 'SMALL',
      address: '1 Small Rd',
      subdivision: 'N/A',
      subdivisionNorm: null,
      sqft: 1700,
      closePrice: 595_000,
      closePpsf: 350,
      lastAsk: 599_000,
      closeDate: '2026-07-01',
      ...over,
    })

  it('does not swap in a smaller sale from the neighboring polygon that every ring rung refused', () => {
    // A tenth of a mile away, so the first ring rung scans it and the
    // neighborhood wall refuses it there.
    const awbrey = smaller({
      listingKey: 'AWBREY',
      latitude: RIVER_WEST.latitude - 0.1 / 69,
      longitude: RIVER_WEST.longitude,
      marketArea: 'bend-awbrey-butte',
    })
    const out = walkPricingLadder(home(), [...larger, awbrey], { asOf })
    expect(out.rungs.find((r) => r.tier === 'nearby-0.25mi-3mo')?.ran).toBe(true)
    expect(out.comps.map((c) => c.listingKey)).not.toContain('AWBREY')
    expect(out.comps.map((c) => c.listingKey).sort()).toEqual(['RW0', 'RW1', 'RW2', 'RW3', 'RW4'])
    expect(out.tiersUsed).not.toContain('gla-bracket')
    expect(out.trace.some((t) => t.startsWith('GLA bracket'))).toBe(false)
  })

  it('still swaps in the smaller sale when it sits inside the same neighborhood', () => {
    // Farther out than the five, so the walk stops before it and only the
    // size swap can reach it.
    const inside = smaller({ ...RIVER_WEST, listingKey: 'INSIDE', latitude: RIVER_WEST.latitude - 0.8 / 69 })
    const out = walkPricingLadder(home(), [...larger, inside], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('INSIDE')
    expect(out.comps).toHaveLength(5)
    expect(out.trace.some((t) => t.startsWith('GLA bracket: replaced'))).toBe(true)
  })
})

describe('walk to 7, price on 5+ (Matt 2026-10-07)', () => {
  // The ruling: keep walking past five, up to seven, while the same area
  // still holds qualifying sales, so the comparability review can drop one or
  // two and still leave five. Nothing widens the area to get them. The
  // subject's own ground (own street, own plat, its pocket) is the same area
  // across its whole window; every rung that widens the area stops at five.
  // The cap seats own ground first, then the closest homes of an over-full place.
  const asOf = '2026-08-01'
  const here = { latitude: 44.06, longitude: -121.3, communityLocated: true as const, communitySlug: null }
  const at = (miles: number) => ({ latitude: here.latitude + miles / 69, longitude: here.longitude })
  const subj = () =>
    subject({
      ...here,
      subdivisionSlug: 'kenwood',
      adjacentSubdivisionSlugs: ['aubrey'],
      closerSubdivisionSlugs: [],
    })
  // Same size as the subject, so the GLA bracket has nothing to swap and the
  // set is the walk's own.
  const plat = (listingKey: string, miles: number, closeDate: string) =>
    sale({
      ...here,
      ...at(miles),
      listingKey,
      address: `${listingKey} Kenwood Ln`,
      subdivisionSlug: 'kenwood',
      sqft: 2000,
      closeDate,
    })
  const adj = (listingKey: string, miles: number, closeDate: string) =>
    sale({
      ...here,
      ...at(miles),
      listingKey,
      address: `${listingKey} Aubrey Ln`,
      subdivision: 'Aubrey',
      subdivisionNorm: 'aubrey',
      subdivisionSlug: 'aubrey',
      sqft: 2000,
      closeDate,
    })
  const ring = (listingKey: string, miles: number, closeDate: string) =>
    sale({
      ...here,
      ...at(miles),
      listingKey,
      address: `${listingKey} Open Rd`,
      subdivision: null,
      subdivisionNorm: null,
      sqft: 2000,
      closeDate,
    })
  const THREE_MO = '2026-07-01'
  const SIX_MO = '2026-03-15'
  const EIGHTEEN_MO = '2025-03-01'
  const TWENTY_FOUR_MO = '2024-10-01'
  const keysOf = (out: ReturnType<typeof walkPricingLadder>) => out.comps.map((c) => c.listingKey).sort()
  const rung = (out: ReturnType<typeof walkPricingLadder>, tier: string) => out.rungs.find((r) => r.tier === tier)

  it('a wider rung holding seven or more after reaching five yields seven: own ground first, then that rung\'s closest homes', () => {
    const pool = [
      plat('O1', 0.3, THREE_MO),
      plat('O2', 0.3, THREE_MO),
      // adjacent-sub-3mo: eight sales; the rung reaches five and holds three more than seven needs.
      ...[0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05].map((miles, i) => adj(`A${8 - i}`, miles, THREE_MO)),
      // adjacent-sub-6mo: the closest sale in the pool. A wider rung once five is held.
      adj('A6MO', 0.01, SIX_MO),
    ]
    const out = walkPricingLadder(subj(), pool, { asOf })
    expect(out.comps).toHaveLength(7)
    // A1 to A5 sit at 0.05 to 0.25 miles: the five closest of the rung that reached five.
    expect(keysOf(out)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'O1', 'O2'])
    expect(rung(out, 'adjacent-sub-3mo')?.added).toBe(8)
    expect(rung(out, 'adjacent-sub-6mo')?.ran).toBe(false)
    expect(rung(out, 'adjacent-sub-6mo')?.skippedReason).toMatch(/already has 10 price-setting sales/)
    expect(out.reachedTarget).toBe(true)
  })

  it('once five is reached no sale from a rung that widens the area enters, even one closer in price, date or distance', () => {
    const pool = [
      ...['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((key) => plat(key, 0.3, '2026-06-01')),
      // The touching plat, two days old, at the same price, a fiftieth of a mile out.
      adj('ADJ', 0.02, '2026-07-30'),
      // No plat at all, a tenth of a mile out, last week, at the same price.
      ring('RING', 0.1, '2026-07-25'),
    ]
    const out = walkPricingLadder(subj(), pool, { asOf })
    expect(keysOf(out)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
    for (const tier of ['adjacent-sub-3mo', 'closer-sub-3mo', 'nearby-0.25mi-3mo', 'community-6mo', 'widened-disclosed-24mo']) {
      expect(rung(out, tier)?.ran).toBe(false)
      expect(rung(out, tier)?.skippedReason).toMatch(/already has 6 price-setting sales/)
    }
    // Own ground is the same area: its later windows still ran.
    expect(rung(out, 'subdivision-24mo-wide')?.ran).toBe(true)
  })

  it('own-plat sales from the 18- and 24-month windows still compete for seats after five is reached', () => {
    const pool = [
      ...['F1', 'F2', 'F3', 'F4', 'F5'].map((key) => plat(key, 0.3, THREE_MO)),
      plat('L18A', 0.02, EIGHTEEN_MO),
      plat('L18B', 0.04, EIGHTEEN_MO),
      plat('L24A', 0.03, TWENTY_FOUR_MO),
      plat('L24B', 0.05, TWENTY_FOUR_MO),
      adj('ADJ', 0.01, THREE_MO),
    ]
    const out = walkPricingLadder(subj(), pool, { asOf })
    expect(rung(out, 'subdivision-3mo')?.runningTotal).toBe(5)
    expect(rung(out, 'subdivision-18mo')?.added).toBe(2)
    expect(rung(out, 'subdivision-24mo')?.added).toBe(2)
    // Nine own-plat sales, seven seats, closest first: the four older ones sit
    // nearer than the five recent ones, so they take seats.
    expect(out.comps).toHaveLength(7)
    expect(keysOf(out)).toEqual(['F1', 'F2', 'F3', 'L18A', 'L18B', 'L24A', 'L24B'])
    expect(rung(out, 'adjacent-sub-3mo')?.ran).toBe(false)
  })

  it('a wider rung that reaches five holding six gives six, and nothing past it fills the seventh seat', () => {
    const pool = [
      plat('O1', 0.3, THREE_MO),
      plat('O2', 0.3, EIGHTEEN_MO),
      ...['B1', 'B2', 'B3', 'B4'].map((key) => adj(key, 0.25, THREE_MO)),
      ...['C1', 'C2', 'C3'].map((key) => adj(key, 0.05, SIX_MO)),
      ring('RING', 0.1, THREE_MO),
    ]
    const out = walkPricingLadder(subj(), pool, { asOf })
    expect(keysOf(out)).toEqual(['B1', 'B2', 'B3', 'B4', 'O1', 'O2'])
    expect(rung(out, 'adjacent-sub-6mo')?.ran).toBe(false)
    expect(out.trace.some((t) => t.includes('Comp shortage'))).toBe(false)
  })

  it('a walk that reaches five exactly at the last sale of a wider rung stays five and does not widen', () => {
    const pool = [
      ...['O1', 'O2', 'O3'].map((key) => plat(key, 0.3, THREE_MO)),
      ...['E1', 'E2'].map((key) => adj(key, 0.3, THREE_MO)),
      // Three more touching-plat sales one window out, closer than every one of the five.
      ...['W1', 'W2', 'W3'].map((key) => adj(key, 0.02, SIX_MO)),
      ring('RING', 0.05, THREE_MO),
    ]
    const out = walkPricingLadder(subj(), pool, { asOf })
    expect(keysOf(out)).toEqual(['E1', 'E2', 'O1', 'O2', 'O3'])
    expect(out.reachedTarget).toBe(true)
    expect(rung(out, 'adjacent-sub-3mo')?.runningTotal).toBe(5)
    const ran = out.rungs.filter((r) => r.ran).map((r) => r.tier)
    expect(ran[ran.length - 1]).toBe('adjacent-sub-3mo')
    expect(rung(out, 'adjacent-sub-6mo')?.skippedReason).toMatch(/already has 5 price-setting sales/)
  })
})
