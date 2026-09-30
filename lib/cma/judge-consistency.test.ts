import { describe, expect, it } from 'vitest'
import {
  alignNarrativeToFinalSet,
  alignNarrativeToPricedSet,
  checkJudgmentConsistency,
  honestComparabilityLine,
  restoreCustomYearQualityPeers,
  type CompVerdict,
  statedRetainedCount,
} from '@/lib/cma/judge-consistency'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import type { CmaComp } from '@/lib/cma/types'

/** Minimal comp whose $/sqft is exactly what the test wants to assert on. */
function comp(listingKey: string, address: string, ppsf: number, sqft = 2000): CmaComp {
  return {
    listingKey,
    mlsNumber: listingKey,
    address,
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.2,
    yearBuilt: 2005,
    propertySubType: 'Single Family Residence',
    closePrice: ppsf * sqft,
    listPrice: ppsf * sqft,
    closeDate: '2026-03-01',
    daysToOffer: 20,
    domTotal: 25,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
  } as unknown as CmaComp
}

function verdict(listingKey: string, tier: CompVerdict['tier'], reason = 'r', basis?: CompVerdict['basis']): CompVerdict {
  return { listingKey, tier, reason, basis }
}

describe('checkJudgmentConsistency', () => {
  it('passes a coherent judgment with no violations', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500), comp('C', '300 Cedar Ave', 540)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong'), verdict('C', 'weak')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: 'Three closed sales priced from $450 to $540 per square foot.',
    })
    expect(res.violations).toEqual([])
    expect(res.offendingKeptKeys).toEqual([])
  })

  it('flags a kept comp outside the declared band and names it as offending', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500), comp('C', '300 Cedar Ave', 700)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong'), verdict('C', 'weak')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: '',
    })
    expect(res.violations.some((v) => v.includes('C') && v.includes('$700/sqft'))).toBe(true)
    expect(res.offendingKeptKeys).toContain('C')
  })

  it('flags a price-tier exclusion that sits inside the declared band', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500), comp('C', '300 Cedar Ave', 520)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [
        verdict('A', 'strong'),
        verdict('B', 'strong'),
        verdict('C', 'exclude', 'premium price tier', 'price-tier'),
      ],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: '',
    })
    expect(res.violations.some((v) => v.includes('EXCLUDED on price tier'))).toBe(true)
  })

  it('reads a price-tier exclusion out of the reason text when basis is other', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500), comp('C', '300 Cedar Ave', 520)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [
        verdict('A', 'strong'),
        verdict('B', 'strong'),
        verdict('C', 'exclude', 'Sold at a much higher price per square foot than the subject tier', 'other'),
      ],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: '',
    })
    expect(res.violations.some((v) => v.includes('EXCLUDED on price tier'))).toBe(true)
  })

  it('catches the 922 Ogden defect: a kept comp stranded with the excluded group', () => {
    // Retained cluster $446-544, one kept at $631, excluded on price tier from $676.
    const comps = [
      comp('K1', '100 Ash Ave', 446),
      comp('K2', '200 Birch Ave', 489),
      comp('K3', '300 Cedar Ave', 544),
      comp('K4', '1223 Fresno Ave', 631),
      comp('X1', '400 Date Ave', 676),
      comp('X2', '500 Elm Ave', 801),
    ]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [
        verdict('K1', 'strong'),
        verdict('K2', 'strong'),
        verdict('K3', 'strong'),
        verdict('K4', 'weak'),
        verdict('X1', 'exclude', 'premium renovated tier', 'price-tier'),
        verdict('X2', 'exclude', 'premium renovated tier', 'price-tier'),
      ],
      // A band wide enough to legalize keeping $631 still cannot legalize the strand.
      ppsfFloor: 440,
      ppsfCeiling: 640,
      narrative: '',
    })
    expect(res.offendingKeptKeys).toContain('K4')
    expect(res.violations.some((v) => v.includes('K4') && v.includes('631'))).toBe(true)
  })

  it('does not call a continuous kept distribution stranded', () => {
    const comps = [
      comp('K1', '100 Ash Ave', 446),
      comp('K2', '200 Birch Ave', 489),
      comp('K3', '300 Cedar Ave', 524),
      comp('K4', '1223 Fresno Ave', 560),
      comp('X1', '400 Date Ave', 676),
    ]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [
        verdict('K1', 'strong'),
        verdict('K2', 'strong'),
        verdict('K3', 'strong'),
        verdict('K4', 'weak'),
        verdict('X1', 'exclude', 'premium renovated tier', 'price-tier'),
      ],
      ppsfFloor: 440,
      ppsfCeiling: 570,
      narrative: '',
    })
    expect(res.offendingKeptKeys).toEqual([])
    expect(res.violations).toEqual([])
  })

  it('catches a stranded kept comp on the low side', () => {
    const comps = [
      comp('K1', '100 Ash Ave', 300),
      comp('K2', '200 Birch Ave', 480),
      comp('K3', '300 Cedar Ave', 500),
      comp('K4', '400 Date Ave', 520),
      comp('X1', '500 Elm Ave', 280),
    ]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [
        verdict('K1', 'weak'),
        verdict('K2', 'strong'),
        verdict('K3', 'strong'),
        verdict('K4', 'strong'),
        verdict('X1', 'exclude', 'lower price tier', 'price-tier'),
      ],
      ppsfFloor: 290,
      ppsfCeiling: 530,
      narrative: '',
    })
    expect(res.offendingKeptKeys).toContain('K1')
  })

  it('flags a narrative that calls a kept comp excluded', () => {
    const comps = [comp('A', '100 Ashwood Ave', 450), comp('B', '200 Birchmont Ave', 500), comp('C', '300 Cedarwood Ave', 520)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong'), verdict('C', 'weak')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: 'Cedarwood was excluded as a different market segment. The remaining sales price the subject.',
    })
    expect(res.violations.some((v) => v.includes('cedarwood'))).toBe(true)
  })

  it('flags a narrative that presents an excluded comp as retained', () => {
    const comps = [comp('A', '100 Ashwood Ave', 450), comp('B', '200 Birchmont Ave', 500), comp('C', '300 Cedarwood Ave', 900)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong'), verdict('C', 'exclude', 'condition', 'condition')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: 'Ashwood, Birchmont, and Cedarwood were kept as the closest sales.',
    })
    expect(res.violations.some((v) => v.includes('cedarwood'))).toBe(true)
  })

  it('does not attribute a narrative mention to a street name shared by two comps', () => {
    const comps = [comp('A', '100 Ashwood Ave', 450), comp('B', '200 Ashwood Ave', 900)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'exclude', 'condition', 'condition')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: 'Ashwood was kept as the closest sale.',
    })
    expect(res.violations.filter((v) => v.includes('ashwood'))).toEqual([])
  })

  it('flags a candidate that received no verdict at all', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500), comp('C', '300 Cedar Ave', 520)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong')],
      ppsfFloor: 430,
      ppsfCeiling: 560,
      narrative: '',
    })
    expect(res.violations.some((v) => v.includes('no verdict'))).toBe(true)
  })

  it('flags a missing or inverted band', () => {
    const comps = [comp('A', '100 Ash Ave', 450), comp('B', '200 Birch Ave', 500)]
    const res = checkJudgmentConsistency({
      comps,
      verdicts: [verdict('A', 'strong'), verdict('B', 'strong')],
      ppsfFloor: 0,
      ppsfCeiling: 0,
      narrative: '',
    })
    expect(res.violations.some((v) => v.includes('No usable'))).toBe(true)
  })
})

