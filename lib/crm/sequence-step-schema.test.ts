import { describe, it, expect } from 'vitest'
import {
  parseSteps,
  parseSequenceTriggers,
  validateStep,
  EMPTY_STEP,
  EMPTY_CONDITION,
  STEP_CHANNELS,
  SEQUENCE_TRIGGER_TYPES,
  isConditionNode,
  type Step,
  type AnyStepOrCondition,
} from './sequence-step-schema'

describe('parseSteps — valid shapes per channel', () => {
  it('accepts an email step with a templateKey', () => {
    const steps = parseSteps([{ channel: 'email', delayDays: 1, templateKey: 'welcome-1' }])
    expect(steps).toHaveLength(1)
    const s = steps[0] as Step
    expect(s.channel).toBe('email')
    expect(s.templateKey).toBe('welcome-1')
  })

  it('accepts an email step with an inline body (no template)', () => {
    const steps = parseSteps([{ channel: 'email', subject: 'Hi', body: 'Hello there' }])
    expect((steps[0] as Step).body).toBe('Hello there')
  })

  it('accepts an sms step with a body + delayMinutes', () => {
    const steps = parseSteps([{ channel: 'sms', delayMinutes: 30, body: 'quick text' }])
    expect((steps[0] as Step).delayMinutes).toBe(30)
  })

  it('accepts a task step with a taskName', () => {
    const steps = parseSteps([{ channel: 'task', taskName: 'Call them', taskType: 'Call' }])
    expect((steps[0] as Step).taskName).toBe('Call them')
  })

  it('accepts a tag step that adds tags', () => {
    const steps = parseSteps([{ channel: 'tag', addTags: ['audience:buyer'] }])
    expect((steps[0] as Step).addTags).toEqual(['audience:buyer'])
  })

  it('accepts a tag step that only removes tags', () => {
    const steps = parseSteps([{ channel: 'tag', removeTags: ['intent:cold'] }])
    expect((steps[0] as Step).removeTags).toEqual(['intent:cold'])
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
    const s = steps[0] as Step
    expect(s.confirm).toBe(true)
    expect(s.fallbackEmailBody).toBe('Fallback body')
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

// ── v2 channels ───────────────────────────────────────────────────────────────

describe('parseSteps — v2 channels', () => {
  const V2_CHANNELS = ['change_stage', 'add_note', 'reassign', 'run_automation'] as const

  for (const channel of V2_CHANNELS) {
    it(`accepts ${channel} step with a value`, () => {
      const steps = parseSteps([{ channel, delayDays: 0, value: 'some-value' }])
      expect(steps).toHaveLength(1)
      expect((steps[0] as any).channel).toBe(channel)
      expect((steps[0] as any).value).toBe('some-value')
    })

    it(`rejects ${channel} step without value`, () => {
      expect(() => parseSteps([{ channel, delayDays: 0 }])).toThrow()
    })

    it(`rejects ${channel} step with whitespace-only value`, () => {
      expect(() => parseSteps([{ channel, delayDays: 0, value: '   ' }])).toThrow()
    })
  }

  it('EMPTY_STEP objects exist for all 8 channels', () => {
    for (const c of STEP_CHANNELS) {
      expect(EMPTY_STEP[c]).toBeDefined()
      expect(EMPTY_STEP[c].channel).toBe(c)
    }
  })
})

// ── Condition nodes ───────────────────────────────────────────────────────────

describe('parseSteps — condition nodes', () => {
  it('parses a condition node with empty paths', () => {
    const raw = [
      { type: 'condition', field: 'stage', op: 'is', value: 'active', truePath: [], falsePath: [] },
    ]
    const steps = parseSteps(raw)
    expect(steps).toHaveLength(1)
    expect(isConditionNode(steps[0])).toBe(true)
    const node = steps[0] as any
    expect(node.field).toBe('stage')
    expect(node.value).toBe('active')
  })

  it('parses a condition node with step children in truePath', () => {
    const raw = [
      {
        type: 'condition',
        field: 'tag',
        op: 'is_not',
        value: 'audience:buyer',
        truePath: [{ channel: 'email', delayDays: 0, templateKey: 'nurture' }],
        falsePath: [],
      },
    ]
    const steps = parseSteps(raw)
    const node = steps[0] as any
    expect(isConditionNode(steps[0])).toBe(true)
    expect(node.truePath[0].channel).toBe('email')
  })

  it('parses nested condition nodes (recursive)', () => {
    const raw = [
      {
        type: 'condition',
        field: 'source',
        op: 'contains',
        value: 'zillow',
        truePath: [
          {
            type: 'condition',
            field: 'stage',
            op: 'is',
            value: 'new',
            truePath: [{ channel: 'task', delayDays: 0, taskName: 'Call now' }],
            falsePath: [],
          },
        ],
        falsePath: [],
      },
    ]
    const steps = parseSteps(raw)
    const outer = steps[0] as any
    expect(isConditionNode(outer)).toBe(true)
    const inner = outer.truePath[0]
    expect(isConditionNode(inner)).toBe(true)
    expect(inner.truePath[0].taskName).toBe('Call now')
  })

  it('condition node with empty value parses (engine evaluates at runtime; no throw at write time)', () => {
    // The union schema detects `type:'condition'` via passthrough and trusts the
    // engine to handle an empty value condition gracefully (evaluateCondition
    // fails-safe to false). A strict write-time reject would break the builder's
    // save-draft flow for in-progress conditions.
    const raw = [
      { type: 'condition', field: 'stage', op: 'is', value: '', truePath: [], falsePath: [] },
    ]
    const steps = parseSteps(raw)
    expect(isConditionNode(steps[0])).toBe(true)
  })

  it('parses a mixed array — flat steps + condition nodes', () => {
    const raw = [
      { channel: 'email', delayDays: 0, templateKey: 'intro' },
      { type: 'condition', field: 'stage', op: 'is', value: 'qualified', truePath: [], falsePath: [] },
      { channel: 'task', delayDays: 1, taskName: 'Book call' },
    ]
    const steps = parseSteps(raw)
    expect(steps).toHaveLength(3)
    expect(isConditionNode(steps[0])).toBe(false)
    expect(isConditionNode(steps[1])).toBe(true)
    expect(isConditionNode(steps[2])).toBe(false)
  })

  it('EMPTY_CONDITION passes isConditionNode', () => {
    expect(isConditionNode(EMPTY_CONDITION)).toBe(true)
    expect(EMPTY_CONDITION.truePath).toEqual([])
    expect(EMPTY_CONDITION.falsePath).toEqual([])
  })
})

// ── isConditionNode type guard ────────────────────────────────────────────────

describe('isConditionNode', () => {
  it('returns true for a condition node', () => {
    const cond: AnyStepOrCondition = {
      type: 'condition',
      field: 'stage',
      op: 'is',
      value: 'x',
      truePath: [],
      falsePath: [],
    }
    expect(isConditionNode(cond)).toBe(true)
  })

  it('returns false for a flat step', () => {
    const step: AnyStepOrCondition = { channel: 'email', body: 'hi' }
    expect(isConditionNode(step)).toBe(false)
  })
})

// ── parseSequenceTriggers ─────────────────────────────────────────────────────

describe('parseSequenceTriggers', () => {
  it('parses an empty array', () => {
    expect(parseSequenceTriggers([])).toEqual([])
  })

  it('parses all valid trigger types', () => {
    const raw = SEQUENCE_TRIGGER_TYPES.map((type) => ({ type, value: 'val' }))
    const triggers = parseSequenceTriggers(raw)
    expect(triggers).toHaveLength(SEQUENCE_TRIGGER_TYPES.length)
    triggers.forEach((t, i) => expect(t.type).toBe(SEQUENCE_TRIGGER_TYPES[i]))
  })

  it('parses a trigger with no value (value is optional)', () => {
    const triggers = parseSequenceTriggers([{ type: 'inquiry' }])
    expect(triggers[0].type).toBe('inquiry')
    expect(triggers[0].value).toBeUndefined()
  })

  it('throws on an unknown trigger type', () => {
    expect(() => parseSequenceTriggers([{ type: 'unknown_event' }])).toThrow()
  })

  it('includes the 5 new v2 trigger types', () => {
    const newTypes = ['deal_stage_changed', 'inquiry', 'property_saved', 'calendar_date', 'appointment']
    for (const type of newTypes) {
      const triggers = parseSequenceTriggers([{ type }])
      expect(triggers[0].type).toBe(type)
    }
  })
})
