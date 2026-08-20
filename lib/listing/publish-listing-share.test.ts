import { describe, expect, it } from 'vitest'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from './publish-listing-share'

/** A listing nowhere near a registered fractional-interest property. */
const ELSEWHERE = { subdivisionName: 'Awbrey Butte', city: 'Bend', listNumber: '220000000' }

/** MLS 220222478 — Cabin 10 unit U3, "1/4 share in Camp Sherman!". */
const LAKE_CREEK_CABIN_10 = {
  propertySubType: 'Condominium',
  subdivisionName: 'Lake Creek Lodge',
  city: 'Camp Sherman',
  listNumber: '220222478',
}

describe('publishListingShareKind', () => {
  it('labels Snowgoose Tenancy in Common, never invents timeshare', () => {
    const subject = { ...ELSEWHERE, propertySubType: 'Tenancy in Common' }
    expect(publishListingShareKind(subject)).toBe('Tenancy in common')
    expect(publishListingShareKind(subject)).not.toMatch(/timeshare/i)
    expect(publishListingShareKind(subject)).not.toMatch(/fractional/i)
  })

  it('labels a true Timeshare subtype', () => {
    expect(publishListingShareKind({ ...ELSEWHERE, propertySubType: 'Timeshare' })).toBe('Timeshare')
  })

  it('labels a registry row the feed files as Condominium', () => {
    // Without this the page prints "$159,900" bare, and the ask is only
    // publishable because a share label sits beside it.
    expect(publishListingShareKind(LAKE_CREEK_CABIN_10)).toBe('Fractional interest')
    expect(
      publishListingShareKind({
        propertySubType: 'Multi Family',
        subdivisionName: 'Inn Of The 7th',
        city: 'Bend',
        listNumber: '220216423',
      }),
    ).toBe('Fractional interest')
  })

  it('withholds fee-simple and empty subtypes', () => {
    expect(
      publishListingShareKind({ ...ELSEWHERE, propertySubType: 'Single Family Residence' }),
    ).toBeNull()
    expect(publishListingShareKind({ ...ELSEWHERE, propertySubType: 'Condominium' })).toBeNull()
    expect(publishListingShareKind({ ...ELSEWHERE, propertySubType: null })).toBeNull()
    expect(publishListingShareKind({ ...ELSEWHERE, propertySubType: '' })).toBeNull()
  })

  it('withholds on the resort listing itself', () => {
    expect(
      publishListingShareKind({
        propertySubType: null,
        subdivisionName: 'Lake Creek Lodge',
        city: 'Camp Sherman',
        listNumber: '220224690',
      }),
    ).toBeNull()
  })
})

describe('publishListingSharePricePerSqft', () => {
  const feeSimple = (pricePerSqft: number | null) => ({
    ...ELSEWHERE,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    pricePerSqft,
  })

  it('withholds $4/sqft and $3/sqft on the Snowgoose share rows', () => {
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
        propertyType: 'A',
        propertySubType: 'Tenancy in Common',
        pricePerSqft: 3.56,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
        propertyType: 'A',
        propertySubType: 'Tenancy in Common',
        pricePerSqft: 2.57,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
        propertyType: 'A',
        propertySubType: 'Timeshare',
        pricePerSqft: 4,
      }),
    ).toBeNull()
  })

  // 220222478 published "$185 /sqft" — a quarter-share price over the whole
  // cabin's 866 sq ft. The sub-type-only rule published it.
  it('withholds $185/sqft on the Lake Creek Lodge quarter share', () => {
    expect(
      publishListingSharePricePerSqft({
        ...LAKE_CREEK_CABIN_10,
        propertyType: 'A',
        pricePerSqft: 184.64,
      }),
    ).toBeNull()
    // The same figure on a condo anywhere else still publishes.
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
        propertyType: 'A',
        propertySubType: 'Condominium',
        pricePerSqft: 184.64,
      }),
    ).toBe(185)
  })

  it('keeps fee-simple living-area ppsf', () => {
    expect(publishListingSharePricePerSqft(feeSimple(412))).toBe(412)
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
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
        ...ELSEWHERE,
        propertyType: 'G',
        propertySubType: null,
        pricePerSqft: 3.26,
      }),
    ).toBeNull()
    expect(
      publishListingSharePricePerSqft({
        ...ELSEWHERE,
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
