/**
 * The place block's read counts the subject's recorded plat, not one MLS
 * spelling (reader review 2026-10-08, cma-1355-jacksonville).
 *
 * The letter said "5 homes have sold in Northwest Townsite between 2023 and
 * 2026" because getCmaSubdivisionHistory matched SubdivisionName =
 * 'Northwest Townsite' exactly. The plat (Northwest Townsite Second
 * Addition) holds about twenty more closes the MLS spells "Northwest
 * Townsite Co 2nd Addt". With the subject's ground, the read also takes the
 * rows inside the box around the plat, and the polygon decides.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const named: Row[] = []
const boxed: Row[] = []

function chain(): unknown {
  const state = { byName: false, byBox: false }
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined
        const answer = async () => ({ data: state.byName ? named : state.byBox ? boxed : [], error: null })
        if (prop === 'range' || prop === 'limit') return answer
        return (col?: unknown) => {
          if (prop === 'eq' && col === 'SubdivisionName') state.byName = true
          if (prop === 'gte' && col === 'Latitude') state.byBox = true
          return proxy
        }
      },
    },
  )
  return proxy
}

const PLATS: Record<string, string> = {
  '44.061276': 'northwest-townsite-second-addition', // 1367 Milwaukee
  '44.058868': 'northwest-townsite-second-addition', // 1251 Jacksonville
  '44.055604': 'northwest-townsite-second-addition', // 1223 Fresno
  '44.062064': 'northwest-townsite-second-addition', // 1501 Newport
  '44.055274': 'northwest-townsite-second-addition', // 1346 Elgin
  '44.0601': 'grandview', // a Grandview sale inside the box
}
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => chain() }) }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: async (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) =>
    points.map((p) => PLATS[String(p.lat)] ?? null),
}))
const outline = vi.fn(async (_g: unknown, _o?: unknown) => ({ latMin: 44.05, latMax: 44.07, lngMin: -121.34, lngMax: -121.32 }))
vi.mock('@/lib/data/cma/platGroundBounds', () => ({ getPlatGroundBounds: (g: unknown, o?: unknown) => outline(g, o) }))

import { getCmaSubdivisionClosed, getCmaSubdivisionHistory } from '@/lib/data/cma/builderReads'
import { subjectPlatGround } from '@/lib/pricing/plat-ground'

const sale = (key: string, address: string, name: string, closeDate: string, lat: number, lng: number, price: number): Row => {
  const [StreetNumber, ...rest] = address.split(' ')
  return {
    ListingKey: key,
    StreetNumber,
    StreetName: rest.join(' '),
    SubdivisionName: name,
    CloseDate: closeDate,
    ClosePrice: price,
    Latitude: lat,
    Longitude: lng,
    PhotoURL: 'https://cdn.example/x.jpg',
  }
}

// The four most recent closes on the plat, from listings (read 2026-10-08).
const JACKSONVILLE_1251 = sale('20260723185213842855000000', '1251 Jacksonville', 'Northwest Townsite', '2026-08-07', 44.058868, -121.32996, 734000)
const FRESNO_1223 = sale('20260610163102552046000000', '1223 Fresno', 'Northwest Townsite', '2026-07-24', 44.055604, -121.329952, 906000)
const NEWPORT_1501 = sale('20251001004913306284000000', '1501 Newport', 'Northwest Townsite Co 2nd Addt', '2025-11-14', 44.062064, -121.333831, 975000)
const ELGIN_1346 = sale('20250613124224391307000000', '1346 Elgin', 'Northwest Townsite Co 2nd Addt', '2025-10-07', 44.055274, -121.33088, 1675000)
const MILWAUKEE_1367 = sale('20250203231219211502000000', '1367 Milwaukee', 'Northwest Townsite Co 2nd Addt', '2025-03-31', 44.061276, -121.331492, 645000)
const GRANDVIEW = sale('GV', '1 Grand', 'Grandview', '2026-01-01', 44.0601, -121.33, 700000)

const ground = subjectPlatGround({
  subdivision: 'Northwest Townsite',
  subdivisionSlug: 'northwest-townsite-second-addition',
  city: 'Bend',
  latitude: 44.058868,
  longitude: -121.331289,
})

describe('the subdivision reads take the subject plat under every MLS spelling', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    named.length = 0
    boxed.length = 0
    outline.mockClear()
    named.push(JACKSONVILLE_1251, FRESNO_1223)
    boxed.push(JACKSONVILLE_1251, FRESNO_1223, NEWPORT_1501, ELGIN_1346, MILWAUKEE_1367, GRANDVIEW)
  })

  it('the place block reads the plat: the four most recent are 1251 Jacksonville, 1223 Fresno, 1501 Newport, 1346 Elgin', async () => {
    const rows = await getCmaSubdivisionHistory('Northwest Townsite', '2016-10-08', { ground, city: 'Bend' })
    expect(rows.map((r) => `${r.StreetNumber} ${r.StreetName}`)).toEqual([
      '1251 Jacksonville',
      '1223 Fresno',
      '1501 Newport',
      '1346 Elgin',
      '1367 Milwaukee',
    ])
    expect(outline).toHaveBeenCalledTimes(1)
  })

  it('without a ground the read is the exact MLS name, as before', async () => {
    const rows = await getCmaSubdivisionHistory('Northwest Townsite', '2016-10-08')
    expect(rows.map((r) => r.ListingKey)).toEqual([JACKSONVILLE_1251.ListingKey, FRESNO_1223.ListingKey])
    expect(outline).not.toHaveBeenCalled()
  })

  it('the subdivision pulse reads the same ground', async () => {
    const rows = await getCmaSubdivisionClosed('Northwest Townsite', '2025-10-08', { ground, city: 'Bend' })
    // The box rows answer regardless of date in this mock; the ground decides membership.
    expect(rows.map((r) => r.ListingKey)).not.toContain('GV')
    expect(rows).toHaveLength(5)
  })
})
