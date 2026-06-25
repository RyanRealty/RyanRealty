import { describe, it, expect } from 'vitest'
import {
  parseSteps,
  validateStep,
  EMPTY_STEP,
  STEP_CHANNELS,
  type Step,
} from './sequence-step-schema'

describe('parseSteps — valid shapes per channel', () => {
  it('accepts an email step with a templateKey', () => {
    const steps = parseSteps([{ channel: 'email', delayDays: 1, templateKey: 'welcome-1' }])
    expect(steps).toHaveLength(1)
    expect(steps[0].channel).toBe('email')
    expect(steps[0].templateKey).toBe('welcome-1')
  })

  it('accepts an email step with an inline body (no template)', () => {
    const steps = parseSteps([{ channel: 'email', subject: 'Hi', body: 'Hello there' }])
    expect(steps[0].body).toBe('Hello there')
  })

  it('accepts an sms step with a body + delayMinutes', () => {
    const steps = parseSteps([{ channel: 'sms', delayMinutes: 30, body: 'quick text' }])
    expect(steps[0].delayMinutes).toBe(30)
  })

  it('accepts a task step with a taskName', () => {
    const steps = parseSteps([{ channel: 'task', taskName: 'Call them', taskType: 'Call' }])
    expect(steps[0].taskName).toBe('Call them')
  })

  it('accepts a tag step that adds tags', () => {
    const steps = parseSteps([{ channel: 'tag', addTags: ['audience:buyer'] }])
    expect(steps[0].addTags).toEqual(['audience:buyer'])
  })

  it('accepts a tag step that only removes tags', () => {
    const steps = parseSteps([{ channel: 'tag', removeTags: ['intent:cold'] }])
    expect(steps[0].removeTags).toEqual(['intent:cold'])
  })

  it('accepts a confirm + fallbackEmail sms step (engine fields)', () => {
    const steps = parseSteps([
      {
        channel: 'sms',
        body: 'text body',
        confirm: true,
        fallbackEmailSubject: 'Sub',
        fallbackEmailBody: 'Fallback body',
      },
    ])
    expect(steps[0].confirm).toBe(true)
    expect(steps[0].fallbackEmailBody).toBe('Fallback body')
  })

  it('accepts a multi-step linear sequence', () => {
    const steps = parseSteps([
      { channel: 'email', templateKey: 'a' },
      { channel: 'sms', delayDays: 2, body: 'b' },
      { channel: 'task', taskName: 'c' },
      { channel: 'tag', addTags: ['x'] },
    ])
    expect(steps).toHaveLength(4)
  })

  it('accepts an empty step list', () => {
    expect(parseSteps([])).toEqual([])
  })

  it('strips unknown keys (no smuggling extra fields into the engine)', () => {
    const steps = parseSteps([{ channel: 'tag', addTags: ['x'], nextStepId: 99, evil: true }])
    expect(steps[0]).not.toHaveProperty('nextStepId')
    expect(steps[0]).not.toHaveProperty('evil')
  })
})

describe('parseSteps — invalid shapes throw', () => {
  it('throws on a non-array', () => {
    expect(() => parseSteps({ channel: 'email' })).toThrow()
  })

  it('throws on an unknown channel', () => {
    expect(() => parseSteps([{ channel: 'webhook' }])).toThrow()
  })

  it('throws on a missing channel', () => {
    expect(() => parseSteps([{ body: 'hi' }])).toThrow()
  })

  it('throws on a negative delayDays', () => {
    expect(() => parseSteps([{ channel: 'email', templateKey: 'a', delayDays: -1 }])).toThrow()
  })

  it('throws on a non-integer delayDays', () => {
    expect(() => parseSteps([{ channel: 'email', templateKey: 'a', delayDays: 1.5 }])).toThrow()
  })

  it('throws on an email step with neither template nor body', () => {
    expect(() => parseSteps([{ channel: 'email', delayDays: 1 }])).toThrow()
  })

  it('throws on an sms step with a whitespace-only body and no template', () => {
    expect(() => parseSteps([{ channel: 'sms', body: '   ' }])).toThrow()
  })

  it('throws on a task step with no taskName', () => {
    expect(() => parseSteps([{ channel: 'task', delayDays: 1 }])).toThrow()
  })

  it('throws on a no-op tag step (no add or remove)', () => {
    expect(() => parseSteps([{ channel: 'tag', delayDays: 1 }])).toThrow()
  })

  it('throws on a tag step with empty arrays', () => {
    expect(() => parseSteps([{ channel: 'tag', addTags: [], removeTags: [] }])).toThrow()
  })

  it('throws when ANY step in the list is malformed', () => {
    expect(() =>
      parseSteps([
        { channel: 'email', templateKey: 'a' },
        { channel: 'task' }, // missing taskName
      ]),
    ).toThrow()
  })
})

describe('validateStep — non-throwing single-step validator', () => {
  it('returns ok for a valid step', () => {
    const r = validateStep({ channel: 'email', body: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.step.channel).toBe('email')
  })

  it('returns flat error strings for an invalid step', () => {
    const r = validateStep({ channel: 'task' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.errors.some((e) => e.includes('task'))).toBe(true)
    }
  })
})

describe('EMPTY_STEP — starter per channel', () => {
  it('has an entry for every channel', () => {
    for (const ch of STEP_CHANNELS) {
      expect(EMPTY_STEP[ch].channel).toBe(ch)
    }
  })

  it('email/sms/task starters validate; tag starter requires a tag', () => {
    expect(validateStep(EMPTY_STEP.email).ok).toBe(true)
    expect(validateStep(EMPTY_STEP.sms).ok).toBe(true)
    expect(validateStep(EMPTY_STEP.task).ok).toBe(true)
    // tag starter has no tags yet — must fail until the UI collects one.
    expect(validateStep(EMPTY_STEP.tag).ok).toBe(false)
  })

  it('the starters round-trip through parseSteps once a tag is added', () => {
    const tagWithChoice: Step = { ...EMPTY_STEP.tag, addTags: ['audience:seller'] }
    const steps = parseSteps([EMPTY_STEP.email, EMPTY_STEP.sms, EMPTY_STEP.task, tagWithChoice])
    expect(steps).toHaveLength(4)
  })
})
