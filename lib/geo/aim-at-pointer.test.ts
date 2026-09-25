import { describe, expect, it } from 'vitest'
import { aimAtPointer, headAimTransform, HEAD_AT_REST } from './aim-at-pointer'

const C = { x: 1000, y: 400 }

describe('aimAtPointer (V3DogFloater: the whole head turns, the eye stays fixed)', () => {
  it('rests with no pointer reading or with the pointer on the center', () => {
    expect(aimAtPointer(C, null)).toEqual(HEAD_AT_REST)
    expect(aimAtPointer(C, { x: 1000, y: 400 })).toEqual(HEAD_AT_REST)
  })

  it('rests while the pointer is on the dog himself, so hovering or tapping him never spins the head', () => {
    // A 34px radius is the floater's own circle; 30px below the center is on him.
    expect(aimAtPointer(C, { x: 1000, y: 430 }, 34)).toEqual(HEAD_AT_REST)
    expect(aimAtPointer(C, { x: 1020, y: 380 }, 34)).toEqual(HEAD_AT_REST)
    // Just off the circle he looks again.
    expect(aimAtPointer(C, { x: 1000, y: 440 }, 34)).toEqual({ deg: -90, mirror: false })
  })

  it('does not turn when the ball is straight ahead (the art already faces left)', () => {
    expect(aimAtPointer(C, { x: 200, y: 400 })).toEqual({ deg: 0, mirror: false })
  })

  it('turns clockwise to look up-left and counter-clockwise to look down-left', () => {
    expect(aimAtPointer(C, { x: 600, y: 0 })).toEqual({ deg: 45, mirror: false })
    expect(aimAtPointer(C, { x: 600, y: 800 })).toEqual({ deg: -45, mirror: false })
  })

  it('looks straight up or down without mirroring', () => {
    expect(aimAtPointer(C, { x: 1000, y: 0 })).toEqual({ deg: 90, mirror: false })
    expect(aimAtPointer(C, { x: 1000, y: 900 })).toEqual({ deg: -90, mirror: false })
  })

  it('mirrors to face right instead of hanging upside down when the ball is to its right', () => {
    expect(aimAtPointer(C, { x: 1300, y: 400 })).toEqual({ deg: 0, mirror: true })
    expect(aimAtPointer(C, { x: 1300, y: 100 })).toEqual({ deg: -45, mirror: true })
  })

  it('never turns a left-facing head past a little over a quarter circle', () => {
    for (let a = 0; a < 360; a += 5) {
      const r = (a * Math.PI) / 180
      const aim = aimAtPointer(C, { x: C.x + Math.cos(r) * 300, y: C.y + Math.sin(r) * 300 })
      expect(Math.abs(aim.deg), `angle ${a}`).toBeLessThanOrEqual(102)
    }
  })

  it('writes the transform mirror-first so a mirrored head still turns toward the ball', () => {
    expect(headAimTransform({ deg: 12.5, mirror: false })).toBe('rotate(12.5deg)')
    expect(headAimTransform({ deg: -30, mirror: true })).toBe('rotate(-30deg) scaleX(-1)')
  })
})
