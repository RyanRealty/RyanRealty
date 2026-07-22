/**
 * ownershipYears derivation for the prospecting detail — locks the source
 * priority (crm custom customOwnershipSince → the enrichment-notes
 * "Owned since YYYY-MM-DD" marker → the last closed MLS cycle) and the §0
 * fail-quiet rule: no proven date, no number.
 */
import { describe, expect, it } from 'vitest'
import { deriveOwnershipSince, ownershipYearsFromDate } from './get'
import type { ProspectPriceCycle } from './types'

const AS_OF = new Date('2026-07-21T00:00:00Z')

function closedCycle(overrides: Partial<ProspectPriceCycle> = {}): ProspectPriceCycle {
  return {
    listDate: '2014-03-01',
    status: 'Closed',
    originalListPrice: 470000,
    finalListPrice: 460000,
    closePrice: 451000,
    daysOnMarket: 40,
    priceDropCount: 1,
    offMarketDate: '2014-06-05',
    daysToPending: 25,
    wasRelisted: false,
    backOnMarketCount: null,
    ...overrides,
  }
}

describe('ownershipYearsFromDate', () => {
  it('returns whole years, 0 for under a year, null for bad input', () => {
    expect(ownershipYearsFromDate('2004-04-29', AS_OF)).toBe(22)
    expect(ownershipYearsFromDate('2026-02-01', AS_OF)).toBe(0)
    expect(ownershipYearsFromDate('2091-01-01', AS_OF)).toBeNull()
    expect(ownershipYearsFromDate(null, AS_OF)).toBeNull()
    expect(ownershipYearsFromDate('garbage', AS_OF)).toBeNull()
  })
})

describe('deriveOwnershipSince', () => {
  it('prefers the county custom field over notes and MLS', () => {
    expect(
      deriveOwnershipSince({
        customOwnershipSince: '2004-04-29',
        enrichmentNotes: 'Owned since 2010-01-01 (county deed history).',
        priceHistory: [closedCycle()],
      }),
    ).toBe('2004-04-29')
  })

  it('falls back to the enrichment-notes marker written by the owner-lookup chain', () => {
    expect(
      deriveOwnershipSince({
        enrichmentNotes:
          'Resolved via Deschutes County assessor records (taxlot 12345, account 129007). Owned since 2004-04-29 (county deed history, acquired at $251,000). Skip trace: 2 phone(s), 1 email(s).',
        priceHistory: [],
      }),
    ).toBe('2004-04-29')
  })

  it('falls back to the most recent CLOSED MLS cycle', () => {
    expect(
      deriveOwnershipSince({
        enrichmentNotes: null,
        priceHistory: [
          // The expired cycle itself (no close) must never be the source.
          closedCycle({ status: 'Expired', closePrice: null, offMarketDate: '2026-06-10' }),
          closedCycle({ offMarketDate: '2014-06-05' }),
          closedCycle({ offMarketDate: '2009-02-01', closePrice: 300000 }),
        ],
      }),
    ).toBe('2014-06-05')
  })

  it('returns null when nothing proves a date', () => {
    expect(
      deriveOwnershipSince({
        enrichmentNotes: 'Skip trace unavailable.',
        priceHistory: [closedCycle({ closePrice: null })],
      }),
    ).toBeNull()
  })
})
