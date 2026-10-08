/**
 * The listings ladder reads the price anchor at the narrowest level with five
 * sales (Matt 2026-10-08, lib/pricing/price-anchor.ts), the same walk as the
 * facts ladder. 3062 NW Kelly Hill sits in the plat Westside Meadows II beside
 * Westside Meadows, inside Summit West; its anchor was Summit West's $609, and
 * every Westside Meadows sale ($326 to $457 a square foot) fell outside its
 * own home's line.
 *
 * The wide anchor read is the newest closes in an eight-mile box (500 rows at
 * most), which in Bend is a few months, so a plat's year of sales mostly falls
 * off it. The narrow levels also read the mile around the home and the home's
 * own MLS subdivision name over the full twelve months.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaListingRow } from '@/lib/data'
import type { CmaSubject } from '@/lib/cma/types'

const { selectCmaCompsPool, selectCmaCompsByKeys } = vi.hoisted(() => ({
  selectCmaCompsPool: vi.fn(async (_opts: Record<string, unknown>) => [] as CmaListingRow[]),
  selectCmaCompsByKeys: vi.fn(async (_keys?: unknown) => [] as CmaListingRow[]),
}))

const WM = { lat: 44.0745, lng: -121.3632 }
const WM2 = { lat: 44.0742, lng: -121.36266 }

vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/cma/builderReads', () => ({ selectCmaCompsPool, selectCmaCompsByKeys }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  getSubdivisionRing: async () => ({
    homeSlug: 'westside-meadows-ii',
    homeLabel: 'Westside Meadows II',
    neighborhoodSlug: null,
    ring: [],
  }),
  // The recorded plat under each point: the two Westside Meadows plats, and
  // Shevlin Ridge for the rest of Summit West.
  assignSubdivisionSlugs: async (pts: ReadonlyArray<{ lat: number | null; lng: number | null }>) =>
    pts.map((p) =>
      p.lat === WM2.lat && p.lng === WM2.lng
        ? 'westside-meadows-ii'
        : p.lat === WM.lat && p.lng === WM.lng
          ? 'westside-meadows'
          : 'shevlin-ridge-phase-1',
    ),
  assignCommunitySlugs: async () => null,
}))
vi.mock('@/lib/data/subdivisions/getPlatFamilyFootprint', () => ({ getPlatFamilyFootprint: async () => null }))
vi.mock('@/lib/cma/hydrate-closed-comp-dom', () => ({
  hydrateClosedCompDaysOnMarket: async <T,>(comps: T) => comps,
}))

import { selectComps } from '@/lib/cma/comps'

const subject = (): CmaSubject =>
  ({
    listingKey: 'subj',
    mlsNumber: null,
    streetAddress: '3062 NW Kelly Hill',
    city: 'Bend',
    postalCode: null,
    subdivision: 'Westside Meadows',
    latitude: 44.073973,
    longitude: -121.362518,
    beds: 3,
    baths: 2,
    sqft: 1702,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
  }) as unknown as CmaSubject

const recent = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)

let seq = 0
function row(
  key: string,
  closePrice: number,
  sqft: number,
  at: { lat: number; lng: number },
  subdivision: string,
): CmaListingRow {
  seq += 1
  return {
    ListingKey: key,
    ListNumber: `2300${seq}`,
    StreetNumber: String(2000 + seq),
    StreetName: 'Summerhill',
    City: 'Bend',
    SubdivisionName: subdivision,
    Latitude: at.lat,
    Longitude: at.lng,
    property_sub_type: 'Single Family Residence',
    ClosePrice: closePrice,
    CloseDate: recent,
    TotalLivingAreaSqFt: sqft,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    lot_size_acres: 0.15,
    year_built: 2003,
  } as unknown as CmaListingRow
}

// The verified listings rows (2026-10-08): ClosePrice / TotalLivingAreaSqFt.
const westsideMeadows = () => [
  row('KELLY_3080', 788_000, 1960, WM2, 'Westside Meadows'),
  row('KELLY_3086', 725_000, 2160, WM2, 'Westside Meadows'),
  row('BORDEAUX_2955', 800_000, 1750, WM, 'Westside Meadows'),
  row('SUMMERHILL_2500', 717_000, 2080, WM, 'Westside Meadows'),
  row('CHARDONNAY_2974', 735_000, 1920, WM, 'Westside Meadows'),
  row('SUMMERHILL_2382', 800_000, 2091, WM, 'Westside Meadows'),
  row('SUMMERHILL_2376', 765_000, 2347, WM, 'Westside Meadows'),
]
const summitWest = () =>
  Array.from({ length: 40 }, (_, i) =>
    row(`SW${i}`, 1800 * (600 + (i % 5) * 10), 1800, { lat: 44.0705 + (i % 4) * 0.001, lng: -121.3665 }, 'Shevlin Ridge'),
  )

/**
 * The anchor reads ask for 800 rows. The wide one (eight-mile box) holds the
 * newest closes only: Summit West plus two Westside Meadows sales. The mile
 * read and the MLS-name read hold Westside Meadows' whole year.
 */
function reads(opts: { narrow: boolean }) {
  selectCmaCompsPool.mockImplementation(async (o: Record<string, unknown>) => {
    if (o.limit !== 800) return []
    const b = o.bounds as { latMin: number; latMax: number } | null
    const wide = !o.subdivisionIlike && b != null && b.latMax - b.latMin > 0.1
    if (wide) return [...summitWest(), ...westsideMeadows().slice(2, 4)]
    return opts.narrow ? westsideMeadows() : []
  })
}

describe('the listings ladder anchors 3062 NW Kelly Hill on Westside Meadows', () => {
  beforeEach(() => {
    selectCmaCompsPool.mockReset()
    selectCmaCompsByKeys.mockReset()
    selectCmaCompsByKeys.mockResolvedValue([])
  })

  it('reads the subdivision family over the full year and names it', async () => {
    reads({ narrow: true })
    const sel = await selectComps(subject())
    expect(sel.diagnostics.price_anchor).toEqual({ ppsf: 383, n: 7, level: 'family', where: 'in Westside Meadows' })
    expect(
      sel.trace.some((t) =>
        t.startsWith(
          'Price tier: homes of this size sell for about $383 a square foot in Westside Meadows (median of 7 sales that closed in the last 12 months). Sales outside $306 to $460 a square foot',
        ),
      ),
    ).toBe(true)
    // The mile read and the MLS-name read were asked for twelve months too.
    const anchorCalls = selectCmaCompsPool.mock.calls.map((c) => c[0]).filter((o) => o.limit === 800)
    expect(anchorCalls).toHaveLength(3)
    expect(new Set(anchorCalls.map((o) => o.closeDateGte)).size).toBe(1)
    expect(anchorCalls.some((o) => o.subdivisionIlike === 'Westside Meadows')).toBe(true)
  })

  it('without the full year, the two newest Westside Meadows sales cannot hold a level and Summit West answers', async () => {
    reads({ narrow: false })
    const sel = await selectComps(subject())
    expect(sel.diagnostics.price_anchor?.level).toBe('neighborhood')
    expect(sel.diagnostics.price_anchor!.ppsf).toBeGreaterThan(600)
  })
})
