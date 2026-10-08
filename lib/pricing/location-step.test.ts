import { describe, expect, it } from 'vitest'
import {
  closedCompWeight,
  locationMatchFromFacts,
  resolveLocationMatch,
} from '@/lib/pricing/closed-comp-weight'
import { pricingSaleToCmaComp } from '@/lib/pricing/estimate'
import { saleLocationMatch, walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * Rule 15's location step reads where the SALE sits, not the rung that let it
 * in. 915 Saginaw (2026-10-07): the subject sits in Park Place inside River
 * West; four River West sales came in on the 1.25-mile and 5-mile rungs and
 * weighed as wider (0) instead of the neighborhood (1).
 */

const RIVER_WEST = 'bend-river-west'

function saginaw(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SAGINAW',
    streetAddress: '915 Saginaw',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Park Place',
    subdivisionNorm: 'park place',
    subdivisionSlug: 'park-place',
    adjacentSubdivisionSlugs: ['touching-plat'],
    closerSubdivisionSlugs: ['kenwood'],
    latitude: 44.06569,
    longitude: -121.32545,
    beds: 4,
    baths: 3,
    bathsFull: 2,
    bathsHalf: 1,
    sqft: 2085,
    lotAcres: 0.17,
    yearBuilt: 1993,
    storyClass: 'two',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: RIVER_WEST,
    ...over,
  }
}

let seq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: over.listingKey ?? `RW${seq}`,
    listNumber: null,
    address: over.address ?? `${2000 + seq} 4th`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Mallery',
    subdivisionNorm: 'mallery',
    subdivisionSlug: 'mallery-addition',
    latitude: 44.066825,
    longitude: -121.31837,
    beds: 4,
    baths: 3,
    sqft: 2050,
    lotAcres: 0.16,
    yearBuilt: 1995,
    storyClass: 'two',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 1_000_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-25',
    originalAsk: 1_025_000,
    lastAsk: 1_010_000,
    daysToOffer: 12,
    cdom: 20,
    dropCount: 0,
    closePpsf: 488,
    photoUrl: null,
    publicRemarks: null,
    marketArea: RIVER_WEST,
    ...over,
  }
}

describe('locationMatchFromFacts — rule 15 from where the sale sits', () => {
  it('orders own plat, touching plat, inside the parent, else wider', () => {
    const none = { ownPlat: false, touchingPlat: false, insideParent: false }
    expect(locationMatchFromFacts({ ...none, ownPlat: true, insideParent: true })).toBe('same-subdivision')
    expect(locationMatchFromFacts({ ...none, touchingPlat: true })).toBe('adjacent-subdivision')
    expect(locationMatchFromFacts({ ...none, streetPocket: true })).toBe('adjacent-subdivision')
    expect(locationMatchFromFacts({ ...none, insideParent: true })).toBe('neighborhood-or-community')
    expect(locationMatchFromFacts({ ...none, platRow: true })).toBe('neighborhood-or-community')
    expect(locationMatchFromFacts(none)).toBe('wider')
  })

  it('a stamped step wins over the rung name', () => {
    expect(resolveLocationMatch({ selectionTier: 'city-5mi-18mo' })).toBe('wider')
    expect(
      resolveLocationMatch({ selectionTier: 'city-5mi-18mo', locationMatch: 'neighborhood-or-community' }),
    ).toBe('neighborhood-or-community')
  })
})