describe('alignNarrativeToPricedSet', () => {
  it('drops a sentence that calls a priced sale excluded', () => {
    const priced = [
      { listingKey: 'K', address: '1740 Karena' },
      { listingKey: 'S', address: '947 6th' },
    ]
    const out = alignNarrativeToPricedSet(
      priced,
      'Two comparable sales were retained, priced from $420 to $478 per square foot. The Karena sale was excluded because its lot places it in a higher segment.',
    )
    expect(out).toContain('Two comparable sales were retained')
    expect(out).not.toMatch(/Karena sale was excluded/i)
  })
})

describe('honestComparabilityLine', () => {
  it('states the priced count without naming a street or a price the set does not have', () => {
    const line = honestComparabilityLine({ keptCount: 4, reviewExcluded: 2, differentProduct: 0, auditRemoved: 0 })
    expect(line).toBe('Four closed sales were retained. Two candidate sales were excluded by the comparability review.')
    const findings = checkNarrativeIntegrity({
      narrative: line,
      comps: [
        { listingKey: 'A', address: '1 Oak', closePrice: 500000, city: 'Bend' },
        { listingKey: 'B', address: '2 Pine', closePrice: 510000, city: 'Bend' },
        { listingKey: 'C', address: '3 Elm', closePrice: 520000, city: 'Bend' },
        { listingKey: 'D', address: '4 Ash', closePrice: 530000, city: 'Bend' },
      ] as never,
      excluded: [],
      subject: { streetAddress: '9 Main', city: 'Bend', subdivision: null },
      market: null,
    })
    expect(findings).toEqual([])
  })
})

