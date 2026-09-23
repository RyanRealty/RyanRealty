import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { countClosedInside, pointInGeometry } from './getPlatFamilyFootprint'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'

// Two phases side by side, the second with a hole (a lot the county left out).
const union: BoundaryGeometry = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
    [
      [
        [2, 0],
        [4, 0],
        [4, 2],
        [2, 2],
        [2, 0],
      ],
      [
        [2.5, 0.5],
        [3.5, 0.5],
        [3.5, 1.5],
        [2.5, 1.5],
        [2.5, 0.5],
      ],
    ],
  ],
}

describe('pointInGeometry', () => {
  it('finds a point in either phase and never in a hole', () => {
    expect(pointInGeometry(0.5, 0.5, union)).toBe(true)
    expect(pointInGeometry(2.2, 1, union)).toBe(true)
    expect(pointInGeometry(3, 1, union)).toBe(false)
    expect(pointInGeometry(1.5, 0.5, union)).toBe(false)
  })
})

describe('countClosedInside', () => {
  it('counts each sale once, inside the outline only, by close year', () => {
    const out = countClosedInside(
      [
        { listing_key: 'a', lat: 0.5, lng: 0.5, close_date: '2024-05-01T00:00:00Z' },
        // The same sale read twice (a replat overlapping its phase).
        { listing_key: 'a', lat: 0.5, lng: 0.5, close_date: '2024-05-01T00:00:00Z' },
        { listing_key: 'b', lat: 1, lng: 2.2, close_date: '2025-02-01T00:00:00Z' },
        // In the hole and outside: not counted.
        { listing_key: 'c', lat: 1, lng: 3, close_date: '2025-02-01T00:00:00Z' },
        { listing_key: 'd', lat: 0.5, lng: 1.5, close_date: '2025-02-01T00:00:00Z' },
        // Inside, no close date: counted, no year.
        { listing_key: 'e', lat: 0.2, lng: 0.2, close_date: null },
      ],
      union,
      2026,
    )
    expect(out.closedCount).toBe(3)
    expect(out.closedByYear).toEqual({ 2024: 1, 2025: 1 })
  })
})
