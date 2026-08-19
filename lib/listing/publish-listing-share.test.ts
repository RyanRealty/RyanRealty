import { describe, expect, it } from 'vitest'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from './publish-listing-share'

describe('publishListingShareKind', () => {
  it('labels Snowgoose Tenancy in Common, never invents timeshare', () => {
    expect(publishListingShareKind('Tenancy in Common')).toBe('Tenancy in common')
    expect(publishListingShareKind('Tenancy in Common')).not.toMatch(/timeshare/i)
    expect(publishListingShareKind('Tenancy in Common')).not.toMatch(/fractional/i)
  })

  it('labels a true Timeshare subtype', () => {
    expect(publishListingShareKind('Timeshare')).toBe('Timeshare')
  })

  it('withholds fee-simple and empty subtypes', () => {
    expect(publishListingShareKind('Single Family Residence')).toBeNull()
    expect(publishListingShareKind('Condominium')).toBeNull()
    expect(publishListingShareKind(null)).toBeNull()
    expect(publishListingShareKind('')).toBeNull()
  })
})

describe('publishListingSharePricePerSqft', () => {
  const feeSimple = (pricePerSqft: number | null) => ({
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    pricePerSqft,
  })

  it('withholds $4/sqft and $3/sqft on the Snowgoose share rows', () => {
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'A',
        propertySubType: 'Tenancy in Common',
        pricePerSqft: 3.56,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'A',
        propertySubType: 'Tenancy in Common',
        pricePerSqft: 2.57,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'A',
        propertySubType: 'Timeshare',
        pricePerSqft: 4,
      }),
    ).toBeNull()
  })

  it('keeps fee-simple living-area ppsf', () => {
    expect(publishListingSharePricePerSqft(feeSimple(412))).toBe(412)
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'A',
        propertySubType: null,
        pricePerSqft: 412,
      }),
    ).toBe(412)
  })

  it('withholds a missing or non-positive ppsf', () => {
    expect(publishListingSharePricePerSqft(feeSimple(null))).toBeNull()
    expect(publishListingSharePricePerSqft(feeSimple(0))).toBeNull()
  })

  // 735 Purcell (MLS 220174840) is PropertyType 'G' — "Commercial Lease" in the
  // feed's own PropertyTypeLabel — so its ListPrice 2.5 is rent per square foot.
  it('withholds $/sqft on a commercial lease, whatever the arithmetic says', () => {
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'G',
        propertySubType: null,
        pricePerSqft: 3.26,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        propertyType: 'g',
        propertySubType: null,
        pricePerSqft: 500,
      }),
    ).toBeNull()
  })

  // 220218225 Redmond: $500 over 1,405 sq ft is 0.36, which the whole-dollar
  // publisher would print as "$0 per square foot".
  it('withholds a figure that would publish as $0', () => {
    expect(publishListingSharePricePerSqft(feeSimple(0.36))).toBeNull()
    expect(publishListingSharePricePerSqft(feeSimple(0.49))).toBeNull()
    expect(publishListingSharePricePerSqft(feeSimple(0.5))).toBe(1)
  })

  // An in-park manufactured home in Grants Pass at $8,500 over 784 sq ft really
  // is $10.84 per square foot. A blanket "too cheap" floor would delete a
  // verified figure, which section 0 forbids as firmly as a wrong one.
  it('keeps a low but real figure', () => {
    expect(publishListingSharePricePerSqft({ ...feeSimple(10.84), propertySubType: 'In Park', propertyType: 'B' })).toBe(11)
    expect(publishListingSharePricePerSqft({ ...feeSimple(7.45), propertyType: 'F' })).toBe(7)
  })
})
