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
    propertySubType: 'Single Family Residence',
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
    propertySubType: 'Single Family Residence',
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
      subjectSubType: 'Single Family Residence',
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

  it('a range wider than 8% of the recommended list on a side forces review (Matt 2026-09-09)', () => {
    const tight = [
      comp({ closePrice: 600000, sqft: 2000 }),
      comp({ closePrice: 605000, sqft: 2000 }),
      comp({ closePrice: 610000, sqft: 2000 }),
      comp({ closePrice: 615000, sqft: 2000 }),
      comp({ closePrice: 620000, sqft: 2000 }),
      comp({ closePrice: 625000, sqft: 2000 }),
    ]
    const adjusted = adjustComps(subject(), tight, null)
    const pricing = computePricing(subject(), adjusted, null)!
    // Blake's 1617 NW 8th: $699,000 to $932,000 around $816,000.
    pricing.valueLow = Math.round(pricing.recommended * 0.857)
    pricing.valueHigh = Math.round(pricing.recommended * 1.142)
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(tight),
      minComps: 6,
      marketContextPresent: true,
    })
    const check = contract.checks.find((c) => c.id === 'range-width')!
    expect(check.severity).toBe('review')
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/wider than 8%/)
    expect(contract.forceReview).toBe(true)
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

  it('hard-fails when a townhouse is used to price a single-family house', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, propertySubType: 'Townhouse' }),
    ]
    const adjusted = adjustComps(subject({ propertySubType: 'Single Family Residence' }), comps, null)
    const pricing = computePricing(subject({ propertySubType: 'Single Family Residence' }), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
    })
    expect(contract.pass).toBe(false)
    const check = contract.checks.find((c) => c.id === 'product-type-match')!
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/Townhouse/)
  })

  it('passes product-type-match when every priced sale is the same type', () => {
    const comps = tightSet().map((c) => ({ ...c, propertySubType: 'Single Family Residence' }))
    const adjusted = adjustComps(subject({ propertySubType: 'Single Family Residence' }), comps, null)
    const pricing = computePricing(subject({ propertySubType: 'Single Family Residence' }), adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
    })
    expect(contract.checks.find((c) => c.id === 'product-type-match')!.pass).toBe(true)
  })

  it('hard-fails when a two-bath sale is used to price a one-bath house', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 1, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, baths: 2, propertySubType: 'Single Family Residence' }),
    ]
    const subj = subject({ baths: 1, propertySubType: 'Single Family Residence' })
    const adjusted = adjustComps(subj, comps, null)
    const pricing = computePricing(subj, adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 1,
    })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'bath-count-match')!.pass).toBe(false)
  })

  /**
   * The contract must grade the bath cut with the SAME rule the selector
   * applied. lib/pricing/match.ts (and the lib/cma/comps.ts fallback) open a
   * plus-or-minus-one whole-bath window for a custom/new subject, on Matt's
   * rule; the contract re-checked every build against the exact-floor resale
   * rule and hard-failed 59 of the 136 live build failures on comps its own
   * selector was told to keep. Same rule on both ends, or the engine refuses
   * work it already decided was sound.
   */
  it('accepts a plus-one-bath comp on a custom or new subject (the rule the selector used)', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 2, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, baths: 3, propertySubType: 'Single Family Residence' }),
    ]
    const subj = subject({ baths: 2, propertySubType: 'Single Family Residence' })
    const adjusted = adjustComps(subj, comps, null)
    const pricing = computePricing(subj, adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 2,
      subjectIsCustomOrNew: true,
    })
    const check = contract.checks.find((c) => c.id === 'bath-count-match')!
    expect(check.pass).toBe(true)
    expect(check.detail).toContain('within one whole bathroom')
  })

  it('still hard-fails a two-bath gap on a custom or new subject', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 2, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, baths: 4, propertySubType: 'Single Family Residence' }),
    ]
    const subj = subject({ baths: 2, propertySubType: 'Single Family Residence' })
    const adjusted = adjustComps(subj, comps, null)
    const pricing = computePricing(subj, adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 2,
      subjectIsCustomOrNew: true,
    })
    expect(contract.checks.find((c) => c.id === 'bath-count-match')!.pass).toBe(false)
  })

  it('keeps the exact whole-bath rule for an ordinary resale subject', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 2, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, baths: 3, propertySubType: 'Single Family Residence' }),
    ]
    const subj = subject({ baths: 2, propertySubType: 'Single Family Residence' })
    const adjusted = adjustComps(subj, comps, null)
    const pricing = computePricing(subj, adjusted, null)!
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 2,
      subjectIsCustomOrNew: false,
    })
    expect(contract.checks.find((c) => c.id === 'bath-count-match')!.pass).toBe(false)
  })

  it('hard-fails when the recommended list sits above a failed last ask', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    pricing.recommended = 800_000
    pricing.highEnd = 850_000
    pricing.conservative = 760_000
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      failedAsk: 749_900,
    })
    expect(contract.pass).toBe(false)
    expect(contract.checks.find((c) => c.id === 'expired-list-cap')!.pass).toBe(false)
  })
})

