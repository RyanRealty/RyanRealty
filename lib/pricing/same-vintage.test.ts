import { describe, expect, it } from 'vitest'
import { distanceMiles } from '@/lib/cma/market-area'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * A same-generation plat within half a mile outranks a touching plat from a
 * different generation. Own-plat sales stay. A wider ring does not open for this.
 */
const asOf = '2026-08-01'
const HERE = { latitude: 44.06, longitude: -121.3 }
const SUBJECT_YEAR = 2005
const STALE_YEAR = 1980
const SAME_YEAR = 2006

function atMiles(miles: number) {
  return { latitude: HERE.latitude + miles / 69, longitude: HERE.longitude }
}

function milesFromSubject(sale: { latitude: number | null; longitude: number | null }): number {
  return (
    distanceMiles({ lat: HERE.latitude, lng: HERE.longitude }, { lat: sale.latitude, lng: sale.longitude }) ??
    Number.POSITIVE_INFINITY
  )
}

function home(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Subject Oak',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Subject Oak Homes',
    subdivisionNorm: 'subject oak homes',
    subdivisionSlug: 'subject-oak-homes',
    ...HERE,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt: SUBJECT_YEAR,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    communityLocated: true,
    communitySlug: null,
    adjacentSubdivisionSlugs: ['stale-pine-homes'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

function sale(listingKey: string, slug: string, name: string, miles: number, yearBuilt: number): PricingSale {
  const at = atMiles(miles)
  return {
    listingKey,
    listNumber: null,
    address: `${listingKey} Lane`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: name,
    subdivisionNorm: name.toLowerCase(),
    subdivisionSlug: slug,
    ...at,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    yearBuilt,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 700_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-07-15',
    originalAsk: 725_000,
    lastAsk: 710_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 350,
    photoUrl: null,
    publicRemarks: null,
  }
}

const stale = (key: string, miles: number) => sale(key, 'stale-pine-homes', 'Stale Pine Homes', miles, STALE_YEAR)

describe('same generation within half a mile', () => {
  it('seats a same-generation sale about 0.4 miles away ahead of a stale touching plat, and keeps the own-plat sale', () => {
    const own = sale('OWN', 'subject-oak-homes', 'Subject Oak Homes', 0.05, SUBJECT_YEAR)
    const neighbors = [0.08, 0.1, 0.12, 0.14, 0.16].map((miles, index) => stale(`S${index + 1}`, miles))
    const half = sale('HALF', 'same-era-homes', 'Same Era Homes', 0.4, SAME_YEAR)
    const mile = sale('MILE', 'far-era-homes', 'Far Era Homes', 0.8, SAME_YEAR)
    expect(milesFromSubject(half)).toBeGreaterThan(0.25)
    expect(milesFromSubject(half)).toBeLessThanOrEqual(0.5)
    expect(milesFromSubject(mile)).toBeGreaterThan(0.5)
    expect(milesFromSubject(mile)).toBeLessThanOrEqual(1)

    const out = walkPricingLadder(home(), [own, ...neighbors, half, mile], { asOf })
    const keys = out.comps.map((comp) => comp.listingKey)

    expect(out.comps).toHaveLength(5)
    expect(keys).toContain('HALF')
    expect(keys).toContain('OWN')
    expect(out.comps.find((comp) => comp.listingKey === 'OWN')?.ownPlat).toBe(true)
    expect(out.comps.find((comp) => comp.listingKey === 'HALF')?.ownPlat).toBe(false)
    expect(out.comps.find((comp) => comp.listingKey === 'HALF')?.selectionTier).toBe('nearby-0.5mi-3mo')
    const staleSeated = keys.filter((key) => key.startsWith('S'))
    expect(staleSeated.length).toBeLessThan(5)
    expect(keys).not.toContain('MILE')
    const adjacentAdded = out.rungs
      .filter((rung) => rung.tier.startsWith('adjacent-'))
      .reduce((sum, rung) => sum + rung.added, 0)
    expect(adjacentAdded).toBe(5)
    const halfRung = out.rungs.find((rung) => rung.tier === 'nearby-0.5mi-3mo')
    expect(halfRung?.ran).toBe(true)
    expect(halfRung?.added).toBe(1)
    // Own plat plus the five stale neighbors were already in. The ring did not
    // run because the set was short.
    expect(halfRung?.runningTotal).toBeGreaterThanOrEqual(7)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-0.75mi-3mo')?.ran).toBe(false)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-1mi-3mo')?.ran).toBe(false)
  })

  it('keeps the stale touching plats and does not open the 1-mile ring when nothing same-generation is within half a mile', () => {
    const neighbors = [0.08, 0.1, 0.12, 0.14, 0.16].map((miles, index) => stale(`S${index + 1}`, miles))
    const far = sale('FAR', 'far-era-homes', 'Far Era Homes', 0.8, SAME_YEAR)
    expect(milesFromSubject(far)).toBeGreaterThan(0.5)
    expect(milesFromSubject(far)).toBeLessThanOrEqual(1)

    const out = walkPricingLadder(home(), [...neighbors, far], { asOf })
    const keys = out.comps.map((comp) => comp.listingKey)

    expect(out.comps).toHaveLength(5)
    expect(keys.sort()).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    expect(keys).not.toContain('FAR')
    const adjacentAdded = out.rungs
      .filter((rung) => rung.tier.startsWith('adjacent-'))
      .reduce((sum, rung) => sum + rung.added, 0)
    expect(adjacentAdded).toBe(5)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-0.25mi-3mo')?.ran).toBe(false)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-0.5mi-3mo')?.ran).toBe(false)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-0.75mi-3mo')?.ran).toBe(false)
    expect(out.rungs.find((rung) => rung.tier === 'nearby-1mi-3mo')?.ran).toBe(false)
  })
})