describe('saleLocationMatch — the walls\' own membership tests', () => {
  it('a River West sale outside the plat rows is the neighborhood step', () => {
    expect(saleLocationMatch(saginaw(), sale())).toBe('neighborhood-or-community')
  })

  it('own plat, touching plat and the next row read their own tests', () => {
    expect(saleLocationMatch(saginaw(), sale({ subdivision: 'Park Place', subdivisionNorm: 'park place', subdivisionSlug: 'park-place' }))).toBe(
      'same-subdivision',
    )
    expect(saleLocationMatch(saginaw(), sale({ subdivisionSlug: 'touching-plat' }))).toBe('adjacent-subdivision')
    // A touching plat across the neighborhood line is still the adjacent step.
    expect(
      saleLocationMatch(saginaw(), sale({ subdivisionSlug: 'touching-plat', marketArea: 'bend-awbrey-butte' })),
    ).toBe('adjacent-subdivision')
    expect(saleLocationMatch(saginaw(), sale({ subdivisionSlug: 'kenwood' }))).toBe('neighborhood-or-community')
  })

  it('a sale outside River West is wider', () => {
    expect(saleLocationMatch(saginaw(), sale({ marketArea: 'bend-awbrey-butte' }))).toBe('wider')
  })

  it('a pocket sale is the neighborhood step for a recorded plat, the adjacent step for a plat-less home', () => {
    // Outside every polygon and community, so only the pocket test can place it.
    const away = { marketArea: null, latitude: null, longitude: null, address: '77 Pocket Ln' }
    const recorded = saginaw({ marketArea: null, latitude: null, longitude: null, pocketStreetKeys: ['pocket'] })
    expect(saleLocationMatch(recorded, sale(away))).toBe('neighborhood-or-community')
    const platLess = saginaw({
      subdivision: null,
      subdivisionNorm: null,
      subdivisionSlug: null,
      marketArea: null,
      latitude: null,
      longitude: null,
      pocketStreetKeys: ['pocket'],
    })
    expect(saleLocationMatch(platLess, sale(away))).toBe('adjacent-subdivision')
    // Off the pocket street, with no parent, it is wider.
    expect(saleLocationMatch(platLess, sale({ ...away, address: '9 Elsewhere Rd' }))).toBe('wider')
  })
})

describe('915 Saginaw — a River West sale admitted on a radius rung weighs as the neighborhood', () => {
  it('the walk stamps the neighborhood step on a sale a nearby or city rung admitted', () => {
    const pool = [
      sale({ latitude: 44.066825, longitude: -121.31837 }),
      sale({ latitude: 44.06206, longitude: -121.32896, closeDate: '2025-11-12' }),
      sale({ latitude: 44.060634, longitude: -121.325316, closeDate: '2025-09-02' }),
      sale({ latitude: 44.067311, longitude: -121.330443, closeDate: '2025-06-27' }),
    ]
    const out = walkPricingLadder(saginaw(), pool, { asOf: '2026-10-07' })
    expect(out.comps.length).toBeGreaterThan(0)
    for (const c of out.comps) {
      // Admitted by distance, not by a plat or neighborhood rung name.
      expect(c.selectionTier).toMatch(/^(nearby-|city-)/)
      expect(resolveLocationMatch({ selectionTier: c.selectionTier })).toBe('wider')
      expect(c.locationMatch).toBe('neighborhood-or-community')
      // The stamp rides to the comp the weight reads, and the weight is the
      // neighborhood step (1 plus less than one secondary step), not wider.
      const comp = pricingSaleToCmaComp(c)
      expect(comp.locationMatch).toBe('neighborhood-or-community')
      const w = closedCompWeight({
        subjectSqft: 2085,
        saleSqft: comp.sqft,
        monthsSinceClose: 6,
        selectionTier: comp.selectionTier,
        ownPlat: comp.ownPlat,
        locationMatch: comp.locationMatch,
        setsPrice: true,
      })
      expect(w).toBeGreaterThanOrEqual(1)
      expect(w).toBeLessThan(2)
    }
  })

  it('without the stamp the same sale weighed as wider (the defect)', () => {
    const w = closedCompWeight({
      subjectSqft: 2085,
      saleSqft: 2145,
      monthsSinceClose: 11,
      selectionTier: 'city-5mi-18mo',
      ownPlat: false,
      setsPrice: true,
    })
    expect(w).toBeLessThan(1)
  })
})
