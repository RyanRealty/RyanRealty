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

  it('withholds property age when year_built is sqft', () => {
    expect(computeTier1({ ...NULLS, yearBuilt: 3672 }).property_age).toBeNull()
  })

  it('all-null input → null derived fields (no NaN/crash)', () => {
    const n = computeTier1(NULLS)
    expect(n.price_per_sqft).toBeNull()
    expect(n.estimated_monthly_piti).toBeNull()
    expect(n.property_age).toBeNull()
    expect(n.hoa_annual_cost).toBeNull()
  })
})

describe('numeric(p,s) bound clamp (delta-cursor incident 2026-08-05)', () => {
  it('an out-of-range derived metric stores NULL instead of overflowing the column', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    // $99M on a 0.0001-acre "lot": price_per_acre = 9.9e11... fits 1e12; push
    // harder with 0.00001 → 9.9e12, over numeric(14,2). Also 0.01 baths on 4
    // beds → bed_bath_ratio 400, over numeric(4,2).
    const row = sparkToListingRow({
      ListingKey: '999', ListNumber: '220000002', StandardStatus: 'Active',
      ListPrice: 99_000_000, LotSizeAcres: 0.00001, BathroomsTotal: 0.01,
      BedroomsTotal: 4,
    } as Record<string, unknown>)
    expect(row.price_per_acre).toBeNull()
    expect(row.bed_bath_ratio).toBeNull()
    // Sane fields on the same row survive untouched.
    expect(row.ListPrice).toBe(99_000_000)
    expect(row.price_per_bedroom).toBe(24_750_000)
  })

  it('an out-of-range SOURCE numeric also stores NULL (same chokepoint)', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    const row = sparkToListingRow({
      ListingKey: '998', ListNumber: '220000003', StandardStatus: 'Active',
      LotSizeSquareFeet: 99_000_000_000,
    } as Record<string, unknown>)
    expect(row.lot_size_sqft).toBeNull()
  })
})

describe('publishYearBuilt on ingest', () => {
  it('does not store LivingArea leaking into YearBuilt', async () => {
    const { sparkToListingRow, computeTier1 } = await import('./listing-mapper')
    const row = sparkToListingRow({
      ListingKey: '997',
      ListNumber: '220223541',
      StandardStatus: 'Active',
      YearBuilt: 3672,
      LivingArea: 3672,
    } as Record<string, unknown>)
    expect(row.year_built).toBeNull()
    expect(computeTier1({ ...NULLS, yearBuilt: 3672 }).property_age).toBeNull()
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

describe('masked-value stripping (adversarial audit 2026-07-30)', () => {
  // Spark returns "********" for fields our feed access level does not
  // license. The mask reached anon-readable `details` verbatim (measured:
  // DirectionFaces masked on 9,407 of 9,648 MV rows) and nine search filters
  // were built over fields that are 100% masked. Masks must die at the door.
  it('stripMaskedValues drops masked scalars, filters masked array elements', async () => {
    const { stripMaskedValues } = await import('./listing-mapper')
    expect(stripMaskedValues({
      DirectionFaces: '********',
      SchoolDistrict: '****',
      City: 'Bend',
      Levels: ['One', '********'],
      AllMasked: ['****', '********'],
      Price: 500000,
      Empty: '',
      Star: '*',
    })).toEqual({
      City: 'Bend',
      Levels: ['One'],
      Price: 500000,
      Empty: '',   // empty string is not a mask; other layers decide its fate
    })
  })

  it('sparkToListingRow.details never carries a masked value, typed columns null', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    const row = sparkToListingRow({
      ListingKey: 'k1', ListNumber: '220000002', StandardStatus: 'Active',
      DirectionFaces: '********', SchoolDistrict: '********',
      StoriesTotal: '********', WalkScore: '********',
      City: 'Bend', PublicRemarks: 'Real remarks.',
    })
    const details = row.details as Record<string, unknown>
    expect(details.DirectionFaces).toBeUndefined()
    expect(details.SchoolDistrict).toBeUndefined()
    expect(details.StoriesTotal).toBeUndefined()
    expect(details.PublicRemarks).toBe('Real remarks.')
    expect(row.school_district).toBeNull()
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

describe('toText — one representation per typed text column (levels defect, 2026-07-31)', () => {
  // Root cause: the April promotion of the tier-2 columns out of `details`
  // wrote `listings.levels` with a raw jsonb->text cast and a JS String()
  // coercion instead of reducing the multi-select object to its truthy keys.
  // 881 on-market rows froze carrying '{"One": true}' / '[object Object]' /
  // '********'. singleLevel compares `levels = 'One'` and levelsOptions does an
  // IN over the bare labels — both exactly right, both blind to those rows.
  // Every shape below was measured in production before the backfill.

  it('scalar label passes through', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText('One')).toBe('One')
    expect(toText('  Two  ')).toBe('Two')
  })

  it('single-key multi-select object reduces to its label', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText({ One: true })).toBe('One')
    expect(toText({ 'Multi/Split': true })).toBe('Multi/Split')
  })

  it('multi-key object joins truthy labels in feed order, drops falsy keys', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText({ One: true, Two: true })).toBe('One, Two')
    expect(toText({ Two: true, 'Three Or More': true })).toBe('Two, Three Or More')
    expect(toText({ One: true, Two: false })).toBe('One')
    expect(toText({ One: false, Two: false })).toBeNull()
    expect(toText({})).toBeNull()
  })

  it('object stringified by a jsonb->text cast reduces to the same label', async () => {
    const { toText } = await import('./listing-mapper')
    // Postgres renders jsonb with a space after the colon; JSON.stringify does not.
    expect(toText('{"One": true}')).toBe('One')
    expect(toText('{"One":true}')).toBe('One')
    expect(toText('{"One": true, "Two": true}')).toBe('One, Two')
    expect(toText('{"One": false}')).toBeNull()
  })

  it('[object Object] is dropped, never persisted', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText('[object Object]')).toBeNull()
  })

  it('the Spark mask is dropped', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText('********')).toBeNull()
    expect(toText('****')).toBeNull()
    expect(toText('  ********  ')).toBeNull()
    expect(toText('')).toBeNull()
    expect(toText('   ')).toBeNull()
    // A lone asterisk is still a mask run, not content.
    expect(toText('*')).toBeNull()
  })

  it('an already-normalized comma list is left alone', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText('One, Two')).toBe('One, Two')
    expect(toText('Three Or More, Multi/Split')).toBe('Three Or More, Multi/Split')
  })

  it('unparseable object/array-shaped text is dropped, never leaked raw', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText('{One: true')).toBeNull()
    expect(toText('{not json at all}')).toBeNull()
    expect(toText('[unclosed')).toBeNull()
  })

  it('arrays join their labels and drop masked elements', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText(['Frame', 'Stone'])).toBe('Frame, Stone')
    expect(toText(['One', '********'])).toBe('One')
    expect(toText(['********', '****'])).toBeNull()
    expect(toText([])).toBeNull()
    expect(toText('["Frame", "Stone"]')).toBe('Frame, Stone')
  })

  it('null/undefined and non-text scalars', async () => {
    const { toText } = await import('./listing-mapper')
    expect(toText(null)).toBeNull()
    expect(toText(undefined)).toBeNull()
    expect(toText(42)).toBeNull()
  })

  it('sparkToListingRow normalizes levels for every observed shape', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    const levelsOf = (Levels: unknown) =>
      sparkToListingRow({ ListingKey: '1', ListNumber: '220000001', Levels }).levels
    expect(levelsOf('One')).toBe('One')
    expect(levelsOf({ One: true })).toBe('One')
    expect(levelsOf({ One: true, Two: true })).toBe('One, Two')
    expect(levelsOf('{"One": true}')).toBe('One')
    expect(levelsOf('[object Object]')).toBeNull()
    expect(levelsOf('********')).toBeNull()
    expect(levelsOf('One, Two')).toBe('One, Two')
  })

  it('the mask never reaches a typed text column via any promoted field', async () => {
    const { sparkToListingRow } = await import('./listing-mapper')
    const row = sparkToListingRow({
      ListingKey: '1', ListNumber: '220000001',
      Levels: '********', DirectionFaces: '********', SubdivisionName: '********',
      ArchitecturalStyle: '{"Craftsman": true}', FoundationDetails: '[object Object]',
    })
    expect(row.levels).toBeNull()
    expect(row.direction_faces).toBeNull()
    expect(row.SubdivisionName).toBeNull()
    expect(row.architectural_style).toBe('Craftsman')
    expect(row.foundation_details).toBeNull()
  })
})

