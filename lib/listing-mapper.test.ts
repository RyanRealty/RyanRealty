import { describe, it, expect } from 'vitest'
import { computeTier1, type Tier1Input } from './listing-mapper'

const FULL: Tier1Input = {
  listPrice: 500000,
  closePrice: 490000,
  originalListPrice: 520000,
  sqft: 2000,
  lotAcres: 0.5,
  lotSqft: 21780,
  bedrooms: 4,
  bathrooms: 2,
  rooms: 8,
  yearBuilt: 2000,
  aboveGrade: 1800,
  buildingTotal: 2400,
  hoaMonthly: 100,
  taxAnnual: 6000,
  taxAssessed: 480000,
}

const NULLS: Tier1Input = {
  listPrice: null, closePrice: null, originalListPrice: null, sqft: null,
  lotAcres: null, lotSqft: null, bedrooms: null, bathrooms: null, rooms: null,
  yearBuilt: null, aboveGrade: null, buildingTotal: null, hoaMonthly: null,
  taxAnnual: null, taxAssessed: null,
}

describe('computeTier1 (sync derived fields, audit p3.2)', () => {
  const t = computeTier1(FULL)

  it('per-area + per-unit prices', () => {
    expect(t.price_per_sqft).toBe(250)
    expect(t.close_price_per_sqft).toBe(245)
    expect(t.price_per_acre).toBe(1000000)
    expect(t.price_per_bedroom).toBe(125000)
    expect(t.price_per_room).toBe(62500)
  })

  it('ratios', () => {
    expect(t.sale_to_final_list_ratio).toBe(0.98)
    expect(t.bed_bath_ratio).toBe(2)
    expect(t.above_grade_pct).toBe(0.75)
  })

  it('hoa, property age, and a positive PITI', () => {
    expect(t.hoa_annual_cost).toBe(1200)
    expect(t.property_age).toBe(new Date().getFullYear() - 2000)
    expect(typeof t.estimated_monthly_piti).toBe('number')
    expect(t.estimated_monthly_piti as number).toBeGreaterThan(0)
  })

  it('all-null input → null derived fields (no NaN/crash)', () => {
    const n = computeTier1(NULLS)
    expect(n.price_per_sqft).toBeNull()
    expect(n.estimated_monthly_piti).toBeNull()
    expect(n.property_age).toBeNull()
    expect(n.hoa_annual_cost).toBeNull()
  })
})

describe('private-detail redaction (attack finding 2026-07-11)', () => {
  it('sparkToListingRow.details NEVER contains any confidential key', async () => {
    const { sparkToListingRow, PRIVATE_DETAIL_KEYS } = await import('./listing-mapper')
    const fields = {
      ListingKey: '123', ListNumber: '220000001', StandardStatus: 'Active',
      PublicRemarks: 'Lovely home.',
      PrivateRemarks: 'Lockbox 1234, seller relocating, agent cell 602-451-7671.',
      ShowingInstructions: 'Call first, tenant occupied.',
      ShowingPhoneNumber: '541-555-0100', OccupantName: 'John Doe',
      OwnerName: 'Jane Owner', ContingencyRemarks: 'Subject to seller finding replacement.',
    }
    const row = sparkToListingRow(fields)
    const details = row.details as Record<string, unknown>
    expect(details.PublicRemarks).toBe('Lovely home.')
    for (const k of PRIVATE_DETAIL_KEYS) {
      expect(details[k], `details must not carry ${k}`).toBeUndefined()
    }
  })

  it('extractPrivateDetails captures the confidential keys, null when none present', async () => {
    const { extractPrivateDetails } = await import('./listing-mapper')
    const priv = extractPrivateDetails({
      PublicRemarks: 'x', PrivateRemarks: 'lockbox', ShowingInstructions: 'call',
      ShowingPhoneNumber: '', OwnerName: '   ', OccupantName: '********',
    })
    expect(priv).toEqual({ PrivateRemarks: 'lockbox', ShowingInstructions: 'call' })
    expect(extractPrivateDetails({ PublicRemarks: 'only public', City: 'Bend' })).toBeNull()
  })
})
