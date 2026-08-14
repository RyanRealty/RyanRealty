/**
 * Ownership-tenure line in the expired audit — 'Owned since YYYY (N years)'
 * in the pricing/context section. Locks the §0 rules: the line renders only
 * when the county deed record or the last closed MLS sale proves the date,
 * the county source wins when both exist, and the finding is OMITTED (never
 * estimated) when no source has a date or the date postdates the audited
 * listing period.
 */
import { describe, expect, it } from 'vitest'
import {
  buildFailureFindings,
  buildNetSheet,
  buildOwnershipFinding,
  buildServicesList,
  buildThisHomeMarketingPlan,
  feeLine,
} from './expired-audit'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import { checkBrandVoice } from '@/lib/voice/check'
import type { BpoListingHistory } from '@/lib/bpo/types'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const AS_OF = new Date('2026-07-21T00:00:00Z')

function history(overrides: Partial<BpoListingHistory> = {}): BpoListingHistory {
  return {
    cycles: [],
    attemptsCount: 1,
    failedAttemptsCount: 1,
    currentCycle: {
      listingKey: 'K1',
      mlsNumber: '220100001',
      status: 'Expired',
      listAgentName: null,
      listOfficeName: null,
      listDate: '2026-01-10',
      offMarketDate: '2026-06-10',
      originalListPrice: 900000,
      finalListPrice: 875000,
      closePrice: null,
      daysOnMarket: 151,
      priceCutCount: 1,
      totalPriceChangeAmt: -25000,
      wasRelisted: false,
      outcome: 'expired',
    },
    currentIsActive: false,
    currentDaysOnMarket: 151,
    currentListPrice: 875000,
    currentOriginalListPrice: 900000,
    currentCutFromOriginalPct: -2.8,
    peakAskingPrice: 900000,
    totalDeclineFromPeakPct: null,
    lastSalePrice: null,
    lastSaleDate: null,
    signals: [],
    listingPressureAdjustmentPct: 0,
    trace: [],
    ...overrides,
  }
}

describe('buildOwnershipFinding', () => {
  it('prefers the county deed date and says so in the fact', () => {
    const f = buildOwnershipFinding({
      history: history({ lastSaleDate: '2019-05-01', lastSalePrice: 500000 }),
      ownershipSince: '2004-04-29',
      asOf: AS_OF,
    })
    expect(f).not.toBeNull()
    expect(f!.lens).toBe('Ownership')
    expect(f!.fact).toBe('Owned since 2004 (22 years) per the county deed record.')
  })

  it('falls back to the last closed MLS sale, citing the record and price', () => {
    const f = buildOwnershipFinding({
      history: history({ lastSaleDate: '2014-06-05', lastSalePrice: 451000 }),
      asOf: AS_OF,
    })
    expect(f).not.toBeNull()
    expect(f!.fact).toBe(
      'Owned since 2014 (12 years). The MLS record shows the last sale at this address closed in 2014 at $451,000.',
    )
  })

  it('is omitted when no source proves a date (never estimated)', () => {
    expect(buildOwnershipFinding({ history: history(), asOf: AS_OF })).toBeNull()
  })

  it('is omitted when the date postdates the audited listing period', () => {
    // A sale recorded after the final cycle listed is not this owner's story.
    const f = buildOwnershipFinding({
      history: history({ lastSaleDate: '2026-03-01', lastSalePrice: 800000 }),
      asOf: AS_OF,
    })
    expect(f).toBeNull()
  })

  it('is omitted on a future/garbage date', () => {
    expect(
      buildOwnershipFinding({ history: history(), ownershipSince: '2091-01-01', asOf: AS_OF }),
    ).toBeNull()
    expect(
      buildOwnershipFinding({ history: history(), ownershipSince: 'unknown', asOf: AS_OF }),
    ).toBeNull()
  })

  it('labels sub-year tenure honestly and uses the singular for one year', () => {
    const under = buildOwnershipFinding({
      history: history({ currentCycle: null }),
      ownershipSince: '2026-02-01',
      asOf: AS_OF,
    })
    expect(under!.fact).toContain('(under a year)')
    const one = buildOwnershipFinding({
      history: history({ currentCycle: null }),
      ownershipSince: '2025-06-01',
      asOf: AS_OF,
    })
    expect(one!.fact).toContain('(1 year)')
  })
})

