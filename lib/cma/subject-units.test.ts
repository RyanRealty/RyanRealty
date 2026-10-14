import { describe, expect, it } from 'vitest'
import {
  applyMultiUnitSubject,
  describesSameStructure,
  multiUnitProfile,
  multiUnitSubjectRefusal,
  multiUnitSubjectTrace,
  subjectUnitFacts,
  subjectUnitsTrace,
  unitRecordOf,
  type MultiUnitProfile,
} from '@/lib/cma/subject-units'

// 429 Irving as the listings table holds it (audit 2026-10-14).
const IRVING_2026 = {
  ListingKey: '20250813172616455254000000',
  ListNumber: '220207733',
  PropertyType: 'A',
  property_sub_type: 'Single Family Residence',
  StandardStatus: 'Expired',
  TotalLivingAreaSqFt: '1629',
  year_built: 2003,
  public_remarks:
    'Prime midtown location with built-in income potential! This versatile property features a 1,629 sq ft main home with 2 bedrooms, 2.5 bathrooms. The highlight is a 520 sq ft ADU—perfect for long-term rental income, guest quarters, or multi-generational living.',
  details: { 'Accessory Dwelling Unit YN': 'Yes', 'ADU SqFt': 520, 'ADU Type': 'Detached', 'ADU Permitted YN': 'Yes', PropertyType: 'A' },
}
const IRVING_2005 = {
  ListingKey: '20200227141424415425000000',
  ListNumber: '2005001',
  PropertyType: 'C',
  property_sub_type: 'Duplex',
  StandardStatus: 'Closed',
  CloseDate: '2005-07-07 00:00:00+00',
  TotalLivingAreaSqFt: '2300',
  year_built: 2003,
  public_remarks:
    'Craftsman-style, detached duplex, built in 2004. Unit A is 2 bedrooms, 2.5 bath 1629 sq.ft. Unit B is 1 bed, 1 bath, 520 sq.ft.',
  details: { NumberOfUnitsTotal: 2, PropertyType: 'C', PropertyTypeLabel: 'Residential Income' },
}

describe('unitRecordOf', () => {
  it('reads every multi-unit signal off the 2005 duplex record', () => {
    const r = unitRecordOf(IRVING_2005)
    expect(r.reasons).toEqual([
      'PropertyType C (Residential Income)',
      'sub type Duplex',
      'NumberOfUnitsTotal 2',
      'remarks that describe a multi-unit home',
    ])
    expect(r.unitsTotal).toBe(2)
    expect(r.sqft).toBe(2300)
    expect(r.yearBuilt).toBe(2003)
    expect(r.closeDate).toBe('2005-07-07')
  })

  it('reads the 2026 house-plus-ADU record as a single-unit record', () => {
    expect(unitRecordOf(IRVING_2026).reasons).toEqual([])
  })

  it('accepts details as a JSON string and ignores Spark placeholders', () => {
    const r = unitRecordOf({ ...IRVING_2005, details: JSON.stringify({ NumberOfUnitsTotal: '3', PropertyTypeLabel: '********' }) })
    expect(r.unitsTotal).toBe(3)
    expect(r.reasons).toContain('PropertyType C (Residential Income)')
  })
})

describe('describesSameStructure', () => {
  it('matches on the year built', () => {
    expect(describesSameStructure({ sqft: 1629, yearBuilt: 2003 }, { sqft: 2300, yearBuilt: 2003, unitsTotal: 2 })).toBe(true)
    expect(describesSameStructure({ sqft: 1629, yearBuilt: 2015 }, { sqft: 2300, yearBuilt: 1950, unitsTotal: 2 })).toBe(false)
  })
  it('without years, the earlier area must sit between the current one and four times it', () => {
    expect(describesSameStructure({ sqft: 1629, yearBuilt: null }, { sqft: 2300, yearBuilt: null, unitsTotal: 2 })).toBe(true)
    expect(describesSameStructure({ sqft: 1967, yearBuilt: null }, { sqft: 34200, yearBuilt: null, unitsTotal: null })).toBe(false)
    expect(describesSameStructure({ sqft: 1967, yearBuilt: 1998 }, { sqft: 34200, yearBuilt: 1998, unitsTotal: null })).toBe(false)
    expect(describesSameStructure({ sqft: null, yearBuilt: null }, { sqft: 2300, yearBuilt: null, unitsTotal: 2 })).toBe(false)
  })
  it('an apartment record with more than four units is never the subject', () => {
    expect(describesSameStructure({ sqft: 1000, yearBuilt: 1990 }, { sqft: 1500, yearBuilt: 1990, unitsTotal: 12 })).toBe(false)
  })
})

