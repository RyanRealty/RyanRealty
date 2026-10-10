import { describe, expect, it } from 'vitest'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { roomAdjustmentWords } from '@/lib/cma/seller-letter-copy'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import { pricingSaleToCmaComp } from '@/lib/pricing/estimate'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

/**
 * RULE 4, ONE DECISION WHEREVER THE SALE CAME FROM (2026-10-08).
 *
 * A one-room sale that passes the hard wall stays in the pool and is disclosed
 * at zero dollars. Five own-plat sales outrank it, so it waits. When the own
 * plat is short of five it seats on the rung that admitted it. The accuracy
 * contract reads the same room counts:
 *
 *  - cma-20435-powder-mountain: 60645 Taos, 3 bed / 3 full baths against the
 *    subject's 3 bed / 2 full baths, a touching plat inside the subject's
 *    mapped neighborhood (bend-southeast-bend), seated by the bracket.
 *  - cma-63264-rossby: 63127 Vista Meadow, 4 bed / 2 full baths against the
 *    subject's 3 bed / 2 full baths, a next-row plat inside the subject's
 *    mapped neighborhood (bend-boyd-acres), seated by the bracket.
 *
 * Both are one whole room apart on the subject's own ground, which rule 4
 * keeps and discloses at zero dollars. Now every door into the set makes one
 * call (pickerRoomDecision in lib/pricing/match.ts), the seated sale carries
 * it, and the contract re-runs the rule on the counts that call compared.
 *
 * Shapes are the two homes' own counts, sizes and grounds (dry run and
 * listings rows read 2026-10-08); prices and points are rounded fixtures.
 */
const asOf = '2026-10-08'

function subjectOf(over: Partial<PricingSubject>): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '20435 Powder Mountain',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Mtn High',
    subdivisionNorm: 'mtn high',
    subdivisionSlug: 'mountain-high',
    latitude: 44.006427,
    longitude: -121.302224,
    beds: 3,
    baths: 2,
    bathsFull: 2,
    bathsHalf: 0,
    sqft: 2588,
    lotAcres: 0.2,
    yearBuilt: 1990,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: 'bend-southeast-bend',
    communityLocated: true,
    communitySlug: null,
    adjacentSubdivisionSlugs: ['alpine-village-ii-at-mountain-high'],
    closerSubdivisionSlugs: [],
    ...over,
  }
}

function saleOf(over: Partial<PricingSale>): PricingSale {
  return {
    listingKey: 'SALE',
    listNumber: null,
    address: '1 Own Plat',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Mtn High',
    subdivisionNorm: 'mtn high',
    subdivisionSlug: 'mountain-high',
    latitude: 44.0066,
    longitude: -121.3025,
    beds: 3,
    baths: 2,
    bathsFull: 2,
    bathsHalf: 0,
    sqft: 2300,
    lotAcres: 0.2,
    yearBuilt: 1990,
    newConstruction: false,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 830_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 849_000,
    lastAsk: 839_000,
    daysToOffer: 20,
    cdom: 40,
    dropCount: 0,
    closePpsf: 361,
    photoUrl: null,
    publicRemarks: null,
    marketArea: 'bend-southeast-bend',
    communityLocated: true,
    communitySlug: null,
    ...over,
  }
}

/** Five own-plat sales, every one smaller than the subject, so the bracket wants one larger home. */
function ownPlatSmaller(): PricingSale[] {
  const rows: Array<[string, number, number, string]> = [
    ['20396 Mission Ridge', 2200, 800_000, '2026-09-04'],
    ['20396 Buttermilk', 2250, 815_000, '2026-08-06'],
    ['20465 Outback', 2393, 860_000, '2026-04-01'],
    ['20386 White Pass', 2208, 805_000, '2026-03-27'],
    ['60640 Thunderbird', 2555, 925_000, '2026-02-28'],
  ]
  return rows.map(([address, sqft, closePrice, closeDate], i) =>
    saleOf({
      listingKey: `OWN_${i}`,
      address,
      sqft,
      closePrice,
      closeDate,
      closePpsf: Math.round(closePrice / sqft),
      latitude: 44.0066 + i * 0.0003,
      longitude: -121.3025 - i * 0.0003,
    }),
  )
}

