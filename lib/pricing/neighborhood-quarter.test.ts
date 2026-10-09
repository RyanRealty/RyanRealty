/**
 * When the plat rows are short of five, the quarter-mile steps inside the
 * neighborhood use the same size rule as the rest of the search (Matt
 * 2026-10-09). 20289 Schaeffer kept four own-plat sales about 25% larger.
 * The next sale, about 17% larger at half a mile, died on the 15% ring.
 */
import { describe, expect, it } from 'vitest'
import { distanceMiles } from '@/lib/cma/market-area'
import {
  PLAT_WIDE_SQFT_BAND,
  PRICING_MIN_COMPS,
  pricingTierLadder,
} from '@/lib/pricing/ladder'
import { closedCompWeight } from '@/lib/pricing/closed-comp-weight'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

const asOf = '2026-08-01'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '20289 Schaeffer',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Schaeffer',
    subdivisionNorm: 'schaeffer',
    subdivisionSlug: 'schaeffer-test-plat',
    latitude: 44.09,
    longitude: -121.28,
    beds: 3,
    baths: 2,
    sqft: 1200,
    lotAcres: 0.15,
    yearBuilt: 2005,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: 'bend-boyd-acres',
    adjacentSubdivisionSlugs: [],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

function sale(over: Partial<PricingSale> = {}): PricingSale {
  return {
    listingKey: 'SALE',
    listNumber: null,
    address: '1 Comp St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Schaeffer',
    subdivisionNorm: 'schaeffer',
    subdivisionSlug: 'schaeffer-test-plat',
    latitude: 44.0902,
    longitude: -121.2802,
    beds: 3,
    baths: 2,
    sqft: 1497,
    lotAcres: 0.15,
    yearBuilt: 2004,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 480_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 499_000,
    lastAsk: 489_000,
    daysToOffer: 12,
    cdom: 20,
    dropCount: 0,
    closePpsf: 321,
    photoUrl: null,
    publicRemarks: null,
    marketArea: 'bend-boyd-acres',
    ...over,
  }
}

/** About 0.54 miles north. Past the half-mile step, inside three quarters. */
function atHalfMile(over: Partial<PricingSale>): PricingSale {
  return sale({
    latitude: 44.09 + 0.54 / 69,
    longitude: -121.28,
    ...over,
  })
}

describe('quarter-mile steps when the plat is short of five', () => {
  it('searches at the wide plat band and does not demand the same story or a 15-year age', () => {
    expect(PRICING_MIN_COMPS).toBe(5)
    const rings = pricingTierLadder().filter((t) => t.name.startsWith('nearby-'))
    expect(rings.length).toBeGreaterThan(0)
    expect(rings[0]?.name).toBe('nearby-0.25mi-3mo')
    for (const ring of rings) {
      expect(ring.sqftBand).toBe(PLAT_WIDE_SQFT_BAND)
      expect(ring.ageYears).toBe(25)
      expect(ring.sameStory).toBe(false)
      expect(ring.maxMiles).toBeLessThanOrEqual(2)
    }
  })

  it('seats a neighborhood sale about 22% off, two stories, 18 years older, and still refuses Broken Top and the next neighborhood', () => {
    const own = [0, 1, 2, 3].map((i) =>
      sale({
        listingKey: `OWN${i}`,
        address: `${20260 + i} Schaeffer`,
        closeDate: `2026-0${5 + (i % 3)}-${10 + i}`,
      }),
    )
    // 22% larger, two stories, 18 years older. Inside the 25% price line.
    // The tight rings inside a mile refuse it, and the 20% rings past a mile
    // refuse the size, so a farther 10% sale takes the fifth seat first.
    const closer = atHalfMile({
      listingKey: 'CLOSER',
      address: '1464 Neighbor',
      subdivision: 'Neighbor Plat',
      subdivisionNorm: 'neighbor plat',
      subdivisionSlug: 'neighbor-test-plat',
      sqft: 1464,
      yearBuilt: 1987,
      storyClass: 'two',
      closePpsf: 328,
    })
    const farther = sale({
      listingKey: 'FARTHER',
      address: '1320 Farther',
      subdivision: 'Farther Plat',
      subdivisionNorm: 'farther plat',
      subdivisionSlug: 'farther-test-plat',
      latitude: 44.09 + 1.4 / 69,
      longitude: -121.28,
      sqft: 1320,
      yearBuilt: 2004,
      storyClass: 'one',
      closePpsf: 364,
    })
    const tooBig = atHalfMile({
      listingKey: 'TOOBIG',
      address: '1560 Neighbor',
      subdivision: 'Neighbor Plat',
      subdivisionNorm: 'neighbor plat',
      subdivisionSlug: 'neighbor-test-plat',
      sqft: 1560,
      yearBuilt: 2004,
      storyClass: 'one',
      latitude: 44.09 + 0.6 / 69,
    })
    const resort = atHalfMile({
      listingKey: 'BROKEN',
      address: '1 Broken Top',
      subdivision: 'Broken Top',
      subdivisionNorm: 'broken top',
      subdivisionSlug: 'broken-top',
      sqft: 1402,
      yearBuilt: 2004,
      storyClass: 'one',
      latitude: 44.09 + 0.62 / 69,
    })
    const otherNeighborhood = atHalfMile({
      listingKey: 'OTHER',
      address: '1 Other Neighborhood',
      subdivision: 'Other Plat',
      subdivisionNorm: 'other plat',
      subdivisionSlug: 'other-neighborhood-plat',
      sqft: 1402,
      yearBuilt: 2004,
      storyClass: 'one',
      marketArea: 'bend-old-bend',
      latitude: 44.09 + 0.64 / 69,
    })
    const miles = distanceMiles(
      { lat: 44.09, lng: -121.28 },
      { lat: closer.latitude, lng: closer.longitude },
    )
    expect(miles).toBeGreaterThan(0.5)
    expect(miles).toBeLessThanOrEqual(0.75)
    const farMiles = distanceMiles(
      { lat: 44.09, lng: -121.28 },
      { lat: farther.latitude, lng: farther.longitude },
    )
    expect(farMiles).toBeGreaterThan(1.25)
    expect(farMiles).toBeLessThanOrEqual(1.5)

    const short = walkPricingLadder(subject(), own, { asOf })
    expect(short.comps).toHaveLength(4)
    expect(short.starved).toBe(true)

    const out = walkPricingLadder(
      subject(),
      [...own, closer, farther, tooBig, resort, otherNeighborhood],
      { asOf },
    )
    expect(out.comps.map((c) => c.listingKey)).toContain('CLOSER')
    expect(out.comps.find((c) => c.listingKey === 'CLOSER')?.selectionTier).toBe('nearby-0.75mi-3mo')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('FARTHER')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TOOBIG')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('BROKEN')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('OTHER')
    expect(out.comps).toHaveLength(5)
    expect(out.starved).toBe(false)
    expect(out.reachedTarget).toBe(true)
  })
})

