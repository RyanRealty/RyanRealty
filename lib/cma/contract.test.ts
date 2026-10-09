import { describe, expect, it } from 'vitest'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { roomCountsDecision } from '@/lib/pricing/room-ground'
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
    // Five priced sales against a floor of six: the pricer itself refuses
    // anything under five (Matt 2026-10-07), so the contract is graded on a
    // set it can price.
    const comps = tightSet().slice(0, 5)
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

  it('grades dispersion on the final list, not a recommended dollar left in the review reason', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    pricing.recommended = 544_000
    pricing.conservative = 500_000
    pricing.highEnd = 570_000
    pricing.valueLow = 494_000
    pricing.valueHigh = 570_000
    pricing.needsReview = true
    pricing.reviewReason =
      'Comparable sales span a wide price-per-square-foot range. Recommended $561,000 sits inside the supported range.'
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
    })
    const dispersion = contract.checks.find((c) => c.id === 'dispersion-within-limit')!
    expect(dispersion.pass).toBe(false)
    expect(dispersion.detail).toContain('$544,000')
    expect(dispersion.detail).not.toContain('$561,000')
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

  it('accepts a one-bath gap used to price a one-bath house, and says it counts for less', () => {
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
    expect(contract.pass).toBe(true)
    const check = contract.checks.find((c) => c.id === 'bath-count-match')!
    expect(check.pass).toBe(true)
    expect(check.detail).toMatch(/counts for less/)
    expect(check.detail).toMatch(/No dollar value is applied to the room/)
  })

  it('accepts a plus-one-bath own-plat sale the selector disclosed, custom or not', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 2, propertySubType: 'Single Family Residence' })),
      comp({
        closePrice: 700000,
        sqft: 2000,
        baths: 3,
        propertySubType: 'Single Family Residence',
        ownPlat: true,
        roomDifference: ['baths'],
      }),
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
      subjectBeds: 3,
      subjectIsCustomOrNew: true,
    })
    const check = contract.checks.find((c) => c.id === 'bath-count-match')!
    expect(check.pass).toBe(true)
    expect(check.detail).toMatch(/counts for less/)
    expect(check.detail).toMatch(/No dollar value is applied to the room/)
  })

  it('accepts a plus-one-bath sale off the subject’s ground, and says it counts for less', () => {
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
      subjectBeds: 3,
      subjectIsCustomOrNew: true,
    })
    const offGround = contract.checks.find((c) => c.id === 'bath-count-match')!
    expect(offGround.pass).toBe(true)
    expect(offGround.detail).toMatch(/counts for less/)
  })

  it('still hard-fails a three-bath gap on a custom or new subject', () => {
    const comps = [
      ...tightSet().slice(0, 5).map((c) => ({ ...c, baths: 2, propertySubType: 'Single Family Residence' })),
      comp({ closePrice: 700000, sqft: 2000, baths: 5, propertySubType: 'Single Family Residence' }),
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

  it('accepts a one-bath gap on an ordinary resale and says it counts for less', () => {
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
    const check = contract.checks.find((c) => c.id === 'bath-count-match')!
    expect(check.pass).toBe(true)
    expect(check.detail).toMatch(/counts for less/)
  })

  describe('one room rule carried from the picker (cma-1117-milwaukee, 2026-10-08)', () => {
    // listings rows read 2026-10-08. 1117 Milwaukee: 2 bed, BathroomsTotal 1,
    // baths_full 1, baths_half 0, Boulevard. 852 Columbia: 2 bed,
    // BathroomsTotal 3, baths_full 2, baths_half 1, Boulevard (own plat).
    const milwaukee = () =>
      subject({ beds: 2, baths: 1, bathsFull: 1, bathsHalf: 0, subdivision: 'Boulevard', propertySubType: 'Single Family Residence' })
    const oneBath = (c: CmaComp): CmaComp => ({
      ...c,
      beds: 2,
      baths: 1,
      bathsFull: 1,
      bathsHalf: 0,
      propertySubType: 'Single Family Residence',
    })
    const columbia = (): CmaComp =>
      comp({
        address: '852 Columbia',
        closePrice: 705000,
        sqft: 2020,
        beds: 2,
        baths: 3,
        bathsFull: 2,
        bathsHalf: 1,
        subdivision: 'Boulevard',
        ownPlat: true,
        propertySubType: 'Single Family Residence',
      })
    /** What the listings walk does at admission (lib/cma/comps.ts). */
    const pickerKeeps = (subj: CmaSubject, c: CmaComp): CmaComp => {
      const rooms = roomCountsDecision(subj, c)
      expect(rooms.ok).toBe(true)
      return { ...c, roomDifference: rooms.notes.length > 0 ? rooms.notes : null, roomDecision: rooms }
    }

    it('passes a sale the picker kept on full baths, with the build’s own subject args', () => {
      const subj = milwaukee()
      const comps = [...tightSet().slice(0, 5).map(oneBath), pickerKeeps(subj, columbia())]
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
        subjectBaths: subj.baths,
        subjectBathsFull: subj.bathsFull ?? null,
        subjectBathsHalf: subj.bathsHalf ?? null,
        subjectBeds: subj.beds,
        subjectSubdivisionSlug: subj.subdivisionSlug ?? null,
      })
      const check = contract.checks.find((c) => c.id === 'bath-count-match')!
      expect(check.pass).toBe(true)
      expect(check.detail).toMatch(/counts for less/)
      expect(check.detail).toMatch(/No dollar value is applied to the room/)
      expect(check.detail).not.toContain('?')
      expect(contract.pass).toBe(true)
    })

    it('passes the same sale when the contract is handed the bath total alone and the sale lost its split: the stamp carries the decision', () => {
      const subj = milwaukee()
      const kept = pickerKeeps(subj, columbia())
      const stripped: CmaComp = { ...kept, bathsFull: null, bathsHalf: null }
      const comps = [...tightSet().slice(0, 5).map(oneBath), stripped]
      const adjusted = adjustComps(subj, comps, null)
      const pricing = computePricing(subj, adjusted, null)!
      const args = {
        audit: cleanAudit(),
        comps: adjusted,
        pricing,
        judgment: judgmentFor(comps),
        minComps: 6,
        marketContextPresent: true,
        subjectSubType: 'Single Family Residence',
        // The dry run's shape before 2026-10-08: the total, no split, no beds.
        subjectBaths: 1,
      }
      expect(evaluateAccuracyContract(args).checks.find((c) => c.id === 'bath-count-match')!.pass).toBe(true)
      // Without the stamp the totals are compared. One against five is three
      // or more apart and refuses a sale the picker kept on full baths. That
      // is the regression the stamp closes. One against three is two apart
      // and stays.
      const unstamped = adjusted.map((c) =>
        c.address === '852 Columbia' ? { ...c, baths: 5, roomDecision: null } : { ...c, roomDecision: null },
      )
      const bare = evaluateAccuracyContract({ ...args, comps: unstamped }).checks.find((c) => c.id === 'bath-count-match')!
      expect(bare.pass).toBe(false)
      expect(bare.detail).toContain('852 Columbia is 2 bed / 5 bath')
    })

    it('keeps a sale the picker keeps: one full bath apart off the subject’s ground', () => {
      const subj = milwaukee()
      const offGround: CmaComp = { ...columbia(), subdivision: 'Highland', ownPlat: false }
      const rooms = roomCountsDecision(subj, offGround)
      expect(rooms.ok).toBe(true)
      expect(rooms.notes).toEqual(['baths'])
      const comps = [...tightSet().slice(0, 5).map(oneBath), { ...offGround, roomDecision: rooms }]
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
        subjectBaths: subj.baths,
        subjectBathsFull: subj.bathsFull ?? null,
        subjectBathsHalf: subj.bathsHalf ?? null,
        subjectBeds: subj.beds,
      })
      const check = contract.checks.find((c) => c.id === 'bath-count-match')!
      expect(check.pass).toBe(true)
      expect(check.detail).toMatch(/counts for less/)
      expect(check.detail).toMatch(/No dollar value is applied to the room/)
      expect(contract.pass).toBe(true)
    })

    it('fails three full baths apart even on the own plat, with no stamp to read', () => {
      const subj = milwaukee()
      const comps = [...tightSet().slice(0, 5).map(oneBath), { ...columbia(), bathsFull: 4, bathsHalf: 0, baths: 4 }]
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
        subjectBathsFull: 1,
        subjectBathsHalf: 0,
        subjectBeds: 2,
      })
      expect(contract.checks.find((c) => c.id === 'bath-count-match')!.pass).toBe(false)
    })

    it('never prints "?": an unknown subject bedroom count is stated as not compared', () => {
      const subj = milwaukee()
      subj.beds = null
      const kept = pickerKeeps(subj, columbia())
      const comps = [...tightSet().slice(0, 5).map(oneBath), kept]
      const adjusted = adjustComps(subj, comps, null)
      const pricing = computePricing(subj, adjusted, null)!
      const base = {
        audit: cleanAudit(),
        comps: adjusted,
        pricing,
        judgment: judgmentFor(comps),
        minComps: 6,
        marketContextPresent: true,
        subjectSubType: 'Single Family Residence',
        subjectBaths: 1,
        subjectBathsFull: 1,
        subjectBathsHalf: 0,
        subjectBeds: null,
      }
      const pass = evaluateAccuracyContract(base).checks.find((c) => c.id === 'bath-count-match')!
      expect(pass.pass).toBe(true)
      expect(pass.detail).not.toContain('?')
      expect(pass.detail).toMatch(/bedroom count was not stored, so bedrooms were not compared/)
      // A three-bath gap still refuses, and the unknown bedrooms are named, never printed as "?".
      const refused = evaluateAccuracyContract({
        ...base,
        comps: adjusted.map((c) =>
          c.address === '852 Columbia'
            ? {
                ...c,
                baths: 4,
                bathsFull: 4,
                bathsHalf: 0,
                roomDecision: null,
                roomDifference: null,
                ownPlat: false,
                subdivision: 'Highland',
              }
            : c,
        ),
      }).checks.find((c) => c.id === 'bath-count-match')!
      expect(refused.pass).toBe(false)
      expect(refused.detail).not.toContain('?')
      expect(refused.detail).toBe(
        "Comp 852 Columbia is 2 bed / 4 full bath against this home's 1 full bath, a room gap the one-room rule refuses. This home's bedroom count was not stored, so bedrooms were not compared.",
      )
    })
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

  it('Nugget shape: ask below the band, rec under that ask passes expired-list-cap', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    pricing.valueLow = 734_000
    pricing.valueHigh = 1_285_000
    pricing.conservative = 724_000
    pricing.recommended = 724_000
    pricing.highEnd = 724_000
    pricing.failedAsk = 725_000
    pricing.failedAskBelowRange = true
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      failedAsk: 725_000,
      priceAnchorPpsf: 400,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 2,
    })
    const cap = contract.checks.find((c) => c.id === 'expired-list-cap')
    expect(cap?.pass).toBe(true)
    expect(cap?.detail).toMatch(/failedAskBelowRange/)
    expect(cap?.detail).toMatch(/\$734,000/)
    expect(contract.checks.filter((c) => c.severity === 'hard' && !c.pass)).toHaveLength(0)
    expect(contract.pass).toBe(true)
  })

  it('Nugget shape: ask below the band, rec above valueLow fails expired-list-cap', () => {
    const comps = tightSet()
    const adjusted = adjustComps(subject(), comps, null)
    const pricing = computePricing(subject(), adjusted, null)!
    pricing.valueLow = 734_000
    pricing.valueHigh = 1_285_000
    pricing.conservative = 734_000
    pricing.recommended = 1_036_000
    pricing.highEnd = 1_285_000
    pricing.failedAsk = 725_000
    pricing.failedAskBelowRange = true
    const contract = evaluateAccuracyContract({
      audit: cleanAudit(),
      comps: adjusted,
      pricing,
      judgment: judgmentFor(comps),
      minComps: 6,
      marketContextPresent: true,
      failedAsk: 725_000,
      priceAnchorPpsf: 400,
      subjectSubType: 'Single Family Residence',
      subjectBaths: 2,
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

describe('the house next door anchors the number (Matt 2026-09-10)', () => {
  function twinSubject() {
    return subject({ streetAddress: '23 Benaiah', city: 'Bend', sqft: 2080, lastListPrice: null })
  }
  /** Six sales in other plats, all far above what the street itself fetches. */
  function otherPlats() {
    return Array.from({ length: 6 }, (_, i) =>
      comp({
        address: `${100 + i} Tanglewood`,
        city: 'Bend',
        sqft: 1900,
        closePrice: 640_000 + i * 5_000,
        closeDate: new Date(Date.now() - (60 + i * 20) * 86_400_000).toISOString().slice(0, 10),
      }),
    )
  }
  const twin = () =>
    comp({
      address: '31 Benaiah',
      city: 'Bend',
      sqft: 2080,
      closePrice: 512_000,
      closeDate: new Date(Date.now() - 420 * 86_400_000).toISOString().slice(0, 10),
    })

  it('holds the recommendation to the twin plus a tenth, and says so', () => {
    const adjusted = adjustComps(twinSubject(), [...otherPlats(), twin()], null)
    const pricing = computePricing(twinSubject(), adjusted, null)!
    expect(pricing.streetAnchor).not.toBeNull()
    expect(pricing.recommended).toBe(pricing.streetAnchor!.ceiling)
    expect(pricing.recommended).toBeLessThan(pricing.streetAnchor!.before)
    expect(pricing.streetAnchor!.addresses).toEqual(['31 Benaiah'])
    expect(pricing.streetAnchor!.sentence).toContain('31 Benaiah')
    expect(pricing.needsReview).toBe(true)
  })

  it('leaves the number alone when no sale sits on the subject’s street', () => {
    const adjusted = adjustComps(twinSubject(), otherPlats(), null)
    const pricing = computePricing(twinSubject(), adjusted, null)!
    expect(pricing.streetAnchor ?? null).toBeNull()
  })

  it('leaves the number alone when the street sale agrees with the set', () => {
    const agreeing = comp({ address: '31 Benaiah', city: 'Bend', sqft: 2080, closePrice: 700_000 })
    const adjusted = adjustComps(twinSubject(), [...otherPlats(), agreeing], null)
    const pricing = computePricing(twinSubject(), adjusted, null)!
    expect(pricing.streetAnchor ?? null).toBeNull()
  })

  it('ignores a same-street sale of a very different size', () => {
    const bigger = comp({ address: '31 Benaiah', city: 'Bend', sqft: 3400, closePrice: 512_000 })
    const adjusted = adjustComps(twinSubject(), [...otherPlats(), bigger], null)
    const pricing = computePricing(twinSubject(), adjusted, null)!
    expect(pricing.streetAnchor ?? null).toBeNull()
  })

  it('keeps the contract’s conservative <= recommended <= highEnd', () => {
    const adjusted = adjustComps(twinSubject(), [...otherPlats(), twin()], null)
    const p = computePricing(twinSubject(), adjusted, null)!
    expect(p.conservative).toBeLessThanOrEqual(p.recommended)
    expect(p.recommended).toBeLessThanOrEqual(p.highEnd)
  })
})
