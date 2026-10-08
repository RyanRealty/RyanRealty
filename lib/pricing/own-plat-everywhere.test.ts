/**
 * ONE OWN-SUBDIVISION DECISION, EVERYWHERE (Matt 2026-10-08, "Yes,
 * everywhere"): a recorded addition or phase of the subject's subdivision that
 * sits in the same neighborhood counts as the subject's own subdivision in the
 * comp search, the pricing weights, the price-line exemption, the room rule,
 * the price anchor, the competition and came-off homes, and the review.
 *
 * Before the ruling the listings ladder asked the ground decision
 * (lib/pricing/plat-ground.ts) and the facts ladder asked samePlat, so for a
 * Kenwood subject a Kenwood First Addition sale was own plat (weight 3) on one
 * ladder and a touching plat (weight 2, graded on the 20% price line and the
 * year band) on the other.
 *
 * Plats and points are the county's (public.boundaries, read 2026-10-08):
 * Kenwood's centroid, 733 Saginaw in Kenwood First Addition, both in River
 * West; Park Place Phase I's centroid in Southwest Bend.
 */
import { describe, expect, it } from 'vitest'
import { judgeComps, type JudgeModelCall } from '@/lib/cma/judge'
import type { CompVerdict } from '@/lib/cma/judge-consistency'
import { sameAreaFit } from '@/lib/cma/same-area-fit'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import { keptOnOwnGround } from '@/lib/pricing/comp-area'
import { walkPricingLadder, type PricingSale, type PricingSubject, type SelectedPricingComp } from '@/lib/pricing/match'
import {
  onOwnPlat,
  ownPlatReach,
  parentOf,
  platGround,
  platGroundReach,
} from '@/lib/pricing/plat-ground'
import { anchorFromSamples, anchorPlaceNames, anchorSampler, samePlat } from '@/lib/pricing/price-anchor'
import { carriedRoomDecision, roomCountsDecision } from '@/lib/pricing/room-ground'

