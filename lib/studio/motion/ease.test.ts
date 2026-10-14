import { describe, expect, it } from 'vitest'
import { BRAND_EASE_MOVE, BRAND_EASE_OUT, cubicBezier, presence, progress } from './ease'

const ease = (x: number) => cubicBezier(...BRAND_EASE_OUT, x)

describe('brand ease-out', () => {
  it('starts at 0, ends at 1, and never runs backwards', () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    let last = 0
    for (let i = 1; i <= 100; i++) {
      const y = ease(i / 100)
      expect(y).toBeGreaterThanOrEqual(last)
      last = y
    }
  })

  it('is an ease-out: most of the move happens early', () => {
    expect(ease(0.25)).toBeGreaterThan(0.25)
    expect(ease(0.5)).toBeGreaterThan(0.7)
  })

  it('agrees with linear when the curve is linear', () => {
    for (const x of [0.1, 0.33, 0.5, 0.9]) expect(cubicBezier(0, 0, 1, 1, x)).toBeCloseTo(x, 5)
  })
})

describe('brand move ease', () => {
  const move = (x: number) => cubicBezier(...BRAND_EASE_MOVE, x)

  it('is cubic-bezier(.65,0,.35,1): slow in, slow out, symmetric about the middle', () => {
    expect(BRAND_EASE_MOVE).toEqual([0.65, 0, 0.35, 1])
    expect(move(0)).toBe(0)
    expect(move(1)).toBe(1)
    expect(move(0.5)).toBeCloseTo(0.5, 6)
    for (const x of [0.1, 0.2, 0.35]) expect(move(x) + move(1 - x)).toBeCloseTo(1, 6)
    expect(move(0.1)).toBeLessThan(0.1)
    expect(move(0.9)).toBeGreaterThan(0.9)
  })
})

describe('presence', () => {
  const cue = { start: 1, end: 4 }

  it('is 0 outside the cue and 1 while it holds', () => {
    expect(presence(0.5, cue, 0.4, 0.3)).toBe(0)
    expect(presence(2.5, cue, 0.4, 0.3)).toBe(1)
    expect(presence(4.5, cue, 0.4, 0.3)).toBe(0)
  })

  it('eases in over the entrance and out over the exit', () => {
    expect(presence(1.2, cue, 0.4, 0.3)).toBeGreaterThan(0)
    expect(presence(1.2, cue, 0.4, 0.3)).toBeLessThan(1)
    expect(presence(3.85, cue, 0.4, 0.3)).toBeLessThan(1)
  })

  it('a closing cue with no exit stays to its last frame', () => {
    expect(presence(4, cue, 0.4, 0)).toBe(1)
  })

  it('progress clamps', () => {
    expect(progress(-1, 0, 1)).toBe(0)
    expect(progress(5, 0, 1)).toBe(1)
  })
})
