import { describe, expect, it } from 'vitest'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * YEAR BUILT DOES NOT REMOVE A TOUCHING-PLAT SALE (Matt 2026-10-10). On 711
 * Georgia the old size bracket swapped in 355 Delaware from a touching plat
 * over own-plat sales. Five own-plat sales now keep the price. The touching
 * sale stays in the pool. A two-story sale the strict touching rung refuses
 * still stays out.
 */
const asOf = '2026-10-08'

function georgia(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '711 Georgia',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Deschutes',
    subdivisionNorm: 'deschutes',
    subdivisionSlug: 'deschutes',
    latitude: 44.0545,
    longitude: -121.3172,
    beds: 2,
    baths: 2,
    sqft: 1307,
    lotAcres: 0.12,
    yearBuilt: 2016,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: 'bend-river-west',
    communityLocated: true,
    communitySlug: null,
    adjacentSubdivisionSlugs: ['staats-addition'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

let seq = 0
function sale(over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: `K${seq}`,
    listNumber: null,
    address: `${200 + seq} Georgia`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Deschutes',
    subdivisionNorm: 'deschutes',
    subdivisionSlug: 'deschutes',
    latitude: 44.0546 + seq * 0.0002,
    longitude: -121.3173,
    beds: 2,
    baths: 2,
    sqft: 1450,
    lotAcres: 0.12,
    yearBuilt: 2012,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 870_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-15',
    originalAsk: 889_000,
    lastAsk: 879_000,
    daysToOffer: 20,
    cdom: 30,
    dropCount: 0,
    closePpsf: 600,
    photoUrl: null,
    publicRemarks: null,
    marketArea: 'bend-river-west',
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

/** Five own-plat sales, every one larger than the subject, so the bracket wants a smaller one. */
function ownPlatLarger(): PricingSale[] {
  return Array.from({ length: 5 }, (_, i) => sale({ sqft: 1450 + i * 10, closePrice: 870_000 + i * 6_000 }))
}

/** A smaller sale on the touching plat, close in price per square foot. */
function touchingSmaller(over: Partial<PricingSale>): PricingSale {
  return sale({
    listingKey: 'TOUCHING',
    address: '355 Delaware',
    subdivision: 'Staats',
    subdivisionNorm: 'staats',
    subdivisionSlug: 'staats-addition',
    sqft: 1160,
    closePrice: 699_000,
    closePpsf: 603,
    ...over,
  })
}

describe('the size bracket and the year band', () => {
  it('keeps five own-plat sales ahead of an older touching-plat sale', () => {
    const out = walkPricingLadder(georgia(), [...ownPlatLarger(), touchingSmaller({ yearBuilt: 1925 })], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    expect(out.comps).toHaveLength(5)
    expect((out.bench ?? []).map((c) => c.listingKey)).toContain('TOUCHING')
    expect(out.tiersUsed).not.toContain('gla-bracket')
    expect(out.trace.some((t) => t.startsWith('GLA bracket'))).toBe(false)
  })

  it('still leaves a closer-year touching sale on the bench when five own sales already passed', () => {
    // 2016 against 1995 is 21 years. Year built does not remove it on a
    // touching plat. Five own-plat sales still outrank it.
    const out = walkPricingLadder(georgia(), [...ownPlatLarger(), touchingSmaller({ yearBuilt: 1995 })], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    expect(out.comps).toHaveLength(5)
    expect((out.bench ?? []).map((c) => c.listingKey)).toEqual(['TOUCHING'])
    expect(out.trace.some((t) => t.startsWith('GLA bracket'))).toBe(false)
  })

  it('reads the story rule of the rung it stands in for', () => {
    // A ladder whose only touching rungs are the strict ones (same story).
    // A two-story touching sale is refused by that rung. A one-story sale is
    // admitted, then left on the bench because five own-plat sales outrank it.
    const tiers = pricingTierLadder().filter(
      (t) => t.sameSubdivision || (t.adjacentSubdivision && t.apples === 'strict'),
    )
    const twoStory = walkPricingLadder(
      georgia(),
      [...ownPlatLarger(), touchingSmaller({ yearBuilt: 2010, storyClass: 'two' })],
      { asOf, tiers },
    )
    expect(twoStory.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    expect((twoStory.bench ?? []).map((c) => c.listingKey)).not.toContain('TOUCHING')
    const oneStory = walkPricingLadder(
      georgia(),
      [...ownPlatLarger(), touchingSmaller({ yearBuilt: 2010, storyClass: 'one' })],
      { asOf, tiers },
    )
    expect(oneStory.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    expect(oneStory.comps).toHaveLength(5)
    expect((oneStory.bench ?? []).map((c) => c.listingKey)).toEqual(['TOUCHING'])
  })
})
