/**
 * Picker and comparability review share one room-count decision.
 *
 * A test here fails if those two paths disagree on the same sale's room gap.
 * Shape lock: 3028 Indian (3 bath) vs 2834 Indian (2 bath), same plat.
 */
import { describe, expect, it } from 'vitest'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'
import { roomCountsDecision } from '@/lib/pricing/room-ground'
import { roomDifferenceSentence } from '@/lib/pricing/room-counts'
import { groundVerdict } from '@/lib/cma/judge-ground'
import { judgeComps, type JudgeModelCall } from '@/lib/cma/judge'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import type { CompVerdict } from '@/lib/cma/judge-consistency'

const asOf = '2026-08-01'

function pricingSubject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: '3028',
    streetAddress: '3028 Indian',
    city: 'Redmond',
    citySlug: 'redmond',
    subdivision: 'Indian Ridge',
    subdivisionNorm: 'indian ridge',
    latitude: 44.272,
    longitude: -121.174,
    beds: 3,
    baths: 3,
    sqft: 1840,
    lotAcres: 0.2,
    yearBuilt: 1998,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    ...over,
  }
}

let saleSeq = 0
function pricingSale(over: Partial<PricingSale> = {}): PricingSale {
  saleSeq += 1
  return {
    listingKey: over.listingKey ?? `K${saleSeq}`,
    listNumber: null,
    address: over.address ?? `${saleSeq} Comp St`,
    city: 'Redmond',
    citySlug: 'redmond',
    subdivision: 'Indian Ridge',
    subdivisionNorm: 'indian ridge',
    latitude: 44.273,
    longitude: -121.175,
    beds: 3,
    baths: 3,
    sqft: 1800,
    lotAcres: 0.18,
    yearBuilt: 1996,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 520_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 535_000,
    lastAsk: 525_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 288.9,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

function cmaSubject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: '3028',
    mlsNumber: '100',
    streetAddress: '3028 Indian',
    city: 'Redmond',
    state: 'OR',
    postalCode: '97756',
    subdivision: 'Indian Ridge',
    latitude: 44.272,
    longitude: -121.174,
    beds: 3,
    baths: 3,
    sqft: 1840,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1998,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Single level home.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 535000,
    lastListDate: null,
    listingHistoryLine: null,
    ...over,
  }
}

function cmaComp(over: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: '2834',
    mlsNumber: null,
    address: '2834 Indian',
    city: 'Redmond',
    subdivision: 'Indian Ridge',
    latitude: 44.273,
    longitude: -121.175,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.18,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1996,
    photoUrl: null,
    publicRemarks: 'Single level home.',
    viewDescription: null,
    taxAnnual: null,
    listPrice: 525000,
    closePrice: 520000,
    closeDate: '2026-06-01',
    daysToOffer: 12,
    domTotal: 20,
    selectionTier: 'subdivision-6mo',
    ownPlat: true,
    ...over,
  }
}

const market: CmaMarketContext = {
  geoSlug: 'redmond',
  geoLabel: 'Redmond',
  periodStart: '2025-01-01',
  periodEnd: '2026-01-01',
  soldCount365: 100,
  medianSalePrice: 500000,
  medianDom: 20,
  medianPpsf: 280,
  saleToListRatio: 0.98,
  yoyMedianPriceDeltaPct: 2,
  activeCount: 40,
  pendingCount: 10,
  monthsOfSupply: 4.1,
  mosFormula: 'test',
  marketVerdict: 'balanced',
  methodologyVersion: 'test',
  computedAt: '2026-01-01',
  pulseUpdatedAt: null,
}

function clusterAround(peer: CmaComp): CmaComp[] {
  return [
    cmaComp({ listingKey: 'A', address: '2800 Indian', baths: 3, closePrice: 530000, ownPlat: true }),
    cmaComp({ listingKey: 'B', address: '2810 Indian', baths: 3, closePrice: 528000, ownPlat: true }),
    cmaComp({ listingKey: 'C', address: '2820 Indian', baths: 3, closePrice: 522000, ownPlat: true }),
    peer,
  ]
}

function payload(verdicts: CompVerdict[]) {
  return {
    ppsfFloor: 250,
    ppsfCeiling: 320,
    exclusionRule: 'Priced on closed sales from $250 to $320 per square foot.',
    confidence: 'Moderate',
    narrative: 'Four sales set the range.',
    verdicts: verdicts.map((v) => ({
      listingKey: v.listingKey,
      tier: v.tier,
      reason: v.reason,
      basis: v.tier === 'exclude' ? (v.basis ?? 'other') : 'not-excluded',
    })),
  }
}

function pickerKeeps(subject: PricingSubject, sale: PricingSale): boolean {
  return walkPricingLadder(subject, [sale], { asOf }).comps.some((c) => c.listingKey === sale.listingKey)
}