describe('toText invariant — no unmatchable representation may reach a typed column', () => {
  // The gate for this defect class. singleLevel/levelsOptions and every other
  // scalar-column filter compare the column to a bare label, so ANY value that
  // is not a label (raw JSON, an object coerced to string, a Spark mask) is a
  // row silently deleted from its own filter. Rather than enumerate the shapes
  // seen so far, assert the invariant over every shape we can think of: toText
  // returns a label list or null, never a serialization artifact.
  const ARTIFACTS = [
    '[object Object]',
    '[object Array]',
    '{"One": true}',
    '{"One":true}',
    '{"One": true, "Two": true}',
    '{}',
    '{',
    '{broken',
    '{not json}',
    '[',
    '[]',
    '["One"]',
    '********',
    '****',
    '*',
    '   ********   ',
    '',
    '   ',
  ]

  it('never returns a raw object/array-shaped string, [object Object], or a mask', async () => {
    const { toText } = await import('./listing-mapper')
    const inputs: unknown[] = [
      ...ARTIFACTS,
      { One: true },
      { One: true, Two: true },
      { One: false },
      {},
      ['One', '********'],
      ['********'],
      [],
      null,
      undefined,
      42,
    ]
    for (const v of inputs) {
      const out = toText(v)
      if (out === null) continue
      expect(out, `toText(${JSON.stringify(v)}) leaked a brace shape`).not.toMatch(/^[{[]/)
      expect(out, `toText(${JSON.stringify(v)}) leaked [object Object]`).not.toBe('[object Object]')
      expect(out, `toText(${JSON.stringify(v)}) leaked a mask`).not.toMatch(/^\*+$/)
      expect(out, `toText(${JSON.stringify(v)}) leaked whitespace padding`).toBe(out.trim())
      expect(out.length, `toText(${JSON.stringify(v)}) returned empty`).toBeGreaterThan(0)
    }
  })

  it('every artifact shape collapses to null or a clean label list', async () => {
    const { toText } = await import('./listing-mapper')
    for (const a of ARTIFACTS) {
      const out = toText(a)
      expect(out === null || /^[^{[*].*$/.test(out), `${a} -> ${out}`).toBe(true)
    }
  })
})