describe('the disclosed widening forces review (Matt 2026-09-09)', () => {
  it('passes when every sale came from the bounded ladder and flags when it did not', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    const base = {
      subjectSubType: 'Single Family Residence',
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    }
    const clean = evaluateAccuracyContract({ ...base, tiersUsed: ['subdivision-6mo', 'neighborhood-12mo'] })
    const widenedCheck = (c: ReturnType<typeof evaluateAccuracyContract>) =>
      c.checks.find((x) => x.id === 'disclosed-widening')
    expect(widenedCheck(clean)?.pass).toBe(true)
    expect(clean.forceReview).toBe(false)

    for (const tier of ['widened-disclosed-24mo', 'rural-widened-disclosed-24mo']) {
      const widened = evaluateAccuracyContract({ ...base, tiersUsed: ['subdivision-6mo', tier] })
      const check = widenedCheck(widened)
      expect(check?.pass).toBe(false)
      expect(check?.severity).toBe('review')
      expect(check?.detail).toMatch(/widened one more step/)
      expect(widened.forceReview).toBe(true)
      // A review-severity check never fails the build; it raises the banner.
      expect(widened.checks.filter((c) => c.severity === 'hard' && !c.pass)).toHaveLength(0)
    }
  })
})

describe('recommendation-in-range — the number sits inside the sales that support it', () => {
  function checkFor(over: { valueLow: number; valueHigh: number; recommended: number; clamp?: unknown }) {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const base = computePricing(subject(), adjusted, null)!
    const pricing = { ...base, ...over } as typeof base
    const contract = evaluateAccuracyContract({
      subjectSubType: 'Single Family Residence',
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    return contract.checks.find((c) => c.id === 'recommendation-in-range')!
  }

  it('passes when the recommendation sits inside the range', () => {
    const c = checkFor({ valueLow: 600_000, valueHigh: 700_000, recommended: 650_000 })
    expect(c.pass).toBe(true)
    expect(c.severity).toBe('review')
  })

  it('fails and says so when the recommendation is above the top of the range', () => {
    const c = checkFor({ valueLow: 716_000, valueHigh: 784_000, recommended: 791_000 })
    expect(c.pass).toBe(false)
    expect(c.detail).toContain('ABOVE')
  })

  it('fails and blames the cap when a clamp pulled it below', () => {
    const c = checkFor({
      valueLow: 577_000,
      valueHigh: 832_000,
      recommended: 535_000,
      clamp: { tier: 'recommended', from: 600_000, to: 535_000, reason: 'failed ask' },
    })
    expect(c.pass).toBe(false)
    expect(c.detail).toContain('already failed to sell')
  })

  it('fails with nothing to blame when no clamp explains the gap', () => {
    const c = checkFor({ valueLow: 577_000, valueHigh: 832_000, recommended: 535_000, clamp: null })
    expect(c.pass).toBe(false)
    expect(c.detail).toContain('no cap explaining the gap')
  })
})

describe('value-has-a-basis — a number under half the ask with nothing grading it', () => {
  function checkFor(over: {
    recommended: number
    failedAsk?: number | null
    priceAnchorPpsf?: number | null
  }) {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const base = computePricing(subject(), adjusted, null)!
    const pricing = { ...base, recommended: over.recommended, failedAsk: over.failedAsk ?? null } as typeof base
    const contract = evaluateAccuracyContract({
      subjectSubType: 'Single Family Residence',
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      failedAsk: over.failedAsk ?? null,
      priceAnchorPpsf: over.priceAnchorPpsf ?? null,
    })
    return contract.checks.find((c) => c.id === 'value-has-a-basis')!
  }

  it('refuses 19717 Mt Bachelor: $14,000 against a $90,000 ask, no tier resolved', () => {
    const c = checkFor({ recommended: 14_000, failedAsk: 90_000, priceAnchorPpsf: null })
    expect(c.pass).toBe(false)
    expect(c.severity).toBe('hard')
    expect(c.detail).toContain('product mismatch')
  })

  it('allows an ordinary overpriced expired: 30% under the ask', () => {
    expect(checkFor({ recommended: 630_000, failedAsk: 900_000, priceAnchorPpsf: null }).pass).toBe(true)
  })

  it('allows the same wide gap once a price tier graded the comps', () => {
    expect(checkFor({ recommended: 14_000, failedAsk: 90_000, priceAnchorPpsf: 420 }).pass).toBe(true)
  })

  it('says nothing is wrong when there is no ask to compare against', () => {
    expect(checkFor({ recommended: 14_000, failedAsk: null, priceAnchorPpsf: null }).pass).toBe(true)
  })
})
