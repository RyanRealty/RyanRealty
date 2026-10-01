/**
 * The judge's deterministic resolver, 2026-09-30: the own-plat restoration that
 * replaced the Falcon re-admission, the cache replaying stored votes through
 * the current resolver, and the narrative claim checks run against the set the
 * review keeps. The model is a function passed in. Nothing here calls api.x.ai.
 */
import { describe, expect, it } from 'vitest'
import { judgeComps, type JudgeModelCall } from '@/lib/cma/judge'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import { alignNarrativeToFinalSet, type CompVerdict } from '@/lib/cma/judge-consistency'

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '100',
    streetAddress: '4541 36th',
    city: 'Redmond',
    state: 'OR',
    postalCode: '97756',
    subdivision: 'Triple Ridge',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 3,
    sqft: 1840,
    lotAcres: 0.08,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2018,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Two story home near the park.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 520000,
    lastListDate: null,
    listingHistoryLine: null,
    ...overrides,
  }
}

function comp(overrides: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: 'C1',
    mlsNumber: null,
    address: '3886 Coyote',
    city: 'Redmond',
    subdivision: 'Triple Ridge',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 3,
    sqft: 1800,
    lotAcres: 0.08,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2018,
    photoUrl: null,
    publicRemarks: 'Two story home.',
    viewDescription: null,
    taxAnnual: null,
    listPrice: 700000,
    closePrice: 700000,
    closeDate: '2026-03-15',
    daysToOffer: 12,
    domTotal: 20,
    selectionTier: 'subdivision-6mo',
    ...overrides,
  }
}