const KENWOOD = { latitude: 44.06378, longitude: -121.32375 }
const SAGINAW_733 = { latitude: 44.065697, longitude: -121.322645 }
const PARK_PLACE_PHASE_I = { latitude: 44.02324, longitude: -121.32792 }
const RIVER_WEST = 'bend-river-west'
const asOf = '2026-10-08'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '100 Kenwood Test',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    subdivisionSlug: 'kenwood',
    ...KENWOOD,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    yearBuilt: 1940,
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
    communitySlug: null,
    adjacentSubdivisionSlugs: ['kenwood-first-addition', 'kenwood-gardens'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

function sale(key: string, ppsf: number, over: Partial<PricingSale> = {}): PricingSale {
  const sqft = over.sqft ?? 1800
  return {
    listingKey: key,
    listNumber: null,
    address: `${key} Street`,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    subdivisionSlug: 'kenwood',
    ...KENWOOD,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.15,
    yearBuilt: 1945,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: ppsf * sqft,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: null,
    lastAsk: ppsf * sqft,
    daysToOffer: 10,
    cdom: 20,
    dropCount: 0,
    closePpsf: ppsf,
    photoUrl: null,
    publicRemarks: null,
    marketArea: RIVER_WEST,
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

/** A Kenwood First Addition sale (MLS "Kenwood", as 733 Saginaw is listed), in River West. */
function addition(key: string, ppsf: number, over: Partial<PricingSale> = {}): PricingSale {
  return sale(key, ppsf, { subdivisionSlug: 'kenwood-first-addition', ...SAGINAW_733, ...over })
}

/**
 * Three Kenwood sales and three Kenwood First Addition sales near $450 a
 * square foot, then two addition sales the old touching-plat rung refused:
 * one at $300 (outside the 20% line, $360 to $540) and one built 1995, 55
 * years off the subject, one bedroom apart.
 */
function pool(): PricingSale[] {
  return [
    sale('KEN_1', 450, { closeDate: '2026-08-01' }),
    sale('KEN_2', 452, { closeDate: '2026-07-01' }),
    sale('KEN_3', 448, { closeDate: '2026-05-01' }),
    addition('ADD_1', 451, { closeDate: '2026-08-15' }),
    addition('ADD_2', 449, { closeDate: '2026-06-15' }),
    addition('ADD_3', 450, { closeDate: '2026-04-15' }),
    addition('ADD_CHEAP', 300, { closeDate: '2026-09-01' }),
    addition('ADD_ROOM', 455, { closeDate: '2026-09-10', beds: 4, yearBuilt: 1995 }),
  ]
}

describe('the one decision: a recorded addition inside the subject neighborhood is its own subdivision', () => {
  it('733 Saginaw (Kenwood First Addition, River West) is own plat for a Kenwood subject; samePlat said no', () => {
    expect(parentOf(KENWOOD.latitude, KENWOOD.longitude)).toBe(RIVER_WEST)
    expect(parentOf(SAGINAW_733.latitude, SAGINAW_733.longitude)).toBe(RIVER_WEST)
    const s = subject()
    const row = addition('ADD_1', 451)
    expect(samePlat(s, row)).toBe(false)
    expect(ownPlatReach(s, row)).toBe('family')
    expect(onOwnPlat(s, row)).toBe(true)
  })

  it('a namesake outside the neighborhood, another subdivision, or another town is not', () => {
    const s = subject({ subdivision: 'Park Place', subdivisionNorm: 'park place', subdivisionSlug: 'park-place' })
    // Park Place Phase I is Park Place by name and sits in Southwest Bend.
    expect(
      onOwnPlat(s, sale('PP1', 400, { subdivisionSlug: 'park-place-phase-i', subdivision: 'Park Place', marketArea: null, ...PARK_PLACE_PHASE_I })),
    ).toBe(false)
    // Kenwood Gardens is a different subdivision, wherever it sits.
    expect(onOwnPlat(subject(), sale('KG', 400, { subdivisionSlug: 'kenwood-gardens', subdivision: 'Kenwood Gardens' }))).toBe(false)
    // Off the mesh a family plat in another town is not this ground.
    const offMesh = subject({ marketArea: null, latitude: null, longitude: null })
    expect(onOwnPlat(offMesh, addition('AWAY', 450, { marketArea: null, latitude: null, longitude: null }))).toBe(true)
    expect(onOwnPlat(offMesh, addition('AWAY', 450, { city: 'Redmond', marketArea: null, latitude: null, longitude: null }))).toBe(false)
  })

  it('every pair samePlat calls own plat stays own plat', () => {
    const slugs = ['kenwood', 'kenwood-first-addition', 'hampton-park-subdivision-phase-i', 'hampton-park-subdivision-phase-ii', 'park-place']
    for (const a of slugs) {
      for (const b of slugs) {
        const s = subject({ subdivisionSlug: a })
        const row = sale('X', 400, { subdivisionSlug: b })
        if (samePlat(s, row)) expect([a, b, onOwnPlat(s, row)]).toEqual([a, b, true])
      }
    }
  })

  it('the facts walk and the listings ladder read the same ground and give the same answer', () => {
    const s = subject()
    // The listings ladder's own ground, as lib/cma/comps.ts builds it.
    const listings = platGround({ platSlugs: ['kenwood'], names: ['Kenwood'], city: 'Bend', parent: RIVER_WEST })
    for (const row of [
      addition('ADD_1', 451),
      sale('KEN_1', 450),
      sale('KG', 400, { subdivisionSlug: 'kenwood-gardens', subdivision: 'Kenwood Gardens' }),
      sale('NOPOLY', 400, { subdivisionSlug: null, subdivision: 'Kenwood' }),
      addition('AWAY', 450, { marketArea: 'bend-southwest-bend', ...PARK_PLACE_PHASE_I }),
    ]) {
      const facts = onOwnPlat(s, row)
      const listing =
        platGroundReach(listings, {
          platSlug: row.subdivisionSlug,
          subdivision: row.subdivision,
          latitude: row.latitude,
          longitude: row.longitude,
          city: row.city,
        }) != null
      expect([row.listingKey, facts]).toEqual([row.listingKey, listing])
    }
  })
})

describe('the facts walk seats the addition on the own-plat rung, at weight 3, under the own-plat exemptions', () => {
  const out = walkPricingLadder(subject(), pool(), { asOf, anchorWindowMonths: 24 })
  const seated = (key: string) => out.comps.find((c) => c.listingKey === key)

  it('own ground holds seven, so nothing widens: every addition sale came in on a subdivision rung', () => {
    expect(out.comps).toHaveLength(7)
    for (const c of out.comps) expect([c.listingKey, c.selectionTier.startsWith('subdivision-')]).toEqual([c.listingKey, true])
    expect(out.tiersUsed.some((t) => t.startsWith('adjacent-sub-'))).toBe(false)
  })

  it('stamps the addition own plat and weighs it as the same subdivision', () => {
    const c = seated('ADD_1')!
    expect(c.ownPlat).toBe(true)
    expect(c.locationMatch).toBe('same-subdivision')
  })

  it('the 20% price line does not grade it: the $300 addition sale stands inside its own subdivision', () => {
    expect(out.priceAnchor).toMatchObject({ source: 'plat', where: 'Kenwood' })
    expect(seated('ADD_CHEAP')?.ownPlat).toBe(true)
  })

  it('the year band does not apply, and one bedroom apart is own ground, kept and disclosed', () => {
    const c = seated('ADD_ROOM')!
    expect(c.roomDecision?.ok).toBe(true)
    expect(c.roomDifference).toEqual(['beds'])
  })

  it('outside the neighborhood polygon the same plat is the touching plat it always was', () => {
    const away = pool().map((p) =>
      p.subdivisionSlug === 'kenwood-first-addition' ? { ...p, marketArea: 'bend-awbrey-butte' } : p,
    )
    const walked = walkPricingLadder(subject(), away, { asOf, anchorWindowMonths: 24 })
    const add = walked.comps.filter((c) => c.subdivisionSlug === 'kenwood-first-addition')
    expect(add.length).toBeGreaterThan(0)
    for (const c of add) {
      expect(c.selectionTier.startsWith('adjacent-sub-')).toBe(true)
      expect(c.locationMatch).toBe('adjacent-subdivision')
      expect(c.ownPlat).toBe(false)
      expect(c.selectionTier.startsWith('subdivision-')).toBe(false)
    }
    // The $300 sale is graded on the line there and skipped.
    expect(walked.comps.some((c) => c.listingKey === 'ADD_CHEAP')).toBe(false)
  })
})

describe('the price anchor plat level is the subject own subdivision', () => {
  it('reads Kenwood and Kenwood First Addition together, named by the family', () => {
    const sample = anchorSampler({
      platSlug: 'kenwood',
      subdivisionNorm: 'kenwood',
      citySlug: 'bend',
      communitySlug: null,
      marketArea: RIVER_WEST,
      ...KENWOOD,
      ruralAcreage: false,
    })
    const place = (p: PricingSale) =>
      sample({
        ppsf: p.closePpsf,
        platSlug: p.subdivisionSlug ?? null,
        subdivisionNorm: p.subdivisionNorm,
        citySlug: p.citySlug,
        communitySlug: null,
        marketArea: p.marketArea ?? null,
        latitude: p.latitude,
        longitude: p.longitude,
      })
    const three = pool().slice(0, 3).map(place)
    const additions = pool().slice(3, 6).map(place)
    expect(additions.every((s) => s.inPlat && s.inPlatBeyondOwn === true)).toBe(true)
    const names = anchorPlaceNames({ platSlug: 'kenwood', platLabel: 'Kenwood First', subdivision: 'Kenwood', marketArea: RIVER_WEST, city: 'Bend' })
    expect(anchorFromSamples([...three, ...additions], names)).toMatchObject({ source: 'plat', n: 6 })
    // The plat alone is three sales: no plat level without the addition.
    expect(anchorFromSamples(three, names)?.source).not.toBe('plat')
  })
})

describe('the competition and came-off homes, the comp area, and the room rule read the same decision', () => {
  const cmaSubject = {
    streetAddress: '100 Kenwood Test',
    city: 'Bend',
    subdivision: 'Kenwood',
    subdivisionSlug: 'kenwood',
    ...KENWOOD,
    beds: 3,
    baths: 2,
    sqft: 1800,
    yearBuilt: 1940,
    propertySubType: 'Single Family Residence',
    marketArea: RIVER_WEST,
  }

  it('a home for sale in Kenwood First Addition is on the subject own plat: no year band, one room apart kept', () => {
    const fit = sameAreaFit(null, cmaSubject, {
      address: '733 Saginaw',
      city: 'Bend',
      subdivision: 'Kenwood',
      subdivisionSlug: 'kenwood-first-addition',
      ...SAGINAW_733,
      beds: 4,
      baths: 2,
      sqft: 1900,
      yearBuilt: 2005,
      propertySubType: 'Single Family Residence',
    })
    expect(fit).toEqual({ ok: true, ownPlat: true, roomDifference: ['beds'] })
  })

  it('a printed addition sale with no stamp is on the subject own ground; outside the polygon it is not', () => {
    expect(keptOnOwnGround(cmaSubject, { subdivisionSlug: 'kenwood-first-addition', ...SAGINAW_733 })).toBe(true)
    expect(keptOnOwnGround(cmaSubject, { subdivisionSlug: 'kenwood-first-addition', ...PARK_PLACE_PHASE_I })).toBe(false)
  })

  it('an unstamped sale on own ground only through the family is local for the room rule', () => {
    // Off the mesh, so the mapped-neighborhood test cannot carry it, and a
    // different MLS spelling, so the name cannot either.
    const offMesh = { ...cmaSubject, latitude: null, longitude: null, marketArea: null, subdivision: 'Kenwood' }
    const decision = roomCountsDecision(offMesh, {
      address: '9 Elsewhere',
      city: 'Bend',
      subdivision: 'Kenwood 1st Addn',
      subdivisionSlug: 'kenwood-first-addition',
      beds: 4,
      baths: 2,
    })
    expect(decision.ok).toBe(true)
    expect(decision.compared.local).toBe(true)
  })
})

describe('the picker and the review call the same decision on an addition sale (rule 4)', () => {
  const market: CmaMarketContext = {
    geoSlug: 'bend',
    geoLabel: 'Bend',
    periodStart: '2025-10-01',
    periodEnd: '2026-10-01',
    soldCount365: 100,
    medianSalePrice: 800000,
    medianDom: 20,
    medianPpsf: 450,
    saleToListRatio: 0.98,
    yoyMedianPriceDeltaPct: 1,
    activeCount: 40,
    pendingCount: 10,
    monthsOfSupply: 4.5,
    mosFormula: 'test',
    marketVerdict: 'balanced',
    methodologyVersion: 'test',
    computedAt: '2026-10-01',
    pulseUpdatedAt: null,
  }
  const cmaSubject: CmaSubject = {
    listingKey: 'SUBJ',
    mlsNumber: '1',
    streetAddress: '100 Kenwood Test',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: 'Kenwood',
    subdivisionSlug: 'kenwood',
    ...KENWOOD,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1940,
    garageSpaces: 1,
    photoUrl: null,
    publicRemarks: 'Single level home.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 820000,
    lastListDate: null,
    listingHistoryLine: null,
  }
  const toComp = (c: SelectedPricingComp): CmaComp => ({
    listingKey: c.listingKey,
    mlsNumber: null,
    address: c.address,
    city: c.city,
    subdivision: c.subdivision,
    subdivisionSlug: c.subdivisionSlug ?? null,
    latitude: c.latitude,
    longitude: c.longitude,
    beds: c.beds,
    baths: c.baths,
    sqft: c.sqft,
    lotAcres: c.lotAcres,
    propertySubType: 'Single Family Residence',
    yearBuilt: c.yearBuilt,
    photoUrl: null,
    publicRemarks: 'Single level home.',
    viewDescription: null,
    taxAnnual: null,
    listPrice: c.lastAsk,
    closePrice: c.closePrice,
    closeDate: c.closeDate,
    daysToOffer: c.daysToOffer,
    domTotal: c.cdom,
    selectionTier: c.selectionTier,
    ownPlat: c.ownPlat ?? null,
    roomDecision: c.roomDecision ?? null,
    roomDifference: c.roomDifference ?? null,
  })

  it('the review restores the addition sale it cut on price and the one it cut for the bedroom', async () => {
    const walked = walkPricingLadder(subject(), pool(), { asOf, anchorWindowMonths: 24 })
    const comps = walked.comps.map(toComp)
    const room = comps.find((c) => c.listingKey === 'ADD_ROOM')!
    // The picker's room call, read back the way every later check reads it.
    expect(carriedRoomDecision(cmaSubject, room)).toMatchObject({ ok: true, notes: ['beds'] })
    const verdicts: CompVerdict[] = comps.map((c) =>
      c.listingKey === 'ADD_CHEAP'
        ? { listingKey: c.listingKey, tier: 'exclude', basis: 'price-tier', reason: 'Sold at $300/sqft, under the $360 floor.' }
        : c.listingKey === 'ADD_ROOM'
          ? { listingKey: c.listingKey, tier: 'exclude', basis: 'other', reason: '4 bedrooms against the subject 3.' }
          : { listingKey: c.listingKey, tier: 'strong', reason: 'Same subdivision, same size.' },
    )
    const callModel: JudgeModelCall = async () => ({
      payload: {
        ppsfFloor: 360,
        ppsfCeiling: 540,
        exclusionRule: 'Priced on closed sales from $360 to $540 per square foot.',
        confidence: 'Moderate',
        narrative: 'Seven sales set the range.',
        verdicts: verdicts.map((v) => ({
          listingKey: v.listingKey,
          tier: v.tier,
          reason: v.reason,
          basis: v.tier === 'exclude' ? v.basis : 'not-excluded',
        })),
      },
      raw: '{}',
      costUsd: 0,
    })
    const result = await judgeComps(cmaSubject, comps, market, {
      callModel,
      minComps: 5,
      priceAnchor: { ppsf: walked.priceAnchor!.ppsf, n: walked.priceAnchor!.n },
    })
    const cheap = result!.verdicts.find((v) => v.listingKey === 'ADD_CHEAP')!
    expect(cheap.tier).toBe('weak')
    expect(cheap.reason).toMatch(/^Inside the subject's own subdivision/)
    const roomV = result!.verdicts.find((v) => v.listingKey === 'ADD_ROOM')!
    expect(roomV.tier).toBe('strong')
    expect(roomV.reason).toMatch(/One bedroom different from yours/)
  })
})
