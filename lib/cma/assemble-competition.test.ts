import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaBandListingRow } from '@/lib/data/cma/bandInventory'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

/**
 * The count the competition sentence states is the count the table draws
 * (rule 17), because the assembly and the draw run ONE fit over ONE area
 * (Matt 2026-10-07, rule 24). The reads are mocked; everything between them
 * and the stored set is the real code.
 */

const getCmaAreaBandInventory = vi.fn()
const getCmaAreaUnsoldCycles = vi.hoisted(() => vi.fn(async () => null))
const getSubdivisionRing = vi.hoisted(() =>
  vi.fn(async () => ({
    homeSlug: 'old-bend-plat',
    homeLabel: 'Old Bend',
    neighborhoodSlug: 'bend-old-bend',
    ring: [] as Array<{
      slug: string
      label: string
      gapM: number
      pointM: number
      inNeighborhood: boolean | null
      rank: number
    }>,
  })),
)
const readNeighborRings = vi.hoisted(() =>
  vi.fn(async () => [] as Array<{
    homeSlug: string
    neighborhoodSlug?: string | null
    plats: Array<{ slug: string; gapM: number; pointM: number; inNeighborhood: boolean | null }>
  }>),
)

type AnyFn = (...args: unknown[]) => unknown
vi.mock('@/lib/data/cma/bandInventory', () => ({
  getCmaAreaBandInventory: (...args: unknown[]) => (getCmaAreaBandInventory as AnyFn)(...args),
}))
vi.mock('@/lib/data/cma/areaUnsoldReads', () => ({
  getCmaAreaUnsoldCycles: (...args: unknown[]) => (getCmaAreaUnsoldCycles as AnyFn)(...args),
}))
const getListingAskChanges = vi.fn(async (): Promise<Map<string, unknown[]>> => new Map())
vi.mock('@/lib/data/cma/localOutcomeReads', () => ({
  getListingAskChanges: (...args: unknown[]) => (getListingAskChanges as AnyFn)(...args),
}))
vi.mock('@/lib/cma/parcel-shapes', () => ({
  resolveCmaParcels: async () => null,
}))
vi.mock('@/lib/data/geo/subdivision-ring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/geo/subdivision-ring')>()
  return { ...actual, getSubdivisionRing, readNeighborRings }
})

import { assembleCompetition } from '@/lib/cma/assemble-competition'

// Inside the City of Bend's Old Bend polygon (bend-old-bend).
const OLD_BEND = { lat: 44.0554, lng: -121.3153 }

function subject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '1',
    streetAddress: '100 NW Subject',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: OLD_BEND.lat,
    longitude: OLD_BEND.lng,
    beds: 3,
    baths: 2,
    sqft: 1500,
    yearBuilt: 2015,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    standardStatus: 'Expired',
    lastListPrice: 420_000,
    ...over,
  } as CmaSubject
}

function comp(over: Partial<CmaAdjustedComp>): CmaAdjustedComp {
  return {
    listingKey: 'C',
    address: '1 Sold',
    closePrice: 400_000,
    closeDate: '2026-08-01',
    sqft: 1500,
    latitude: OLD_BEND.lat,
    longitude: OLD_BEND.lng,
    ...over,
  } as CmaAdjustedComp
}

function diagnostics(tiers: Array<{ tier: string; added: number }>, subdivision: string | null): CompSelectionDiagnostics {
  return {
    subject: { subdivision },
    ladder: tiers.map((t) => ({ tier: t.tier, ran: true, months_back: 6, comps_added: t.added })),
    rural_acreage: false,
    excluded_totals: {},
  } as unknown as CompSelectionDiagnostics
}

function row(over: Partial<CmaBandListingRow>): CmaBandListingRow {
  return {
    ListingKey: 'R',
    StreetNumber: '10',
    StreetName: 'NW Rival',
    ListPrice: 400_000,
    StandardStatus: 'Active',
    DaysOnMarket: 12,
    OnMarketDate: '2026-09-20',
    PhotoURL: null,
    Latitude: 44.056,
    Longitude: -121.316,
    property_sub_type: 'Single Family Residence',
    City: 'Bend',
    SubdivisionName: 'Old Bend',
    plat_slug: 'old-bend-plat',
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1500,
    year_built: 1925,
    lot_size_acres: 0.14,
    ...over,
  }
}

