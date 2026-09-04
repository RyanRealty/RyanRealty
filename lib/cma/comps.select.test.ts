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

const divideSpy = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/lib/pricing/divides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pricing/divides')>()
  return {
    ...actual,
    crossesMajorDivide: divideSpy,
  }
})

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

describe('selectComps — the fallback ladder carries the divide cut (D5)', () => {
  // The facts ladder has refused to cross US-97 / Bend Parkway / the Deschutes
  // since divides.ts shipped. This FALLBACK ladder silently dropped the cut,
  // which is how 828 Florida (west of the Parkway) was priced from Archie
  // Briggs / Star Ridge / Rimrock sales across it. The wiring is what this
  // pins; the bank logic itself is tested in lib/pricing/divides.test.ts.
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    divideSpy.mockReset()
  })

  it('excludes a comp on the other side of the divide and counts it', async () => {
    divideSpy.mockReturnValue(true)
    selectCmaCompsPool.mockResolvedValue([closedRow()])
    const sel = await selectComps(subject())
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.excluded_totals.crossed_divide).toBeGreaterThan(0)
  })

  it('admits the same comp when no divide is crossed', async () => {
    divideSpy.mockReturnValue(false)
    selectCmaCompsPool.mockResolvedValue([closedRow()])
    const sel = await selectComps(subject())
    expect(sel.comps.length).toBeGreaterThan(0)
  })
})

describe('selectComps — a condo building is not "self" (the 363 Bluff starvation)', () => {
  // The bare address equality dropped 20 of the Plaza's own building sales as
  // "the subject's own listing" — the best comp set a condo has — and starved
  // the build to one comp. Same address is self only when the UNIT matches.
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    divideSpy.mockReset()
    divideSpy.mockReturnValue(false)
  })

  const condoSubject = () =>
    subject({
      streetAddress: '363 Bluff',
      propertySubType: 'Condominium',
      unitNumber: '204',
    })

  it('admits a different unit at the same address', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({ StreetNumber: '363', StreetName: 'Bluff', unit_number: '103', property_sub_type: 'Condominium' }),
    ])
    const sel = await selectComps(condoSubject())
    expect(sel.comps).toHaveLength(1)
  })

  it('still drops the subject unit itself', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({ StreetNumber: '363', StreetName: 'Bluff', unit_number: '204', property_sub_type: 'Condominium', ListingKey: 'other-key' }),
    ])
    const sel = await selectComps(condoSubject())
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.excluded_totals.self).toBeGreaterThan(0)
  })

  it('an attached subject with NO unit on either side admits — ListingKey already catches the true self', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({ StreetNumber: '363', StreetName: 'Bluff', property_sub_type: 'Condominium' }),
    ])
    const sel = await selectComps(subject({ streetAddress: '363 Bluff', propertySubType: 'Condominium' }))
    expect(sel.comps).toHaveLength(1)
  })

  it('hard-refuses listings SQL tiers for a 2024 custom Rim View subject', async () => {
    // Even if the pool would return Summit stock, custom/new must not walk
    // subdivision/competing-area/citywide SQL tiers (prod #187 still showed them).
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'SUMMIT',
        StreetNumber: '1990',
        StreetName: 'Summit',
        year_built: 1990,
        TotalLivingAreaSqFt: 4800,
        lot_size_acres: 2,
        BedroomsTotal: 4,
        BathroomsTotal: 4,
      }),
      closedRow({
        ListingKey: 'NORTH_RIM',
        StreetNumber: '61225',
        StreetName: 'Brosterhous',
        year_built: 2022,
        TotalLivingAreaSqFt: 5100,
        lot_size_acres: 2.1,
        BedroomsTotal: 4,
        BathroomsTotal: 4,
        public_remarks: 'Custom built modern home.',
      }),
    ])
    const sel = await selectComps(
      subject({
        streetAddress: '19365 Rim View',
        yearBuilt: 2024,
        newConstructionYn: true,
        sqft: 4972,
        lotAcres: 2,
        beds: 4,
        baths: 4,
        publicRemarks:
          'Introducing a stunning mid-century modern home perched over a turn in Tumalo Creek. This to-be-built masterpiece offers 4 beds.',
        propertySubType: 'Single Family Residence',
      }),
    )
    expect(selectCmaCompsPool).not.toHaveBeenCalled()
    expect(sel.comps).toHaveLength(0)
    expect(sel.tiersUsed).toEqual([])
    expect(sel.pricingSource).toBe('facts')
    expect(sel.diagnostics.pricing_source).toBe('facts')
    expect(sel.diagnostics.custom_or_new).toBe(true)
    expect(sel.diagnostics.ladder).toEqual([])
    expect(sel.diagnostics.tiers_used).toEqual([])
    expect(sel.trace.join(' ')).toMatch(/listings SQL ladder is disabled/i)
  })

  it('hard-refuses listings SQL for unmapped Rim View even when pool has Perspective peers', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'PERSPECTIVE',
        StreetNumber: '2060',
        StreetName: 'Perspective',
        year_built: 2023,
        TotalLivingAreaSqFt: 3963,
        lot_size_acres: 1.19,
        BedroomsTotal: 4,
        BathroomsTotal: 3,
        public_remarks: 'Custom built modern home.',
        Latitude: 44.086736,
        Longitude: -121.342439,
        CloseDate: '2025-07-31',
        ClosePrice: 3300000,
      }),
    ])
    const sel = await selectComps(
      subject({
        streetAddress: '19365 Rim View',
        yearBuilt: 2024,
        newConstructionYn: true,
        sqft: 4972,
        lotAcres: 2,
        beds: 4,
        baths: 4,
        publicRemarks:
          'Introducing a stunning mid-century modern home perched over Tumalo Creek.',
        propertySubType: 'Single Family Residence',
        latitude: 44.1005,
        longitude: -121.356541,
      }),
    )
    expect(selectCmaCompsPool).not.toHaveBeenCalled()
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.ladder).toEqual([])
    expect(sel.diagnostics.pricing_source).toBe('facts')
    expect(sel.diagnostics.custom_or_new).toBe(true)
  })

  it('does not keep a dry acreage sale for an irrigated subject', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'DRY',
        StreetNumber: '10',
        StreetName: 'Dry',
        lot_size_acres: 10,
        TotalLivingAreaSqFt: 2000,
        public_remarks: 'Dry lot. No irrigation.',
      }),
      closedRow({
        ListingKey: 'WET',
        StreetNumber: '11',
        StreetName: 'Irrigated',
        lot_size_acres: 12,
        TotalLivingAreaSqFt: 2100,
        public_remarks: 'Irrigated pasture with water rights.',
      }),
    ])
    const sel = await selectComps(
      subject({
        lotAcres: 10,
        sqft: 2000,
        publicRemarks: 'Irrigated hay ground.',
      }),
      { subjectIrrigation: 'irrigated' },
    )
    expect(sel.comps.map((c) => c.listingKey)).toEqual(['WET'])
    expect(sel.diagnostics.excluded_totals.acreage_infrastructure).toBeGreaterThan(0)
  })

  it('a DETACHED subject at the same bare address stays self — that is what the check always meant there', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({ StreetNumber: '1', StreetName: 'Main', ListingKey: 'prior-sale-of-subject' }),
    ])
    const sel = await selectComps(subject({ streetAddress: '1 Main' }))
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.excluded_totals.self).toBeGreaterThan(0)
  })
})