describe('subjectUnitFacts', () => {
  it('finds the duplex behind 429 Irving in its own listing history', () => {
    const facts = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    expect(facts.multiUnit).toBe(false)
    expect(facts.aduYn).toBe(true)
    expect(facts.aduSqft).toBe(520)
    expect(facts.aduType).toBe('Detached')
    expect(facts.priorMultiUnit?.listingKey).toBe(IRVING_2005.ListingKey)
    expect(facts.priorMultiUnit?.unitsTotal).toBe(2)
  })

  it('a prior Residential Lots record is land, not a unit', () => {
    const lot = { ListingKey: 'lot', PropertyType: 'D', property_sub_type: 'Residential Lots', StandardStatus: 'Closed', CloseDate: '2001-06-25' }
    const facts = subjectUnitFacts({ ...IRVING_2026, details: {} }, [IRVING_2026, lot])
    expect(facts.priorMultiUnit).toBeNull()
    expect(facts.multiUnit).toBe(false)
    expect(facts.aduYn).toBe(true)
  })

  it('a current record typed Duplex is multi-unit on its own', () => {
    const facts = subjectUnitFacts(IRVING_2005, [IRVING_2005])
    expect(facts.multiUnit).toBe(true)
    expect(facts.unitsTotal).toBe(2)
  })

  it('a townhouse sharing an address with an apartment complex record stays a townhouse', () => {
    const th = { ListingKey: 'th', PropertyType: 'A', property_sub_type: 'Townhouse', TotalLivingAreaSqFt: '1967', year_built: 1998 }
    const complex = { ListingKey: 'mf', PropertyType: 'C', property_sub_type: 'Multi Family', TotalLivingAreaSqFt: '34200', year_built: 1998, StandardStatus: 'Expired' }
    expect(subjectUnitFacts(th, [th, complex]).priorMultiUnit).toBeNull()
  })

  it('a plain house with blank details and no ADU wording reads no ADU', () => {
    const plain = { ListingKey: 'p', PropertyType: 'A', property_sub_type: 'Single Family Residence', public_remarks: 'Cozy bungalow.' }
    const facts = subjectUnitFacts(plain, [plain])
    expect(facts).toEqual({ multiUnit: false, reasons: [], unitsTotal: null, aduYn: null, aduSqft: null, aduType: null, priorMultiUnit: null })
  })
})

