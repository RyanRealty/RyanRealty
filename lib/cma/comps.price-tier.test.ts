/**
 * The listings ladder admits on the one 20% line (Matt 2026-10-08,
 * lib/pricing/price-tier.ts): a sale's own closed $/sqft against the
 * one-read anchor, in place of the 30% gap, and the starved rung no longer
 * widens it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'

const { selectCmaCompsPool, selectCmaCompsByKeys } = vi.hoisted(() => ({
  selectCmaCompsPool: vi.fn(async (_opts: Record<string, unknown>) => [] as CmaListingRow[]),
  selectCmaCompsByKeys: vi.fn(async (_keys?: unknown) => [] as CmaListingRow[]),
}))

vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/cma/builderReads', () => ({ selectCmaCompsPool, selectCmaCompsByKeys }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  getSubdivisionRing: async () => null,
  assignSubdivisionSlugs: async (pts: ReadonlyArray<unknown>) => pts.map(() => null),
  assignCommunitySlugs: async () => null,
}))
vi.mock('@/lib/cma/hydrate-closed-comp-dom', () => ({
  hydrateClosedCompDaysOnMarket: async <T,>(comps: T) => comps,
}))

import { selectComps } from '@/lib/cma/comps'

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

const recent = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

function row(key: string, ppsf: number, i: number, at: { lat: number; lng: number } = { lat: 44.051, lng: -121.301 }): CmaListingRow {
  return {
    ListingKey: key,
    ListNumber: `2200${i}`,
    StreetNumber: String(100 + i),
    StreetName: 'Oak',
    City: 'Bend',
    SubdivisionName: null,
    Latitude: at.lat,
    Longitude: at.lng,
    property_sub_type: 'Single Family Residence',
    ClosePrice: Math.round(2000 * ppsf),
    CloseDate: recent,
    TotalLivingAreaSqFt: 2000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    lot_size_acres: 0.2,
    year_built: 2000,
  } as unknown as CmaListingRow
}

/** The anchor read (limit 800) gets five sales at $250, so the line is $200 to $300. */
function pool(candidates: CmaListingRow[], at?: { lat: number; lng: number }) {
  const anchorRows = [0, 1, 2, 3, 4].map((i) => row(`ANCHOR${i}`, 250, 50 + i, at))
  selectCmaCompsPool.mockImplementation(async (opts: Record<string, unknown>) =>
    opts.limit === 800 ? anchorRows : candidates,
  )
}

const keys = (sel: Awaited<ReturnType<typeof selectComps>>) => sel.comps.map((c) => c.listingKey).sort()

describe('the listings ladder admits on the one 20% price line', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
  })

  it('keeps a sale 19% under the $250 anchor and skips one 21% under, which the 30% gap seated', async () => {
    pool([
      ...['A', 'B', 'C', 'D'].map((k, i) => row(k, 250, i)),
      row('IN', 250 * 0.81, 10),
      row('OUT', 250 * 0.79, 11),
    ])
    const sel = await selectComps(subject())
    expect(sel.diagnostics.price_anchor).toEqual({ ppsf: 250, n: 5 })
    expect(keys(sel)).toContain('IN')
    expect(keys(sel)).not.toContain('OUT')
    expect(sel.diagnostics.excluded_totals.price_tier).toBeGreaterThan(0)
    expect(sel.trace.some((t) => t.includes('$200 to $300 a square foot (within 20% of $250)'))).toBe(true)
  })

  it('keeps a sale 19% over the anchor and skips one 21% over', async () => {
    const core = ['A', 'B', 'C', 'D'].map((k, i) => row(k, 250, i))
    pool([...core, row('IN', 250 * 1.19, 10)])
    expect(keys(await selectComps(subject()))).toContain('IN')
    // Alone with the four, so nothing but the line can keep it out.
    pool([...core, row('OUT', 250 * 1.21, 11)])
    expect(keys(await selectComps(subject()))).not.toContain('OUT')
  })

  it('does not widen the line on the starved rung', async () => {
    // Only three sales inside the line exist, so the ladder walks every rung,
    // the starved widening included (it runs only for a home outside every
    // mapped neighborhood, hence the unmapped point east of Bend). A sale 30%
    // under (inside the old widened band of about 50%, outside the old 30%
    // gap) stays out on every rung.
    const east = { lat: 44.101, lng: -121.201 }
    pool([...['A', 'B', 'C'].map((k, i) => row(k, 250, i, east)), row('FAR_TIER', 250 * 0.7, 12, east)], east)
    const sel = await selectComps(subject({ latitude: 44.1, longitude: -121.2 }))
    expect(sel.diagnostics.ladder.some((t) => t.tier === 'widened-disclosed-24mo' && t.ran)).toBe(true)
    expect(keys(sel)).not.toContain('FAR_TIER')
    expect(sel.trace.some((t) => t.includes('widened what counts as your home')))
      .toBe(false)
  })
})
