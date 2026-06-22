import { describe, it, expect } from 'vitest'
import {
  isActiveForSaleStatus,
  classifyInventoryPropertyType,
  isResidentialInventoryType,
} from './inventory-filters'

// These drive inventory counts on city/market surfaces. A misclassification shifts
// the headline "N homes for sale" number. Characterization test that locks
// current behavior. Audit p3.2.
describe('isActiveForSaleStatus', () => {
  it('treats empty/unknown as active (inclusive default)', () => {
    expect(isActiveForSaleStatus('')).toBe(true)
    expect(isActiveForSaleStatus(null)).toBe(true)
    expect(isActiveForSaleStatus(undefined)).toBe(true)
  })
  it('matches active / for sale / coming soon (case-insensitive)', () => {
    expect(isActiveForSaleStatus('Active')).toBe(true)
    expect(isActiveForSaleStatus('For Sale')).toBe(true)
    expect(isActiveForSaleStatus('Coming Soon')).toBe(true)
  })
  it('rejects closed / pending / sold', () => {
    expect(isActiveForSaleStatus('Closed')).toBe(false)
    expect(isActiveForSaleStatus('Pending')).toBe(false)
    expect(isActiveForSaleStatus('Sold')).toBe(false)
  })
})

describe('classifyInventoryPropertyType', () => {
  it('buckets single-family (incl. plain "residential" + detached)', () => {
    expect(classifyInventoryPropertyType('Single Family Residence')).toBe('single_family')
    expect(classifyInventoryPropertyType('Residential')).toBe('single_family')
    expect(classifyInventoryPropertyType('Detached')).toBe('single_family')
  })
  it('buckets condo/townhome, manufactured/mobile, land/lot', () => {
    expect(classifyInventoryPropertyType('Condominium')).toBe('condo_townhome')
    expect(classifyInventoryPropertyType('Townhouse')).toBe('condo_townhome')
    expect(classifyInventoryPropertyType('Manufactured Home')).toBe('manufactured_mobile')
    expect(classifyInventoryPropertyType('Mobile Home')).toBe('manufactured_mobile')
    expect(classifyInventoryPropertyType('Vacant Lot')).toBe('land_lot')
    expect(classifyInventoryPropertyType('Acreage')).toBe('land_lot')
  })
  it('falls back to other for empty/unrecognized', () => {
    expect(classifyInventoryPropertyType('')).toBe('other')
    expect(classifyInventoryPropertyType(null)).toBe('other')
    expect(classifyInventoryPropertyType('Commercial')).toBe('other')
  })
})

describe('isResidentialInventoryType', () => {
  // Everything EXCEPT land/lot counts as residential (note: "other" is included).
  it('includes homes; excludes land/lot', () => {
    expect(isResidentialInventoryType('Single Family Residence')).toBe(true)
    expect(isResidentialInventoryType('Condominium')).toBe(true)
    expect(isResidentialInventoryType('Manufactured Home')).toBe(true)
    expect(isResidentialInventoryType('Vacant Lot')).toBe(false)
    expect(isResidentialInventoryType('Acreage')).toBe(false)
  })
})
