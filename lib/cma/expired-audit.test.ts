/**
 * Ownership-tenure line in the expired audit — 'Owned since YYYY (N years)'
 * in the pricing/context section. Locks the §0 rules: the line renders only
 * when the county deed record or the last closed MLS sale proves the date,
 * the county source wins when both exist, and the finding is OMITTED (never
 * estimated) when no source has a date or the date postdates the audited
 * listing period.
 */
import { describe, expect, it } from 'vitest'
import { buildFailureFindings, buildOwnershipFinding } from './expired-audit'
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

  it('adds the Ownership finding right after the pricing finding when known', () => {
    const findings = buildFailureFindings({
      subject,
      pricing,
      market: null,
      history: history({ lastSaleDate: '2014-06-05', lastSalePrice: 451000 }),
      photosCount: 30,
    })
    const lenses = findings.map((f) => f.lens)
    expect(lenses[0]).toBe('pricing')
    expect(lenses[1]).toBe('Ownership')
  })

  it('emits no Ownership finding when tenure is unknown', () => {
    const findings = buildFailureFindings({
      subject,
      pricing,
      market: null,
      history: history(),
      photosCount: 30,
    })
    expect(findings.some((f) => f.lens === 'Ownership')).toBe(false)
  })
})