function inventory(input: {
  lo: number
  hi: number
  activeRows: CmaBandListingRow[]
  pendingRows: CmaBandListingRow[]
}) {
  return {
    area: null,
    lo: input.lo,
    hi: input.hi,
    activeRows: input.activeRows,
    pendingRows: input.pendingRows,
    activeCount: input.activeRows.length,
    pendingCount: input.pendingRows.length,
    activeAsks: input.activeRows.map((r) => Number(r.ListPrice)),
    activeDaysOnMarket: [],
    truncated: false,
    citation: {
      table: 'listings' as const,
      filter: `test area, ListPrice ${input.lo}..${input.hi}`,
      rows: input.activeRows.length + input.pendingRows.length,
      rowsAfterAreaTest: input.activeRows.length + input.pendingRows.length,
      fetchedAt: '2026-10-07T00:00:00.000Z',
      query: 'test',
      truncated: false,
    },
  }
}

/** Two printed sales in Old Bend, from the neighborhood rung, in two plats: the sales area is the Old Bend polygon. */
function oldBendArgs(s: CmaSubject) {
  return {
    subject: s,
    comps: [
      comp({ listingKey: 'C1', address: '1 NW Sold', subdivision: 'Highland Addition', selectionTier: 'neighborhood-6mo' }),
      comp({
        listingKey: 'C2',
        address: '2 NW Sold',
        subdivision: 'Aubrey Heights',
        selectionTier: 'neighborhood-6mo',
        latitude: 44.0558,
        longitude: -121.315,
      }),
    ],
    verdicts: [],
    diagnostics: diagnostics([{ tier: 'neighborhood-6mo', added: 2 }], null),
    recommended: 400_000,
    subjectZone: null,
    generatedAtIso: '2026-10-07T12:00:00.000Z',
  }
}

const DEFAULT_RING = {
  homeSlug: 'old-bend-plat',
  homeLabel: 'Old Bend',
  neighborhoodSlug: 'bend-old-bend',
  ring: [] as Array<{
    slug: string
    label: string
    gapM: number
    pointM: number
    inNeighborhood: boolean | null
    rank: number
  }>,
}

const PARK_ADDITION = {
  slug: 'park-addition',
  label: 'Park Addition',
  gapM: 0,
  pointM: 40,
  inNeighborhood: true,
  rank: 1,
}

