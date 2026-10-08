import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'

const { selectCmaCompsPool, selectCmaCompsByKeys } = vi.hoisted(() => ({
  // Typed with its options bag so a test can assert what the selector asked the
  // pool for (segment, sqft band), not merely that it was called.
  selectCmaCompsPool: vi.fn(async (_opts: Record<string, unknown>) => [] as CmaListingRow[]),
  selectCmaCompsByKeys: vi.fn(async (_keys?: unknown) => [] as CmaListingRow[]),
}))

vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/cma/builderReads', () => ({
  selectCmaCompsPool,
  selectCmaCompsByKeys,
}))
// Hoisted so the walk-to-7 tests can hand the subject a touching plat; every
// other test keeps the default: no ring, no plat on any row.
const ringMocks = vi.hoisted(() => ({
  getSubdivisionRing: vi.fn(async (): Promise<unknown> => null),
  assignSubdivisionSlugs: vi.fn(async (pts: ReadonlyArray<unknown>): Promise<Array<string | null>> => pts.map(() => null)),
}))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  getSubdivisionRing: ringMocks.getSubdivisionRing,
  assignSubdivisionSlugs: ringMocks.assignSubdivisionSlugs,
  assignCommunitySlugs: async () => null,
}))

// The touching plats' recorded outline (the plat-family footprint DAL). The
// adjacent rung's read is bounded by its box (2026-10-08); unmocked it would
// reach the live database from a unit test.
const TOUCHING_OUTLINE = {
  type: 'Polygon' as const,
  coordinates: [[[-121.31, 44.04], [-121.29, 44.04], [-121.29, 44.06], [-121.31, 44.06], [-121.31, 44.04]]],
}
const TOUCHING_BOUNDS = { latMin: 44.04, latMax: 44.06, lngMin: -121.31, lngMax: -121.29 }
const footprintMock = vi.hoisted(() => ({
  getPlatFamilyFootprint: vi.fn(async (_input: { familySlug: string; memberSlugs: readonly string[] }): Promise<unknown> => null),
}))
vi.mock('@/lib/data/subdivisions/getPlatFamilyFootprint', () => ({
  getPlatFamilyFootprint: footprintMock.getPlatFamilyFootprint,
}))

vi.mock('@/lib/cma/hydrate-closed-comp-dom', () => ({
  hydrateClosedCompDaysOnMarket: async <T,>(comps: T) => comps,
}))

const divideSpy = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/lib/pricing/divides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pricing/divides')>()
  return {
    ...actual,
    crossesMajorDivide: divideSpy,
  }
})

// Wraps (not stubs) the real keepTightestByClosePrice so selectComps still
// culls for real; this just records what asOf it was called with, to prove
// the CMA's own as-of date (WP5 item d) reaches the final cull instead of
// being dropped on the floor.
const keepTightestSpy = vi.hoisted(() => vi.fn())
vi.mock('@/lib/pricing/ladder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pricing/ladder')>()
  return {
    ...actual,
    keepTightestByClosePrice: (...args: Parameters<typeof actual.keepTightestByClosePrice>) => {
      keepTightestSpy(...args)
      return actual.keepTightestByClosePrice(...args)
    },
  }
})

import { selectComps, selectCompsByKeys } from '@/lib/cma/comps'
import { marketAreaBounds } from '@/lib/cma/market-area'

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

  it('drops a new build against an ordinary resale of the same subtype', async () => {
    const year = new Date().getFullYear()
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'new-build',
        StreetNumber: '200',
        property_sub_type: 'Townhouse',
        year_built: year,
        TotalLivingAreaSqFt: 1800,
      }),
      closedRow({
        ListingKey: 'resale',
        StreetNumber: '300',
        property_sub_type: 'Townhouse',
        year_built: year - 12,
        TotalLivingAreaSqFt: 1800,
      }),
    ])
    const result = await selectComps(
      subject({ propertySubType: 'Townhouse', yearBuilt: year - 11, sqft: 1800 }),
    )
    expect(result.comps.map((c) => c.listingKey)).toContain('resale')
    expect(result.comps.map((c) => c.listingKey)).not.toContain('new-build')
    expect(result.diagnostics.excluded_totals.year_quality).toBeGreaterThan(0)
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

