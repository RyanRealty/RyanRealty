import { describe, expect, it } from 'vitest'
import { pointInRings, polygonInteriorPoint, type Ring } from './project-svg'

describe('polygonInteriorPoint (district label anchor)', () => {
  it('lands inside a simple square, away from the edges', () => {
    const square: Ring = [
      [-121.32, 44.05],
      [-121.28, 44.05],
      [-121.28, 44.09],
      [-121.32, 44.09],
      [-121.32, 44.05],
    ]
    const p = polygonInteriorPoint([square])
    expect(p).not.toBeNull()
    expect(pointInRings(p![0], p![1], [square])).toBe(true)
    // Near the middle, not jammed against a corner.
    expect(p![0]).toBeGreaterThan(-121.31)
    expect(p![0]).toBeLessThan(-121.29)
    expect(p![1]).toBeGreaterThan(44.06)
    expect(p![1]).toBeLessThan(44.08)
  })

  it('stays inside an L-shaped (concave) polygon, not in the notch', () => {
    const ell: Ring = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
      [0, 0],
    ]
    const p = polygonInteriorPoint([ell])
    expect(p).not.toBeNull()
    expect(pointInRings(p![0], p![1], [ell])).toBe(true)
    // The notch (x>4, y>4) is outside the L — the point must not land there.
    expect(p![0] <= 4 || p![1] <= 4).toBe(true)
  })

  it('prefers the larger lobe of a dumbbell shape over either thin neck', () => {
    // Two 4x4 lobes joined by a 1-wide waist — the farthest-from-every-edge
    // point should land inside a lobe (distance ~2), not in the waist
    // (distance ~0.5).
    const dumbbell: Ring = [
      [0, 0],
      [4, 0],
      [4, 1.5],
      [6, 1.5],
      [6, 0],
      [10, 0],
      [10, 4],
      [6, 4],
      [6, 2.5],
      [4, 2.5],
      [4, 4],
      [0, 4],
      [0, 0],
    ]
    const p = polygonInteriorPoint([dumbbell])
    expect(p).not.toBeNull()
    expect(pointInRings(p![0], p![1], [dumbbell])).toBe(true)
    // Not sitting in the narrow waist (4 <= x <= 6).
    expect(p![0] < 4 || p![0] > 6).toBe(true)
  })

  it('returns null rather than guessing when there are no rings', () => {
    expect(polygonInteriorPoint([])).toBeNull()
  })

  it('returns null for a degenerate, zero-area ring rather than guessing', () => {
    // Every vertex is the same point: the bbox has zero span, so there is no
    // window to sample and the function refuses rather than reporting a
    // point that cannot be verified inside anything.
    const collapsed: Ring = [
      [-121.3, 44.06],
      [-121.3, 44.06],
      [-121.3, 44.06],
    ]
    expect(polygonInteriorPoint([collapsed])).toBeNull()
  })
})
