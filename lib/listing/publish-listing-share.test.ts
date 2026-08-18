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
  it('withholds $4/sqft and $3/sqft on the Snowgoose share rows', () => {
    expect(publishListingSharePricePerSqft('Tenancy in Common', 3.56)).toBeNull()
    expect(publishListingSharePricePerSqft('Tenancy in Common', 2.57)).toBeNull()
    expect(publishListingSharePricePerSqft('Timeshare', 4)).toBeNull()
  })

  it('keeps fee-simple living-area ppsf', () => {
    expect(publishListingSharePricePerSqft('Single Family Residence', 412)).toBe(412)
    expect(publishListingSharePricePerSqft(null, 412)).toBe(412)
  })

  it('withholds a missing or non-positive ppsf', () => {
    expect(publishListingSharePricePerSqft('Single Family Residence', null)).toBeNull()
    expect(publishListingSharePricePerSqft('Single Family Residence', 0)).toBeNull()
  })
})