describe('a one-room gap stays in the set and weighs less', () => {
  const weight = {
    subjectSqft: 1200,
    saleSqft: 1200,
    monthsSinceClose: 1,
    subjectYearBuilt: 2005,
    saleYearBuilt: 2005,
    subjectLotAcres: 0.15,
    saleLotAcres: 0.15,
    subjectBeds: 3,
    subjectBaths: 2,
  }

  it('weighs one room under the same count, and a same-subdivision gap still outweighs an adjacent match', () => {
    const same = closedCompWeight({ ...weight, saleBeds: 3, saleBaths: 2, locationMatch: 'same-subdivision' })
    const oneBed = closedCompWeight({ ...weight, saleBeds: 4, saleBaths: 2, locationMatch: 'same-subdivision' })
    const both = closedCompWeight({ ...weight, saleBeds: 4, saleBaths: 3, locationMatch: 'same-subdivision' })
    const adjacent = closedCompWeight({
      ...weight,
      saleBeds: 3,
      saleBaths: 2,
      locationMatch: 'adjacent-subdivision',
    })
    expect(oneBed).toBeGreaterThan(0)
    expect(oneBed).toBeLessThan(same)
    expect(both).toBeGreaterThan(0)
    expect(both).toBeLessThan(oneBed)
    expect(both).toBeGreaterThan(adjacent)
  })

  it('seats a neighborhood sale one bedroom and one bathroom off, and still refuses two bedrooms off', () => {
    const both = sale({
      listingKey: 'BOTH',
      address: '10 Neighbor',
      subdivision: 'Neighbor Plat',
      subdivisionNorm: 'neighbor plat',
      subdivisionSlug: 'neighbor-test-plat',
      beds: 4,
      baths: 3,
      sqft: 1200,
      yearBuilt: 2005,
    })
    const twoBeds = sale({
      listingKey: 'TWOBEDS',
      address: '12 Schaeffer',
      beds: 5,
      baths: 2,
      sqft: 1200,
      yearBuilt: 2005,
    })
    const out = walkPricingLadder(subject(), [both, twoBeds], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('BOTH')
    expect(out.comps.find((c) => c.listingKey === 'BOTH')?.roomDifference).toEqual(['beds', 'baths'])
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TWOBEDS')
  })

  it('seats a touching plat across the neighborhood line when it is one bathroom off', () => {
    const touch = sale({
      listingKey: 'TOUCH',
      address: '20 Across',
      subdivision: 'Across Line',
      subdivisionNorm: 'across line',
      subdivisionSlug: 'across-the-line',
      // Larkspur shares Boyd Acres' side of the Parkway and the Deschutes.
      // Old Bend is the other side of the Parkway, which is a different wall.
      marketArea: 'bend-larkspur',
      beds: 3,
      baths: 3,
      sqft: 1200,
      yearBuilt: 2005,
    })
    const out = walkPricingLadder(subject({ adjacentSubdivisionSlugs: ['across-the-line'] }), [touch], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['TOUCH'])
    expect(out.comps[0]?.roomDifference).toEqual(['baths'])
    expect(out.comps[0]?.locationMatch).toBe('adjacent-subdivision')
  })
})
