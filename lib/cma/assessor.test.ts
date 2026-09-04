import { describe, expect, it } from 'vitest'
import { propertySubTypeFromStatClass } from '@/lib/cma/assessor'
// Static, not a dynamic import inside the test body: lib/cma/subject pulls a
// heavy graph and the lazy import blew the 5s timeout under full-suite load.
import { parseCmaAddress, subjectFromAssessorFacts } from '@/lib/cma/subject'

/**
 * The mapping is read off the county's own vocabulary (119 distinct
 * Stat_Class_Desc_1 values, enumerated 2026-09-04), so these cases are real
 * strings the assessor serves, not invented ones.
 */
describe('propertySubTypeFromStatClass', () => {
  it('maps every stick-built detached class the county uses', () => {
    for (const c of [
      'One story',
      'One story with attic',
      'One story with basement',
      'One story w/attic and basement',
      'Two story',
      'Two story with attic',
      'Two story with basement',
      'Split level',
    ]) {
      expect(propertySubTypeFromStatClass(c)).toBe('Single Family Residence')
    }
  })

  it('maps attached and manufactured product to their own types', () => {
    expect(propertySubTypeFromStatClass('Dwellings - Condominium')).toBe('Condominium')
    expect(propertySubTypeFromStatClass('Residential Condos')).toBe('Condominium')
    expect(propertySubTypeFromStatClass('Townhouse')).toBe('Townhouse')
    for (const c of ['Single wide', 'Double wide', 'Triple wide', 'Four wide']) {
      expect(propertySubTypeFromStatClass(c)).toBe('Manufactured Home')
    }
  })

  it('refuses to force anything else into a house', () => {
    // Forcing these to SFR would price an apartment block or a kennel against
    // detached comps. Null lets the existing unknown-subject rule apply.
    for (const c of [
      'Dwellings - Apartment',
      'Mobile Home Park',
      'Class 3 Tiny Home',
      'Lodging  - Vacation Cabins',
      'Nursing Home/Assisted Living',
      'Commercial Dog Kennel',
      'Warehouse - Mini Storage',
      'Airplane Hangar',
      '10 - 19 units',
      'Duplex',
      'Fourplex',
    ]) {
      expect(propertySubTypeFromStatClass(c)).toBeNull()
    }
  })

  it('handles absent and messy input', () => {
    expect(propertySubTypeFromStatClass(null)).toBeNull()
    expect(propertySubTypeFromStatClass('')).toBeNull()
    expect(propertySubTypeFromStatClass('   ')).toBeNull()
    expect(propertySubTypeFromStatClass('  TWO STORY  ')).toBe('Single Family Residence')
  })

  it('does not match a story word buried mid-string', () => {
    // The detached rule is anchored: a class that merely mentions a story is
    // not a house. "Store - Store" starts with "Store", not "One story".
    expect(propertySubTypeFromStatClass('Store - Store')).toBeNull()
    expect(propertySubTypeFromStatClass('Store - Convenience')).toBeNull()
  })
})

describe('subjectFromAssessorFacts address', () => {
  it('keeps the street line the owner typed, casing and suffix intact', () => {
    const raw = '2552 NE Lynda Ln, Bend, OR 97701'
    const parsed = parseCmaAddress(raw)
    expect(parsed).not.toBeNull()
    const subject = subjectFromAssessorFacts(
      parsed!,
      {
        taxlot: '171222DD00170',
        latitude: 44.0821485,
        longitude: -121.2648171,
        sqft: 2258,
        beds: 4,
        baths: 2.5,
        yearBuilt: 1999,
        lotAcres: 0.19,
        statClass: 'Two story',
        dialUrl: 'https://dial.deschutes.org/Real/Index/171222DD00170',
        geocodePrecision: 'ROOFTOP',
      },
      raw,
    )
    // Parsing lowercases and drops the suffix for SQL matching. A client reads
    // this one.
    expect(subject.streetAddress).toBe('2552 NE Lynda Ln')
    expect(subject.propertySubType).toBe('Single Family Residence')
    expect(subject.sqft).toBe(2258)
    expect(subject.mlsNumber).toBeNull()
  })
})
