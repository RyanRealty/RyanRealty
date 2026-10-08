/**
 * Reader review 2026-10-08, the one map: every printed pin sits inside a line
 * the map drew, or the caption says why not.
 *
 * Three stored letters failed that reading on b3132caf5:
 *
 * - 3037 Purcell: 2110 Carrie, 20 metres from 2124 Carrie, was nudged
 *   0.00036 degrees north by the Google-marker spread and landed outside
 *   Silver Sage Phase I, the plat PostGIS holds it in; and the whole of
 *   Holliday Park Third Addition Phase III was shaded half a mile south
 *   although the area holds it to the subject's street.
 * - 2382 Jackson: Aspen Heights Phase IV was drawn around 2799 Baroness but
 *   its name was dropped because the ring's centroid lies off the top of the
 *   frame, so the lobe read as more Holliday Park Phase II.
 * - 2745 Aldrich: 2820 Aldrich, 11 metres from a sale, was nudged north of
 *   Madison Park's top edge by the same spread.
 *
 * The plat polygons here are small synthetic rings at the real coordinates,
 * so the drawn ground has roads under it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const assigned = vi.fn<(points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => Promise<Array<string | null>>>()
const boundary = vi.fn<(input: { geoType: string; geoSlug: string }) => Promise<unknown>>()
const labels: Record<string, string> = {
  'silver-sage-phase-i': 'Silver Sage Phase I',
  'silver-sage-phase-2': 'Silver Sage Phase 2',
  'holliday-park-third-addition-phase-iii': 'Holliday Park Third Addition Phase III',
  'holliday-park-third-addition-phase-ii': 'Holliday Park Third Addition Phase II',
  'aspen-heights-phase-iv': 'Aspen Heights Phase IV',
  'obsidian-ridge-phases-i-and-ii': 'Obsidian Ridge Phases I And II',
  'merrick-subdivision-phases-1-and-2': 'Merrick Subdivision Phases 1 And 2',
  'madison-park': 'Madison Park',
}

vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  assignSubdivisionSlugs: (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) => assigned(points),
  getSubdivisionRing: async () => null,
  readBoundaryLabel: async (_t: string, slug: string) => labels[slug] ?? null,
}))
vi.mock('@/lib/data/geo/getBoundaryGeoJSON', () => ({
  getBoundaryGeoJSON: (input: { geoType: string; geoSlug: string }) => boundary(input),
}))

import { buildCmaMapDataUri, type CmaMapResult } from '@/lib/cma/map'
import { pinsOutsideOutlines } from '@/lib/cma/map-outlines'
import { pointInAnyRing } from '@/lib/cma/render-place-polygon'
import { ringsFromGeometry } from '@/lib/cma/map-overlay'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

type Pt = { lat: number; lng: number }
type Box = { minLat: number; maxLat: number; minLng: number; maxLng: number }

/** A plat as a rectangle, as GeoJSON (lng, lat). */
function box(b: Box) {
  return {
    type: 'Polygon',
    coordinates: [[
      [b.minLng, b.minLat],
      [b.maxLng, b.minLat],
      [b.maxLng, b.maxLat],
      [b.minLng, b.maxLat],
      [b.minLng, b.minLat],
    ]],
  }
}

/** Which rectangle holds each point: the plat read the map makes. */
function assignBy(plats: Record<string, Box>) {
  return async (points: ReadonlyArray<{ lat: number | null; lng: number | null }>) =>
    points.map((p) => {
      if (p.lat == null || p.lng == null) return null
      for (const [slug, b] of Object.entries(plats)) {
        if (p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng) return slug
      }
      return null
    })
}

function subjectAt(streetAddress: string, at: Pt, subdivision: string): CmaSubject {
  return {
    streetAddress,
    city: 'Bend',
    latitude: at.lat,
    longitude: at.lng,
    subdivision,
    propertySubType: 'Single Family Residence',
  } as unknown as CmaSubject
}

function sale(address: string, at: Pt, subdivision: string): CmaComp {
  return { address, latitude: at.lat, longitude: at.lng, subdivision, propertySubType: 'Single Family Residence' } as unknown as CmaComp
}