async function reviewAfterBathExclude(subject: CmaSubject, sale: CmaComp): Promise<boolean> {
  const comps = clusterAround(sale)
  const call: JudgeModelCall = async ({ system }) => {
    expect(system).toMatch(/ONE ROOM RULE/i)
    return {
      payload: payload(
        comps.map((c) =>
          c.listingKey === sale.listingKey
            ? {
                listingKey: c.listingKey,
                tier: 'exclude' as const,
                basis: 'other' as const,
                reason: `${c.baths} bath versus the subject ${subject.baths} bath.`,
              }
            : { listingKey: c.listingKey, tier: 'strong' as const, reason: 'Same size and vintage.' },
        ),
      ),
      raw: '{}',
      costUsd: 0,
    }
  }
  const result = await judgeComps(subject, comps, market, { callModel: call, minComps: 3 })
  return result?.keptKeys.includes(sale.listingKey) === true
}

async function reviewAfterBathKeep(subject: CmaSubject, sale: CmaComp): Promise<boolean> {
  const comps = clusterAround(sale)
  const call: JudgeModelCall = async () => ({
    payload: payload(
      comps.map((c) => ({ listingKey: c.listingKey, tier: 'strong' as const, reason: 'Same size and vintage.' })),
    ),
    raw: '{}',
    costUsd: 0,
  })
  const result = await judgeComps(subject, comps, market, { callModel: call, minComps: 3 })
  return result?.keptKeys.includes(sale.listingKey) === true
}

const indian2834 = pricingSale({
  listingKey: '2834',
  address: '2834 Indian',
  baths: 2,
})

