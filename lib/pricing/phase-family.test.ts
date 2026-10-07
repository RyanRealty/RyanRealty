import { describe, expect, it } from 'vitest'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { adjustCmaCompAlongMarket } from '@/lib/pricing/estimate'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * Phases of one ordinary subdivision are that subdivision.
 * A phase stem is not a parent community, so it cannot wall off the next row.
 * Bend Golf Club additions stay a community of different plats (see
 * community-outline-plats.test.ts). A registry community such as Tetherow
 * does not collapse into one plat.
 */
const asOf = '2026-10-06'

function home(): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '10 Phase Two',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Hampton Park Subdivision Phase II',
    subdivisionNorm: 'hampton park subdivision phase ii',
    subdivisionSlug: 'hampton-park-subdivision-phase-ii',
    latitude: 44.07537,
    longitude: -121.293927,
    beds: 4,
    baths: 3,
    sqft: 2388,
    lotAcres: 0.15,
    yearBuilt: 2000,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: 'bend-orchard-district',
    communityLocated: true,
    // What the plat-stem fallback writes today. It is the subdivision, not a community.
    communitySlug: 'hampton-park-subdivision',
    adjacentSubdivisionSlugs: ['hampton-park-subdivision-phase-i', 'raven-wood-addition'],
    closerSubdivisionSlugs: ['deer-pointe-village-phase-i'],
  }
}

function sale(over: Partial<PricingSale>): PricingSale {
  return {
    listingKey: 'SALE',
    listNumber: null,
    address: '1 Sale',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Hampton Park Subdivision Phase I',
    subdivisionNorm: 'hampton park subdivision phase i',
    subdivisionSlug: 'hampton-park-subdivision-phase-i',
    latitude: 44.0758,
    longitude: -121.2942,
    beds: 3,
    baths: 2,
    sqft: 1704,
    lotAcres: 0.14,
    yearBuilt: 1997,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 535_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-04-01',
    originalAsk: 549_000,
    lastAsk: 539_000,
    daysToOffer: 20,
    cdom: 40,
    dropCount: 0,
    closePpsf: 314,
    photoUrl: null,
    publicRemarks: null,
    marketArea: 'bend-orchard-district',
    communityLocated: true,
    communitySlug: 'hampton-park-subdivision',
    ...over,
  }
}

