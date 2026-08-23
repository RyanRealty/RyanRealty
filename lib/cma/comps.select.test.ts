import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'

const { selectCmaCompsPool, selectCmaCompsByKeys } = vi.hoisted(() => ({
  selectCmaCompsPool: vi.fn(async () => [] as CmaListingRow[]),
  selectCmaCompsByKeys: vi.fn(async () => [] as CmaListingRow[]),
}))

vi.mock('@/lib/data', () => ({
  selectCmaCompsPool,
  selectCmaCompsByKeys,
}))

import { selectComps, selectCompsByKeys } from '@/lib/cma/comps'

const subject = (over: Partial<CmaSubject> = {}): CmaSubject =>
  ({
    listingKey: 'subj',
    mlsNumber: null,
    streetAddress: '1 Main',
    city: 'Bend',
    postalCode: null,
    subdivision: null,
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2000,
    ...over,
  }) as unknown as CmaSubject

function closedRow(over: Record<string, unknown> = {}): CmaListingRow {
  return {
    ListingKey: 'k1',
    ListNumber: '22000000',
    StreetNumber: '100',
    StreetName: 'Oak',
    City: 'Bend',
    SubdivisionName: 'Kenwood',
    Latitude: 44.051,
    Longitude: -121.301,
    property_sub_type: 'Single Family Residence',
    ClosePrice: 500000,
    CloseDate: '2026-06-01',
    TotalLivingAreaSqFt: 2000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    lot_size_acres: 0.2,
    ...over,
  }
}

describe('selectComps — SQL filter follows the subject product type', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsPool.mockResolvedValue([])
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
  })

  it('asks the pool for SFR on a detached subject', async () => {
    await selectComps(subject({ propertySubType: 'Single Family Residence' }))
    expect(selectCmaCompsPool.mock.calls.length).toBeGreaterThan(0)
    for (const [opts] of selectCmaCompsPool.mock.calls) {
      expect(opts.propertySubType).toBe('Single Family Residence')
    }
  })

  it('asks the pool for Townhouse on a townhouse subject, never SFR', async () => {
    const result = await selectComps(subject({ propertySubType: 'Townhouse' }))
    expect(selectCmaCompsPool.mock.calls.length).toBeGreaterThan(0)
    for (const [opts] of selectCmaCompsPool.mock.calls) {
      expect(opts.propertySubType).toBe('Townhouse')
      expect(opts.propertySubType).not.toBe('Single Family Residence')
    }
    expect(result.trace.some((t) => t.includes("property_sub_type='Townhouse'"))).toBe(true)
    expect(result.trace.some((t) => t.includes("property_sub_type='Single Family Residence'"))).toBe(false)
  })

  it('still drops a townhouse row in JS when the pool is mixed', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({ ListingKey: 'sfr', StreetNumber: '100', property_sub_type: 'Single Family Residence' }),
      closedRow({ ListingKey: 'th', StreetNumber: '200', property_sub_type: 'Townhouse' }),
    ])
    const result = await selectComps(subject({ propertySubType: 'Single Family Residence' }))
    expect(result.comps.every((c) => c.propertySubType === 'Single Family Residence')).toBe(true)
    expect(result.comps.some((c) => c.listingKey === 'th')).toBe(false)
    expect(result.diagnostics.excluded_totals.product_type).toBeGreaterThan(0)
  })
})

describe('selectCompsByKeys — JS product-type filter still applies', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
  })

  it('drops a townhouse key for a detached subject', async () => {
    selectCmaCompsByKeys.mockResolvedValue([
      closedRow({ ListingKey: 'sfr', property_sub_type: 'Single Family Residence' }),
      closedRow({ ListingKey: 'th', StreetNumber: '200', property_sub_type: 'Townhouse' }),
    ])
    const result = await selectCompsByKeys(subject({ propertySubType: 'Single Family Residence' }), ['sfr', 'th'])
    expect(result.comps.map((c) => c.listingKey)).toEqual(['sfr'])
  })
})