describe('assembleCompetition: the sentence counts what the table draws (rule 17, rule 24)', () => {
  beforeEach(() => {
    getCmaAreaBandInventory.mockReset()
    getCmaAreaUnsoldCycles.mockReset()
    getCmaAreaUnsoldCycles.mockResolvedValue(null)
    getListingAskChanges.mockReset()
    getListingAskChanges.mockResolvedValue(new Map())
    getSubdivisionRing.mockReset()
    getSubdivisionRing.mockResolvedValue(DEFAULT_RING)
    readNeighborRings.mockReset()
    readNeighborRings.mockResolvedValue([])
  })

  it('draws the 1925 home on the recorded plat against a 2015 subject (year ranks, it does not refuse)', async () => {
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) =>
      inventory({ lo: q.lo, hi: q.hi, activeRows: [row({ ListingKey: 'OLD', year_built: 1925 })], pendingRows: [] }),
    )
    const out = await assembleCompetition(oldBendArgs(subject({ yearBuilt: 2015 })))
    expect(out.compArea?.kind).toBe('neighborhood')
    expect(out.compArea?.names).toEqual(['Old Bend'])
    // The assembly's count, the stored set's count, and the drawn table agree.
    expect(out.widestAreaInventory?.activeCount).toBe(1)
    expect(out.competitionRing?.activeCount).toBe(1)
    expect(out.bandRivals?.activeCount).toBe(1)
    expect(out.bandRivals?.rivals.map((r) => r.listingKey)).toEqual(['OLD'])
    expect(out.bandRivals?.sentence).toBe(
      '1 home like yours is for sale in Old Bend and the plats that touch it. None are under contract right now.',
    )
    expect(out.bandRivals?.sentence).not.toMatch(/between \$|[—–]/)
    expect(out.bandRivals?.bandBasis).toBeUndefined()
    expect(out.peerBand).toBeNull()
    expect(out.rivalBand).toEqual({ lo: 400_000, hi: 400_000 })
    expect(out.pool?.ownLabel).toBe('Old Bend')
    expect(out.pool?.openedNext).toBe(false)
    expect(getCmaAreaBandInventory).toHaveBeenCalledTimes(1)
    expect(getCmaAreaBandInventory).toHaveBeenCalledWith(expect.objectContaining({ lo: 1, hi: 50_000_000 }))
    expect(readNeighborRings).not.toHaveBeenCalled()
    const filter = out.widestAreaInventory?.citation.filter ?? ''
    expect(filter).toContain('The price was not a filter')
    expect(filter).toContain('The plats were')
    expect(filter).toContain('rankBestPool kept 1 of 1')
    expect(out.widestAreaInventory?.sameAreaFit).toBe(true)
    expect(getCmaAreaUnsoldCycles).toHaveBeenCalledWith(
      expect.objectContaining({ priceLo: 1, priceHi: 50_000_000, months: 36 }),
    )
  })

  it('stamps each printed competitor with its last stretch off its ask history (Matt 2026-10-08)', async () => {
    // 2260 Indigo's shape: Active Jan 29 at $670,000, back Jun 15 at $645,000, asking $550,000.
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) =>
      inventory({
        lo: q.lo,
        hi: q.hi,
        activeRows: [
          row({
            ListingKey: 'BACK',
            ListPrice: 400_000,
            OriginalListPrice: 470_000,
            OnMarketDate: '2026-06-15T16:16:30+00:00',
            original_on_market_timestamp: '2026-01-29T21:47:23+00:00',
            year_built: 1925,
          }),
        ],
        pendingRows: [],
      }),
    )
    getListingAskChanges.mockImplementationOnce(
      async () =>
        new Map([
          [
            'BACK',
            [
              { at: '2026-05-22T15:30:58+00:00', from: 470_000, to: 445_000 },
              { at: '2026-06-15T16:16:49+00:00', from: 445_000, to: 400_000 },
            ],
          ],
        ]),
    )
    const out = await assembleCompetition(oldBendArgs(subject({ yearBuilt: 2015 })))
    const [rival] = out.bandRivals?.rivals ?? []
    expect(rival?.stretch).toEqual({ from: '2026-06-15', firstAsk: 445_000, restarted: true })
    // The MLS original stays on the row; the letter prints the stretch's.
    expect(rival?.originalListPrice).toBe(470_000)
  })

  it('draws the 1978 pending a neighborhood area counted against a 1950 subject', async () => {
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) =>
      inventory({
        lo: q.lo,
        hi: q.hi,
        activeRows: [],
        pendingRows: [row({ ListingKey: 'P78', StandardStatus: 'Pending', year_built: 1978 })],
      }),
    )
    const out = await assembleCompetition(oldBendArgs(subject({ yearBuilt: 1950 })))
    expect(out.competitionRing?.pendingCount).toBe(1)
    expect(out.bandRivals?.pendingCount).toBe(1)
    expect(out.bandRivals?.rivals.map((r) => `${r.listingKey}:${r.status}`)).toEqual(['P78:Pending'])
    expect(out.bandRivals?.sentence).toBe(
      'No home like yours is for sale in Old Bend or the plats that touch it, but one is under contract.',
    )
    expect(out.bandRivals?.sentence).not.toMatch(/between \$|[—–]/)
  })

  it('does not compare homes for sale when the inventory read fails, and does not open the next row', async () => {
    getSubdivisionRing.mockResolvedValue({ ...DEFAULT_RING, ring: [PARK_ADDITION] })
    getCmaAreaBandInventory.mockRejectedValue(new Error('statement timeout'))
    const failed = await assembleCompetition(oldBendArgs(subject()))
    expect(getCmaAreaBandInventory).toHaveBeenCalledTimes(1)
    expect(readNeighborRings).not.toHaveBeenCalled()
    expect(failed.widestAreaInventory).toBeNull()
    expect(failed.bandRivals?.rivals).toEqual([])
    expect(failed.bandRivals?.sentence).toBe(
      'The homes for sale in Old Bend and the plats that touch it were not read, so none are compared here.',
    )
    expect(failed.bandRivals?.sentence).not.toMatch(/[—–]/)
  })

  it('keeps a touching-plat home about 40% above the recommendation when it is one of the best five', async () => {
    getSubdivisionRing.mockResolvedValue({ ...DEFAULT_RING, ring: [PARK_ADDITION] })
    const own = (key: string) =>
      row({
        ListingKey: key,
        StreetNumber: key,
        StreetName: 'Delaware',
        ListPrice: 1_000_000,
        SubdivisionName: 'Old Bend',
        plat_slug: 'old-bend-plat',
        TotalLivingAreaSqFt: 1950,
        year_built: 2015,
      })
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) =>
      inventory({
        lo: q.lo,
        hi: q.hi,
        activeRows: [
          own('A'),
          own('B'),
          own('C'),
          own('D'),
          row({
            ListingKey: 'PARK',
            StreetNumber: '320',
            StreetName: 'Riverside',
            ListPrice: 1_400_000,
            SubdivisionName: 'Park Addition',
            plat_slug: 'park-addition',
            TotalLivingAreaSqFt: 1500,
            year_built: 2015,
          }),
          row({
            ListingKey: 'BIG',
            StreetNumber: '1',
            StreetName: 'Over',
            ListPrice: 1_000_000,
            TotalLivingAreaSqFt: 2100,
          }),
          row({
            ListingKey: 'BEDS',
            StreetNumber: '2',
            StreetName: 'Rooms',
            ListPrice: 1_000_000,
            BedroomsTotal: 6,
          }),
        ],
        pendingRows: [],
      }),
    )
    const out = await assembleCompetition({ ...oldBendArgs(subject()), recommended: 1_000_000 })
    expect(readNeighborRings).not.toHaveBeenCalled()
    expect(out.bandRivals?.rivals.map((r) => r.listingKey)).toEqual(['A', 'B', 'C', 'D', 'PARK'])
    expect(out.bandRivals?.rivals.map((r) => r.listingKey)).not.toContain('BIG')
    expect(out.bandRivals?.rivals.map((r) => r.listingKey)).not.toContain('BEDS')
    expect(out.bandRivals?.activeCount).toBe(5)
    expect(out.bandRivals?.lo).toBe(1_000_000)
    expect(out.bandRivals?.hi).toBe(1_400_000)
    expect(out.bandRivals?.bandBasis).toBeUndefined()
    expect(out.bandRivals?.sentence).toBe(
      '5 homes like yours are for sale in Old Bend and the plats that touch it. None are under contract right now.',
    )
    expect(out.widestAreaInventory?.citation.filter).toContain('rankBestPool kept 5 of 5')
  })

  it('opens the next row only when own and touching plats hold fewer than five that fit', async () => {
    getSubdivisionRing.mockResolvedValue({ ...DEFAULT_RING, ring: [PARK_ADDITION] })
    readNeighborRings.mockResolvedValue([
      {
        homeSlug: 'park-addition',
        plats: [{ slug: 'riverside', gapM: 0, pointM: 80, inNeighborhood: true }],
      },
    ])
    const two = [
      row({ ListingKey: 'ONE', StreetNumber: '1', StreetName: 'A' }),
      row({ ListingKey: 'TWO', StreetNumber: '2', StreetName: 'B' }),
    ]
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number; area?: { platSlugs?: string[] } }) =>
      inventory({ lo: q.lo, hi: q.hi, activeRows: two, pendingRows: [] }),
    )
    const out = await assembleCompetition(oldBendArgs(subject()))
    expect(readNeighborRings).toHaveBeenCalledTimes(1)
    expect(getCmaAreaBandInventory).toHaveBeenCalledTimes(2)
    const second = getCmaAreaBandInventory.mock.calls[1]?.[0] as { area?: { platSlugs?: string[] } }
    expect(second.area?.platSlugs).toContain('riverside')
    expect(out.pool?.openedNext).toBe(true)
    expect(out.bandRivals?.sentence).toBe(
      '2 homes like yours are for sale in Old Bend, the plats that touch it, and the plats that touch those. None are under contract right now.',
    )
    expect(out.bandRivals?.rivals).toHaveLength(2)
  })

  it('does not use the city or a mile radius when the home is not inside a recorded plat', async () => {
    getSubdivisionRing.mockResolvedValue(null)
    const out = await assembleCompetition(oldBendArgs(subject()))
    expect(getCmaAreaBandInventory).not.toHaveBeenCalled()
    expect(getCmaAreaUnsoldCycles).not.toHaveBeenCalled()
    expect(out.competitionArea).toBeNull()
    expect(out.competitionRings).toEqual([])
    expect(out.pool).toBeNull()
    expect(out.bandRivals?.rivals).toEqual([])
    expect(out.bandRivals?.sentence).toBe(
      'This home is not inside a recorded plat, so no homes for sale were compared. The search did not use the city or a mile radius.',
    )
  })
})
