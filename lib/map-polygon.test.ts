import { describe, it, expect } from 'vitest'
import { isPointInPolygon, isInsideAnyRing, getPolygonBounds, type MapPolygonPoint } from './map-polygon'

// A unit square (lng 0..1, lat 0..1).
const SQUARE: MapPolygonPoint[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
]

// A second, disjoint square (lng 10..11, lat 10..11) — for the MultiPolygon case.
const FAR_SQUARE: MapPolygonPoint[] = [
  { lat: 10, lng: 10 },
  { lat: 10, lng: 11 },
  { lat: 11, lng: 11 },
  { lat: 11, lng: 10 },
]

describe('isPointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, SQUARE)).toBe(true)
  })
  it('returns false for a point outside the polygon', () => {
    expect(isPointInPolygon({ lat: 5, lng: 5 }, SQUARE)).toBe(false)
  })
  it('returns false for a degenerate polygon (< 3 points)', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(false)
  })
})

describe('isInsideAnyRing (pin clipping)', () => {
  it('shows all pins when there is no boundary (empty rings)', () => {
    expect(isInsideAnyRing({ lat: 999, lng: 999 }, [])).toBe(true)
  })
  it('keeps a pin inside the single ring', () => {
    expect(isInsideAnyRing({ lat: 0.25, lng: 0.75 }, [SQUARE])).toBe(true)
  })
  it('drops a pin outside the single ring (the "homes outside the polygon" bug)', () => {
    expect(isInsideAnyRing({ lat: 5, lng: 5 }, [SQUARE])).toBe(false)
  })
  it('keeps a pin inside the second ring of a MultiPolygon', () => {
    expect(isInsideAnyRing({ lat: 10.5, lng: 10.5 }, [SQUARE, FAR_SQUARE])).toBe(true)
  })
  it('drops a pin that is outside every ring of a MultiPolygon', () => {
    expect(isInsideAnyRing({ lat: 5, lng: 5 }, [SQUARE, FAR_SQUARE])).toBe(false)
  })

  it('clips a realistic pin set down to only the in-boundary homes', () => {
    const pins = [
      { lat: 0.1, lng: 0.1 }, // in
      { lat: 0.9, lng: 0.9 }, // in
      { lat: 2.0, lng: 2.0 }, // out
      { lat: -1.0, lng: 0.5 }, // out
    ]
    const clipped = pins.filter((p) => isInsideAnyRing(p, [SQUARE]))
    expect(clipped).toHaveLength(2)
    expect(clipped).toEqual([
      { lat: 0.1, lng: 0.1 },
      { lat: 0.9, lng: 0.9 },
    ])
  })
})

describe('getPolygonBounds', () => {
  it('computes the bounding box of a ring', () => {
    expect(getPolygonBounds(SQUARE)).toEqual({ west: 0, south: 0, east: 1, north: 1 })
  })
})