describe('multiUnitSubjectRefusal (the multi-unit ladder prices two to four units, Matt 2026-10-14)', () => {
  const subject = { streetAddress: '429 Irving', sqft: 1629, propertySubType: 'Single Family Residence' }

  it('no longer refuses 429 Irving: a duplex by its prior record prices on the ladder', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    expect(multiUnitSubjectRefusal({ ...subject, units })).toBeNull()
  })

  it('no longer refuses a record that is itself a duplex', () => {
    const units = subjectUnitFacts(IRVING_2005, [IRVING_2005])
    expect(multiUnitSubjectRefusal({ ...subject, propertySubType: 'Duplex', sqft: 2300, units })).toBeNull()
  })

  it('still refuses a building of more than four units, and the sentence files under Multi-unit home', () => {
    const complex = { ListingKey: 'mf', PropertyType: 'C', property_sub_type: 'Multi Family', TotalLivingAreaSqFt: '9800', year_built: 1988, details: { NumberOfUnitsTotal: 12, PropertyTypeLabel: 'Residential Income' } }
    const units = subjectUnitFacts(complex, [complex])
    const reason = multiUnitSubjectRefusal({ streetAddress: '100 Bond', sqft: 9800, propertySubType: 'Multi Family', units })
    expect(reason).toMatch(/^Multi-unit home: the MLS record for 100 Bond describes a multi-unit home \(PropertyType C \(Residential Income\); sub type Multi Family\)\./)
    expect(reason).toContain('A building of 12 units is priced on its income')
    expect(reason).toContain('Matt prices it by hand.')
    expect(reason).not.toMatch(/[—–]/)
  })

  it('a house with an ADU and no multi-unit record is not refused (rule 23: an ADU is not a multi-unit)', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026])
    expect(units.aduYn).toBe(true)
    expect(multiUnitSubjectRefusal({ ...subject, units })).toBeNull()
    expect(multiUnitSubjectRefusal({ ...subject, units: null })).toBeNull()
    expect(multiUnitSubjectRefusal(subject)).toBeNull()
  })
})

describe('multiUnitProfile and applyMultiUnitSubject (the multi-unit ladder, Matt 2026-10-14)', () => {
  it('429 Irving: a duplex of 2,149 sq ft, the main home plus its recorded ADU, from the prior record', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    const profile = multiUnitProfile(units, { sqft: 1629, propertySubType: 'Single Family Residence' })
    expect(profile).toEqual({
      units: 2,
      propertySubType: 'Duplex',
      sqft: 2149,
      sqftBasis: "the current record's 1,629 sq ft main home plus its 520 sq ft ADU",
      basis: 'prior',
    })
  })

  it('without an ADU area on the current record the earlier record\'s area is the building', () => {
    const current = { ...IRVING_2026, details: { 'Accessory Dwelling Unit YN': 'Yes' } }
    const units = subjectUnitFacts(current, [current, IRVING_2005])
    const profile = multiUnitProfile(units, { sqft: 1629, propertySubType: 'Single Family Residence' })
    expect(profile?.sqft).toBe(2300)
    expect(profile?.sqftBasis).toBe('the earlier Duplex record (MLS 2005001)')
  })

  it('a current duplex record keeps its own area and sub type', () => {
    const units = subjectUnitFacts(IRVING_2005, [IRVING_2005])
    expect(multiUnitProfile(units, { sqft: 2300, propertySubType: 'Duplex' })).toEqual({
      units: 2,
      propertySubType: 'Duplex',
      sqft: 2300,
      sqftBasis: null,
      basis: 'current',
    })
  })

  it('a Multi Family record with a count of three types as a triplex; with no count it stays Multi Family', () => {
    const three = { ListingKey: 't', PropertyType: 'C', property_sub_type: 'Multi Family', TotalLivingAreaSqFt: '3000', details: { NumberOfUnitsTotal: 3 } }
    expect(multiUnitProfile(subjectUnitFacts(three, [three]), { sqft: 3000, propertySubType: 'Multi Family' })?.propertySubType).toBe('Triplex')
    const bare = { ...three, details: {} }
    const p = multiUnitProfile(subjectUnitFacts(bare, [bare]), { sqft: 3000, propertySubType: 'Multi Family' })
    expect(p?.units).toBeNull()
    expect(p?.propertySubType).toBe('Multi Family')
  })

  it('applies the profile to the subject and leaves a house alone', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    const duplex: { sqft: number | null; propertySubType: string | null; propertyType?: string | null; units?: typeof units; multiUnit?: MultiUnitProfile | null } = {
      sqft: 1629,
      propertySubType: 'Single Family Residence',
      propertyType: 'A',
      units,
    }
    const profile = applyMultiUnitSubject(duplex)
    expect(profile?.units).toBe(2)
    expect(duplex.propertySubType).toBe('Duplex')
    expect(duplex.propertyType).toBe('C')
    expect(duplex.sqft).toBe(2149)
    expect(duplex.multiUnit).toBe(profile)

    const house = { sqft: 1629, propertySubType: 'Single Family Residence', propertyType: 'A', units: subjectUnitFacts(IRVING_2026, [IRVING_2026]) }
    expect(applyMultiUnitSubject(house)).toBeNull()
    expect(house).toMatchObject({ sqft: 1629, propertySubType: 'Single Family Residence', propertyType: 'A' })
  })

  it('writes the ladder sentence for the trace', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    const profile = multiUnitProfile(units, { sqft: 1629, propertySubType: 'Single Family Residence' })
    expect(multiUnitSubjectTrace(profile)).toBe(
      "Priced as a duplex (2 units, 2,149 sq ft: the current record's 1,629 sq ft main home plus its 520 sq ft ADU) from closed duplex sales on the multi-unit ladder, never from single-family sales (rule 23, Matt 2026-10-14).",
    )
    expect(multiUnitSubjectTrace(null)).toBe('')
  })
})

