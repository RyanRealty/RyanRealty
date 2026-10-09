/**
 * Plat polygons are read together (rule 30). A sequential loop keeps one
 * boundary read in flight. This fails on that loop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const assigned = vi.fn(async () => ['plat-a', 'plat-b', 'plat-c', 'plat-d', 'plat-e', 'plat-a'])
let inFlight = 0
let maxInFlight = 0
const boundary = vi.fn(async (_input: { geoType: string; geoSlug: string }) => {
  inFlight += 1
  maxInFlight = Math.max(maxInFlight, inFlight)
  await new Promise((resolve) => setTimeout(resolve, 40))
  inFlight -= 1
  return {
    type: 'Polygon',
    coordinates: [
      [
        [-121.5, 44.0],
        [-121.0, 44.0],
        [-121.0, 44.5],
        [-121.5, 44.5],
        [-121.5, 44.0],
      ],
    ],
  }
})

vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: () => assigned(),
  getSubdivisionRing: async () => ({ neighborhoodSlug: 'test-neighborhood' }),
  readBoundaryLabel: async () => null,
}))

vi.mock('@/lib/data/geo/getBoundaryGeoJSON', () => ({
  getBoundaryGeoJSON: (input: { geoType: string; geoSlug: string }) => boundary(input),
}))

import { buildCmaMapDataUri } from '@/lib/cma/map'

// A point inside the stub polygon. Not a surveyed location for this street.
const subject = {
  streetAddress: '2902 Pinnacle',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  latitude: 44.06,
  longitude: -121.3,
  propertySubType: 'Single Family Residence',
} as CmaSubject

const comp = (address: string, latitude: number): CmaComp =>
  ({
    address,
    latitude,
    longitude: -121.3,
    propertySubType: 'Single Family Residence',
  }) as CmaComp

describe('outlines read the plats together', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key'
    inFlight = 0
    maxInFlight = 0
    boundary.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('holds at least the five plat reads in flight at once', async () => {
    await buildCmaMapDataUri(subject, [
      comp('1 Eaglenest', 44.061),
      comp('2 Mtn Peaks', 44.062),
      comp('3 Madison Park', 44.063),
      comp('4 Oakview', 44.064),
      comp('5 Obsidian Ridge', 44.065),
    ])
    const platCalls = boundary.mock.calls.filter((call) => call[0]?.geoType === 'subdivision')
    expect(platCalls.map((call) => call[0]?.geoSlug).sort()).toEqual(
      ['plat-a', 'plat-b', 'plat-c', 'plat-d', 'plat-e'].sort(),
    )
    expect(maxInFlight).toBeGreaterThanOrEqual(5)
  })
})
