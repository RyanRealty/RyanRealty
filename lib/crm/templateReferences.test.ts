import { describe, it, expect } from 'vitest'
import {
  normalizeSteps,
  countStepReferences,
  findTemplateReferences,
  refuseReferencedTemplateDelete,
  validateChannel,
  type SequenceRef,
} from './templateReferences'

describe('normalizeSteps', () => {
  it('returns [] for non-array or null', () => {
    expect(normalizeSteps(null)).toEqual([])
    expect(normalizeSteps(undefined)).toEqual([])
    expect(normalizeSteps('nope')).toEqual([])
    expect(normalizeSteps(42)).toEqual([])
  })

  it('drops non-object entries', () => {
    expect(normalizeSteps([{ templateKey: 'a' }, null, 'x', 3])).toEqual([{ templateKey: 'a' }])
  })
})

describe('countStepReferences', () => {
  it('counts exact key matches across steps', () => {
    const steps = [
      { channel: 'email', templateKey: 'email-x-1' },
      { channel: 'sms', templateKey: 'sms-y-2' },
      { channel: 'email', templateKey: 'email-x-1' },
    ]
    expect(countStepReferences(steps, 'email-x-1')).toBe(2)
    expect(countStepReferences(steps, 'sms-y-2')).toBe(1)
    expect(countStepReferences(steps, 'missing')).toBe(0)
  })

  it('returns 0 for an empty key', () => {
    expect(countStepReferences([{ templateKey: 'a' }], '')).toBe(0)
  })

  it('ignores steps without a templateKey', () => {
    expect(countStepReferences([{ channel: 'task', taskName: 'Call' }], 'anything')).toBe(0)
  })
})

describe('findTemplateReferences', () => {
  const sequences: SequenceRef[] = [
    { id: 1, name: 'Buyer Long-game', steps: [{ templateKey: 'email-x-1' }, { templateKey: 'sms-y-2' }] },
    { id: 2, name: 'Seller Nurture', steps: [{ templateKey: 'email-x-1' }] },
    { id: 3, name: 'Open House', steps: [{ templateKey: 'email-z-9' }] },
  ]

  it('finds every sequence referencing the key with per-sequence counts', () => {
    const hits = findTemplateReferences('email-x-1', sequences)
    expect(hits).toEqual([
      { sequenceId: 1, sequenceName: 'Buyer Long-game', stepCount: 1 },
      { sequenceId: 2, sequenceName: 'Seller Nurture', stepCount: 1 },
    ])
  })

  it('returns [] for an unreferenced key', () => {
    expect(findTemplateReferences('email-never', sequences)).toEqual([])
  })
})

describe('refuseReferencedTemplateDelete', () => {
  const sequences: SequenceRef[] = [
    { id: 1, name: 'Buyer Long-game', steps: [{ templateKey: 'email-x-1' }] },
    { id: 2, name: 'Seller Nurture', steps: [{ templateKey: 'email-x-1' }] },
  ]

  it('allows deleting an unreferenced template', () => {
    expect(refuseReferencedTemplateDelete('email-free', sequences)).toEqual({ ok: true })
  })

  it('refuses a referenced template and names every sequence', () => {
    const r = refuseReferencedTemplateDelete('email-x-1', sequences)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected refusal')
    expect(r.error).toContain('2 sequences')
    expect(r.error).toContain('Buyer Long-game')
    expect(r.error).toContain('Seller Nurture')
  })

  it('uses singular noun for a single referencing sequence', () => {
    const r = refuseReferencedTemplateDelete('email-x-1', [sequences[0]])
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected refusal')
    expect(r.error).toContain('1 sequence (')
    expect(r.error).not.toContain('sequences')
  })
})

describe('validateChannel', () => {
  it('accepts email and sms (trim + case-insensitive)', () => {
    expect(validateChannel('email')).toEqual({ ok: true, channel: 'email' })
    expect(validateChannel('  SMS ')).toEqual({ ok: true, channel: 'sms' })
  })

  it('rejects anything else', () => {
    expect(validateChannel('push').ok).toBe(false)
    expect(validateChannel('').ok).toBe(false)
    expect(validateChannel(null).ok).toBe(false)
    expect(validateChannel(7).ok).toBe(false)
  })
})