describe('subjectUnitsTrace', () => {
  it('states the prior duplex record and the ADU', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026, IRVING_2005])
    const line = subjectUnitsTrace(units, { streetAddress: '429 Irving', sqft: 1629, propertySubType: 'Single Family Residence' })
    expect(line).toBe(
      'An earlier MLS record at this address (MLS 2005001, closed 2005-07-07) is typed Duplex, 2 units, 2,300 sq ft, built 2003: the same structure the current record lists as Single Family Residence at 1,629 sq ft with a 520 sq ft ADU.',
    )
  })
  it('states an ADU alone when there is no multi-unit record', () => {
    const units = subjectUnitFacts(IRVING_2026, [IRVING_2026])
    expect(subjectUnitsTrace(units, { streetAddress: '429 Irving', sqft: 1629, propertySubType: 'Single Family Residence' })).toBe(
      'The MLS record lists a detached ADU of 520 sq ft; the living area above is the main home.',
    )
    expect(subjectUnitsTrace(null, { streetAddress: 'x', sqft: null, propertySubType: null })).toBe('')
  })
})

describe('the code-review shapes (2026-10-14)', () => {
  it('a prior duplex record that lists one unit\'s area still matches on the year', () => {
    expect(describesSameStructure({ sqft: 1629, yearBuilt: 2003 }, { sqft: 1100, yearBuilt: 2003, unitsTotal: 2 })).toBe(true)
    expect(describesSameStructure({ sqft: 1629, yearBuilt: 2003 }, { sqft: 9000, yearBuilt: 2003, unitsTotal: 2 })).toBe(false)
  })
  it('a condo or townhouse record carrying the building\'s unit count is not a multi-unit home', () => {
    const condo = { ListingKey: 'c', PropertyType: 'A', property_sub_type: 'Condominium', TotalLivingAreaSqFt: '980', year_built: 2004, details: { NumberOfUnitsTotal: 24 } }
    expect(unitRecordOf(condo).reasons).toEqual([])
    expect(subjectUnitFacts(condo, [condo]).multiUnit).toBe(false)
    const th = { ...condo, property_sub_type: 'Townhouse', details: { NumberOfUnitsTotal: 3 } }
    expect(unitRecordOf(th).reasons).toEqual([])
  })
  it('a house record with a unit count of two to four is a duplex signal; five or more is not read', () => {
    const sfr = { ListingKey: 's', PropertyType: 'A', property_sub_type: 'Single Family Residence', details: { NumberOfUnitsTotal: 2 } }
    expect(unitRecordOf(sfr).reasons).toEqual(['NumberOfUnitsTotal 2'])
    expect(unitRecordOf({ ...sfr, details: { NumberOfUnitsTotal: 36 } }).reasons).toEqual([])
    expect(unitRecordOf({ ...sfr, PropertyType: 'F', property_sub_type: null, details: { NumberOfUnitsTotal: 3 } }).reasons).toEqual([])
  })
})
