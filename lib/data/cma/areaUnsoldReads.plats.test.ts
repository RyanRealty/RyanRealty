/**
 * The unsold read and the band read test each row's recorded plat polygon,
 * and hold a plat only the own-street sale reached to the subject's street
 * (Matt 2026-10-07, rule 24; reader review of 3037 Purcell and 2382 Jackson).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows: Array<Record<string, unknown>> = []
const assigned = vi.fn<(points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => Promise<Array<string | null>>>()

function chain(): unknown {
  const target: Record<string, unknown> = {}
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'range') return async () => ({ data: rows, error: null })
      if (prop === 'then') return undefined
      return () => proxy
    },
  })
  return proxy
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => chain() }) }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => assigned(points),
}))

import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getCmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { buildCompArea } from '@/lib/pricing/comp-area'

const purcell = buildCompArea({
  subject: {
    latitude: 44.080952,
    longitude: -121.272517,
    subdivision: 'Silver Sage',
    subdivisionSlug: 'silver-sage-phase-i',
    streetAddress: '3037 Purcell',
    city: 'Bend',
  },
  rungs: [
    { key: 'own-street-24mo', kept: 1, added: 1 },
    { key: 'subdivision-3mo', kept: 1, added: 1 },
    { key: 'adjacent-sub-6mo', kept: 1, added: 1 },
  ],
  keptComps: [
    { subdivision: 'Silver Sage', subdivisionSlug: 'silver-sage-phase-2', selectionTier: 'subdivision-3mo' },
    { subdivision: 'Tamarack Park', subdivisionSlug: 'tamarack-park-east-phase-vi', selectionTier: 'adjacent-sub-6mo' },
    { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'own-street-24mo' },
  ],
})!

const row = (StreetNumber: string, StreetName: string, SubdivisionName: string, Latitude: number, Longitude: number) => ({
  ListingKey: `${StreetNumber}-${StreetName}`,
  StreetNumber,
  StreetName,
  SubdivisionName,
  City: 'Bend',
  Latitude,
  Longitude,
  ListPrice: 550000,
})

// The stored 3037 Purcell peers and rivals, with the plat geo_assign_batch put each in.
const PLATS: Record<string, string> = {
  '44.078836': 'tamarack-park-east-phase-iv',
  '44.0764': 'holliday-park',
  '44.075079': 'holliday-park-third-addition-phase-iii',
  '44.07618': 'holliday-park-third-addition-phase-ii',
  '44.075624': 'holliday-park-third-addition-phase-iii',
}

describe('the area reads test the recorded plat and the street', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    rows.length = 0
    rows.push(
      row('2923', 'Deborah', 'Tamarack Park', 44.078836, -121.275457),
      row('2020', 'Hall', 'Holliday Park', 44.0764, -121.273521),
      row('2382', 'Jackson', 'Holliday Park', 44.075079, -121.268868),
      row('2260', 'Indigo', 'Holliday Park', 44.07618, -121.269519),
      row('2350', 'Purcell', 'Holliday Park', 44.075624, -121.269354),
    )
    assigned.mockReset()
    assigned.mockImplementation(async (points) => points.map((p) => PLATS[String(p.lat)] ?? null))
  })

  it('3037 Purcell expireds: Holliday Park homes off Purcell are not in the area', async () => {
    const read = await getCmaAreaUnsoldCycles({ area: purcell, city: 'Bend', propertySubType: null, priceLo: 1, priceHi: 9e6 })
    expect(read.rows.map((r) => `${r.StreetNumber} ${r.StreetName}`)).toEqual(['2923 Deborah', '2350 Purcell'])
    expect(read.citation.rowsAfterAreaTest).toBe(2)
    expect(read.citation.filter).toContain('recorded plat polygon per row')
  })

  it('3037 Purcell competition: the same test on the band read', async () => {
    const inv = await getCmaAreaBandInventory({ area: purcell, city: 'Bend', lo: 1, hi: 9e6 })
    expect(inv!.activeRows.map((r) => `${r.StreetNumber} ${r.StreetName}`)).toEqual(['2923 Deborah', '2350 Purcell'])
  })

  it('an area with no recorded plats reads no polygons and keeps the name test', async () => {
    const legacy = { ...purcell, platSlugs: undefined, street: undefined, namesWithoutPlat: undefined }
    const read = await getCmaAreaUnsoldCycles({ area: legacy, city: 'Bend', propertySubType: null, priceLo: 1, priceHi: 9e6 })
    expect(assigned).not.toHaveBeenCalled()
    expect(read.rows).toHaveLength(5)
  })
})
