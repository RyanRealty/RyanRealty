import { describe, expect, it } from 'vitest'
import { BRAND_EASE_OUT, cubicBezier } from './ease'
import { EXIT_SECONDS, frameState, type MotionCue, type MotionPlan } from './cues'
import {
  HOLD_DRIFT_PX,
  REVEAL_FRAMES,
  REVEAL_SCALE_FROM,
  REVEAL_SECONDS,
  driftBetween,
  holdDrift,
  revealPose,
} from './reveal'

const ease = (p: number) => cubicBezier(BRAND_EASE_OUT[0], BRAND_EASE_OUT[1], BRAND_EASE_OUT[2], BRAND_EASE_OUT[3], p)

const numberCue: MotionCue = {
  kind: 'number',
  id: 'hook-number',
  start: 0.1,
  end: 3.7,
  eyebrow: 'City of Bend',
  value: '3.5',
  unit: 'months of homes for sale',
  scope: null,
  asOf: 'As of Oct 13, 2026',
  figureKeys: ['bend_sfr_mos'],
  place: { top: 300 },
}

const textCue: MotionCue = {
  kind: 'text',
  id: 'paper-text',
  start: 0.25,
  end: 3.2,
  tone: 'payoff',
  eyebrow: null,
  line: 'Buyers have leverage',
  place: { top: 420, paper: true },
}

const plan = (cues: MotionCue[], extra: Partial<MotionPlan> = {}): MotionPlan => ({
  cues,
  duration: 4,
  surface: 'footage',
  notes: [],
  holdDriftPx: HOLD_DRIFT_PX,
  ...extra,
})

const state = (p: MotionPlan, id: string, t: number) => frameState(p, t).find((s) => s.id === id)!

describe('eased_number_reveal: the reveal', () => {
  it('is 12 frames at 30 fps, from 0.92 and invisible to full size and full opacity', () => {
    expect(REVEAL_FRAMES).toBe(12)
    expect(REVEAL_SECONDS).toBeCloseTo(0.4, 9)
    expect(revealPose(0.1, 0.1)).toEqual({ opacity: 0, scale: REVEAL_SCALE_FROM })
    expect(revealPose(0.05, 0.1)).toEqual({ opacity: 0, scale: 0.92 })
    expect(revealPose(0.1 + REVEAL_SECONDS, 0.1)).toEqual({ opacity: 1, scale: 1 })
    expect(revealPose(2, 0.1)).toEqual({ opacity: 1, scale: 1 })
  })

  it('rides the brand ease-out and never overshoots', () => {
    let lastScale = 0
    let lastOpacity = -1
    for (let f = 0; f <= REVEAL_FRAMES; f++) {
      const p = revealPose(f / 30, 0)
      const expected = ease(Math.min(1, f / 30 / REVEAL_SECONDS))
      expect(p.opacity).toBeCloseTo(expected, 3)
      expect(p.scale).toBeCloseTo(0.92 + 0.08 * expected, 4)
      expect(p.scale).toBeGreaterThanOrEqual(lastScale)
      expect(p.scale).toBeLessThanOrEqual(1)
      expect(p.opacity).toBeGreaterThanOrEqual(lastOpacity)
      lastScale = p.scale
      lastOpacity = p.opacity
    }
    // An ease-out front-loads the move: over half the way in after a quarter of the time.
    expect(revealPose(REVEAL_SECONDS / 4, 0).opacity).toBeGreaterThan(0.5)
  })
})

describe('the hold drift', () => {
  it('is zero until landing, linear across the hold, and 8 px at the end', () => {
    expect(HOLD_DRIFT_PX).toBe(8)
    expect(holdDrift(0.4, 0.5, 3.5)).toBe(0)
    expect(holdDrift(2, 0.5, 3.5)).toBeCloseTo(4, 2)
    expect(holdDrift(3.5, 0.5, 3.5)).toBe(8)
    expect(holdDrift(9, 0.5, 3.5)).toBe(8)
    expect(holdDrift(1, 2, 2)).toBe(0)
  })

  it('moves a held card in every 1.2 s window, so freezedetect never sees a still card', () => {
    // A 2.5 s hold is the shortest allowed; the drift's rate is lowest on the longest holds.
    for (const hold of [2.5, 5, 8]) {
      for (let a = 0; a + 1.2 <= hold; a += 0.1) {
        expect(driftBetween(a, a + 1.2, 0, hold)).toBeGreaterThan(1)
      }
    }
  })
})

describe('frameState draws a number card with the reveal and the drift', () => {
  const p = plan([numberCue])
  it('starts at 0.92 and invisible, lands at full size, then rises', () => {
    expect(state(p, 'hook-number-card', 0)).toMatchObject({ opacity: 0, scale: 0.92 })
    expect(state(p, 'hook-number-card', 0.1)).toMatchObject({ opacity: 0, scale: 0.92, y: 0 })
    const landed = state(p, 'hook-number-card', 0.5)
    expect(landed).toMatchObject({ opacity: 1, scale: 1 })
    expect(landed.y).toBe(0)
    const later = state(p, 'hook-number-card', 2.5)
    expect(later.opacity).toBe(1)
    expect(later.y).toBeLessThan(-4)
    expect(later.y).toBeGreaterThan(-8)
  })

  it('fades out before its end and is gone after it', () => {
    expect(state(p, 'hook-number-card', numberCue.end - EXIT_SECONDS / 2).opacity).toBeLessThan(1)
    expect(state(p, 'hook-number-card', numberCue.end + 0.01).opacity).toBe(0)
  })

  it('every frame is a pure function of t: the same t gives the same state', () => {
    expect(frameState(p, 1.2345)).toEqual(frameState(p, 1.2345))
  })

  it('does not drift when the plan asks for no drift (format films)', () => {
    const still = plan([numberCue], { holdDriftPx: undefined })
    expect(state(still, 'hook-number-card', 2.5).y).toBe(0)
  })
})

describe('frameState drifts a held text card on cream paper', () => {
  it('rises across the hold after its 16 px entrance', () => {
    const p = plan([textCue])
    const a = state(p, 'paper-text-card', 1.0)
    const b = state(p, 'paper-text-card', 2.2)
    expect(a.opacity).toBe(1)
    expect(b.opacity).toBe(1)
    expect(a.y - b.y).toBeGreaterThan(2)
  })
})

describe('captions and the loop echo', () => {
  const caption: MotionCue = { kind: 'caption', id: 'cap0', start: 0.5, end: 0.9, text: 'So', words: [0] }
  it('a caption hard-cuts in and out on its times', () => {
    const p = plan([caption])
    expect(state(p, 'cap0-card', 0.49).opacity).toBe(0)
    expect(state(p, 'cap0-card', 0.5).opacity).toBe(1)
    expect(state(p, 'cap0-card', 0.89).opacity).toBe(1)
    expect(state(p, 'cap0-card', 0.9).opacity).toBe(0)
  })

  it('from loopEcho.from on, every card is drawn as it is at t = 0', () => {
    const p = plan([numberCue, caption], { loopEcho: { from: 3 } })
    expect(state(p, 'hook-number-card', 2.9).opacity).toBe(1)
    expect(state(p, 'hook-number-card', 3.1)).toEqual(state(p, 'hook-number-card', 0))
    expect(state(p, 'cap0-card', 3.5)).toEqual(state(p, 'cap0-card', 0))
  })
})
