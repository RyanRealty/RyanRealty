import { describe, expect, it } from 'vitest'
import {
  basemapPoints,
  clipBasemap,
  decodeBasemapFeature,
  decodeBasemapPath,
  EMPTY_BASEMAP,
  thinBasemap,
  type Basemap,
  type BasemapFeature,
} from './basemap'

const Q = 10000

function road(name: string, points: [number, number][]): BasemapFeature {
  const encoded: number[] = []
  let px = 0
  let py = 0
  for (let i = 0; i < points.length; i += 1) {
    const x = Math.round(points[i]![0] * Q)
    const y = Math.round(points[i]![1] * Q)
    if (i === 0) encoded.push(x, y)
    else encoded.push(x - px, y - py)
    px = x
    py = y
  }
  const xs = points.map((p) => Math.round(p[0] * Q))
  const ys = points.map((p) => Math.round(p[1] * Q))
  return {
    c: 'secondary',
    n: name,
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    p: [encoded],
  }
}

const BEND_ROAD = road('NE 3rd St', [
  [-121.31, 44.06],
  [-121.3, 44.08],
  [-121.29, 44.1],
])
const PRINEVILLE_ROAD = road('Ochoco Hwy', [
  [-120.85, 44.3],
  [-120.8, 44.31],
])

const BASE: Basemap = {
  ...EMPTY_BASEMAP,
  source: 'US Census TIGER/Line 2024',
  q: Q,
  roads: [BEND_ROAD, PRINEVILLE_ROAD],
  waterways: [road('Deschutes River', [[-121.4, 43.9], [-121.35, 44.2], [-121.3, 44.5]])],
  bodies: [road('Suttle Lake', [[-121.75, 44.41], [-121.73, 44.42], [-121.75, 44.41]])],
}

describe('decodeBasemapPath', () => {
  it('walks the deltas back to lon/lat', () => {
    const points = decodeBasemapPath(BEND_ROAD.p[0]!, Q)
    expect(points).toHaveLength(3)
    expect(points[0]![0]).toBeCloseTo(-121.31, 6)
    expect(points[1]![1]).toBeCloseTo(44.08, 6)
    expect(points[2]![0]).toBeCloseTo(-121.29, 6)
  })

  it('a path shorter than one segment decodes to nothing', () => {
    expect(decodeBasemapPath([12, 34], Q)).toEqual([])
    expect(decodeBasemapPath([], Q)).toEqual([])
  })

  it('quantization error stays inside half a unit', () => {
    const original: [number, number][] = [
      [-121.31234, 44.06789],
      [-121.29876, 44.07123],
    ]
    const decoded = decodeBasemapPath(road('x', original).p[0]!, Q)
    for (let i = 0; i < original.length; i += 1) {
      expect(Math.abs(decoded[i]![0] - original[i]![0])).toBeLessThanOrEqual(0.5 / Q)
      expect(Math.abs(decoded[i]![1] - original[i]![1])).toBeLessThanOrEqual(0.5 / Q)
    }
  })
})

describe('decodeBasemapFeature', () => {
  it('returns one array of points per part', () => {
    expect(decodeBasemapFeature(BEND_ROAD, Q)).toHaveLength(1)
    expect(decodeBasemapFeature({ ...BEND_ROAD, p: [] }, Q)).toEqual([])
  })
})

describe('clipBasemap', () => {
  it('keeps what the frame holds and drops what it does not', () => {
    const clipped = clipBasemap(BASE, { minLon: -121.35, maxLon: -121.25, minLat: 44.0, maxLat: 44.15 }, 0)
    expect(clipped.roads.map((r) => r.n)).toEqual(['NE 3rd St'])
    expect(clipped.waterways.map((r) => r.n)).toEqual(['Deschutes River'])
    expect(clipped.bodies).toEqual([])
  })

  it('padding pulls in a road that only just leaves the frame', () => {
    const bbox = { minLon: -121.35, maxLon: -120.9, minLat: 44.0, maxLat: 44.25 }
    expect(clipBasemap(BASE, bbox, 0).roads.map((r) => r.n)).toEqual(['NE 3rd St'])
    expect(clipBasemap(BASE, bbox, 0.3).roads.map((r) => r.n)).toEqual(['NE 3rd St', 'Ochoco Hwy'])
  })

  it('no frame keeps everything; no basemap is empty', () => {
    expect(clipBasemap(BASE, null).roads).toHaveLength(2)
    expect(clipBasemap(null, null)).toBe(EMPTY_BASEMAP)
  })

  it('a feature with no drawable path never survives', () => {
    const withEmpty: Basemap = { ...BASE, roads: [{ ...BEND_ROAD, p: [] }] }
    expect(clipBasemap(withEmpty, { minLon: -122, maxLon: -120, minLat: 43, maxLat: 45 }, 0).roads).toEqual([])
  })
})

describe('thinBasemap', () => {
  it('drops water too small to read at this frame, and never a road', () => {
    const bbox = { minLon: -122, maxLon: -120, minLat: 43, maxLat: 45 }
    const thinned = thinBasemap(BASE, bbox, 0.04)
    expect(thinned.roads).toHaveLength(2)
    expect(thinned.waterways.map((w) => w.n)).toEqual(['Deschutes River'])
    expect(thinned.bodies).toEqual([])
  })

  it('the same lake survives a frame it fills', () => {
    const bbox = { minLon: -121.78, maxLon: -121.7, minLat: 44.39, maxLat: 44.44 }
    expect(thinBasemap(BASE, bbox, 0.04).bodies.map((b) => b.n)).toEqual(['Suttle Lake'])
  })
})

describe('basemapPoints', () => {
  it('counts every coordinate the payload carries', () => {
    expect(basemapPoints(BASE)).toBe(3 + 2 + 3 + 3)
    expect(basemapPoints(null)).toBe(0)
  })
})