describe('ordinary subdivision phases', () => {
  it('keeps a phase sale that is one bedroom and one bathroom off, then a next-row neighbor the phase name used to wall out', () => {
    const phase = sale({ listingKey: 'PHASE_I', address: '700 Phase One' })
    const tooFar = sale({
      listingKey: 'PHASE_FAR',
      address: '9 Phase One',
      beds: 2,
      baths: 2,
      sqft: 2100,
      closePrice: 500_000,
      closeDate: '2026-03-01',
    })
    const next = sale({
      listingKey: 'NEXT_ROW',
      address: '20 Next Row',
      subdivision: 'Deer Pointe Village Phase I',
      subdivisionNorm: 'deer pointe village phase i',
      subdivisionSlug: 'deer-pointe-village-phase-i',
      communitySlug: 'deer-pointe-village',
      beds: 4,
      baths: 3,
      sqft: 2008,
      yearBuilt: 1990,
      closePrice: 638_000,
      closeDate: '2026-08-01',
      latitude: 44.0765,
      longitude: -121.2925,
    })
    const nextRooms = sale({
      ...next,
      listingKey: 'NEXT_ROOMS',
      address: '21 Next Row',
      beds: 3,
      baths: 2,
      closePrice: 550_000,
      latitude: 44.0766,
      longitude: -121.2924,
    })
    const outside = sale({
      listingKey: 'OUTSIDE',
      address: '30 Other Plat',
      subdivision: 'Choctaw Village',
      subdivisionNorm: 'choctaw village',
      subdivisionSlug: 'choctaw-village',
      communitySlug: null,
      beds: 4,
      baths: 3,
      sqft: 2200,
      yearBuilt: 2000,
      closePrice: 640_000,
      closeDate: '2026-07-01',
      latitude: 44.08,
      longitude: -121.29,
    })
    // Every kept sale is smaller than the subject, so the size bracket wants
    // one larger home. A same-size sale outside both rows must not take the
    // next-row seat. Size does not reorder the subdivision.
    const outsideLarger = sale({
      listingKey: 'OUTSIDE_LARGER',
      address: '40 Other Farm',
      subdivision: 'Jones Farm',
      subdivisionNorm: 'jones farm',
      subdivisionSlug: 'jones-farm',
      communitySlug: null,
      beds: 4,
      baths: 3,
      sqft: 2500,
      yearBuilt: 2000,
      closePrice: 640_000,
      closePpsf: 314,
      closeDate: '2026-06-01',
      latitude: 44.081,
      longitude: -121.291,
    })

    const out = walkPricingLadder(home(), [outsideLarger, outside, nextRooms, next, tooFar, phase], { asOf })
    const picked = (key: string) => out.comps.find((comp) => comp.listingKey === key)

    const phaseComp = picked('PHASE_I')
    expect(phaseComp?.selectionTier.startsWith('subdivision-')).toBe(true)
    expect(phaseComp?.ownPlat).toBe(true)
    expect(phaseComp?.roomDifference).toEqual(['beds', 'baths'])
    expect(picked('PHASE_FAR')).toBeUndefined()
    expect(picked('NEXT_ROW')?.selectionTier.startsWith('closer-sub-')).toBe(true)
    expect(picked('NEXT_ROOMS')).toBeUndefined()
    // The two rows hold two sales, short of the minimum, so the walk goes on
    // inside the Orchard District after both rows (rule 15). The outside sales
    // arrive on a ring, never on the next-row seat or the size bracket.
    expect(picked('OUTSIDE')?.selectionTier).toMatch(/^nearby-/)
    expect(picked('OUTSIDE_LARGER')?.selectionTier).toMatch(/^nearby-/)
    expect(out.tiersUsed).not.toContain('gla-bracket')

    // A registry community's phases stay neighboring plats.
    const tetherow = home()
    tetherow.subdivision = 'Tetherow'
    tetherow.subdivisionNorm = 'tetherow'
    tetherow.subdivisionSlug = 'tetherow-phase-1'
    tetherow.communitySlug = 'tetherow'
    tetherow.marketArea = null
    tetherow.adjacentSubdivisionSlugs = ['tetherow-phase-2']
    tetherow.closerSubdivisionSlugs = []
    const otherPhase = sale({
      listingKey: 'TETHEROW_2',
      address: '1 Tetherow',
      subdivision: 'Tetherow Phase 2',
      subdivisionNorm: 'tetherow phase 2',
      subdivisionSlug: 'tetherow-phase-2',
      communitySlug: 'tetherow',
      beds: 4,
      baths: 3,
      sqft: 2300,
      marketArea: null,
    })
    const resort = walkPricingLadder(tetherow, [otherPhase], {
      asOf,
      tiers: pricingTierLadder().filter((tier) => tier.sameSubdivision || tier.adjacentSubdivision),
    })
    expect(resort.comps[0]?.selectionTier.startsWith('adjacent-sub-')).toBe(true)
    expect(resort.comps[0]?.ownPlat).toBe(false)
  })

  it('gives a next-row phase neighbor weight, and still gives a different community none', () => {
    const subject = {
      streetAddress: '10 Phase Two',
      city: 'Bend',
      sqft: 2388,
      beds: 4,
      baths: 3,
      yearBuilt: 2000,
      subdivision: 'Hampton Park Subdivision Phase II',
      subdivisionSlug: 'hampton-park-subdivision-phase-ii',
      communitySlug: 'hampton-park-subdivision',
      communityLocated: true,
    } as CmaSubject
    const neighbor = {
      address: '20 Next Row',
      city: 'Bend',
      sqft: 2008,
      beds: 5,
      baths: 3,
      yearBuilt: 1996,
      closePrice: 581_000,
      closeDate: '2026-03-23',
      subdivision: 'Deer Pointe Village Phase I',
      subdivisionSlug: 'deer-pointe-village-phase-i',
      communitySlug: 'deer-pointe-village',
      communityLocated: true,
      selectionTier: 'closer-sub-9mo',
      ownPlat: false,
    } as CmaComp
    const weighed = adjustCmaCompAlongMarket({
      subject,
      subjectStory: 'unknown',
      comp: neighbor,
      saleStory: 'unknown',
      points: [],
      asOf: '2026-10-06',
    })
    expect(weighed.adjusted.weight).toBeGreaterThan(0)

    const otherCommunity = adjustCmaCompAlongMarket({
      subject: {
        ...subject,
        subdivisionSlug: 'tetherow-phase-1',
        communitySlug: 'tetherow',
      },
      subjectStory: 'unknown',
      comp: {
        ...neighbor,
        subdivision: 'Awbrey Butte',
        subdivisionSlug: 'awbrey-butte',
        communitySlug: 'awbrey-butte',
        selectionTier: 'closer-sub-9mo',
      },
      saleStory: 'unknown',
      points: [],
      asOf: '2026-10-06',
    })
    expect(otherCommunity.adjusted.weight).toBe(0)
  })
})
