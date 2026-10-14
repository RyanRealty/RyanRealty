import { describe, expect, it } from 'vitest'
import { endcardCue, frameState, type MotionCue, type MotionPlan } from '../motion/cues'
import { endcardState } from '../motion/endcard'
import { HOLD_DRIFT_PX } from '../motion/reveal'
import { LOOP_SECONDS, echoFrom, filmFrames, frameAtOrAfter, openingSeconds } from './seam'

describe('loop_seam_edit: frame arithmetic', () => {
  it('finds the first whole frame at or after a time', () => {
    expect(frameAtOrAfter(16.25, 30)).toBe(488)
    expect(frameAtOrAfter(16.2, 30)).toBe(486)
    expect(frameAtOrAfter(16.2 + 1e-9, 30)).toBe(486)
  })

  it('runs a looping film to the first frame at or after the out, so the iris is closed on the last frame', () => {
    const out = 16.25
    const frames = filmFrames(out, 30, true)
    expect(frames).toBe(489)
    const last = (frames - 1) / 30
    expect(last).toBeGreaterThanOrEqual(out)
    expect(endcardState(last, { start: 13.2, loop: true }).card.iris).toBe(0)
    // Without the seam the film stops on the frame before the out.
    expect((filmFrames(out, 30, false) - 1) / 30).toBeLessThan(out)
  })

  it('holds the opening frame from the end card to the last frame, and echoes from the iris', () => {
    expect(openingSeconds(396, 489, 30)).toBeCloseTo(93 / 30, 9)
    expect(LOOP_SECONDS).toBe(0.3)
    expect(echoFrom(16.25)).toBe(15.95)
  })
})

describe('loop_seam_edit: the last frame draws frame 0', () => {
  const card: MotionCue = {
    kind: 'number',
    id: 'hook-number',
    start: 0,
    end: 3.7,
    eyebrow: null,
    value: '3.5',
    unit: null,
    scope: null,
    asOf: null,
    figureKeys: ['k'],
  }
  const endcard = endcardCue(4, { loop: true })
  const frames = filmFrames(endcard.times.out, 30, true)
  const plan: MotionPlan = {
    cues: [card, endcard],
    duration: frames / 30,
    surface: 'footage',
    notes: [],
    holdDriftPx: HOLD_DRIFT_PX,
    loopEcho: { from: echoFrom(endcard.times.out) },
  }
  const at = (t: number) => frameState(plan, t)

  it('every non-end-card element on the last frame is as it is on frame 0, and the card is clipped away', () => {
    const last = at((frames - 1) / 30)
    const first = at(0)
    const others = (s: ReturnType<typeof at>) => s.filter((x) => !x.id.startsWith('endcard'))
    expect(others(last)).toEqual(others(first))
    expect(last.find((s) => s.id === 'endcard-card')?.clip).toBe(0)
  })

  it('before the iris starts the end card covers the frame with no clip', () => {
    const t = echoFrom(endcard.times.out) - 0.05
    expect(at(t).find((s) => s.id === 'endcard-card')).toMatchObject({ opacity: 1, clip: null })
  })
})
