import { describe, expect, it } from 'vitest'
import {
  alignNarrativeToPricedSet,
  checkJudgmentConsistency,
  honestComparabilityLine,
  restoreCustomYearQualityPeers,
  type CompVerdict,
  statedRetainedCount,
  repairRetainedCount,
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
    const line = honestComparabilityLine({ keptCount: 4, excludedCount: 2 })
    expect(line.startsWith('Four closed sales were retained.')).toBe(true)
    expect(line).toContain('2 candidate sales were excluded')
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

  it('rewrites the count to the set that actually priced', () => {
    // The live failure: prose says three, the priced set holds four.
    expect(
      repairRetainedCount('Three closed sales were retained, priced from $254 to $314 per square foot.', 4),
    ).toBe('Four closed sales were retained, priced from $254 to $314 per square foot.')
  })

  it('keeps digits as digits and words as words', () => {
    expect(repairRetainedCount('7 sales were retained.', 10)).toBe('10 sales were retained.')
    expect(repairRetainedCount('Nine comparable sales were retained.', 10)).toBe('Ten comparable sales were retained.')
  })

  it('leaves a correct or absent count alone', () => {
    const ok = 'Four closed sales were retained.'
    expect(repairRetainedCount(ok, 4)).toBe(ok)
    const none = 'The retained sales cluster tightly.'
    expect(repairRetainedCount(none, 4)).toBe(none)
  })

  it('does not touch the rest of the sentence', () => {
    const out = repairRetainedCount(
      'Two comparable sales were retained, priced from $420 to $478 per square foot. The Karena sale was excluded.',
      3,
    )
    expect(out).toContain('priced from $420 to $478 per square foot')
    expect(out).toContain('The Karena sale was excluded.')
    expect(out).toContain('Three comparable sales were retained')
  })
})
