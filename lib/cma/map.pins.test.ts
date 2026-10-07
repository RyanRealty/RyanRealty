/**
 * Every row gets a pin, and a home's own plat is drawn around it
 * (reader review 2026-10-07: 2382 Jackson's expired II, 2020 Hall, had no pin
 * under "Every pin below is a row"; 20676 Wild Rose's star sat outside every
 * outline because its 744-vertex plat was sampled to 40 points before the
 * hold test).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const assigned = vi.fn<(points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => Promise<Array<string | null>>>()
const boundary = vi.fn<(input: { geoType: string; geoSlug: string }) => Promise<unknown>>()

vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => assigned(points),
  getSubdivisionRing: async () => null,
  readBoundaryLabel: async (_t: string, slug: string) =>
    slug === 'own-plat' ? 'Larkspur Village' : slug === 'listing-plat' ? 'Holliday Park' : null,
}))
vi.mock('@/lib/data/geo/getBoundaryGeoJSON', () => ({
  getBoundaryGeoJSON: (input: { geoType: string; geoSlug: string }) => boundary(input),
}))

import { buildCmaMapDataUri } from '@/lib/cma/map'
import { projectToImagePercent } from '@/lib/cma/static-map-projection'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '2382 Jackson',
  city: 'Bend',
  latitude: 44.075079,
  longitude: -121.268868,
  subdivision: 'Holliday Park',
  propertySubType: 'Single Family Residence',
} as unknown as CmaSubject

const sale = (address: string, latitude: number, longitude: number) =>
  ({ address, latitude, longitude, propertySubType: 'Single Family Residence' }) as unknown as CmaComp

const comps = [
  sale('2224 Indigo', 44.075936, -121.271063),
  sale('2254 Indigo', 44.076059, -121.269702),
  sale('2266 Jackson', 44.075276, -121.270033),
  sale('2225 Indigo', 44.075577, -121.271089),
  sale('2591 Purcell', 44.074665, -121.269784),
]

/**
 * A plat whose top edge is traced lot by lot (hundreds of vertices) with one
 * narrow lot reaching north to the subject. A 40-point stride sample of this
 * ring skips the narrow lot, and with it the subject.
 */
function lotTracedPlat(home: { lat: number; lng: number }) {
  const west = home.lng - 0.004
  const east = home.lng + 0.004
  const south = home.lat - 0.004
  const top = home.lat - 0.001
  const ring: number[][] = [[west, south], [east, south], [east, top]]
  const steps = 700
  for (let i = 0; i <= steps; i++) {
    const lng = east - ((east - west) * i) / steps
    if (Math.abs(lng - home.lng) < 0.00003) {
      ring.push([home.lng + 0.00004, top], [home.lng + 0.00004, home.lat + 0.0002], [home.lng - 0.00004, home.lat + 0.0002], [home.lng - 0.00004, top])
      continue
    }
    ring.push([lng, top])
  }
  ring.push([west, south])
  return { type: 'Polygon', coordinates: [ring] }
}

describe('buildCmaMapDataUri: every pin, every plat', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key'
    assigned.mockReset()
    boundary.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('frames the listings that came off, so expired II gets its pin on the tile (2382 Jackson, 2020 Hall)', async () => {
    assigned.mockResolvedValue([])
    boundary.mockResolvedValue(null)
    const unsold = [
      { address: '2574 Robinson', latitude: 44.076119, longitude: -121.270985 },
      // West of every sale and active: outside the old frame.
      { address: '2020 Hall', latitude: 44.0764, longitude: -121.273521 },
    ]
    const active = [
      { address: '2350 Purcell', latitude: 44.075624, longitude: -121.269354 },
      { address: '2260 Indigo', latitude: 44.07618, longitude: -121.269519 },
    ]
    const map = await buildCmaMapDataUri(subject, comps, {
      active,
      unsold,
      compArea: { kind: 'subdivision', names: ['Holliday Park'] },
    })
    expect(map).not.toBeNull()
    const keys = map!.pins.map((p) => p.key)
    expect(keys).toEqual([null, '1', '2', '3', '4', '5', 'A', 'B', 'i', 'ii'])
    for (const pin of map!.pins) {
      const at = projectToImagePercent({ lat: pin.lat, lng: pin.lng }, map!.view)
      expect(at, `${pin.key ?? 'subject'} on the tile`).not.toBeNull()
      expect(at!.xPct).toBeGreaterThanOrEqual(0)
      expect(at!.xPct).toBeLessThanOrEqual(100)
      expect(at!.yPct).toBeGreaterThanOrEqual(0)
      expect(at!.yPct).toBeLessThanOrEqual(100)
    }
  })

  it("draws the subject's own lot-traced plat around its star, and the plat each listing sits in on a plat area", async () => {
    const home = { lat: subject.latitude as number, lng: subject.longitude as number }
    assigned.mockImplementation(async (points) =>
      points.map((p, i) => (i === 0 ? 'own-plat' : p.lat === 44.0764 ? 'listing-plat' : null)),
    )
    boundary.mockImplementation(async ({ geoSlug }) => {
      if (geoSlug === 'own-plat') return lotTracedPlat(home)
      if (geoSlug === 'listing-plat') {
        return {
          type: 'Polygon',
          coordinates: [[[-121.2745, 44.0758], [-121.2725, 44.0758], [-121.2725, 44.077], [-121.2745, 44.077], [-121.2745, 44.0758]]],
        }
      }
      return null
    })
    const map = await buildCmaMapDataUri(subject, comps, {
      unsold: [{ address: '2020 Hall', latitude: 44.0764, longitude: -121.273521 }],
      compArea: { kind: 'subdivision', names: ['Holliday Park'] },
    })
    expect(map).not.toBeNull()
    expect(map!.boundaryShown).toBe(true)
    // The plat read covered the listing that came off, not only the sales.
    const asked = assigned.mock.calls[0]![0]
    expect(asked.some((p) => p.lat === 44.0764)).toBe(true)
    const requested = boundary.mock.calls.map((c) => c[0].geoSlug)
    expect(requested).toContain('own-plat')
    expect(requested).toContain('listing-plat')
    // Both outlines are on the drawn ground: each carries its place label.
    expect(map!.dataUri.startsWith('data:image/svg+xml')).toBe(true)
    const svg = Buffer.from(map!.dataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8')
    expect(svg).toContain('Larkspur Village')
    expect(svg).toContain('Holliday Park')
  })
})
