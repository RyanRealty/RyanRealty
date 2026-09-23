import { describe, expect, it } from 'vitest'
import {
  atlasCoordDecimals,
  atlasGeometryTolerance,
  compactAtlasGeometries,
  compactAtlasGeometry,
  simplifyLine,
} from './compact-geometry'
import { makeProjection, outerRings, padBbox, ringsToPath } from '@/lib/geo/project-svg'

/** A wobbly circle: the county-GIS shape, hundreds of vertices at 15 decimals. */
function wobble(cx: number, cy: number, r: number, n: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (1 + 0.00003 * Math.sin(i * 7.3))
    out.push([cx + rr * Math.cos(a) + 1.234567891e-9, cy + rr * Math.sin(a) - 9.87654321e-10])
  }
  out.push(out[0]!)
  return out
}

describe('atlasGeometryTolerance (UXLIVE-3)', () => {
  it('is half a viewBox unit at the deepest zoom, clamped to 0.1 m .. 10 m', () => {
    // A 0.3-degree city frame: 0.3 / 1000 / 5 / 2 = 3e-5 degrees.
    expect(atlasGeometryTolerance({ minLon: -121.5, maxLon: -121.2, minLat: 44, maxLat: 44.1 })).toBeCloseTo(3e-5, 10)
    // A whole-region frame clamps at 1e-4 degrees.
    expect(atlasGeometryTolerance({ minLon: -122, maxLon: -119, minLat: 43, maxLat: 45 })).toBe(1e-4)
    // A tiny plat clamps at 1e-6.
    expect(atlasGeometryTolerance({ minLon: -121.3, maxLon: -121.2999, minLat: 44, maxLat: 44.0001 })).toBe(1e-6)
    expect(atlasGeometryTolerance(null)).toBe(1e-6)
  })

  it('keeps rounding error under the tolerance', () => {
    for (const tol of [1e-6, 3e-6, 3e-5, 1e-4]) {
      const d = atlasCoordDecimals(tol)
      expect(0.5 * 10 ** -d).toBeLessThanOrEqual(tol)
    }
  })
})

describe('simplifyLine', () => {
  it('drops collinear points and keeps the ends', () => {
    const line = [
      [0, 0],
      [1, 0.0000001],
      [2, 0],
      [3, 5],
    ]
    expect(simplifyLine(line, 0.001)).toEqual([
      [0, 0],
      [2, 0],
      [3, 5],
    ])
  })

  it('keeps every point that moves the line by more than the tolerance', () => {
    const zig = [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]
    expect(simplifyLine(zig, 0.1)).toEqual(zig)
  })
})

describe('compactAtlasGeometry', () => {
  const box = { minLon: -121.35, maxLon: -121.25, minLat: 44.02, maxLat: 44.08 }
  const tol = atlasGeometryTolerance(box)
  const poly: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [wobble(-121.3, 44.05, 0.02, 1200), wobble(-121.3, 44.05, 0.005, 40)],
  }

  it('ships a fraction of the bytes', () => {
    const slim = compactAtlasGeometry(poly, tol)
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(poly).length / 3)
  })

  it('draws the same outline: every path vertex within a tenth of a viewBox unit', () => {
    const slim = compactAtlasGeometry(poly, tol)
    const proj = makeProjection(padBbox(box, 0.1), 1000)
    const full = outerRings(poly)[0]!
    const kept = outerRings(slim)[0]!
    // Every kept vertex lies on (a rounding of) the original ring.
    for (const [lon, lat] of kept) {
      const best = Math.min(...full.map(([x, y]) => Math.hypot(x - lon, y - lat)))
      expect(best).toBeLessThanOrEqual(tol)
    }
    // And the drawn path is still a closed ring with a real shape.
    expect(kept[0]).toEqual(kept[kept.length - 1])
    expect(kept.length).toBeGreaterThanOrEqual(4)
    expect(ringsToPath([kept], proj)).toMatch(/^M[\d.]+ [\d.]+L[\s\S]*Z$/)
  })

  it('drops holes (outerRings never reads them) and keeps each polygon of a multipolygon', () => {
    const slim = compactAtlasGeometry(poly, tol)
    expect(slim.coordinates).toHaveLength(1)
    const multi: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [poly.coordinates, [wobble(-121.2, 44.1, 0.01, 300)]],
    }
    const slimMulti = compactAtlasGeometry(multi, tol)
    expect(slimMulti.coordinates).toHaveLength(2)
    expect(slimMulti.coordinates.every((p) => p.length === 1)).toBe(true)
  })

  it('never collapses a small ring below four points', () => {
    const tiny: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.3, 44.05],
          [-121.30000001, 44.05],
          [-121.30000001, 44.05000001],
          [-121.3, 44.05],
        ],
      ],
    }
    // Coarser than the whole shape: rounding would erase it, so it keeps its
    // own vertices and stays a drawn, tappable place.
    const slim = compactAtlasGeometry(tiny, 1e-4)
    expect(slim.coordinates[0]!.length).toBeGreaterThanOrEqual(4)
    expect(outerRings(slim)).toHaveLength(1)
    const small: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.3, 44.05],
          [-121.29998, 44.05],
          [-121.29998, 44.05002],
          [-121.3, 44.05],
        ],
      ],
    }
    expect(outerRings(compactAtlasGeometry(small, 1e-4))).toHaveLength(1)
  })

  it('keeps every part of a trail line', () => {
    const trail: GeoJSON.MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        wobble(-121.3, 44.05, 0.01, 200).slice(0, 100),
        [
          [-121.31, 44.04],
          [-121.3, 44.041],
        ],
      ],
    }
    const slim = compactAtlasGeometry(trail, tol)
    expect(slim.coordinates).toHaveLength(2)
    expect(slim.coordinates[1]).toHaveLength(2)
  })

  it('keeps every other field of a region', () => {
    const [r] = compactAtlasGeometries([{ id: 'x', name: 'X', href: '/x', geometry: poly as GeoJSON.Geometry }], tol)
    expect(r).toMatchObject({ id: 'x', name: 'X', href: '/x' })
  })
})
