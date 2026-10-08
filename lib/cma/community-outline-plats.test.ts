import { describe, expect, it } from 'vitest'
import { communitySlugForRecordedPlats } from '@/lib/cma/community-location'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * geo_assign_batch: 61084 Parrell (44.01823, -121.313298) is in
 * bend-golf-club-addition. A Fairway sale in the 2nd addition is also in
 * wildwood-park, and the MLS subdivision is a different name.
 */
const PARRELL = { lat: 44.01823, lng: -121.313298 }
const FAIRWAY_2ND = { lat: 44.017997, lng: -121.309951 }
const PARRELL_PLATS = ['bend-golf-club-addition']
const FAIRWAY_PLATS = ['bend-golf-club-2nd-addition', 'wildwood-park']

function subject(): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '61084 Parrell',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Bend Golf Club',
    subdivisionNorm: 'bend golf club',
    subdivisionSlug: 'bend-golf-club-addition',
    latitude: PARRELL.lat,
    longitude: PARRELL.lng,
    beds: 3,
    baths: 2,
    sqft: 1748,
    lotAcres: 0.2,
    yearBuilt: 1965,
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
    communitySlug: communitySlugForRecordedPlats(PARRELL_PLATS),
  }
}

function sale(over: Partial<PricingSale> = {}): PricingSale {
  return {
    listingKey: 'FAIRWAY_2ND',
    listNumber: null,
    address: '20270 Fairway',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Wildwood Park',
    subdivisionNorm: 'wildwood park',
    subdivisionSlug: 'bend-golf-club-2nd-addition',
    latitude: FAIRWAY_2ND.lat,
    longitude: FAIRWAY_2ND.lng,
    beds: 3,
    baths: 2,
    sqft: 1656,
    lotAcres: 0.2,
    yearBuilt: 1966,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 620_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2025-11-04',
    originalAsk: 640_000,
    lastAsk: 625_000,
    daysToOffer: 20,
    cdom: 30,
    dropCount: 0,
    closePpsf: 374,
    photoUrl: null,
    publicRemarks: null,
    communityLocated: true,
    communitySlug: communitySlugForRecordedPlats(FAIRWAY_PLATS),
    ...over,
  }
}


function remarksOnly() {
  return sale({
    listingKey: 'REMARKS_ONLY',
    address: '9 Outside',
    subdivision: 'Timber Ridge',
    subdivisionNorm: 'timber ridge',
    subdivisionSlug: 'timber-ridge',
    latitude: 44.05,
    longitude: -121.35,
    closeDate: '2026-07-01',
    closePrice: 630_000,
    lastAsk: 640_000,
    communitySlug: null,
    containingPlatSlugs: ['timber-ridge'],
    publicRemarks: 'Charming home on the Bend Golf Club course, walk to the clubhouse.',
  })
}

describe('Bend Golf Club recorded-plat outline', () => {
  it('takes a touching plat in the same community and not a remarks mention', () => {
    expect(communitySlugForRecordedPlats(PARRELL_PLATS)).toBe('bend-golf-club')
    expect(communitySlugForRecordedPlats(FAIRWAY_PLATS)).toBe('bend-golf-club')
    expect(communitySlugForRecordedPlats(['wildwood-park'])).toBeNull()

    const asOf = '2026-10-04'
    const home = subject()
    home.adjacentSubdivisionSlugs = ['bend-golf-club-2nd-addition']
    const tiers = pricingTierLadder().filter((tier) => tier.adjacentSubdivision || tier.sameCommunity)
    const out = walkPricingLadder(home, [sale(), remarksOnly()], { asOf, tiers })

    // One sale is short of the minimum, so the community rungs run (rules 15
    // and 19). They still never take a sale that only mentions the community.
    const community = out.rungs.filter((rung) => rung.tier.startsWith('community-'))
    expect(community.length).toBeGreaterThan(0)
    expect(community.every((rung) => rung.ran)).toBe(true)
    expect(out.comps.map((comp) => comp.listingKey)).toEqual(['FAIRWAY_2ND'])
    expect(out.comps[0]?.selectionTier.startsWith('adjacent-sub-')).toBe(true)
    expect(out.comps.some((comp) => comp.listingKey === 'REMARKS_ONLY')).toBe(false)
  })
})

