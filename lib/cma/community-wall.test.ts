import { describe, expect, it } from 'vitest'
import {
  REAL_DERIVED_COMMUNITIES,
  communitySlugForRecordedPlats,
  saleSearchCommunitySlug,
  searchCommunitySlug,
  type CommunityAddress,
} from '@/lib/cma/community-location'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * ONLY REAL COMMUNITIES WALL THE SEARCH (Matt 2026-10-08, "Only real
 * communities"). A community walls the comp search when it is in the
 * community registry (data/resort-communities.json), when it is one of the
 * named real derived communities (REAL_DERIVED_COMMUNITIES), or when the home
 * carries an HOA. A community made up from a plat's own name, like a historic
 * townsite addition, is an ordinary plat: the search walks its touching plats
 * inside the neighborhood.
 *
 * The case: 1355 Jacksonville (3 bed, 2 bath, 876 sqft, 1919, no HOA) sits in
 * the recorded plat northwest-townsite-second-addition inside River West. The
 * plat-name strip made "northwest-townsite" a community, and 324 of 329 pool
 * sales died at that wall, 32 of them inside River West.
 */

function address(over: Partial<CommunityAddress> = {}): CommunityAddress {
  return { communityLocated: true, communitySlug: null, ...over }
}

describe('which community walls the comp search', () => {
  it('a registry community walls with or without an HOA', () => {
    expect(searchCommunitySlug(address({ communitySlug: 'broken-top', hoaClass: 'hoa' }))).toBe('broken-top')
    expect(searchCommunitySlug(address({ communitySlug: 'northwest-crossing', hoaClass: 'no_hoa' }))).toBe('northwest-crossing')
    expect(searchCommunitySlug(address({ communitySlug: 'awbrey-glen', hoaClass: 'unknown' }))).toBe('awbrey-glen')
  })

  it('a derived community on the explicit list walls with no HOA', () => {
    expect([...REAL_DERIVED_COMMUNITIES].sort()).toEqual(['bend-golf-club', 'cedar-ridge'])
    const golf = address({
      communitySlug: communitySlugForRecordedPlats(['bend-golf-club-addition']),
      platSlug: 'bend-golf-club-addition',
      hoaClass: 'no_hoa',
    })
    expect(searchCommunitySlug(golf)).toBe('bend-golf-club')
    // Membership from the containing plats alone, no stamped slug.
    expect(
      searchCommunitySlug(address({ containingPlatSlugs: ['cedar-ridge-2nd-addition', 'other-park'], hoaClass: 'no_hoa' })),
    ).toBe('cedar-ridge')
  })

  it('a community derived from a plat name walls when the home carries an HOA', () => {
    const withHoa = address({
      communitySlug: communitySlugForRecordedPlats(['juniper-ridge-second-addition']),
      platSlug: 'juniper-ridge-second-addition',
      hoaClass: 'hoa',
    })
    expect(withHoa.communitySlug).toBe('juniper-ridge')
    expect(searchCommunitySlug(withHoa)).toBe('juniper-ridge')
  })

  it('a community derived from a plat name with no HOA is an ordinary plat', () => {
    const jacksonville = address({
      communitySlug: communitySlugForRecordedPlats(['northwest-townsite-second-addition']),
      platSlug: 'northwest-townsite-second-addition',
      hoaClass: 'no_hoa',
    })
    expect(jacksonville.communitySlug).toBe('northwest-townsite')
    expect(searchCommunitySlug(jacksonville)).toBeNull()
    // Bend Park First Addition and 2nd Addition Bend Pk follow the same rule.
    const roosevelt = address({ containingPlatSlugs: ['bend-park-first-addition'], hoaClass: 'no_hoa' })
    expect(searchCommunitySlug(roosevelt)).toBeNull()
    // An HOA the MLS did not report is not an HOA.
    expect(searchCommunitySlug({ ...jacksonville, hoaClass: 'unknown' })).toBeNull()
    expect(searchCommunitySlug({ ...jacksonville, hoaClass: null })).toBeNull()
  })

  it('one place, one decision: a sale in the subject\'s own derived community takes the subject\'s answer', () => {
    // The subject's HOA makes its derived community real. A sale in the same
    // community whose MLS row reports no HOA is still inside it.
    const subjectHoa = address({ communitySlug: 'juniper-ridge', platSlug: 'juniper-ridge-second-addition', hoaClass: 'hoa' })
    const saleNoHoa = address({ communitySlug: 'juniper-ridge', platSlug: 'juniper-ridge-addition', hoaClass: 'no_hoa' })
    expect(saleSearchCommunitySlug(subjectHoa, saleNoHoa)).toBe('juniper-ridge')
    // The subject carries no HOA, so its derived community is no wall, and a
    // sale in that same community does not raise one by carrying an HOA.
    const subjectPlain = { ...subjectHoa, hoaClass: 'no_hoa' }
    const saleHoa = { ...saleNoHoa, hoaClass: 'hoa' }
    expect(saleSearchCommunitySlug(subjectPlain, saleHoa)).toBeNull()
  })

  it('a sale in another derived community walls an ordinary home only when that sale carries an HOA', () => {
    const plain = address({ communitySlug: 'northwest-townsite', platSlug: 'northwest-townsite-second-addition', hoaClass: 'no_hoa' })
    const townsite = address({ communitySlug: 'bend-park', platSlug: 'bend-park-first-addition', hoaClass: 'no_hoa' })
    const planned = address({ communitySlug: 'juniper-ridge', platSlug: 'juniper-ridge-addition', hoaClass: 'hoa' })
    expect(saleSearchCommunitySlug(plain, townsite)).toBeNull()
    expect(saleSearchCommunitySlug(plain, planned)).toBe('juniper-ridge')
    // A registry community sale stays a community sale whatever its HOA field says.
    expect(saleSearchCommunitySlug(plain, address({ communitySlug: 'tetherow', hoaClass: 'no_hoa' }))).toBe('tetherow')
  })
})

// ---------------------------------------------------------------------------
// The walk: a plat-name community without an HOA walks its touching plats
// inside the neighborhood; the same home with an HOA is walled; a registry
// community stays walled.
// ---------------------------------------------------------------------------

const RIVER_WEST = 'bend-river-west'
const asOf = '2026-10-08'

function jacksonville(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1355 Jacksonville',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Northwest Townsite',
    subdivisionNorm: 'northwest townsite',
    subdivisionSlug: 'northwest-townsite-second-addition',
    latitude: 44.0619,
    longitude: -121.3236,
    beds: 3,
    baths: 2,
    sqft: 876,
    lotAcres: 0.11,
    yearBuilt: 1919,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: RIVER_WEST,
    communityLocated: true,
    communitySlug: 'northwest-townsite',
    adjacentSubdivisionSlugs: ['riverside-addition', 'northwest-townsite-first-addition'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

let seq = 0
function riverWestSale(over: Partial<PricingSale> = {}): PricingSale {
  seq += 1
  return {
    listingKey: `RW${seq}`,
    listNumber: null,
    address: `${1300 + seq} Newport`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Riverside',
    subdivisionNorm: 'riverside',
    subdivisionSlug: 'riverside-addition',
    latitude: 44.0625 + seq * 0.0003,
    longitude: -121.3245,
    beds: 3,
    baths: 2,
    sqft: 900,
    lotAcres: 0.12,
    yearBuilt: 1925,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 660_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: `2026-0${(seq % 8) + 1}-15`,
    originalAsk: 675_000,
    lastAsk: 665_000,
    daysToOffer: 20,
    cdom: 30,
    dropCount: 0,
    closePpsf: 733,
    photoUrl: null,
    publicRemarks: null,
    marketArea: RIVER_WEST,
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

function touchingSales(): PricingSale[] {
  return Array.from({ length: 5 }, () => riverWestSale())
}

describe('the walk under the community rule', () => {
  it('a plat-name community without an HOA walks the touching plats inside the neighborhood to five', () => {
    const out = walkPricingLadder(jacksonville(), touchingSales(), { asOf })
    expect(out.comps).toHaveLength(5)
    expect(out.comps.every((c) => c.selectionTier.startsWith('adjacent-sub-'))).toBe(true)
    // No community step ran on a community that does not wall the search.
    const community = out.rungs.filter((r) => r.tier.startsWith('community-'))
    expect(community.every((r) => !r.ran)).toBe(true)
  })

  it('the same home carrying an HOA keeps its derived community as a wall', () => {
    const out = walkPricingLadder(jacksonville({ hoaClass: 'hoa' }), touchingSales(), { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('a registry community still walls a home with no HOA', () => {
    const out = walkPricingLadder(jacksonville({ communitySlug: 'northwest-crossing' }), touchingSales(), { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('a named real derived community still walls a home with no HOA', () => {
    const golf = jacksonville({
      communitySlug: 'bend-golf-club',
      subdivisionSlug: 'bend-golf-club-addition',
      adjacentSubdivisionSlugs: ['riverside-addition'],
    })
    const out = walkPricingLadder(golf, touchingSales(), { asOf })
    expect(out.comps).toHaveLength(0)
  })

  it('a touching sale inside an HOA plat-name community stays out of an ordinary home\'s set', () => {
    const sales = touchingSales()
    sales[0] = { ...sales[0]!, communitySlug: 'juniper-ridge', hoaClass: 'hoa' }
    const out = walkPricingLadder(jacksonville(), sales, { asOf })
    expect(out.comps.map((c) => c.listingKey)).not.toContain(sales[0]!.listingKey)
    expect(out.comps).toHaveLength(4)
  })
})
