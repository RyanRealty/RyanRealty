import { describe, expect, it } from 'vitest'
import { pupilOffset } from './pupil-offset'

describe('pupilOffset (V3DogFloater eye tracking)', () => {
  it('stays centered with no pointer reading', () => {
    expect(pupilOffset({ x: 34, y: 24 }, null, 3)).toEqual({ dx: 0, dy: 0 })
  })

  it('stays centered with a zero radius (reduced motion / disabled)', () => {
    expect(pupilOffset({ x: 34, y: 24 }, { x: 500, y: 500 }, 0)).toEqual({ dx: 0, dy: 0 })
  })

  it('stays centered when the pointer sits exactly on the eye', () => {
    expect(pupilOffset({ x: 34, y: 24 }, { x: 34, y: 24 }, 3)).toEqual({ dx: 0, dy: 0 })
  })

  it('points straight at a pointer directly to the right, capped at maxRadius', () => {
    const { dx, dy } = pupilOffset({ x: 0, y: 0 }, { x: 1000, y: 0 }, 3)
    expect(dx).toBeCloseTo(3, 5)
    expect(dy).toBeCloseTo(0, 5)
  })

  it('points straight down for a pointer far below', () => {
    const { dx, dy } = pupilOffset({ x: 0, y: 0 }, { x: 0, y: 1000 }, 3)
    expect(dx).toBeCloseTo(0, 5)
    expect(dy).toBeCloseTo(3, 5)
  })

  it('moves proportionally, not to the cap, when the pointer is closer than maxRadius', () => {
    const { dx, dy } = pupilOffset({ x: 0, y: 0 }, { x: 1, y: 0 }, 3)
    expect(dx).toBeCloseTo(1, 5)
    expect(dy).toBeCloseTo(0, 5)
  })

  it('two far-apart pointers produce different, opposite offsets', () => {
    const eye = { x: 34, y: 24 }
    const left = pupilOffset(eye, { x: -900, y: 24 }, 3)
    const right = pupilOffset(eye, { x: 968, y: 24 }, 3)
    expect(left.dx).toBeLessThan(0)
    expect(right.dx).toBeGreaterThan(0)
    expect(left.dx).not.toBeCloseTo(right.dx, 3)
  })

  it('the direction matches atan2 for an arbitrary diagonal pointer', () => {
    const eye = { x: 10, y: 10 }
    const pointer = { x: 10 + 30, y: 10 + 40 } // 3-4-5 triangle, distance 50
    const { dx, dy } = pupilOffset(eye, pointer, 5)
    // Unit direction (0.6, 0.8) times the 5px cap.
    expect(dx).toBeCloseTo(3, 4)
    expect(dy).toBeCloseTo(4, 4)
  })
})
