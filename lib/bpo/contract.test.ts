import { describe, expect, it } from 'vitest'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { evaluateBpoAccuracyContract } from '@/lib/bpo/contract'
import type { CmaAudit } from '@/lib/cma/audit'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import type { BpoListingHistory, BpoOpinion } from '@/lib/bpo/types'

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '220000001',
    streetAddress: '123 Test Ln',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.25,
    yearBuilt: 2005,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 700000,
    lastListDate: null,
    listingHistoryLine: null,
    ...overrides,
  }
}

let keySeq = 0
function comp(overrides: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: `K${keySeq++}`,
    mlsNumber: null,
    address: '1 Comp St',
    city: 'Bend',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.25,
    yearBuilt: 2004,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 710000,
    closePrice: 700000,
    closeDate: new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10),
    daysToOffer: 10,
    domTotal: 40,
    selectionTier: 'city-12mo',
    ...overrides,
  }
}

function tightSet(): CmaComp[] {
  return [
    comp({ closePrice: 690000, sqft: 1950 }),
    comp({ closePrice: 700000, sqft: 2000 }),
    comp({ closePrice: 710000, sqft: 2050 }),
    comp({ closePrice: 720000, sqft: 2100 }),
    comp({ closePrice: 695000, sqft: 1980 }),
    comp({ closePrice: 705000, sqft: 2020 }),
  ]
}

function judgmentFor(comps: CmaComp[]): CompJudgment {
  return {
    verdicts: comps.map((c) => ({ listingKey: c.listingKey, tier: 'strong', reason: 'same tier' })),
    keptKeys: comps.map((c) => c.listingKey),
    confidence: 'High',
    narrative: 'Tight cluster, all comparable.',
    costUsd: 0.02,
    model: 'claude-sonnet-5',
    usedLlm: true,
  }
}

function cleanAudit(): CmaAudit {
  return {
    verdict: 'pass',
    llmVerdict: 'pass',
    findings: [],
    summary: 'Survives adversarial review.',
    costUsd: 0.03,
    model: 'claude-sonnet-5',
    usedLlm: true,
  }
}

function opinion(overrides: Partial<BpoOpinion> = {}): BpoOpinion {
  return {
    opinionValue: 700000,
    valueLow: 680000,
    valueHigh: 720000,
    confidence: 'High',
    ...overrides,
  } as BpoOpinion
}

function history(overrides: Partial<BpoListingHistory> = {}): BpoListingHistory {
  return {
    currentIsActive: false,
    currentListPrice: null,
    ...overrides,
  } as BpoListingHistory
}

function run(args: {
  opinion?: Partial<BpoOpinion>
  history?: Partial<BpoListingHistory>
  audit?: CmaAudit | null
  judgment?: CompJudgment | null
}) {
  const comps = tightSet()
  const adjusted = adjustComps(subject(), comps, null)
  const pricing = computePricing(subject(), adjusted, null)!
  return evaluateBpoAccuracyContract({
    comps: adjusted,
    pricing,
    judgment: args.judgment === undefined ? judgmentFor(comps) : args.judgment,
    audit: args.audit === undefined ? cleanAudit() : args.audit,
    opinion: opinion({ confidence: pricing.confidence, ...args.opinion }),
    history: history(args.history),
    minComps: 6,
    marketContextPresent: true,
  })
}

describe('evaluateBpoAccuracyContract', () => {
  it('passes clean on a tight, judged, audited set with a consistent opinion', () => {
    const contract = run({})
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(false)
  })

  it('hard-fails when the opinion sits outside its own range', () => {
    const contract = run({ opinion: { opinionValue: 800000 } })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'opinion-range-consistency')!.pass).toBe(false)
  })

  it('hard-fails when an active listing should cap the opinion but did not', () => {
    const contract = run({
      opinion: { opinionValue: 700000 },
      history: { currentIsActive: true, currentListPrice: 650000 },
    })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'active-ceiling-consistency')!.pass).toBe(false)
  })

  it('forces review when the opinion confidence was downgraded from the comp-pricing confidence', () => {
    const contract = run({ opinion: { confidence: 'Supportable' } })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(true)
    expect(contract.checks.find((c) => c.id === 'opinion-confidence-downgrade')!.pass).toBe(false)
  })

  it('forces review when the adversarial audit did not run (inherited from the base contract)', () => {
    const contract = run({ audit: null })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(true)
    expect(contract.checks.find((c) => c.id === 'adversarial-audit-ran')!.pass).toBe(false)
  })
})
