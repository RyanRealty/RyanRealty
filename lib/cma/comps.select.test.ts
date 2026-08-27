import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'

const { selectCmaCompsPool, selectCmaCompsByKeys } = vi.hoisted(() => ({
  // Typed with its options bag so a test can assert what the selector asked the
  // pool for (segment, sqft band), not merely that it was called.
  selectCmaCompsPool: vi.fn(async (_opts: Record<string, unknown>) => [] as CmaListingRow[]),
  selectCmaCompsByKeys: vi.fn(async (_keys?: unknown) => [] as CmaListingRow[]),
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
    const detachedCalls = selectCmaCompsPool.mock.calls as unknown as Array<
      [{ propertySubType?: string }]
    >
    for (const [opts] of detachedCalls) {
      expect(opts.propertySubType).toBe('Single Family Residence')
    }
  })

  it('asks the pool for Townhouse on a townhouse subject, never SFR', async () => {
    const result = await selectComps(subject({ propertySubType: 'Townhouse' }))
    expect(selectCmaCompsPool.mock.calls.length).toBeGreaterThan(0)
    const townhouseCalls = selectCmaCompsPool.mock.calls as unknown as Array<
      [{ propertySubType?: string }]
    >
    for (const [opts] of townhouseCalls) {
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

describe('land selection — the four walls that silently returned zero comps', () => {
  const lot = (over: Record<string, unknown> = {}) =>
    closedRow({
      property_sub_type: 'Residential Lots',
      TotalLivingAreaSqFt: null,
      BedroomsTotal: null,
      BathroomsTotal: null,
      lot_size_acres: 0.24,
      ClosePrice: 210_000,
      ...over,
    })

  const landSubject = subject({
    sqft: null,
    lotAcres: 0.23,
    beds: null,
    baths: null,
    propertySubType: 'Residential Lots',
  } as Partial<CmaSubject>)

  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsPool.mockResolvedValue([])
  })

  it('does not bail on a subject with no living area', async () => {
    selectCmaCompsPool.mockResolvedValue([
      lot({ ListingKey: 'a', ClosePrice: 210_000 }),
      lot({ ListingKey: 'b', ClosePrice: 235_000, lot_size_acres: 0.22 }),
      lot({ ListingKey: 'c', ClosePrice: 199_000, lot_size_acres: 0.25 }),
    ])
    const sel = await selectComps(landSubject)
    expect(sel.comps.length).toBeGreaterThan(0)
    expect(sel.trace.join(' ')).not.toMatch(/prices a dwelling/)
  })

  it('queries MLS segment D with no living-area band', async () => {
    selectCmaCompsPool.mockResolvedValue([lot()])
    await selectComps(landSubject)
    const call = selectCmaCompsPool.mock.calls[0]![0]
    expect(call.propertyType).toBe('D')
    expect(call.sqftMin).toBeNull()
    expect(call.sqftMax).toBeNull()
  })

  it('keeps a land row that carries acreage but no square footage', async () => {
    // rowToComp's >=300 sqft floor rejected every land sale, which is what made
    // the pool return rows and the selector still produce nothing.
    selectCmaCompsPool.mockResolvedValue([lot(), lot({ ListingKey: 'b' }), lot({ ListingKey: 'c' })])
    const sel = await selectComps(landSubject)
    expect(sel.comps).not.toHaveLength(0)
    for (const c of sel.comps) expect(c.lotAcres).toBeGreaterThan(0)
  })

  it('still drops a land row with no acreage — that one has no size at all', async () => {
    selectCmaCompsPool.mockResolvedValue([lot({ lot_size_acres: null })])
    const sel = await selectComps(landSubject)
    expect(sel.comps).toHaveLength(0)
  })

  it('leaves an improved subject on segment A with its sqft band', async () => {
    selectCmaCompsPool.mockResolvedValue([closedRow()])
    await selectComps(subject())
    const call = selectCmaCompsPool.mock.calls[0]![0]
    expect(call.propertyType).toBe('A')
    expect(call.sqftMin).toBeGreaterThan(0)
    expect(call.sqftMax).toBeGreaterThan(0)
  })
})