describe('one-room rule — picker and review share one decision', () => {
  it('3028 vs 2834: same plat, 3 vs 2 baths, stays, disclosed, $0 on the room', async () => {
    const subject = pricingSubject()
    const sale = indian2834
    const decision = roomCountsDecision(subject, { ...sale, ownPlat: true })
    expect(decision.ok).toBe(true)
    expect(decision.notes).toEqual(['baths'])
    expect(roomDifferenceSentence(decision.notes)).toContain('No dollar value is applied to the room')

    const picked = walkPricingLadder(subject, [sale], { asOf })
    expect(picked.comps.map((c) => c.listingKey)).toContain('2834')
    expect(picked.comps.find((c) => c.listingKey === '2834')?.roomDifference).toEqual(['baths'])

    const sub = cmaSubject()
    const peer = cmaComp({ ownPlat: true, baths: 2 })
    expect(await reviewAfterBathExclude(sub, peer)).toBe(true)

    const html = renderCompMatrixHtml(
      sub,
      [
        {
          ...peer,
          listingKey: '2834',
          roomDifference: ['baths'],
          monthsSinceClose: 2,
          timeAdjustment: 0,
          timeAdjustedPrice: 520000,
          ppsfTimeAdjusted: 289,
          sizeAdjustment: 0,
          adjustedPrice: 520000,
          weight: 1,
        } as CmaAdjustedComp,
        ...[1, 2, 3, 4].map(
          (i) =>
            ({
              ...cmaComp({ listingKey: `P${i}`, address: `${2800 + i} Indian`, baths: 3 }),
              monthsSinceClose: 2,
              timeAdjustment: 0,
              timeAdjustedPrice: 530000,
              ppsfTimeAdjusted: 294,
              sizeAdjustment: 0,
              adjustedPrice: 530000,
              weight: 1,
            }) as CmaAdjustedComp,
        ),
      ],
      '',
      null,
    )
    expect(html).toContain('One bathroom off yours. No dollar adjustment.')
    expect(html).not.toContain('$0 (1 bath)')
    expect(html).toContain('Adjusted for rooms (theirs vs yours)')
  })

  it('one bath off on own plat stays', () => {
    const subject = pricingSubject({ baths: 3 })
    const sale = pricingSale({ listingKey: 'ONE_OFF', baths: 2, address: '10 Indian Ridge' })
    expect(roomCountsDecision(subject, { ...sale, ownPlat: true }).ok).toBe(true)
    expect(pickerKeeps(subject, sale)).toBe(true)
  })

  it('refuses one bed and one bath on own plat, and still keeps a one-bath-only gap', () => {
    const subject = pricingSubject({ beds: 4, baths: 3 })
    const both = pricingSale({
      listingKey: 'BED_AND_BATH',
      beds: 3,
      baths: 2,
      address: '12 Indian Ridge',
    })
    const bothDecision = roomCountsDecision(subject, { ...both, ownPlat: true })
    expect(bothDecision.ok).toBe(false)
    expect(bothDecision.notes).toEqual([])
    expect(pickerKeeps(subject, both)).toBe(false)

    const bathOnly = pricingSale({
      listingKey: 'BATH_ONLY',
      beds: 4,
      baths: 2,
      address: '14 Indian Ridge',
    })
    const bathDecision = roomCountsDecision(subject, { ...bathOnly, ownPlat: true })
    expect(bathDecision.ok).toBe(true)
    expect(bathDecision.notes).toEqual(['baths'])
    expect(pickerKeeps(subject, bathOnly)).toBe(true)
  })

  it('one bath off off-plat is out', () => {
    const subject = pricingSubject({ baths: 3, marketArea: null })
    const sale = pricingSale({
      listingKey: 'AWAY',
      baths: 2,
      address: '9 Stone',
      subdivision: 'Stone Creek',
      subdivisionNorm: 'stone creek',
      latitude: 44.12,
      longitude: -121.18,
      city: 'Bend',
      citySlug: 'bend',
    })
    expect(roomCountsDecision(subject, { ...sale, ownPlat: false }).ok).toBe(false)
    expect(pickerKeeps(subject, sale)).toBe(false)
  })

  it('two baths off is out everywhere, including own plat', () => {
    const subject = pricingSubject({ baths: 3 })
    const onPlat = pricingSale({ listingKey: 'TWO_OFF', baths: 1, address: '11 Indian Ridge' })
    expect(roomCountsDecision(subject, { ...onPlat, ownPlat: true }).ok).toBe(false)
    expect(pickerKeeps(subject, onPlat)).toBe(false)

    const offPlat = pricingSale({
      listingKey: 'TWO_AWAY',
      baths: 1,
      address: '9 Stone',
      subdivision: 'Stone Creek',
      subdivisionNorm: 'stone creek',
      latitude: 44.12,
      longitude: -121.18,
    })
    expect(roomCountsDecision(subject, { ...offPlat, ownPlat: false }).ok).toBe(false)
    expect(pickerKeeps(subject, offPlat)).toBe(false)
  })

  it('fails if the picker and the review disagree on the same sale’s room gap', async () => {
    const cases: Array<{
      name: string
      ownPlat: boolean
      baths: number
      subdivision: string
      subdivisionNorm: string
      address: string
    }> = [
      { name: '2834 same plat 2ba', ownPlat: true, baths: 2, subdivision: 'Indian Ridge', subdivisionNorm: 'indian ridge', address: '2834 Indian' },
      { name: 'match 3ba own plat', ownPlat: true, baths: 3, subdivision: 'Indian Ridge', subdivisionNorm: 'indian ridge', address: '2840 Indian' },
      { name: '1ba own plat (two off)', ownPlat: true, baths: 1, subdivision: 'Indian Ridge', subdivisionNorm: 'indian ridge', address: '2844 Indian' },
      { name: '2ba off plat', ownPlat: false, baths: 2, subdivision: 'Stone Creek', subdivisionNorm: 'stone creek', address: '9 Stone' },
    ]

    const subject = pricingSubject()
    const sub = cmaSubject()

    for (const row of cases) {
      const sale = pricingSale({
        listingKey: row.name,
        baths: row.baths,
        address: row.address,
        subdivision: row.subdivision,
        subdivisionNorm: row.subdivisionNorm,
        latitude: row.ownPlat ? 44.273 : 44.12,
        longitude: row.ownPlat ? -121.175 : -121.18,
      })
      const peer = cmaComp({
        listingKey: row.name,
        baths: row.baths,
        address: row.address,
        subdivision: row.subdivision,
        ownPlat: row.ownPlat,
        latitude: row.ownPlat ? 44.273 : 44.12,
        longitude: row.ownPlat ? -121.175 : -121.18,
      })
      const allowed = roomCountsDecision(subject, { ...sale, ownPlat: row.ownPlat }).ok
      const picked = pickerKeeps(subject, sale)
      const afterExclude = await reviewAfterBathExclude(sub, peer)
      const afterKeep = await reviewAfterBathKeep(sub, peer)
      expect({ name: row.name, picked, afterExclude, afterKeep, allowed }).toEqual({
        name: row.name,
        picked: allowed,
        afterExclude: allowed,
        afterKeep: allowed,
        allowed,
      })
    }
  })

  it('grounding does not treat a one-bath own-plat gap as a supported exclude', () => {
    const sub = cmaSubject()
    const sale = cmaComp({ ownPlat: true, baths: 2 })
    const result = groundVerdict(
      sub,
      sale,
      {
        listingKey: sale.listingKey,
        tier: 'exclude',
        basis: 'other',
        reason: '2 bath versus the subject 3 bath.',
      },
      [sale],
    )
    expect(result.verdict.tier).not.toBe('exclude')
    expect(result.grounded).toBe(false)
  })
})