describe('selectComps — CMA as-of date reaches the final cull (WP5 item d)', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsPool.mockResolvedValue([closedRow()])
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
    keepTightestSpy.mockClear()
  })

  it('passes opts.asOf through to keepTightestByClosePrice — a back-dated CMA ranks by its own date, not today', async () => {
    await selectComps(subject(), { asOf: '2024-01-15' })
    expect(keepTightestSpy).toHaveBeenCalled()
    const lastArgs = keepTightestSpy.mock.calls.at(-1)!
    expect(lastArgs[2]).toBe('2024-01-15')
  })

  it('defaults asOf to today when the caller supplies none, so the staleness penalty runs on every path (review 2026-10-07)', async () => {
    // The dry run, the BPO engine, place comps and the sell page call
    // selectCompsPreferringFacts with no asOf; they must cull as a build made
    // today does (lib/cma/build.ts passes the build date).
    await selectComps(subject())
    expect(keepTightestSpy).toHaveBeenCalled()
    const lastArgs = keepTightestSpy.mock.calls.at(-1)!
    expect(lastArgs[2]).toBe(new Date().toISOString().slice(0, 10))
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

  it('blocks a Redmond sale across US-97 when both sides are unmapped (D11)', async () => {
    // Diamond Bar Ranch vs The Meadows. divides.ts fails open; the centerline must not.
    divideSpy.mockReturnValue(false)
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'meadows',
        StreetNumber: '757',
        StreetName: 'Maple',
        City: 'Redmond',
        SubdivisionName: 'The Meadows',
        Latitude: 44.292272,
        Longitude: -121.175827,
      }),
    ])
    const sel = await selectComps(
      subject({
        streetAddress: '2465 7th',
        city: 'Redmond',
        subdivision: 'Diamond Bar Ranch',
        latitude: 44.298938,
        longitude: -121.162046,
      }),
    )
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.excluded_totals.crossed_divide).toBeGreaterThan(0)
  })

  it('blocks a Hayden Ranch frontage sale from an interior Diamond Bar subject', async () => {
    divideSpy.mockReturnValue(false)
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'hayden',
        StreetNumber: '1345',
        StreetName: '3rd',
        City: 'Redmond',
        SubdivisionName: 'Hayden Ranch Estates',
        Latitude: 44.289136,
        Longitude: -121.166287,
      }),
    ])
    const sel = await selectComps(
      subject({
        streetAddress: '2465 7th',
        city: 'Redmond',
        subdivision: 'Diamond Bar Ranch',
        latitude: 44.298938,
        longitude: -121.162046,
      }),
    )
    expect(sel.comps).toHaveLength(0)
    expect(sel.diagnostics.excluded_totals.crossed_divide).toBeGreaterThan(0)
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

describe('selectComps — resale past the waiting period reads the new-construction flag', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsPool.mockResolvedValue([])
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
  })

  it('drops a never-owned 2023 sale that the year alone would not call a new build', async () => {
    selectCmaCompsPool.mockResolvedValue([
      closedRow({
        ListingKey: 'never-owned-2023',
        StreetNumber: '200',
        year_built: 2023,
        new_construction_yn: true,
        TotalLivingAreaSqFt: 1800,
        property_sub_type: 'Townhouse',
      }),
      closedRow({
        ListingKey: 'resale-2016',
        StreetNumber: '300',
        year_built: 2016,
        new_construction_yn: false,
        TotalLivingAreaSqFt: 1800,
        property_sub_type: 'Townhouse',
      }),
    ])
    const result = await selectComps(
      subject({ propertySubType: 'Townhouse', yearBuilt: 2018, newConstructionYn: false, sqft: 1800 }),
      { asOf: '2026-08-01' },
    )
    expect(result.comps.map((c) => c.listingKey)).toContain('resale-2016')
    expect(result.comps.map((c) => c.listingKey)).not.toContain('never-owned-2023')
  })
})