describe('honestComparabilityLine splits the candidates left out by reason (review of da8dce6, 2026-09-30)', () => {
  // The reviewer's case: the line said "{M} candidate sales were excluded as a
  // different market segment" while M also counted the sales the audit repair
  // removed and the different-product sales the wall kept out.
  const priced = ['A', 'B', 'C', 'D'].map((k, i) => ({
    listingKey: k,
    address: `${i + 1} ${['Oak', 'Pine', 'Elm', 'Ash'][i]}`,
    closePrice: 500000 + i * 10000,
    sqft: 2000,
    city: 'Bend',
    subdivision: null,
    lotAcres: 0.2,
  }))
  const out = ['R1', 'R2', 'P1', 'X1'].map((k, i) => ({
    listingKey: k,
    address: `${i + 10} ${['Fir', 'Cedar', 'Birch', 'Alder'][i]}`,
    closePrice: 600000,
    sqft: 2000,
    city: 'Bend',
    subdivision: null,
    lotAcres: 0.2,
  }))

  it('gives each reason its own sentence and never calls a product or audit removal a market segment', () => {
    const line = honestComparabilityLine({ keptCount: 4, reviewExcluded: 2, differentProduct: 1, auditRemoved: 1 })
    expect(line).toBe(
      "Four closed sales were retained. Two candidate sales were excluded by the comparability review. One candidate sale was left out as a different product type. One sale was removed on the independent audit's findings.",
    )
    expect(line).not.toMatch(/market segment/)
    expect(line).not.toMatch(/\u2014|\u2013/)
  })

  it('states only the reasons that happened', () => {
    expect(honestComparabilityLine({ keptCount: 3, reviewExcluded: 0, differentProduct: 0, auditRemoved: 2 })).toBe(
      "Three closed sales were retained. Two sales were removed on the independent audit's findings.",
    )
    expect(honestComparabilityLine({ keptCount: 5, reviewExcluded: 0, differentProduct: 0, auditRemoved: 0 })).toBe(
      'Five closed sales were retained.',
    )
  })

  it('passes every claim check against the set it describes, candidates included', () => {
    const line = honestComparabilityLine({ keptCount: 4, reviewExcluded: 2, differentProduct: 1, auditRemoved: 1 })
    const findings = checkNarrativeIntegrity({
      narrative: line,
      comps: priced as never,
      excluded: [
        { listingKey: 'R1', reason: 'Larger lot.' },
        { listingKey: 'R2', reason: 'Newer build.' },
      ],
      subject: { streetAddress: '9 Main', city: 'Bend', subdivision: null },
      market: null,
      candidates: [...priced, ...out] as never,
      tierByKey: new Map([...priced.map((c) => [c.listingKey, 'strong'] as const), ['R1', 'exclude'], ['R2', 'exclude']]),
    })
    expect(findings).toEqual([])
  })
})

describe('restoreCustomYearQualityPeers', () => {
  it('does not toss a custom peer as too luxury', () => {
    const comps = [
      comp('STOCK', '1990 Summit', 330, 4800),
      { ...comp('PEER', '61225 Brosterhous', 823, 5100), yearBuilt: 2022, publicRemarks: 'Custom built home.' },
    ]
    const out = restoreCustomYearQualityPeers({
      subject: { yearBuilt: 2024, newConstructionYn: true, remarks: 'Custom built modern home.' },
      comps,
      verdicts: [
        verdict('STOCK', 'strong', 'same vintage'),
        verdict('PEER', 'exclude', 'too luxury / too expensive', 'price-tier'),
      ],
    })
    expect(out.restoredKeys).toEqual(['PEER'])
    expect(out.verdicts.find((v) => v.listingKey === 'PEER')?.tier).toBe('weak')
  })

  it('leaves ordinary resale judgments alone', () => {
    const comps = [comp('A', '100 Ash Ave', 450)]
    const out = restoreCustomYearQualityPeers({
      subject: { yearBuilt: 1998, remarks: null },
      comps,
      verdicts: [verdict('A', 'exclude', 'premium tier', 'price-tier')],
    })
    expect(out.restoredKeys).toEqual([])
    expect(out.verdicts[0]?.tier).toBe('exclude')
  })
})