/** 60645 Taos's shape: a touching plat that carries the same MLS name, inside the subject's neighborhood. */
function taos(over: Partial<PricingSale> = {}): PricingSale {
  return saleOf({
    listingKey: 'TAOS',
    address: '60645 Taos',
    subdivisionSlug: 'alpine-village-ii-at-mountain-high',
    sqft: 2809,
    beds: 3,
    baths: 4,
    bathsFull: 3,
    bathsHalf: 1,
    closePrice: 1_000_000,
    closePpsf: 356,
    closeDate: '2026-05-29',
    latitude: 44.0081,
    longitude: -121.3041,
    ...over,
  })
}

/**
 * A plat outside the Bend neighborhood mesh (no mapped neighborhood, not a
 * registry community), so own ground is only the plat and the street: the
 * case where the plat test decides. Points sit east of US-97 in Redmond.
 */
function redmondSale(over: Partial<PricingSale>): PricingSale {
  return saleOf({
    city: 'Redmond',
    citySlug: 'redmond',
    subdivision: 'Pine Meadow',
    subdivisionNorm: 'pine meadow',
    subdivisionSlug: 'pine-meadow',
    latitude: 44.2552,
    longitude: -121.1552,
    marketArea: null,
    communityLocated: false,
    ...over,
  })
}

function redmondPlat(): { subject: PricingSubject; own: PricingSale[] } {
  const subject = subjectOf({
    streetAddress: '2500 SE Pine Meadow Way',
    city: 'Redmond',
    citySlug: 'redmond',
    subdivision: 'Pine Meadow',
    subdivisionNorm: 'pine meadow',
    subdivisionSlug: 'pine-meadow',
    latitude: 44.2555,
    longitude: -121.1555,
    marketArea: null,
    communityLocated: false,
    adjacentSubdivisionSlugs: ['pine-meadow-east'],
  })
  const own = ownPlatSmaller().map((s, i) =>
    redmondSale({
      listingKey: s.listingKey,
      address: `${2100 + i * 10} SE Plat Way`,
      sqft: s.sqft,
      closePrice: Math.round(s.sqft * 235),
      closePpsf: 235,
      closeDate: s.closeDate,
      latitude: 44.2552 + i * 0.0002,
      longitude: -121.1552 - i * 0.0002,
    }),
  )
  return { subject, own }
}

function cmaSubjectOf(s: PricingSubject): CmaSubject {
  return {
    listingKey: s.listingKey,
    mlsNumber: null,
    streetAddress: s.streetAddress,
    city: s.city,
    postalCode: null,
    subdivision: s.subdivision,
    subdivisionSlug: s.subdivisionSlug ?? null,
    latitude: s.latitude,
    longitude: s.longitude,
    beds: s.beds,
    baths: s.baths,
    bathsFull: s.bathsFull ?? null,
    bathsHalf: s.bathsHalf ?? null,
    sqft: s.sqft,
    lotAcres: s.lotAcres,
    yearBuilt: s.yearBuilt,
    propertySubType: 'Single Family Residence',
  } as unknown as CmaSubject
}

function contractFor(s: PricingSubject, comps: CmaAdjustedComp[], withGround = true) {
  const subj = cmaSubjectOf(s)
  const pricing = computePricing(subj, comps, null)!
  expect(pricing).toBeTruthy()
  return evaluateAccuracyContract({
    comps,
    pricing,
    judgment: null,
    audit: null,
    minComps: 5,
    marketContextPresent: true,
    subjectSubType: 'Single Family Residence',
    // EXACTLY the subject args lib/cma/build.ts hands the contract.
    subjectBaths: s.baths,
    subjectBathsFull: s.bathsFull ?? null,
    subjectBathsHalf: s.bathsHalf ?? null,
    subjectBeds: s.beds,
    subjectSubdivisionSlug: s.subdivisionSlug ?? null,
    subjectGround: withGround ? subj : null,
  })
}

