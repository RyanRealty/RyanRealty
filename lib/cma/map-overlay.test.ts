import { describe, expect, it } from 'vitest'
import { circlePath, pathParam, ringsFromGeometry, simplifyRing } from '@/lib/cma/map-overlay'

describe('circlePath', () => {
  it('closes a 1-mile ring around a Central Oregon pin', () => {
    const ring = circlePath({ lat: 44.27, lng: -121.17 }, 1, 36)
    expect(ring.length).toBe(37)
    expect(ring[0]?.lat).toBeCloseTo(ring[ring.length - 1]!.lat, 5)
    expect(ring[0]?.lng).toBeCloseTo(ring[ring.length - 1]!.lng, 5)
    const north = ring.reduce((a, p) => (p.lat > a.lat ? p : a))
    expect(north.lat).toBeGreaterThan(44.27)
    expect(north.lat).toBeLessThan(44.3)
  })
})

describe('ringsFromGeometry', () => {
  it('samples a polygon ring', () => {
    const rings = ringsFromGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [-121.18, 44.26],
          [-121.16, 44.26],
          [-121.16, 44.28],
          [-121.18, 44.28],
          [-121.18, 44.26],
        ],
      ],
    })
    expect(rings).toHaveLength(1)
    expect(rings[0]!.length).toBeGreaterThanOrEqual(4)
  })
})

describe('pathParam', () => {
  it('writes a Static Maps path', () => {
    const ring = simplifyRing([
      { lat: 44.26, lng: -121.18 },
      { lat: 44.26, lng: -121.16 },
      { lat: 44.28, lng: -121.16 },
      { lat: 44.28, lng: -121.18 },
      { lat: 44.26, lng: -121.18 },
    ])
    expect(pathParam('0x102742CC', '0x10274233', ring)).toMatch(/^color:0x102742CC\|weight:2\|fillcolor:0x10274233\|/)
  })
})
