import { describe, expect, it } from 'vitest'
import { silhouetteTile, SILHOUETTE_TILE } from './silhouette-tile'

/** Every coordinate pair in a path, as numbers. */
function points(d: string): [number, number][] {
  return [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
}

const square: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.4, 44.0],
      [-121.3, 44.0],
      [-121.3, 44.1],
      [-121.4, 44.1],
      [-121.4, 44.0],
    ],
  ],
}

describe('silhouetteTile', () => {
  it('fits the outline inside the tile with its margin, and names the viewBox', () => {
    const tile = silhouetteTile(square)
    expect(tile).not.toBeNull()
    expect(tile!.viewBox).toBe('0 0 44 44')
    const pts = points(tile!.d)
    expect(pts.length).toBe(5)
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(SILHOUETTE_TILE.pad - 0.05)
      expect(x).toBeLessThanOrEqual(SILHOUETTE_TILE.w - SILHOUETTE_TILE.pad + 0.05)
      expect(y).toBeGreaterThanOrEqual(SILHOUETTE_TILE.pad - 0.05)
      expect(y).toBeLessThanOrEqual(SILHOUETTE_TILE.h - SILHOUETTE_TILE.pad + 0.05)
    }
    // The taller axis (latitude, at 44°N a degree of longitude is shorter) fills the box.
    const ys = pts.map((p) => p[1])
    expect(Math.min(...ys)).toBeCloseTo(SILHOUETTE_TILE.pad, 1)
    expect(Math.max(...ys)).toBeCloseTo(SILHOUETTE_TILE.h - SILHOUETTE_TILE.pad, 1)
    // The narrower axis is centred.
    const xs = pts.map((p) => p[0])
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(SILHOUETTE_TILE.w / 2, 1)
    expect(tile!.d.endsWith('Z')).toBe(true)
  })

  it('keeps every outer ring of a MultiPolygon and drops holes', () => {
    const two: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [square.coordinates[0]!, [[-121.38, 44.02], [-121.32, 44.02], [-121.32, 44.08], [-121.38, 44.02]]],
        [[[-121.2, 44.0], [-121.1, 44.0], [-121.1, 44.05], [-121.2, 44.0]]],
      ],
    }
    const tile = silhouetteTile(two)
    expect(tile!.d.match(/Z/g)).toHaveLength(2)
    expect(tile!.d.match(/M/g)).toHaveLength(2)
  })

  it('draws nothing for no geometry, a point, or a degenerate ring', () => {
    expect(silhouetteTile(null)).toBeNull()
    expect(silhouetteTile(undefined)).toBeNull()
    expect(silhouetteTile({ type: 'Point', coordinates: [-121.3, 44.05] })).toBeNull()
    expect(silhouetteTile({ type: 'Polygon', coordinates: [[[-121.3, 44.0], [-121.3, 44.0], [-121.3, 44.0], [-121.3, 44.0]]] })).toBeNull()
  })
})
