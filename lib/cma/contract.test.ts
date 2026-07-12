import { describe, expect, it } from 'vitest'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import type { CmaAudit } from '@/lib/cma/audit'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

function cleanAudit(overrides: Partial<CmaAudit> = {}): CmaAudit {
  return {
    verdict: 'pass',
    llmVerdict: 'pass',
    findings: [],
    summary: 'Analysis survives adversarial review.',
    costUsd: 0.03,
    model: 'claude-sonnet-4-5',
    usedLlm: true,
    ...overrides,
  }
}

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
    model: 'claude-sonnet-4-5',
    usedLlm: true,
  }
}

describe('evaluateAccuracyContract', () => {
  it('passes clean on a tight, judged, converged set', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(false)
    expect(contract.checks.every((c) => c.pass)).toBe(true)
  })

  it('forces review when the LLM judgment did not run', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: null,
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(true) // build proceeds
    expect(contract.forceReview).toBe(true) // but cannot present as vetted
    expect(contract.checks.find((c) => c.id === 'llm-judgment-ran')!.pass).toBe(false)
  })

  it('hard-fails on a comp older than the 24-month window', () => {
    const stale = comp({ closeDate: new Date(Date.now() - 800 * 86_400_000).toISOString().slice(0, 10) })
    const comps = [...tightSet().slice(0, 5), stale]
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'comp-data-sanity')!.pass).toBe(false)
  })

  it('hard-fails below the comp floor', () => {
    const comps = tightSet().slice(0, 3)
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'comp-floor')!.pass).toBe(false)
  })

  it('forces review on wide dispersion via the pricing flag', () => {
    const wide = [
      comp({ closePrice: 460000, sqft: 2000 }),
      comp({ closePrice: 530000, sqft: 2000 }),
      comp({ closePrice: 610000, sqft: 2000 }),
      comp({ closePrice: 710000, sqft: 2000 }),
      comp({ closePrice: 775000, sqft: 2000 }),
      comp({ closePrice: 825000, sqft: 2000 }),
    ]
    const adjusted = adjustComps(subject(), wide, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(wide),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(true)
    expect(contract.checks.find((c) => c.id === 'dispersion-within-limit')!.pass).toBe(false)
  })

  it('forces review when the adversarial audit did not run', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: null,
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(true)
    expect(contract.checks.find((c) => c.id === 'adversarial-audit-ran')!.pass).toBe(false)
  })

  it('forces review when the adversarial audit records findings', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit({
        verdict: 'review',
        findings: [{ severity: 'major', category: 'comp-selection', claim: 'Comp 3 is a townhome', evidence: 'remarks say attached product' }],
        summary: 'One comparability defect needs broker resolution.',
      }),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    expect(contract.pass).toBe(true)
    expect(contract.forceReview).toBe(true)
    const check = contract.checks.find((c) => c.id === 'adversarial-audit-clean')!
    expect(check.pass).toBe(false)
    expect(check.detail).toContain('Comp 3 is a townhome')
  })
})