describe('recorded plat membership for every community', () => {
  it('a subject inside a plat is a member, a different MLS name inside that plat can be selected, and a remarks mention is not', () => {
    expect(communitySlugForRecordedPlats(['cedar-ridge-addition'])).toBe('cedar-ridge')
    expect(communitySlugForRecordedPlats(['cedar-ridge-2nd-addition', 'other-park'])).toBe('cedar-ridge')
    expect(communitySlugForRecordedPlats(['other-park'])).toBeNull()
    expect(communitySlugForRecordedPlats(['wildwood-park'])).toBeNull()

    const asOf = '2026-10-04'
    const home = subject()
    home.streetAddress = '10 Cedar'
    home.subdivision = 'Cedar Ridge'
    home.subdivisionNorm = 'cedar ridge'
    home.subdivisionSlug = 'other-park'
    home.communitySlug = null
    home.communityLocated = true
    home.containingPlatSlugs = ['cedar-ridge-addition']

    const inside = sale({
      listingKey: 'INSIDE_PLAT',
      address: '20 Cedar',
      subdivision: 'Other Park',
      subdivisionNorm: 'other park',
      subdivisionSlug: 'other-park',
      communitySlug: null,
      communityLocated: true,
      containingPlatSlugs: ['cedar-ridge-2nd-addition', 'other-park'],
    })
    const remarks = sale({
      listingKey: 'REMARKS_ONLY',
      address: '9 Outside',
      subdivision: 'Timber Ridge',
      subdivisionNorm: 'timber ridge',
      subdivisionSlug: 'timber-ridge',
      latitude: 44.05,
      longitude: -121.35,
      closeDate: '2026-07-01',
      closePrice: 630_000,
      lastAsk: 640_000,
      communitySlug: null,
      communityLocated: true,
      containingPlatSlugs: ['timber-ridge'],
      publicRemarks: 'Charming home on the golf course, walk to the clubhouse.',
    })

    const tiers = pricingTierLadder().filter((tier) => tier.sameSubdivision || tier.sameCommunity)
    const out = walkPricingLadder(home, [inside, remarks], { asOf, tiers })

    // One sale is short of the minimum, so the community rungs run (rules 15
    // and 19). They still never take a sale that only mentions the community.
    const community = out.rungs.filter((rung) => rung.tier.startsWith('community-'))
    expect(community.length).toBeGreaterThan(0)
    expect(community.every((rung) => rung.ran)).toBe(true)
    expect(out.comps.map((comp) => comp.listingKey)).toEqual(['INSIDE_PLAT'])
    expect(out.comps[0]?.selectionTier.startsWith('subdivision-')).toBe(true)
    expect(out.comps.some((comp) => comp.listingKey === 'REMARKS_ONLY')).toBe(false)
  })
})

describe('sewer inside a recorded plat', () => {
  it('keeps a septic sale inside the plat and names both sewers', () => {
    const asOf = '2026-10-04'
    const home = subject()
    const inside = sale({
      sewerClass: 'septic',
      subdivision: 'Bend Golf Club',
      subdivisionNorm: 'bend golf club',
      subdivisionSlug: 'bend-golf-club-addition',
      containingPlatSlugs: PARRELL_PLATS,
    })
    const tiers = pricingTierLadder().filter((tier) => tier.sameSubdivision)
    const out = walkPricingLadder(home, [inside], { asOf, tiers })
    expect(out.comps.map((comp) => comp.listingKey)).toEqual(['FAIRWAY_2ND'])
    expect(out.comps[0]?.selectionTier.startsWith('subdivision-')).toBe(true)
    expect(out.comps[0]?.sewerNote).toBe('20270 Fairway is on septic. This home is on public sewer.')
  })

  it('still drops septic against public sewer outside the plat, and keeps unknown', () => {
    const asOf = '2026-10-04'
    const home = subject()
    home.communitySlug = null
    home.communityLocated = false
    home.containingPlatSlugs = null
    home.subdivision = null
    home.subdivisionNorm = null
    home.subdivisionSlug = null
    const septic = sale({
      listingKey: 'OUTSIDE_SEPTIC',
      address: '9 Outside',
      subdivision: 'Other Tract',
      subdivisionNorm: 'other tract',
      subdivisionSlug: 'other-tract',
      communitySlug: null,
      communityLocated: false,
      containingPlatSlugs: null,
      sewerClass: 'septic',
      latitude: home.latitude,
      longitude: (home.longitude ?? 0) + 0.002,
      closeDate: '2026-06-01',
    })
    const unknown = sale({
      ...septic,
      listingKey: 'OUTSIDE_UNKNOWN',
      address: '10 Outside',
      sewerClass: 'unknown',
      longitude: (home.longitude ?? 0) + 0.001,
    })
    const tiers = pricingTierLadder().filter((tier) => tier.name === 'nearby-0.25mi-9mo')
    expect(tiers).toHaveLength(1)
    const dropped = walkPricingLadder(home, [septic], { asOf, tiers })
    expect(dropped.comps).toEqual([])
    const kept = walkPricingLadder(home, [unknown], { asOf, tiers })
    expect(kept.comps.map((comp) => comp.listingKey)).toEqual(['OUTSIDE_UNKNOWN'])
    expect(kept.comps[0]?.sewerNote ?? null).toBeNull()
  })
})
