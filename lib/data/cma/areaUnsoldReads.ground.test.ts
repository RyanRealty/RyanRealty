/**
 * The came-off read and the competition read take every row on the area's
 * recorded plats, whatever its MLS spelling (reader review 2026-10-08).
 *
 * Before: both reads prefiltered on SubdivisionName IN (the area's names), so
 * 1425 Fresno ("Northwest Townsite Co 2nd Addt", on 1355 Jacksonville's own
 * plat) never reached the polygon test, and 733 Saginaw (MLS "Kenwood",
 * recorded Kenwood First Addition) and 1340 Trenton (MLS "West Hills",
 * recorded West Hills) were dropped from 915 Saginaw's competition. Now each
 * read also takes the rows inside the box around the area's plats, the
 * polygon decides through the one ground decision, and the polygon rides on
 * the row (plat_slug) for every later test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const named: Row[] = []
const boxed: Row[] = []
const reads: Array<{ byName: boolean; byBox: boolean }> = []

function chain(): unknown {
  const state = { byName: false, byBox: false }
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined
        if (prop === 'range') {
          return async () => {
            reads.push({ ...state })
            return { data: state.byName ? named : state.byBox ? boxed : [], error: null }
          }
        }
        return (col?: unknown) => {
          if (prop === 'in' && col === 'SubdivisionName') state.byName = true
          if (prop === 'gte' && col === 'Latitude') state.byBox = true
          return proxy
        }
      },
    },
  )
  return proxy
}

const assigned = vi.fn(async (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) =>
  points.map((p) => PLATS[String(p.lat)] ?? null),
)
const outline = vi.fn(async (_ground: unknown, _opts?: unknown) => ({ latMin: 44.04, latMax: 44.08, lngMin: -121.35, lngMax: -121.3 }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => chain() }) }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => assigned(points),
}))
vi.mock('@/lib/data/cma/platGroundBounds', () => ({
  getPlatGroundBounds: (ground: unknown, opts?: unknown) => outline(ground, opts),
}))
// The status log and the relist read are not what this file tests.
vi.mock('@/lib/data/cma/localOutcomeReads', () => ({ getListingStatusChanges: async () => new Map() }))

import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getCmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { buildCompArea } from '@/lib/pricing/comp-area'

// The plat each home's MLS point sits in (public.boundaries, read 2026-10-08).
const PLATS: Record<string, string> = {
  '44.055588': 'northwest-townsite-second-addition', // 1425 Fresno
  '44.058868': 'northwest-townsite-second-addition', // 1355 Jacksonville
  '44.065697': 'kenwood-first-addition', // 733 Saginaw
  '44.06695': 'west-hills', // 1340 Trenton
  '44.02324': 'park-place-phase-i', // a Park Place namesake in Southwest Bend
}

const row = (over: Row): Row => ({
  City: 'Bend',
  ListPrice: 875000,
  property_sub_type: 'Single Family Residence',
  status_change_timestamp: '2026-01-01T06:00:00Z',
  ...over,
})

describe('the area reads take the plats, not one spelling', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    named.length = 0
    boxed.length = 0
    reads.length = 0
    assigned.mockClear()
    outline.mockClear()
  })

  it('1355 Jacksonville came-off read: 1425 Fresno ("Co 2nd Addt") reaches the area and carries its plat', async () => {
    const area = buildCompArea({
      subject: {
        latitude: 44.058868,
        longitude: -121.331289,
        subdivision: 'Northwest Townsite',
        subdivisionSlug: 'northwest-townsite-second-addition',
        streetAddress: '1355 Jacksonville',
        city: 'Bend',
      },
      rungs: [{ key: 'adjacent-subdivision-24mo', kept: 1, added: 1 }],
      keptComps: [{ subdivision: 'Grandview', subdivisionSlug: null, selectionTier: 'adjacent-subdivision-24mo' }],
    })!
    // The name read never returns it: its MLS name is not one of the area's.
    named.push(row({ ListingKey: 'NAMED', StreetNumber: '1', StreetName: 'Elm', SubdivisionName: 'Grandview', Latitude: 44.0601, Longitude: -121.3301 }))
    boxed.push(
      row({ ListingKey: '20250108191339738853000000', StreetNumber: '1425', StreetName: 'Fresno', SubdivisionName: 'Northwest Townsite Co 2nd Addt', StandardStatus: 'Expired', Latitude: 44.055588, Longitude: -121.332439 }),
      row({ ListingKey: 'NAMESAKE', StreetNumber: '9', StreetName: 'Oak', SubdivisionName: 'Park Place', Latitude: 44.02324, Longitude: -121.32792 }),
    )
    const read = await getCmaAreaUnsoldCycles({ area, city: 'Bend', propertySubType: 'Single Family Residence', priceLo: 403000, priceHi: 1356000 })
    expect(outline).toHaveBeenCalledTimes(1)
    expect(reads.some((r) => r.byName)).toBe(true)
    expect(reads.some((r) => r.byBox && !r.byName)).toBe(true)
    const fresno = read.rows.find((r) => r.ListingKey === '20250108191339738853000000')
    expect(fresno?.plat_slug).toBe('northwest-townsite-second-addition')
    // The Grandview row is in by its name (no polygon holds its point here),
    // and the box's namesake in another plat is not in at all.
    expect(read.rows.map((r) => r.ListingKey).sort()).toEqual(['20250108191339738853000000', 'NAMED'])
    expect(read.citation.filter).toContain('whatever the MLS spelling')
  })

  it('915 Saginaw competition read: 733 Saginaw and 1340 Trenton stay in', async () => {
    const area = buildCompArea({
      subject: {
        latitude: 44.06569,
        longitude: -121.32545,
        subdivision: 'Park Place',
        subdivisionSlug: 'park-place',
        streetAddress: '915 Saginaw',
        city: 'Bend',
      },
      rungs: [
        { key: 'closer-sub-9mo', kept: 1, added: 1 },
        { key: 'nearby-1.25mi-3mo', kept: 1, added: 1 },
      ],
      keptComps: [
        { subdivision: 'Kenwood', subdivisionSlug: 'kenwood', selectionTier: 'closer-sub-9mo' },
        { subdivision: 'West Hills', subdivisionSlug: 'west-hills-fifth-addition', selectionTier: 'nearby-1.25mi-3mo' },
      ],
    })!
    const saginaw = row({
      ListingKey: '20260723173957518707000000',
      StreetNumber: '733',
      StreetName: 'Saginaw',
      SubdivisionName: 'Kenwood',
      StandardStatus: 'Pending',
      ListPrice: 995000,
      Latitude: 44.065697,
      Longitude: -121.322645,
    })
    const trenton = row({
      ListingKey: '20260721182401224453000000',
      StreetNumber: '1340',
      StreetName: 'Trenton',
      SubdivisionName: 'West Hills',
      StandardStatus: 'Pending',
      ListPrice: 989900,
      Latitude: 44.06695,
      Longitude: -121.331249,
    })
    // Both carry an area name, so the name read returns them; before this
    // change the polygon test then dropped both (their plats are not the
    // area's exact plats).
    named.push(saginaw, trenton)
    boxed.push(saginaw, trenton)
    const inv = await getCmaAreaBandInventory({ area, city: 'Bend', lo: 820000, hi: 1002000, propertySubType: 'Single Family Residence' })
    const keys = [...inv!.activeRows, ...inv!.pendingRows].map((r) => `${r.StreetNumber} ${r.StreetName}:${r.plat_slug}`)
    // The same rows answer the Active and the Pending reads in this mock.
    expect([...new Set(keys)].sort()).toEqual(['1340 Trenton:west-hills', '733 Saginaw:kenwood-first-addition'])
  })

  it('an area that reads no plats reads by name alone, with no outline read', async () => {
    const area = buildCompArea({
      subject: { latitude: 44.06569, longitude: -121.32545, subdivision: 'Park Place', city: 'Bend' },
      rungs: [{ key: 'closer-sub-9mo', kept: 1, added: 1 }],
      keptComps: [{ subdivision: 'Kenwood', selectionTier: 'closer-sub-9mo' }],
    })!
    expect(area.platSlugs).toEqual([])
    named.push(row({ ListingKey: 'K', StreetNumber: '1', StreetName: 'A', SubdivisionName: 'Kenwood', Latitude: 44.065697, Longitude: -121.322645 }))
    const read = await getCmaAreaUnsoldCycles({ area, city: 'Bend', propertySubType: null, priceLo: 1, priceHi: 9e6 })
    expect(outline).not.toHaveBeenCalled()
    expect(reads.every((r) => !r.byBox)).toBe(true)
    expect(read.rows.map((r) => r.ListingKey)).toEqual(['K'])
  })
})
