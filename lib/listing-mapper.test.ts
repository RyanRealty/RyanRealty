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

// ---------------------------------------------------------------------------
// CustomFields ingest (search plan Phase 1.2, 2026-07-29)
// ---------------------------------------------------------------------------

/** Fixture mirroring the REAL Spark CF response shape verified live 2026-07-29:
 *  Results[].CustomFields = [{ "Main": [ { "<Group Name>": [ {"<Field>": v} ] } ] }] */
const CF_FIXTURE = [
  {
    Main: [
      {
        'General Property Information': [
          { 'Accessory Dwelling Unit YN': 'No' },
          { 'Short Term Rental Permit YN': 'Yes' },
          { "CC&R's YN": 'Yes' },
          { 'Power Production': '' },            // empty → dropped
          { 'Occupant Name': '********' },       // masked → dropped entirely
        ],
      },
      {
        'Location, Tax, and Legal': [
          { Zoning: 'RM' },
          { 'Owner Name': 'Jane Confidential' },
          { 'Phone to Show': '541-555-0100' },
          { 'Phone to Show Number': '541-555-0101' },
          { 'Preferred Escrow Company & Officer': 'ABC Escrow / Sally O.' },
        ],
      },
      { Flood: [{ Flood: 'None' }] },
      { 'Government Overlay': [{ 'Government Overlay': 'Urban Growth Boundary' }] },
    ],
  },
]

describe('CustomFields flattening + privacy diversion', () => {
  it('flattens the real CF shape to a single flat {Field: value} object, dropping masked + empty', async () => {
    const { flattenCustomFields } = await import('./listing-mapper')
    const flat = flattenCustomFields(CF_FIXTURE)
    expect(flat['Accessory Dwelling Unit YN']).toBe('No')
    expect(flat['Short Term Rental Permit YN']).toBe('Yes')
    expect(flat["CC&R's YN"]).toBe('Yes')
    expect(flat.Zoning).toBe('RM')
    expect(flat.Flood).toBe('None')
    expect(flat['Government Overlay']).toBe('Urban Growth Boundary')
    // masked + empty values never survive flattening
    expect(flat['Occupant Name']).toBeUndefined()
    expect(flat['Power Production']).toBeUndefined()
    // confidential values ARE in the raw flat output (redaction is the caller's job)
    expect(flat['Owner Name']).toBe('Jane Confidential')
  })

  it('sparkToListingRow merges public CF fields into details and NEVER a confidential key (either spelling family)', async () => {
    const { sparkToListingRow, PRIVATE_DETAIL_KEYS, CF_COLLISION_PREFIX } = await import('./listing-mapper')
    const fields = {
      ListingKey: '123', ListNumber: '220000001', StandardStatus: 'Active',
      PublicRemarks: 'Lovely home.', PrivateRemarks: 'Lockbox 1234',
    }
    const row = sparkToListingRow(fields, undefined, CF_FIXTURE)
    const details = row.details as Record<string, unknown>
    // public CF fields are reachable in details under their spaced names
    expect(details['Accessory Dwelling Unit YN']).toBe('No')
    expect(details['Short Term Rental Permit YN']).toBe('Yes')
    expect(details["CC&R's YN"]).toBe('Yes')
    expect(details.Zoning).toBe('RM')
    // no confidential key in details, in either spelling, prefixed or not
    for (const k of PRIVATE_DETAIL_KEYS) {
      expect(details[k], `details must not carry ${k}`).toBeUndefined()
      expect(details[`${CF_COLLISION_PREFIX}${k}`], `details must not carry ${CF_COLLISION_PREFIX}${k}`).toBeUndefined()
    }
  })

  it('extractPrivateDetails diverts the confidential CF keys (masked ones dropped)', async () => {
    const { extractPrivateDetails } = await import('./listing-mapper')
    const priv = extractPrivateDetails({ PrivateRemarks: 'Lockbox 1234' }, CF_FIXTURE)
    expect(priv).toEqual({
      PrivateRemarks: 'Lockbox 1234',
      'Owner Name': 'Jane Confidential',
      'Phone to Show': '541-555-0100',
      'Phone to Show Number': '541-555-0101',
      'Preferred Escrow Company & Officer': 'ABC Escrow / Sally O.',
      // 'Occupant Name' was masked "********" → not diverted
    })
  })

  it('collision policy: identical value skipped, different value stored under the CF prefix', async () => {
    const { mergeCustomFieldsIntoDetails, CF_COLLISION_PREFIX } = await import('./listing-mapper')
    const details = { Zoning: 'RM', City: 'Bend' }
    // identical → single key, no prefix
    const same = mergeCustomFieldsIntoDetails(details, { Zoning: 'RM', Flood: 'None' })
    expect(same.Zoning).toBe('RM')
    expect(same[`${CF_COLLISION_PREFIX}Zoning`]).toBeUndefined()
    expect(same.Flood).toBe('None')
    // different → StandardFields value keeps its key, CF value lands prefixed
    const diff = mergeCustomFieldsIntoDetails(details, { Zoning: 'A-1' })
    expect(diff.Zoning).toBe('RM')
    expect(diff[`${CF_COLLISION_PREFIX}Zoning`]).toBe('A-1')
  })

  it('sparkToListingRow without CustomFields is unchanged (no CF keys, no crash)', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    const row = sparkToListingRow({ ListingKey: '123', ListNumber: '220000001', PublicRemarks: 'x' })
    const details = row.details as Record<string, unknown>
    expect(details.PublicRemarks).toBe('x')
    expect(details.Zoning).toBeUndefined()
  })

  it('flattenCustomFields tolerates junk shapes (null, non-array, empty)', async () => {
    const { flattenCustomFields } = await import('./listing-mapper')
    expect(flattenCustomFields(null)).toEqual({})
    expect(flattenCustomFields(undefined)).toEqual({})
    expect(flattenCustomFields([])).toEqual({})
    expect(flattenCustomFields('garbage')).toEqual({})
    expect(flattenCustomFields([{ Main: 'not-an-array' }])).toEqual({})
  })
})
