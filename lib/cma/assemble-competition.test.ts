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

type AnyFn = (...args: unknown[]) => unknown
vi.mock('@/lib/data/cma/bandInventory', () => ({
  getCmaAreaBandInventory: (...args: unknown[]) => (getCmaAreaBandInventory as AnyFn)(...args),
}))
vi.mock('@/lib/data/cma/areaUnsoldReads', () => ({
  getCmaAreaUnsoldCycles: async () => null,
}))
vi.mock('@/lib/cma/parcel-shapes', () => ({
  resolveCmaParcels: async () => null,
}))

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
    SubdivisionName: null,
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

describe('assembleCompetition: the sentence counts what the table draws (rule 17, rule 24)', () => {
  beforeEach(() => {
    getCmaAreaBandInventory.mockReset()
  })

  it('draws the 1925 home a neighborhood area counted against a 2015 subject (no year test in a neighborhood)', async () => {
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
      '1 home like yours is for sale in Old Bend between $360,000 and $440,000. None are under contract right now.',
    )
    expect(out.widestAreaInventory?.citation.filter).toContain('sameAreaFit kept 1 of 1')
    // buildCmaExtras reads this flag so citations.price_band.source calls
    // these the fitting homes, not the whole band.
    expect(out.widestAreaInventory?.sameAreaFit).toBe(true)
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
      'No home like yours in Old Bend is for sale between $360,000 and $440,000, but one is under contract.',
    )
  })

  it('records in the citation that the ±25% read failed and the ±10% count stands, and the sentence does not change', async () => {
    // Two printed sales from the subdivision rung, in Rooster Rock and the
    // plat next to it: a short recorded-plat area, so the band ladder runs.
    const coho = subject({
      streetAddress: '3177 Coho',
      subdivision: 'Rooster Rock',
      latitude: 44.03,
      longitude: -121.27,
      yearBuilt: 2018,
      sqft: 1458,
    })
    const args = {
      ...oldBendArgs(coho),
      comps: [
        comp({ listingKey: 'C1', address: '1 Coho', subdivision: 'Rooster Rock', selectionTier: 'subdivision-12mo', latitude: 44.03, longitude: -121.27 }),
        comp({ listingKey: 'C2', address: '2 Mink', subdivision: 'Madison Park', selectionTier: 'subdivision-12mo', latitude: 44.031, longitude: -121.27 }),
      ],
      diagnostics: diagnostics([{ tier: 'subdivision-12mo', added: 2 }], 'Rooster Rock'),
      recommended: 549_000,
    }
    const tight = [
      row({
        ListingKey: 'ALD',
        StreetNumber: '2820',
        StreetName: 'Aldrich',
        ListPrice: 550_000,
        SubdivisionName: 'Rooster Rock',
        Latitude: 44.03,
        Longitude: -121.271,
        TotalLivingAreaSqFt: 1500,
        year_built: 2016,
      }),
    ]
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) => {
      // The ±10% read answers; the ±25% read fails.
      if (q.lo === 494_000 && q.hi === 604_000) {
        return inventory({ lo: q.lo, hi: q.hi, activeRows: tight, pendingRows: [] })
      }
      throw new Error('statement timeout')
    })
    const failed = await assembleCompetition(args)
    expect(failed.compArea?.kind).toBe('subdivisions')
    expect(getCmaAreaBandInventory).toHaveBeenCalledTimes(2)
    const filter = failed.widestAreaInventory?.citation.filter ?? ''
    expect(filter).toContain('the ±25% band read failed, so the band was never opened; the ±10% count stands')
    expect(filter).not.toContain('band steps tried')
    expect(failed.bandRivals?.activeCount).toBe(1)
    expect(failed.bandRivals?.rivals.map((r) => r.address)).toEqual(['2820 Aldrich'])
    const sentence = failed.bandRivals?.sentence

    // The same ±10% set with a ±25% read that answered and found nothing more:
    // the ladder walked, so the sentence says nothing from outside was added,
    // and the citation lists the steps. The failed read says neither.
    getCmaAreaBandInventory.mockReset()
    getCmaAreaBandInventory.mockImplementation(async (q: { lo: number; hi: number }) =>
      inventory({ lo: q.lo, hi: q.hi, activeRows: tight, pendingRows: [] }),
    )
    const walked = await assembleCompetition(args)
    expect(walked.widestAreaInventory?.citation.filter).toContain('band steps tried ±10%/±15%/±20%/±25%')
    expect(walked.widestAreaInventory?.citation.filter).not.toContain('read failed')
    expect(walked.bandRivals?.sentence).toContain('Nothing from outside Rooster Rock and Madison Park was added')

    // The failed read leaves the ±10% sentence exactly as it was: the count it
    // holds, and no claim that the band was walked.
    expect(sentence).toBe(
      '1 home like yours is for sale in Rooster Rock and Madison Park between $494,000 and $604,000. None are under contract right now.',
    )
    expect(sentence).not.toMatch(/[—–]/)
  })
})