describe('selectComps — walk to 7, price on 5+ (Matt 2026-10-07)', () => {
  // The listings ladder for a named plat walks subdivision-6mo, -12mo, -18mo,
  // -24mo (own ground, the same area across its whole window), then the
  // touching plats at 6, 12, 18 and 24 months (a wider area). Once the set
  // holds five, no rung that widens the area runs. Every sale admitted before
  // five keeps its seat. Seats six and seven come only from own ground,
  // newest closes first, then nearest (Matt 2026-10-07); a widening rung adds
  // only the shortfall to five, its tightest prices first.
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  const SIX_MO = daysAgo(60)
  const TWELVE_MO = daysAgo(240)
  const plat = (key: string, i: number, closePrice: number, closeDate: string) =>
    closedRow({ ListingKey: key, StreetNumber: String(100 + i), ClosePrice: closePrice, CloseDate: closeDate })
  const touching = (key: string, i: number, closePrice: number, closeDate: string) =>
    closedRow({
      ListingKey: key,
      StreetNumber: String(500 + i),
      StreetName: 'Aubrey',
      SubdivisionName: 'Aubrey',
      ClosePrice: closePrice,
      CloseDate: closeDate,
    })
  const kenwood = subject({ subdivision: 'Kenwood' })
  const PLAT_TIERS = ['subdivision-6mo', 'subdivision-12mo', 'subdivision-18mo', 'subdivision-24mo']

  /**
   * The plat query answers with the plat's rows, the touching-plat query (no
   * subdivision, bounded by the touching plats' outline since 2026-10-08)
   * with the touching plat's, each by its own close-date window. The anchor
   * and pocket reads get nothing.
   */
  function poolOf(platRows: CmaListingRow[], touchingRows: CmaListingRow[] = []) {
    selectCmaCompsPool.mockImplementation(async (opts: Record<string, unknown>) => {
      const since = String(opts.closeDateGte ?? '')
      if (opts.subdivisionIlike === 'Kenwood') return platRows.filter((r) => String(r.CloseDate) >= since)
      if (JSON.stringify(opts.bounds) === JSON.stringify(TOUCHING_BOUNDS)) {
        return touchingRows.filter((r) => String(r.CloseDate) >= since)
      }
      return []
    })
  }
  const keys = (sel: Awaited<ReturnType<typeof selectComps>>) => sel.comps.map((c) => c.listingKey).sort()
  const ran = (sel: Awaited<ReturnType<typeof selectComps>>) => sel.diagnostics.ladder.filter((t) => t.ran).map((t) => t.tier)

  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
    ringMocks.getSubdivisionRing.mockImplementation(async () => ({
      homeSlug: 'kenwood',
      homeLabel: 'Kenwood',
      neighborhoodSlug: null,
      ring: [{ slug: 'aubrey', label: 'Aubrey', pointM: 10, rank: 1 }],
    }))
    ringMocks.assignSubdivisionSlugs.mockImplementation(async (pts: ReadonlyArray<unknown>) => pts.map(() => 'aubrey'))
    footprintMock.getPlatFamilyFootprint.mockImplementation(async () => ({ geometry: TOUCHING_OUTLINE }))
  })
  afterEach(() => {
    ringMocks.getSubdivisionRing.mockImplementation(async () => null)
    ringMocks.assignSubdivisionSlugs.mockImplementation(async (pts: ReadonlyArray<unknown>) => pts.map(() => null))
    footprintMock.getPlatFamilyFootprint.mockImplementation(async () => null)
  })

  it('reads the touching-plat rung inside the touching plats\' outline, and counts a row from another plat as not touching, not as outside the neighborhood (2026-10-08)', async () => {
    // Three plat sales, so the touching rung runs. Its read is bounded by the
    // outline's box at the 500-row page, never the 100 newest closes city-wide.
    // Two of its rows sit in a plat that does not touch Kenwood.
    poolOf(
      [0, 1, 2].map((i) => plat(`O${i}`, i, 500_000, SIX_MO)),
      [0, 1, 2, 3].map((i) => touching(`E${i}`, i, 500_000 + i * 1_000, SIX_MO)),
    )
    ringMocks.assignSubdivisionSlugs.mockImplementation(async (pts: ReadonlyArray<unknown>) =>
      pts.map((_p, i) => (i < 2 ? 'aubrey' : 'not-touching-plat')),
    )
    const sel = await selectComps(kenwood)
    expect(footprintMock.getPlatFamilyFootprint).toHaveBeenCalledWith({ familySlug: 'touching-kenwood', memberSlugs: ['aubrey'] })
    const touchingReads = selectCmaCompsPool.mock.calls
      .map(([opts]) => opts)
      .filter((opts) => JSON.stringify(opts.bounds) === JSON.stringify(TOUCHING_BOUNDS))
    expect(touchingReads.length).toBeGreaterThan(0)
    expect(touchingReads.every((opts) => opts.limit === 500 && opts.subdivisionIlike == null)).toBe(true)
    const rung = sel.diagnostics.ladder.find((t) => t.tier === 'adjacent-subdivision-6mo')!
    expect(rung.excluded.not_touching_plat).toBe(2)
    expect(rung.excluded.market_area).toBe(0)
    expect(keys(sel)).toEqual(['E0', 'E1', 'O0', 'O1', 'O2'])
  })

  it('falls back to the neighborhood box when the touching outline cannot be read', async () => {
    footprintMock.getPlatFamilyFootprint.mockImplementation(async () => {
      throw new Error('rpc down')
    })
    poolOf([0, 1, 2].map((i) => plat(`O${i}`, i, 500_000, SIX_MO)))
    const riverWest = subject({ subdivision: 'Kenwood', latitude: 44.0645, longitude: -121.3237 })
    await selectComps(riverWest)
    const riverWestBox = JSON.stringify(marketAreaBounds('bend-river-west'))
    const reads = selectCmaCompsPool.mock.calls.map(([opts]) => opts)
    expect(reads.some((opts) => JSON.stringify(opts.bounds) === riverWestBox && opts.limit === 500)).toBe(true)
    expect(reads.some((opts) => JSON.stringify(opts.bounds) === JSON.stringify(TOUCHING_BOUNDS))).toBe(false)
  })

  it('an over-full plat yields seven: newest first, then nearest, then the tightest price', async () => {
    // Every sale here closed the same day at the same spot, so the tie falls
    // to the close nearest the middle price.
    const central = [500_000, 502_000, 504_000, 506_000, 508_000, 510_000, 512_000]
    poolOf([
      ...central.map((price, i) => plat(`C${i}`, i, price, SIX_MO)),
      plat('LOW', 20, 470_000, SIX_MO),
      plat('HIGH1', 21, 545_000, SIX_MO),
      plat('HIGH2', 22, 550_000, SIX_MO),
    ])
    const sel = await selectComps(kenwood)
    expect(sel.comps).toHaveLength(7)
    expect(keys(sel)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
    expect(sel.diagnostics.candidates).toBe(10)
    expect(ran(sel)).toEqual(PLAT_TIERS)
  })

  it('own-plat sales from a longer window still compete after five is reached', async () => {
    poolOf(
      [
        ...[0, 1, 2, 3, 4].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
        ...[0, 1].map((i) => plat(`W${i}`, 10 + i, 502_000, TWELVE_MO)),
      ],
      [touching('ADJ', 0, 502_000, SIX_MO)],
    )
    const sel = await selectComps(kenwood)
    expect(keys(sel)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4', 'W0', 'W1'])
    expect(ran(sel)).toEqual(PLAT_TIERS)
  })

  it('once five is reached no touching-plat sale enters; a wider rung that reaches five exactly stays five', async () => {
    poolOf(
      [0, 1, 2].map((i) => plat(`O${i}`, i, 500_000, SIX_MO)),
      [
        ...[0, 1].map((i) => touching(`E${i}`, i, 501_000, SIX_MO)),
        // One window out, at the middle price.
        ...[0, 1, 2].map((i) => touching(`T${i}`, 10 + i, 500_000, TWELVE_MO)),
      ],
    )
    const sel = await selectComps(kenwood)
    expect(keys(sel)).toEqual(['E0', 'E1', 'O0', 'O1', 'O2'])
    expect(ran(sel)).toEqual([...PLAT_TIERS, 'adjacent-subdivision-6mo'])
    expect(sel.diagnostics.reached_target).toBe(true)
  })

  it('a wider rung that reaches five holding six gives five: it adds only what reaches five', async () => {
    poolOf(
      [0, 1].map((i) => plat(`O${i}`, i, 500_000, SIX_MO)),
      [
        ...[0, 1, 2, 3].map((i) => touching(`E${i}`, i, 500_000 + i * 1_000, SIX_MO)),
        ...[0, 1, 2].map((i) => touching(`T${i}`, 10 + i, 501_000, TWELVE_MO)),
      ],
    )
    const sel = await selectComps(kenwood)
    // Only what's needed (Matt 2026-10-07): the touching plat adds three, its
    // tightest prices, and never fills seats six and seven.
    expect(keys(sel)).toEqual(['E0', 'E1', 'E2', 'O0', 'O1'])
    expect(ran(sel)).toEqual([...PLAT_TIERS, 'adjacent-subdivision-6mo'])
  })

  // The review of 2026-10-07: the disclosures land in selection.trace, the
  // citations' comp_selection.trace, render_args.compTrace and the build
  // summary, so they must describe the printed set, not the candidates.
  const OLDER = 'Comps older than 6 months were used'
  const SHORT = 'Comps older than 6 months were used because the 6-month set did not reach the minimum'

  it('says nothing about older comps when every printed sale is inside six months, though a 12-month rung added two', async () => {
    poolOf([
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
      ...[0, 1].map((i) => plat(`W${i}`, 20 + i, 560_000, TWELVE_MO)),
    ])
    const sel = await selectComps(kenwood)
    expect(sel.diagnostics.ladder.find((t) => t.tier === 'subdivision-12mo')?.comps_added).toBe(2)
    expect(keys(sel)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'])
    expect(sel.trace.some((t) => t.startsWith(OLDER))).toBe(false)
    expect(sel.diagnostics.disclosures.some((d) => d.startsWith(OLDER))).toBe(false)
  })

  it('an older own-plat sale that kept a seat after five is disclosed without claiming the 6-month set fell short', async () => {
    poolOf([
      ...[0, 1, 2, 3, 4].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
      ...[0, 1].map((i) => plat(`W${i}`, 10 + i, 502_000, TWELVE_MO)),
    ])
    const sel = await selectComps(kenwood)
    expect(keys(sel)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4', 'W0', 'W1'])
    const line = sel.diagnostics.disclosures.find((d) => d.startsWith(OLDER))
    expect(line).toBe(
      "Comps older than 6 months were used. The 6-month set held 5 sales; the search reads this home's own ground across its whole window, out to 24 months, and keeps up to 7, newest first, so an older sale there kept a seat. Fannie Mae B4-1.3-08 requires this be stated.",
    )
    expect(sel.trace).toContain(line)
  })

  it('an older sale used because the 6-month set held fewer than five says so', async () => {
    poolOf([
      ...[0, 1, 2].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
      ...[0, 1].map((i) => plat(`W${i}`, 10 + i, 502_000, TWELVE_MO)),
    ])
    const sel = await selectComps(kenwood)
    expect(keys(sel)).toEqual(['F0', 'F1', 'F2', 'W0', 'W1'])
    expect(sel.diagnostics.disclosures.filter((d) => d.startsWith(SHORT))).toHaveLength(1)
  })

  it('own ground over seven keeps its newest closes, even when older sales sit nearer the middle price (Matt 2026-10-07)', async () => {
    poolOf([
      ...[470_000, 485_000, 500_000, 515_000, 530_000].map((price, i) => plat(`NEW${i}`, i, price, SIX_MO)),
      ...[0, 1, 2].map((i) => plat(`OLD${i}`, 20 + i, 500_000, TWELVE_MO)),
    ])
    const sel = await selectComps(kenwood)
    expect(sel.excludedOutliers).toHaveLength(0)
    // Five six-month sales and two of the three 12-month ones. The price-tight
    // cut would have dropped $470,000 or $530,000 and kept all three older sales.
    expect(sel.comps).toHaveLength(7)
    for (const key of ['NEW0', 'NEW1', 'NEW2', 'NEW3', 'NEW4']) expect(keys(sel)).toContain(key)
    expect(keys(sel).filter((k) => k.startsWith('OLD'))).toHaveLength(2)
  })

  it('the room line counts the printed set, not candidates the cap cut', async () => {
    const bath = (key: string, i: number, closePrice: number, closeDate: string) =>
      closedRow({ ListingKey: key, StreetNumber: String(300 + i), BathroomsTotal: 3, ClosePrice: closePrice, CloseDate: closeDate })
    poolOf([
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
      // One bath more, inside the plat: admitted, then cut by the cap.
      ...[0, 1, 2, 3].map((i) => bath(`BATH${i}`, i, 600_000, TWELVE_MO)),
    ])
    const cut = await selectComps(kenwood)
    expect(cut.diagnostics.candidates).toBe(11)
    expect(keys(cut)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'])
    expect(cut.trace.some((t) => t.includes('one bedroom or bathroom different'))).toBe(false)

    poolOf([
      ...[0, 1, 2, 3, 4].map((i) => plat(`F${i}`, i, 500_000 + i * 1_000, SIX_MO)),
      bath('BATH0', 0, 503_000, SIX_MO),
    ])
    const kept = await selectComps(kenwood)
    expect(keys(kept)).toContain('BATH0')
    expect(kept.diagnostics.disclosures.some((d) => d.startsWith('1 sale(s) are one bedroom or bathroom different'))).toBe(true)
  })

  it('a wider rung reaching five never costs an own-plat sale its seat to the outlier drop (both ladders seat own ground)', async () => {
    poolOf(
      [
        plat('O1', 0, 500_000, SIX_MO),
        plat('O2', 1, 505_000, SIX_MO),
        plat('O3', 2, 495_000, SIX_MO),
        plat('OHI', 3, 700_000, SIX_MO),
      ],
      [0, 1, 2, 3].map((i) => touching(`T${i}`, i, 500_000 + i * 1_000, SIX_MO)),
    )
    const sel = await selectComps(kenwood)
    expect(ran(sel)).toEqual([...PLAT_TIERS, 'adjacent-subdivision-6mo'])
    expect(sel.excludedOutliers).toHaveLength(0)
    // Own ground keeps all four seats; the touching plat adds the one sale
    // that reaches five.
    expect(keys(sel)).toEqual(['O1', 'O2', 'O3', 'OHI', 'T0'])
  })

  it('with no asOf the cull matches a build made today: a stale touching-plat sale pays the staleness penalty', async () => {
    // Three own-plat sales, then the 18-month touching rung reaches five
    // holding four and adds only two. At the middle price sit two sales from
    // about 16 months ago; $30,000 off it, two from just past a year. With
    // today's date the older pair pays the staleness penalty and gives up its
    // seats; with no date at all it did not, so the dry run and the fleet
    // scorer used to seat a different set than a build made today.
    const platRows = [0, 1, 2].map((i) => plat(`O${i}`, i, 500_000, daysAgo(40)))
    const touchingRows = [
      ...[0, 1].map((i) => touching(`STALE${i}`, i, 500_000, daysAgo(500))),
      ...[0, 1].map((i) => touching(`YEAR${i}`, 10 + i, 530_000, daysAgo(380))),
    ]
    poolOf(platRows, touchingRows)
    const today = await selectComps(kenwood, { asOf: new Date().toISOString().slice(0, 10) })
    poolOf(platRows, touchingRows)
    const omitted = await selectComps(kenwood)
    expect(ran(omitted)).toEqual([...PLAT_TIERS, 'adjacent-subdivision-6mo', 'adjacent-subdivision-12mo', 'adjacent-subdivision-18mo'])
    expect(keys(today)).toEqual(['O0', 'O1', 'O2', 'YEAR0', 'YEAR1'])
    expect(keys(omitted)).toEqual(keys(today))
  })

  it('own ground keeps its seats: the wider rung that reached five adds only the shortfall, its tightest prices', async () => {
    poolOf(
      [plat('E500', 0, 500_000, SIX_MO), plat('E545', 1, 545_000, SIX_MO)],
      [470_000, 480_000, 490_000, 500_000, 510_000, 520_000, 530_000, 540_000].map((price, i) =>
        touching(`T${price / 1000}`, 10 + i, price, SIX_MO),
      ),
    )
    const sel = await selectComps(kenwood)
    expect(ran(sel)).toEqual([...PLAT_TIERS, 'adjacent-subdivision-6mo'])
    expect(sel.excludedOutliers).toHaveLength(0)
    expect(sel.comps).toHaveLength(5)
    // $545,000 is the farthest close from the middle price, and it stays: it
    // is in this home's own plat, and the touching plat reached five. The
    // touching plat adds three, the ones nearest the middle price.
    expect(keys(sel)).toEqual(['E500', 'E545', 'T490', 'T500', 'T510'])
  })
})

describe('selectComps — a sale more than 25% off the subject never sets the price, on any rung (Matt 2026-10-08, 25% everywhere)', () => {
  // The listings ladder reads every plat rung at the 35% search band
  // (LOCATION_SQFT_BAND), so 2225 Indigo, 1,393 sqft against 2382 Jackson's
  // 2,016 (30.9% smaller), comes back from the plat query. Rule 20 refuses it
  // at the door: it is counted as not price-setting, never admitted, and four
  // own-plat setters do not reach five.
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  const RECENT = daysAgo(45)
  const jackson = subject({ subdivision: 'Kenwood', sqft: 2016 })
  const plat = (key: string, i: number, over: Record<string, unknown> = {}) =>
    closedRow({ ListingKey: key, StreetNumber: String(100 + i), TotalLivingAreaSqFt: 2016, ClosePrice: 500_000, CloseDate: RECENT, ...over })
  const indigo = plat('INDIGO', 9, { StreetNumber: '2225', StreetName: 'Indigo', TotalLivingAreaSqFt: 1393, ClosePrice: 345_000 })
  const keys = (sel: Awaited<ReturnType<typeof selectComps>>) => sel.comps.map((c) => c.listingKey).sort()

  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
  })

  function platPool(rows: CmaListingRow[]) {
    selectCmaCompsPool.mockImplementation(async (opts: Record<string, unknown>) =>
      opts.subdivisionIlike === 'Kenwood' ? rows : [],
    )
  }

  it('a 30.9% smaller plat sale is counted as not price-setting, never admitted, and four setters are a shortage', async () => {
    platPool([plat('A', 0), plat('B', 1), plat('C', 2), plat('D', 3), indigo])
    const sel = await selectComps(jackson)
    expect(keys(sel)).toEqual(['A', 'B', 'C', 'D'])
    expect(sel.comps.every((c) => c.setsPrice === true)).toBe(true)
    expect(sel.diagnostics.excluded_totals.not_price_setting).toBe(1)
    expect(sel.diagnostics.reached_target).toBe(false)
  })

  it('a 17.9% smaller plat sale still sets the price and reaches five', async () => {
    platPool([plat('A', 0), plat('B', 1), plat('C', 2), plat('D', 3), indigo, plat('FIFTH', 5, { TotalLivingAreaSqFt: 1655, ClosePrice: 410_000 })])
    const sel = await selectComps(jackson)
    expect(keys(sel)).toEqual(['A', 'B', 'C', 'D', 'FIFTH'])
    expect(sel.diagnostics.excluded_totals.not_price_setting).toBe(1)
    expect(sel.diagnostics.reached_target).toBe(true)
  })
})

describe('selectComps — a sale with an ADU never prices a home without one (Matt 2026-10-08, "ADU sale skips")', () => {
  // The listings ladder applies the same reader as the facts walk
  // (aduSaleRefused, lib/pricing/classes.ts), at the door, counted as
  // adu_sale, and the sale is skipped like one that never qualified.
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  const RECENT = daysAgo(45)
  const NORTON =
    'Excellent Midtown Bend multi-unit property featuring a permitted ADU, offering flexibility for a variety of living or investment possibilities. Both units feature attractive finishes and functional living spaces.'
  const PHEASANT =
    "Single level house in Midtown Bend on a huge lot with room to dream. Outside, you've got space to build an ADU, a 2 car garage, RV parking. Whether you're buying your first home, downsizing, or eyeing ADU rental income, this is a lot of house and land."
  const plat = (key: string, i: number, over: Record<string, unknown> = {}) =>
    closedRow({ ListingKey: key, StreetNumber: String(100 + i), ClosePrice: 500_000, CloseDate: RECENT, ...over })
  const norton = plat('NORTON', 9, { StreetNumber: '644', StreetName: 'Norton', public_remarks: NORTON })
  const keys = (sel: Awaited<ReturnType<typeof selectComps>>) => sel.comps.map((c) => c.listingKey).sort()

  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
    selectCmaCompsPool.mockImplementation(async (opts: Record<string, unknown>) =>
      opts.subdivisionIlike === 'Kenwood'
        ? [plat('A', 0), plat('B', 1), plat('C', 2), plat('D', 3), plat('E', 4), norton]
        : [],
    )
  })

  it('skips the ADU sale for a subject whose remarks only hope for one, and counts it', async () => {
    const sel = await selectComps(subject({ subdivision: 'Kenwood', publicRemarks: PHEASANT }))
    expect(keys(sel)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(sel.diagnostics.excluded_totals.adu_sale).toBeGreaterThan(0)
    expect(sel.diagnostics.excluded_totals.product_type).toBe(0)
    expect(sel.diagnostics.excluded_totals.not_price_setting).toBe(0)
    expect(sel.trace.some((t) => t.includes('whose remarks state an ADU'))).toBe(true)
  })

  it('keeps it for a subject whose remarks state its own ADU (not symmetric)', async () => {
    const sel = await selectComps(
      subject({ subdivision: 'Kenwood', publicRemarks: 'Craftsman with a permitted detached ADU over the garage.' }),
    )
    expect(keys(sel)).toContain('NORTON')
    expect(sel.diagnostics.excluded_totals.adu_sale).toBe(0)
  })
})