describe('buildFailureFindings — ownership integration', () => {
  const subject = {
    listingKey: 'K1',
    mlsNumber: '220100001',
    streetAddress: '950 NW 57TH ST',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1900,
    lotAcres: null,
    propertySubType: null,
    yearBuilt: 1999,
    garageSpaces: null,
    photoUrl: null,
    publicRemarks: 'A description long enough not to trip the presentation finding. '.repeat(10),
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 875000,
    lastListDate: '2026-01-10',
    listingHistoryLine: null,
  } satisfies CmaSubject

  const pricing = {
    method1Low: 780000,
    method1Mid: 800000,
    method1High: 820000,
    method2: null,
    method3: 805000,
    convergenceSpreadPct: null,
    converged: true,
    conservative: 780000,
    recommended: 800000,
    highEnd: 820000,
    valueLow: 780000,
    valueHigh: 820000,
    confidence: 'High',
    confidenceReason: 'test',
    needsReview: false,
    reviewReason: null,
  } as unknown as CmaPricing

  it('adds the Ownership finding right after the pricing finding when known (MLS fallback)', () => {
    const findings = buildFailureFindings({
      subject,
      pricing,
      market: null,
      history: history({ lastSaleDate: '2014-06-05', lastSalePrice: 451000 }),
      photosCount: 30,
      ownershipSince: null,
    })
    const lenses = findings.map((f) => f.lens)
    expect(lenses[0]).toBe('pricing')
    expect(lenses[1]).toBe('Ownership')
    // no county date -> the fact cites the MLS record, not the county deed
    expect(findings[1].fact).toContain('MLS record')
  })

  it('emits no Ownership finding when tenure is unknown', () => {
    const findings = buildFailureFindings({
      subject,
      pricing,
      market: null,
      history: history(),
      photosCount: 30,
      ownershipSince: null,
    })
    expect(findings.some((f) => f.lens === 'Ownership')).toBe(false)
  })

  it('W6.2: prefers the county deed date over the MLS last sale when the call site passes ownershipSince', () => {
    const findings = buildFailureFindings({
      subject,
      pricing,
      market: null,
      // MLS last sale is 2014; the county deed date is 2004 (older tenure).
      history: history({ lastSaleDate: '2014-06-05', lastSalePrice: 451000 }),
      photosCount: 30,
      ownershipSince: '2004-04-29',
    })
    const ownership = findings.find((f) => f.lens === 'Ownership')
    expect(ownership, 'Ownership finding present').toBeTruthy()
    // county-preferring fact + the 2004 year, NOT the 2014 MLS year
    expect(ownership!.fact).toContain('county deed record')
    expect(ownership!.fact).toContain('2004')
    expect(ownership!.fact).not.toContain('MLS record')
  })
})

describe('buildServicesList — this-home plan, not a brochure', () => {
  it('names THIS address on the hero lines and keeps generic services secondary', () => {
    const plan = buildThisHomeMarketingPlan({ streetAddress: '1842 NW Foo St' })
    expect(plan.hero[0]).toContain('1842 NW Foo St')
    expect(plan.hero.join(' ')).toMatch(/listing video/i)
    expect(plan.hero.join(' ')).not.toMatch(/every Ryan Realty listing/i)
    expect(plan.secondary.join(' ')).toMatch(/3D walkthrough|weekly report|MLS/i)
    const list = buildServicesList({ streetAddress: '1842 NW Foo St' })
    expect(list[0]).toContain('1842 NW Foo St')
    expect(list[0]).toContain('listing video')
    expect(list.join(' ')).not.toMatch(/What every Ryan Realty listing gets/i)
    for (const line of list) {
      expect(isWorthQuestionCopy(line)).toBe(false)
      expect(blamesPriorAgent(line)).toBe(false)
      const voice = checkBrandVoice(line)
      expect(voice.ok, `${line} -> ${JSON.stringify(voice.violations)}`).toBe(true)
    }
  })

  it('does not invent an address when none is provided', () => {
    const list = buildServicesList(null)
    expect(list[0]).toContain('this home')
    expect(list.join(' ')).not.toMatch(/1842|Main St|\$\d/)
  })

  it('fee line does not lead with the old brochure sentence', () => {
    expect(feeLine()).not.toMatch(/Every service above/i)
    expect(isWorthQuestionCopy(feeLine())).toBe(false)
  })
})

describe('buildNetSheet — close price minus seller concessions', () => {
  const pricing = {
    recommended: 800_000,
    conservative: 780_000,
    highEnd: 820_000,
    notes: [],
  } as unknown as CmaPricing

  it('subtracts comparable-set concessions from seller net', () => {
    const sheet = buildNetSheet(pricing, { expectedConcessions: 10_000 })
    const line = sheet.lines.find((l) => l.label.startsWith('Seller concessions'))
    expect(line?.amount).toBe(-10_000)
    expect(sheet.estimatedNet).toBe(sheet.salePrice - sheet.totalCosts)
    expect(sheet.totalCosts).toBeGreaterThan(10_000)
    expect(sheet.assumptions.some((a) => a.includes('contract price'))).toBe(true)
  })

  it('does not invent a concession line when the set did not resolve one', () => {
    const sheet = buildNetSheet(pricing, { expectedConcessions: null })
    expect(sheet.lines.some((l) => l.label.startsWith('Seller concessions'))).toBe(false)
  })
})