function svgOf(map: CmaMapResult): string {
  expect(map.dataUri.startsWith('data:image/svg+xml;base64,')).toBe(true)
  return Buffer.from(map.dataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8')
}

function ringOf(b: Box) {
  return ringsFromGeometry(box(b) as GeoJSON.Polygon, { maxPoints: Infinity, maxPolygons: Infinity })
}

const pinByKey = (map: CmaMapResult, key: string | null) => {
  const pin = map.pins.find((p) => p.key === key)
  expect(pin, `pin ${key ?? 'subject'}`).toBeDefined()
  return pin!
}

describe('the one map, reader review 2026-10-08: every pin inside a drawn line', () => {
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

  it('3037 Purcell: a sale 20 metres from another stays on its rooftop inside its plat, and the street-held plat is not drawn', async () => {
    // Silver Sage Phase I as recorded: lat 44.080231 to 44.082420. 2110 Carrie
    // sits 0.00014 degrees under the top edge; the old nudge put it 0.00036
    // above 2124 Carrie.
    const plats: Record<string, Box> = {
      'silver-sage-phase-i': { minLat: 44.080231, maxLat: 44.08242, minLng: -121.273701, maxLng: -121.271993 },
      'silver-sage-phase-2': { minLat: 44.080212, maxLat: 44.081242, minLng: -121.273749, maxLng: -121.273702 },
      'holliday-park-third-addition-phase-iii': { minLat: 44.074296, maxLat: 44.075875, minLng: -121.271369, maxLng: -121.268786 },
    }
    assigned.mockImplementation(assignBy(plats))
    boundary.mockImplementation(async ({ geoSlug }) => (plats[geoSlug] ? box(plats[geoSlug]!) : null))
    const subject = subjectAt('3037 Purcell', { lat: 44.080952, lng: -121.272517 }, 'Silver Sage')
    const comps = [
      sale('2124 Carrie', { lat: 44.082292, lng: -121.272478 }, 'Silver Sage'),
      sale('2058 Hollow Tree', { lat: 44.080803, lng: -121.27372 }, 'Silver Sage'),
      sale('2110 Carrie', { lat: 44.082282, lng: -121.272738 }, 'Silver Sage'),
      sale('2107 Carrie', { lat: 44.081817, lng: -121.272599 }, 'Silver Sage'),
      sale('2591 Purcell', { lat: 44.074665, lng: -121.269784 }, 'Holliday Park'),
    ]
    const map = await buildCmaMapDataUri(subject, comps, {
      compArea: {
        kind: 'subdivisions',
        names: ['Silver Sage', 'Holliday Park'],
        platSlugs: ['silver-sage-phase-i', 'silver-sage-phase-2'],
        street: { key: 'purcell', names: ['Holliday Park'], platSlugs: ['holliday-park-third-addition-phase-iii'] },
        sentence: 'Silver Sage, your own subdivision, with the Holliday Park homes on your street.',
      },
    })
    expect(map).not.toBeNull()
    expect(map!.boundaryShown).toBe(true)
    // Pin 3 is 2110 Carrie's rooftop, inside Silver Sage Phase I as recorded.
    const pin3 = pinByKey(map!, '3')
    expect(pin3.lat).toBe(44.082282)
    expect(pin3.lng).toBe(-121.272738)
    expect(pointInAnyRing(pin3, ringOf(plats['silver-sage-phase-i']!))).toBe(true)
    // Both Silver Sage plats are drawn and named; the plat held to the street is neither.
    const requested = boundary.mock.calls.map((c) => c[0].geoSlug)
    expect(requested).toContain('silver-sage-phase-i')
    expect(requested).toContain('silver-sage-phase-2')
    expect(requested).not.toContain('holliday-park-third-addition-phase-iii')
    expect(map!.outlineRings).toHaveLength(2)
    const svg = svgOf(map!)
    expect(svg).toContain('Silver Sage Phase I')
    expect(svg).toContain('Silver Sage Phase 2')
    expect(svg).not.toContain('Holliday Park Third Addition Phase III')
    // Every pin is inside a drawn line, except the one the caption holds to the street.
    expect(pinsOutsideOutlines({ pins: map!.pins, rings: map!.outlineRings })).toEqual(['5'])
    expect(pinsOutsideOutlines({ pins: map!.pins, rings: map!.outlineRings, streetKeys: ['5'] })).toEqual([])
  })

  it('2382 Jackson: a plat that runs off the top of the frame is drawn and named on the part the reader sees', async () => {
    const plats: Record<string, Box> = {
      'holliday-park-third-addition-phase-iii': { minLat: 44.074296, maxLat: 44.075875, minLng: -121.271369, maxLng: -121.268786 },
      'holliday-park-third-addition-phase-ii': { minLat: 44.075876, maxLat: 44.076598, minLng: -121.271223, maxLng: -121.268763 },
      // Aspen Heights Phase IV as recorded starts 0.0004 above Phase II's top
      // edge. Here it is a kilometre tall so its centroid is well off the frame.
      'aspen-heights-phase-iv': { minLat: 44.076599, maxLat: 44.0866, minLng: -121.270294, maxLng: -121.268762 },
    }
    assigned.mockImplementation(assignBy(plats))
    boundary.mockImplementation(async ({ geoSlug }) => (plats[geoSlug] ? box(plats[geoSlug]!) : null))
    const subject = subjectAt('2382 Jackson', { lat: 44.075079, lng: -121.268868 }, 'Holliday Park')
    const comps = [
      sale('2224 Indigo', { lat: 44.075936, lng: -121.271063 }, 'Holliday Park'),
      sale('2254 Indigo', { lat: 44.076059, lng: -121.269702 }, 'Holliday Park'),
      sale('2799 Baroness', { lat: 44.076992, lng: -121.269777 }, 'Aspen Heights'),
      sale('2266 Jackson', { lat: 44.075276, lng: -121.270033 }, 'Holliday Park'),
      sale('2591 Purcell', { lat: 44.074665, lng: -121.269784 }, 'Holliday Park'),
    ]
    const map = await buildCmaMapDataUri(subject, comps, {
      compArea: {
        kind: 'subdivisions',
        names: ['Holliday Park', 'Aspen Heights'],
        platSlugs: ['holliday-park-third-addition-phase-iii', 'holliday-park-third-addition-phase-ii', 'aspen-heights-phase-iv'],
        street: null,
        sentence: 'Holliday Park, your own subdivision, with Aspen Heights one subdivision further out.',
      },
    })
    expect(map).not.toBeNull()
    // Baroness's pin is in Aspen Heights, not in either Holliday Park phase.
    const pin3 = pinByKey(map!, '3')
    expect(pointInAnyRing(pin3, ringOf(plats['aspen-heights-phase-iv']!))).toBe(true)
    expect(pointInAnyRing(pin3, ringOf(plats['holliday-park-third-addition-phase-ii']!))).toBe(false)
    expect(map!.outlineRings).toHaveLength(3)
    // The frame holds no part of Aspen Heights' centroid, and the name is on the map anyway.
    const svg = svgOf(map!)
    expect(svg).toContain('Aspen Heights Phase IV')
    expect(svg).toContain('Holliday Park Third Addition Phase II')
    expect(svg).toContain('Holliday Park Third Addition Phase III')
    expect(pinsOutsideOutlines({ pins: map!.pins, rings: map!.outlineRings })).toEqual([])
  })

  it('2745 Aldrich: the competing home 11 metres from a sale keeps its rooftop inside Madison Park', async () => {
    const plats: Record<string, Box> = {
      'obsidian-ridge-phases-i-and-ii': { minLat: 44.080234, maxLat: 44.082159, minLng: -121.263625, maxLng: -121.261257 },
      'merrick-subdivision-phases-1-and-2': { minLat: 44.081316, maxLat: 44.082222, minLng: -121.261256, maxLng: -121.258753 },
      // Madison Park as recorded: 0.0007 degrees tall. The old nudge was half that.
      'madison-park': { minLat: 44.082246, maxLat: 44.08296, minLng: -121.261236, maxLng: -121.258756 },
    }
    assigned.mockImplementation(assignBy(plats))
    boundary.mockImplementation(async ({ geoSlug }) => (plats[geoSlug] ? box(plats[geoSlug]!) : null))
    const subject = subjectAt('2745 Aldrich', { lat: 44.082009, lng: -121.263489 }, 'Obsidian Ridge')
    const comps = [
      sale('2807 Spring Water', { lat: 44.081429, lng: -121.260933 }, 'Merrick'),
      sale('3227 Sandalwood', { lat: 44.082769, lng: -121.260781 }, 'Madison Park'),
      sale('2812 Aldrich', { lat: 44.082438, lng: -121.260994 }, 'Madison Park'),
      sale('3223 Spring Creek', { lat: 44.082677, lng: -121.259558 }, 'Madison Park'),
      sale('2799 Aldrich', { lat: 44.082038, lng: -121.261322 }, 'Obsidian Ridge'),
    ]
    const map = await buildCmaMapDataUri(subject, comps, {
      active: [{ address: '2820 Aldrich', latitude: 44.082453, longitude: -121.260857 }],
      unsold: [{ address: '3204 Spring Creek', latitude: 44.082334, longitude: -121.258915 }],
      compArea: {
        kind: 'subdivisions',
        names: ['Obsidian Ridge', 'Merrick', 'Madison Park'],
        platSlugs: ['obsidian-ridge-phases-i-and-ii', 'merrick-subdivision-phases-1-and-2', 'madison-park'],
        street: null,
        sentence: 'Obsidian Ridge, your own subdivision, with Merrick and Madison Park next to it.',
      },
    })
    expect(map).not.toBeNull()
    expect(map!.pins.map((p) => p.key)).toEqual([null, '1', '2', '3', '4', '5', 'A', 'i'])
    const pinA = pinByKey(map!, 'A')
    expect(pinA.lat).toBe(44.082453)
    expect(pinA.lng).toBe(-121.260857)
    expect(pointInAnyRing(pinA, ringOf(plats['madison-park']!))).toBe(true)
    expect(map!.outlineRings).toHaveLength(3)
    expect(pinsOutsideOutlines({ pins: map!.pins, rings: map!.outlineRings })).toEqual([])
  })
})