function payload(verdicts: CompVerdict[], extra: Record<string, unknown> = {}) {
  return {
    ppsfFloor: 350,
    ppsfCeiling: 420,
    exclusionRule: 'Priced on closed sales from $350 to $420 per square foot.',
    confidence: 'Moderate',
    narrative: 'Four sales set the range.',
    verdicts: verdicts.map((v) => ({
      listingKey: v.listingKey,
      tier: v.tier,
      reason: v.reason,
      basis: v.tier === 'exclude' ? (v.basis ?? 'other') : 'not-excluded',
    })),
    ...extra,
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

// Four sales near $389/sqft and one in the subject's plat at $278/sqft: a real
// price outlier (29% under the others' median), so grounding keeps the cut.
const cluster = [
  comp({ listingKey: 'A', address: '3886 Coyote', closePrice: 700000 }),
  comp({ listingKey: 'B', address: '3899 Coyote', closePrice: 705000 }),
  comp({ listingKey: 'C', address: '3789 Coyote', closePrice: 698000 }),
  comp({ listingKey: 'D', address: '3876 Coyote', closePrice: 702000 }),
]
const platPeer = (ownPlat: boolean) =>
  comp({ listingKey: 'PLAT', address: '3940 Coyote', closePrice: 500000, ownPlat, selectionTier: ownPlat ? 'subdivision-6mo' : 'nearby-1mi-6mo' })

const priceCut: JudgeModelCall = async ({ messages }) => {
  void messages
  return {
    payload: payload([
      { listingKey: 'A', tier: 'strong', reason: 'Same plat, same size.' },
      { listingKey: 'B', tier: 'strong', reason: 'Same plat, same size.' },
      { listingKey: 'C', tier: 'strong', reason: 'Same plat, same size.' },
      { listingKey: 'D', tier: 'strong', reason: 'Same plat, same size.' },
      { listingKey: 'PLAT', tier: 'exclude', basis: 'price-tier', reason: 'Sold at $278/sqft, below the $350 floor.' },
    ]),
    raw: '{}',
    costUsd: 0,
  }
}

describe('the own-plat restoration (Matt 2026-09-10, two exemptions and only two)', () => {
  it('restores an own-plat sale the review cut on price, at half weight, with its reason on record', async () => {
    const result = await judgeComps(subject(), [...cluster, platPeer(true)], market, { callModel: priceCut, minComps: 3 })
    const v = result!.verdicts.find((x) => x.listingKey === 'PLAT')!
    expect(v.tier).toBe('weak')
    expect(v.basis).toBeUndefined()
    expect(v.reason).toContain("subject's own subdivision")
    expect(result!.keptKeys).toContain('PLAT')
    expect(result!.consistency!.resolvedByCode.join(' ')).toContain("subject's own plat cannot be dropped on price tier")
    // Protected from the band cut, which would otherwise re-exclude a kept sale
    // outside the declared $350 floor, and the band re-anchors on it.
    expect(result!.ppsfFloor).toBeLessThanOrEqual(278)
  })

  it('leaves the same price cut in place for a sale outside the subject\'s plat', async () => {
    const result = await judgeComps(subject(), [...cluster, platPeer(false)], market, { callModel: priceCut, minComps: 3 })
    const v = result!.verdicts.find((x) => x.listingKey === 'PLAT')!
    expect(v.tier).toBe('exclude')
    expect(result!.keptKeys).not.toContain('PLAT')
  })

  it('restores an own-plat one-bath gap the review cut for rooms (3028 vs 2834 shape)', async () => {
    const peer = comp({
      listingKey: '2834',
      address: '2834 Indian',
      baths: 2,
      ownPlat: true,
      closePrice: 700000,
    })
    const bathCut: JudgeModelCall = async () => ({
      payload: payload([
        ...cluster.map((c) => ({ listingKey: c.listingKey, tier: 'strong' as const, reason: 'Same plat.' })),
        {
          listingKey: '2834',
          tier: 'exclude',
          basis: 'other',
          reason: '2 bath versus the subject 3 bath.',
        },
      ]),
      raw: '{}',
      costUsd: 0,
    })
    const result = await judgeComps(subject({ baths: 3, streetAddress: '3028 Indian' }), [...cluster, peer], market, {
      callModel: bathCut,
      minComps: 3,
    })
    const v = result!.verdicts.find((x) => x.listingKey === '2834')!
    expect(v.tier).not.toBe('exclude')
    expect(result!.keptKeys).toContain('2834')
    expect(v.reason).toMatch(/No dollar value is applied to the room|one-room rule/i)
  })

  it('does not restore an own-plat sale excluded for something other than price', async () => {
    const productCut: JudgeModelCall = async () => ({
      payload: payload([
        ...cluster.map((c) => ({ listingKey: c.listingKey, tier: 'strong' as const, reason: 'Same plat.' })),
        { listingKey: 'PLAT', tier: 'exclude', basis: 'structure-type', reason: 'Remarks describe a duplex with two units.' },
      ]),
      raw: '{}',
      costUsd: 0,
    })
    const peer = { ...platPeer(true), publicRemarks: 'Duplex with two units, each rented.' }
    const result = await judgeComps(subject(), [...cluster, peer], market, { callModel: productCut, minComps: 3 })
    expect(result!.verdicts.find((x) => x.listingKey === 'PLAT')!.tier).toBe('exclude')
  })
})

describe('a restoration retires the band and the exclusion the judge stated (review of da8dce6, 2026-09-30)', () => {
  it('drops "One lower-priced sale was set aside" and the $350 to $420 rule once the $278 own-plat sale is restored', async () => {
    const call: JudgeModelCall = async (args) => {
      const turn = await priceCut(args)
      return {
        ...turn,
        payload: {
          ...(turn.payload as Record<string, unknown>),
          narrative:
            'Subject condition is unknown beyond the listing remarks. One lower-priced sale was set aside as a different price tier.',
        },
      }
    }
    const comps = [...cluster, platPeer(true)]
    const result = await judgeComps(subject(), comps, market, { callModel: call, minComps: 3 })
    expect(result!.keptKeys).toContain('PLAT')
    // Nothing was set aside, and the kept set runs $278 to $392 per square foot.
    expect(result!.narrative).not.toMatch(/set aside/)
    expect(result!.narrative).not.toMatch(/\$350 to \$420/)
    expect(result!.narrative).toBe('Subject condition is unknown beyond the listing remarks.')
    expect(result!.exclusionRule).toBe('')
    expect(result!.consistency!.resolvedByCode.join(' ')).toMatch(/declared exclusion rule/)
    // And the final-set pass the build runs finds nothing left to remove.
    const priced = comps.map((c) => ({
      listingKey: c.listingKey,
      address: c.address,
      subdivision: c.subdivision,
      lotAcres: c.lotAcres,
      tier: (c.listingKey === 'PLAT' ? 'weak' : 'strong') as 'strong' | 'weak',
      closePrice: c.closePrice,
      sqft: c.sqft,
    }))
    expect(alignNarrativeToFinalSet({ narrative: result!.narrative, priced, candidates: priced, subject: { streetAddress: '4541 36th', lotAcres: 0.08 } }).removed).toEqual([])
  })

  it('does not append a declared band the kept set refutes, even with no restoration', async () => {
    // Four sales near $389/sqft; the model declares $350 to $420 and writes no band sentence itself.
    const call: JudgeModelCall = async () => ({
      payload: payload(cluster.map((c) => ({ listingKey: c.listingKey, tier: 'strong' as const, reason: 'Same plat.' })), {
        narrative: 'Four sales set the range.',
      }),
      raw: '{}',
      costUsd: 0,
    })
    const result = await judgeComps(subject(), cluster, market, { callModel: call, minComps: 3 })
    expect(result!.narrative).not.toMatch(/\$350 to \$420/)
  })
})

describe('a cache hit replays the stored votes through the current resolver', () => {
  it('applies a rule the stored decision predates, without calling the model', async () => {
    // First build: the sale is not marked own-plat, so the price cut stands.
    const first = await judgeComps(subject(), [...cluster, platPeer(false)], market, { callModel: priceCut, minComps: 3 })
    expect(first!.verdicts.find((x) => x.listingKey === 'PLAT')!.tier).toBe('exclude')
    // Same brief (own-plat is not part of the model input), stored decision in hand.
    const second = await judgeComps(subject(), [...cluster, platPeer(true)], market, {
      callModel: async () => {
        throw new Error('a cache hit must not call the model')
      },
      minComps: 3,
      priorCache: first!.decision,
    })
    expect(second!.cacheHit).toBe(true)
    expect(second!.inputChecksum).toBe(first!.inputChecksum)
    expect(second!.verdicts.find((x) => x.listingKey === 'PLAT')!.tier).toBe('weak')
    expect(second!.consistency!.resolvedByCode[0]).toContain('Reused the stored')
    expect(second!.decision!.votes).toEqual(first!.decision!.votes)
  })
})

describe('the judge strips narrative sentences the kept set refutes', () => {
  it('takes out "Prairie Crossing was dropped" when grounding kept the Prairie Crossing sale (cma-4541-36th)', async () => {
    // Every sale is on Coyote, so the old street-token check cannot see which
    // one the sentence means. The subdivision name says it.
    const comps = [
      comp({ listingKey: 'A', address: '3886 Coyote', closePrice: 475000, sqft: 2010 }),
      comp({ listingKey: 'B', address: '3899 Coyote', closePrice: 492700, sqft: 1921 }),
      comp({ listingKey: 'C', address: '3789 Coyote', closePrice: 500000, sqft: 2088 }),
      comp({ listingKey: 'PC', address: '4100 Coyote', subdivision: 'Prairie Crossing', closePrice: 520000, sqft: 1739, selectionTier: 'pocket-6mo' }),
    ]
    const call: JudgeModelCall = async () => ({
      payload: payload(
        [
          { listingKey: 'A', tier: 'strong', reason: 'Triple Ridge 3bd/3ba.' },
          { listingKey: 'B', tier: 'strong', reason: 'Triple Ridge 3bd/3ba.' },
          { listingKey: 'C', tier: 'strong', reason: 'Triple Ridge 3bd/3ba.' },
          // An amenity exclusion grounding cannot verify, so it is kept at half weight.
          { listingKey: 'PC', tier: 'exclude', basis: 'location', reason: 'Prairie Crossing community amenities named in its remarks.' },
        ],
        {
          ppsfFloor: 236,
          ppsfCeiling: 256,
          narrative:
            'Three Triple Ridge sales were kept between $236 and $256 per square foot. Prairie Crossing was dropped for community amenities named in its remarks. Subject condition is unknown beyond the listing remarks.',
        },
      ),
      raw: '{}',
      costUsd: 0,
    })
    const result = await judgeComps(subject(), comps, market, { callModel: call, minComps: 3 })
    expect(result!.verdicts.find((v) => v.listingKey === 'PC')!.tier).toBe('weak')
    expect(result!.narrative).not.toMatch(/Prairie Crossing was dropped/)
    expect(result!.narrative).toContain('Three Triple Ridge sales were kept')
    expect(result!.consistency!.resolvedByCode.join(' ')).toMatch(/narrative sentence\(s\) the kept set refutes \(dropped-but-priced\)/)
  })
})