const roomCheck = (c: ReturnType<typeof contractFor>) => c.checks.find((x) => x.id === 'bath-count-match')!

describe('the size bracket seats a sale with the picker’s one-room decision (rule 4)', () => {
  it('cma-20435-powder-mountain: five own sales keep the price, and one full bath apart waits on the bench', () => {
    const subject = subjectOf({})
    const out = walkPricingLadder(subject, [...ownPlatSmaller(), taos()], { asOf })
    expect(out.comps.find((c) => c.listingKey === 'TAOS')).toBeUndefined()
    expect(out.comps).toHaveLength(5)
    const waiting = (out.bench ?? []).find((c) => c.listingKey === 'TAOS')
    expect(waiting?.selectionTier.startsWith('adjacent-')).toBe(true)
    expect(waiting?.ownPlat).toBe(false)
    expect(waiting?.roomDecision?.ok).toBe(true)
    expect(waiting?.roomDecision?.notes).toEqual(['baths'])
    expect(waiting?.roomDifference).toEqual(['baths'])
    expect(out.tiersUsed).not.toContain('gla-bracket')
  })

  it('cma-20435-powder-mountain: one full bath apart seats on its adjacent rung when the own plat is short of five', () => {
    const subject = subjectOf({})
    const out = walkPricingLadder(subject, [...ownPlatSmaller().slice(0, 4), taos()], { asOf })
    const seated = out.comps.find((c) => c.listingKey === 'TAOS')
    expect(seated?.selectionTier.startsWith('adjacent-')).toBe(true)
    expect(seated?.selectionTier).not.toBe('gla-bracket')
    expect(seated?.ownPlat).toBe(false)
    expect(seated?.roomDecision?.ok).toBe(true)
    expect(seated?.roomDecision?.notes).toEqual(['baths'])
    expect(seated?.roomDecision?.compared).toMatchObject({
      subjectBaths: 2,
      saleBaths: 3,
      bathBasis: 'full',
      local: true,
    })
    expect(seated?.roomDifference).toEqual(['baths'])

    const comps = out.comps.map(pricingSaleToCmaComp)
    const taosComp = comps.find((c) => c.listingKey === 'TAOS')!
    expect(taosComp.roomDecision?.ok).toBe(true)
    expect(roomAdjustmentWords(taosComp.roomDifference)).toBe(
      'One bathroom off yours. It counts for less. No dollar adjustment.',
    )

    const adjusted = adjustComps(cmaSubjectOf(subject), comps, null)
    const contract = contractFor(subject, adjusted)
    expect(roomCheck(contract).pass).toBe(true)
    expect(roomCheck(contract).detail).toMatch(/counts for less/)
    expect(roomCheck(contract).detail).toMatch(/No dollar value is applied to the room/)
  })

  it('cma-63264-rossby: one bedroom apart in a next-row plat inside the mapped neighborhood is seated and passed', () => {
    // 63264 Rossby: 3 bed, 2 full + 1 half, 2,357 sqft, Westerly II, bend-boyd-acres.
    const subject = subjectOf({
      streetAddress: '63264 Rossby',
      subdivision: 'Westerly II',
      subdivisionNorm: 'westerly ii',
      subdivisionSlug: 'westerly-ii',
      latitude: 44.096881,
      longitude: -121.31138,
      beds: 3,
      baths: 3,
      bathsFull: 2,
      bathsHalf: 1,
      sqft: 2357,
      marketArea: 'bend-boyd-acres',
      adjacentSubdivisionSlugs: ['chestnut-park-phase-2'],
      closerSubdivisionSlugs: ['glen-vista-meadows-pz-20-0186'],
    })
    const own = ownPlatSmaller().map((s, i) =>
      saleOf({
        ...s,
        subdivision: 'Westerly II',
        subdivisionNorm: 'westerly ii',
        subdivisionSlug: 'westerly-ii',
        baths: 3,
        bathsFull: 2,
        bathsHalf: 1,
        sqft: [1850, 1880, 1900, 1996, 2100][i]!,
        closePrice: [680_000, 690_000, 700_000, 730_000, 760_000][i]!,
        closePpsf: Math.round([680_000, 690_000, 700_000, 730_000, 760_000][i]! / [1850, 1880, 1900, 1996, 2100][i]!),
        latitude: 44.0969 + i * 0.0003,
        longitude: -121.3114 - i * 0.0003,
        marketArea: 'bend-boyd-acres',
      }),
    )
    // 63127 Vista Meadow: 4 bed, 2 full + 1 half, 2,684 sqft, Glen Vista Meadows.
    const vistaMeadow = saleOf({
      listingKey: 'VISTA_MEADOW',
      address: '63127 Vista Meadow',
      subdivision: 'Glen Vista Meadows',
      subdivisionNorm: 'glen vista meadows',
      subdivisionSlug: 'glen-vista-meadows-pz-20-0186',
      beds: 4,
      baths: 3,
      bathsFull: 2,
      bathsHalf: 1,
      sqft: 2684,
      // Inside the 30% own-plat close band the bracket holds a different plat to.
      closePrice: 880_000,
      closePpsf: 328,
      closeDate: '2026-05-21',
      latitude: 44.0985,
      longitude: -121.3125,
      marketArea: 'bend-boyd-acres',
    })
    const full = walkPricingLadder(subject, [...own, vistaMeadow], { asOf })
    expect(full.comps.find((c) => c.listingKey === 'VISTA_MEADOW')).toBeUndefined()
    expect(full.comps).toHaveLength(5)
    expect(full.tiersUsed).not.toContain('gla-bracket')

    const out = walkPricingLadder(subject, [...own.slice(0, 4), vistaMeadow], { asOf })
    const seated = out.comps.find((c) => c.listingKey === 'VISTA_MEADOW')
    expect(seated?.selectionTier.startsWith('closer-sub-')).toBe(true)
    expect(seated?.roomDecision?.ok).toBe(true)
    expect(seated?.roomDecision?.notes).toEqual(['beds'])
    expect(seated?.roomDecision?.compared).toMatchObject({ subjectBeds: 3, saleBeds: 4, local: true })
    expect(seated?.roomDifference).toEqual(['beds'])

    const comps = out.comps.map(pricingSaleToCmaComp)
    const adjusted = adjustComps(cmaSubjectOf(subject), comps, null)
    const contract = contractFor(subject, adjusted)
    expect(roomCheck(contract).pass).toBe(true)
    expect(roomAdjustmentWords(comps.find((c) => c.listingKey === 'VISTA_MEADOW')!.roomDifference)).toBe(
      'One bedroom off yours. It counts for less. No dollar adjustment.',
    )
  })

  it('never seats a sale the rule refuses: three full baths apart, and the bracket takes the next eligible home', () => {
    const subject = subjectOf({})
    const twoApart = taos({ bathsFull: 5, bathsHalf: 0, baths: 5 })
    // Farther in size than Taos, so it is the bracket's second choice.
    const sameRooms = taos({
      listingKey: 'NEXT_LARGER',
      address: '60650 Taos',
      sqft: 2900,
      beds: 3,
      baths: 2,
      bathsFull: 2,
      bathsHalf: 0,
      closePrice: 1_020_000,
      closePpsf: 352,
    })
    const out = walkPricingLadder(subject, [...ownPlatSmaller(), twoApart, sameRooms], { asOf })
    expect(out.comps.find((c) => c.listingKey === 'TAOS')).toBeUndefined()
    expect((out.bench ?? []).find((c) => c.listingKey === 'TAOS')).toBeUndefined()
    expect(out.comps.find((c) => c.listingKey === 'NEXT_LARGER')).toBeUndefined()
    const waiting = (out.bench ?? []).find((c) => c.listingKey === 'NEXT_LARGER')
    expect(waiting?.selectionTier.startsWith('adjacent-')).toBe(true)
    expect(waiting?.roomDecision?.ok).toBe(true)
    expect(waiting?.roomDecision?.notes).toEqual([])
    expect(out.tiersUsed).not.toContain('gla-bracket')
  })

  it('seats a one-room sale on a touching plat the bracket already reaches', () => {
    const { subject, own } = redmondPlat()
    const offGround = redmondSale({
      listingKey: 'EAST',
      address: '2300 SE Other Way',
      subdivision: 'Pine Meadow East',
      subdivisionNorm: 'pine meadow east',
      subdivisionSlug: 'pine-meadow-east',
      sqft: 2809,
      bathsFull: 3,
      baths: 3,
      closePrice: 640_000,
      closePpsf: 228,
      closeDate: '2026-05-29',
      latitude: 44.2565,
      longitude: -121.1545,
    })
    const full = walkPricingLadder(subject, [...own, offGround], { asOf })
    expect(full.comps.find((c) => c.listingKey === 'EAST')).toBeUndefined()
    expect(full.comps).toHaveLength(5)
    const waiting = (full.bench ?? []).find((c) => c.listingKey === 'EAST')
    expect(waiting?.roomDifference).toEqual(['baths'])
    expect(waiting?.selectionTier.startsWith('adjacent-')).toBe(true)

    const short = walkPricingLadder(subject, [...own.slice(0, 4), offGround], { asOf })
    const east = short.comps.find((c) => c.listingKey === 'EAST')
    expect(east?.selectionTier.startsWith('adjacent-')).toBe(true)
    expect(east?.selectionTier).not.toBe('gla-bracket')
    expect(east?.roomDifference).toEqual(['baths'])

    const control = walkPricingLadder(subject, [...own, { ...offGround, baths: 2, bathsFull: 2 }], { asOf })
    expect(control.comps.find((c) => c.listingKey === 'EAST')).toBeUndefined()
    expect((control.bench ?? []).some((c) => c.listingKey === 'EAST')).toBe(true)
  })

  it('keeps a one-room sale on the subject’s recorded plat even when the MLS name differs (one call for every door)', () => {
    // Own plat by the recorded polygon is own ground (rule 4). The rung's
    // product test used to run its own room check without the plat test and
    // refused this sale before the rung's own check, which keeps it, could run.
    const { subject, own } = redmondPlat()
    const renamed = redmondSale({
      listingKey: 'RENAMED',
      address: '2400 SE Third Way',
      subdivision: 'Pine Meadow Ph 2',
      subdivisionNorm: 'pine meadow ph 2',
      subdivisionSlug: 'pine-meadow',
      sqft: 2450,
      beds: 4,
      closePrice: 570_000,
      closePpsf: 233,
      closeDate: '2026-07-15',
    })
    const out = walkPricingLadder(subject, [...own, renamed], { asOf })
    const seated = out.comps.find((c) => c.listingKey === 'RENAMED')
    expect(seated?.selectionTier.startsWith('subdivision-')).toBe(true)
    expect(seated?.ownPlat).toBe(true)
    expect(seated?.roomDecision?.notes).toEqual(['beds'])
    expect(seated?.roomDecision?.compared.local).toBe(true)
    expect(seated?.roomDifference).toEqual(['beds'])
  })
})

describe('the accuracy contract decides an unstamped sale on the subject’s own ground', () => {
  it('passes a one-room sale from the room counts alone', () => {
    const subject = subjectOf({})
    const out = walkPricingLadder(subject, [...ownPlatSmaller().slice(0, 4), taos()], { asOf })
    expect(out.comps.some((c) => c.listingKey === 'TAOS')).toBe(true)
    const comps = out.comps.map(pricingSaleToCmaComp)
    // A sale that reached the contract with no stamp, as the bracket's did before this fix.
    const unstamped = comps.map((c) => (c.listingKey === 'TAOS' ? { ...c, roomDecision: null, roomDifference: null } : c))
    const adjusted = adjustComps(cmaSubjectOf(subject), unstamped, null)
    expect(roomCheck(contractFor(subject, adjusted, true)).pass).toBe(true)
    const bare = roomCheck(contractFor(subject, adjusted, false))
    expect(bare.pass).toBe(true)
    expect(bare.detail).toMatch(/counts for less/)
    expect(bare.detail).toMatch(/No dollar value is applied to the room/)
  })
})