describe('V6 — the stated retained count', () => {
  it('reads the count the narrative claims, word or digit', () => {
    expect(statedRetainedCount('Three closed sales were retained, priced from $254 to $314 per square foot.')).toBe(3)
    expect(statedRetainedCount('Nine comparable sales were retained.')).toBe(9)
    expect(statedRetainedCount('7 sales were retained.')).toBe(7)
    expect(statedRetainedCount('Four recent closed sales were retained.')).toBe(4)
  })

  it('returns null when no count is stated rather than guessing one', () => {
    expect(statedRetainedCount('The retained sales cluster tightly on price.')).toBeNull()
    expect(statedRetainedCount('')).toBeNull()
  })

})

describe('alignNarrativeToFinalSet', () => {
  const priced = [
    { listingKey: 'A', address: '3886 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.1, tier: 'strong' as const },
    { listingKey: 'B', address: '3899 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.11, tier: 'strong' as const },
    { listingKey: 'PC', address: '4100 Coyote', subdivision: 'Prairie Crossing', lotAcres: 0.07, tier: 'weak' as const },
  ]
  const subject = { streetAddress: '4541 36th', lotAcres: 0.08 }

  it('takes out every sentence the final priced set refutes and keeps the rest (cma-4541-36th)', () => {
    const out = alignNarrativeToFinalSet({
      narrative:
        'Two Triple Ridge sales were kept between $236 and $256 per square foot. Prairie Crossing was dropped for community amenities named in its remarks. Subject condition is unknown beyond the listing remarks.',
      priced,
      candidates: priced,
      subject,
    })
    expect(out.narrative).toBe(
      'Two Triple Ridge sales were kept between $236 and $256 per square foot. Subject condition is unknown beyond the listing remarks.',
    )
    expect(out.removed.map((f) => f.kind)).toEqual(['dropped-but-priced'])
  })

  it('strips a stale "were retained" count instead of rewriting it (review of da8dce6)', () => {
    const out = alignNarrativeToFinalSet({ narrative: 'Two closed sales were retained.', priced, candidates: priced, subject })
    expect(out.narrative).toBe('')
    expect(out.removed.map((f) => f.kind)).toEqual(['count'])
  })

  it('never manufactures a count: two true weight sentences stay as written (review of da8dce6)', () => {
    // The rewrite this replaced read the first "were retained" count as the
    // whole set and turned "Three ... at full weight" into "Five ... at full
    // weight", a false sentence that raised no finding and shipped.
    const mixed = [
      { listingKey: 'A', address: '3886 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.1, tier: 'strong' as const },
      { listingKey: 'B', address: '3899 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.11, tier: 'strong' as const },
      { listingKey: 'C', address: '3789 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.07, tier: 'strong' as const },
      { listingKey: 'D', address: '4100 Coyote', subdivision: 'Prairie Crossing', lotAcres: 0.07, tier: 'weak' as const },
      { listingKey: 'E', address: '3876 Coyote', subdivision: 'Triple Ridge', lotAcres: 0.07, tier: 'weak' as const },
    ]
    const narrative =
      'Three closed sales were retained at full weight. Two recent sales were retained at half weight to bracket the range.'
    const out = alignNarrativeToFinalSet({ narrative, priced: mixed, candidates: mixed, subject })
    expect(out.narrative).toBe(narrative)
    expect(out.removed).toEqual([])
  })

  it('returns nothing when every sentence is refuted, for the caller to replace', () => {
    const out = alignNarrativeToFinalSet({ narrative: 'One closed sale was kept.', priced, candidates: priced, subject })
    expect(out.narrative).toBe('')
    expect(out.removed.map((f) => f.kind)).toEqual(['count'])
  })
})
