import { describe, expect, it } from 'vitest'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * THE SIZE BRACKET APPLIES THE YEAR BAND AND STORY RULE OF THE RUNG IT STANDS
 * IN FOR (2026-10-08). On 711 Georgia (2 bed, 1,307 sqft, built 2016) the
 * bracket replaced 240 Georgia, the only own-street sale, with 355 Delaware
 * (1,160 sqft, built 1925) from a touching plat. Every touching-plat rung had
 * refused 355 Delaware on the year band (25 years at the loosest); the bracket
 * read no year band at all. A sale the walk's own rung would refuse on age or
 * stories is not a size fix.
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
  it('does not swap in a touching-plat sale every touching-plat rung refused on the year band', () => {
    const out = walkPricingLadder(georgia(), [...ownPlatLarger(), touchingSmaller({ yearBuilt: 1925 })], { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    expect(out.tiersUsed).not.toContain('gla-bracket')
    expect(out.trace.some((t) => t.startsWith('GLA bracket'))).toBe(false)
  })

  it('still swaps in a touching-plat sale inside the touching rung\'s year band', () => {
    // 2016 against 1995 is 21 years: outside the strict touching rung (15),
    // inside the wider one (25), so a touching rung admits it.
    const out = walkPricingLadder(georgia(), [...ownPlatLarger(), touchingSmaller({ yearBuilt: 1995 })], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toContain('TOUCHING')
    expect(out.trace.some((t) => t.startsWith('GLA bracket: replaced'))).toBe(true)
  })

  it('reads the story rule of the rung it stands in for', () => {
    // A ladder whose only touching rungs are the strict ones (same story,
    // 15 years). A two-story touching sale is refused by the swap as by the
    // rung; a one-story one in the same year is taken.
    const tiers = pricingTierLadder().filter(
      (t) => t.sameSubdivision || (t.adjacentSubdivision && t.apples === 'strict'),
    )
    const twoStory = walkPricingLadder(
      georgia(),
      [...ownPlatLarger(), touchingSmaller({ yearBuilt: 2010, storyClass: 'two' })],
      { asOf, tiers },
    )
    expect(twoStory.comps.map((c) => c.listingKey)).not.toContain('TOUCHING')
    const oneStory = walkPricingLadder(
      georgia(),
      [...ownPlatLarger(), touchingSmaller({ yearBuilt: 2010, storyClass: 'one' })],
      { asOf, tiers },
    )
    expect(oneStory.comps.map((c) => c.listingKey)).toContain('TOUCHING')
  })
})
