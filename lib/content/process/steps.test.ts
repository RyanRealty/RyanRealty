import { describe, expect, it } from 'vitest'
import { ALL_STEPS, CAPPED_STEPS, PASSABLE_UNBUILT_STEPS, STEPS_BY_TYPE, UNBUILT_STEPS, stepsFor } from './steps'

describe('the steps of each deliverable (CONTENT_PROCESS.md)', () => {
  it('a video goes brief, voice, stills, board, animatic, motion, master, certify, approve', () => {
    expect(STEPS_BY_TYPE.video).toEqual(['brief', 'voice', 'stills', 'board', 'animatic', 'motion', 'master', 'certify', 'approve'])
    expect([...ALL_STEPS]).toEqual(STEPS_BY_TYPE.video)
  })

  it('a still and a carousel go brief, stills, board, master, certify, approve', () => {
    expect(STEPS_BY_TYPE.still).toEqual(['brief', 'stills', 'board', 'master', 'certify', 'approve'])
    expect(STEPS_BY_TYPE.carousel).toEqual(STEPS_BY_TYPE.still)
  })

  it('post copy goes brief, certify, approve', () => {
    expect(STEPS_BY_TYPE.post_copy).toEqual(['brief', 'certify', 'approve'])
  })

  it('a paid ad is the steps of its creative, with certify and approve last', () => {
    expect(stepsFor('paid_ad')).toEqual(STEPS_BY_TYPE.video)
    expect(stepsFor('paid_ad', 'still')).toEqual(STEPS_BY_TYPE.still)
    for (const creative of ['video', 'still'] as const) {
      const s = stepsFor('paid_ad', creative)
      expect(s[0]).toBe('brief')
      expect(s.slice(-2)).toEqual(['certify', 'approve'])
    }
  })

  it('hands back a copy, so a caller cannot reorder the steps', () => {
    stepsFor('video').reverse()
    expect(STEPS_BY_TYPE.video[0]).toBe('brief')
    expect(stepsFor('video')[0]).toBe('brief')
  })

  it('names the steps phase 1 does not build, and the steps that spend a capped attempt', () => {
    expect([...UNBUILT_STEPS]).toEqual(['certify', 'approve'])
    expect([...PASSABLE_UNBUILT_STEPS]).toEqual(['animatic', 'motion'])
    expect(CAPPED_STEPS).toEqual({ board: 'boards', animatic: 'animatics', master: 'masters' })
  })
})
