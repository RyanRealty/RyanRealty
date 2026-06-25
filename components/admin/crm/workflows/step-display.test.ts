import { describe, it, expect } from 'vitest'
import {
  channelLabel,
  stepSummary,
  cumulativeDays,
  sequenceStatusMeta,
  type DisplayStep,
} from './step-display'

describe('channelLabel', () => {
  it('maps known channels to plain labels', () => {
    expect(channelLabel('email')).toBe('Email')
    expect(channelLabel('sms')).toBe('Text')
    expect(channelLabel('task')).toBe('Task')
    expect(channelLabel('tag')).toBe('Tags')
  })
  it('passes through an unknown channel', () => {
    expect(channelLabel('webhook')).toBe('webhook')
  })
})

describe('stepSummary', () => {
  it('uses the template name when the map resolves the key', () => {
    const step: DisplayStep = { channel: 'email', templateKey: 'email-welcome' }
    expect(stepSummary(step, { 'email-welcome': 'Welcome note' })).toBe('Email · Welcome note')
  })
  it('falls back to the raw key when no name is mapped', () => {
    const step: DisplayStep = { channel: 'sms', templateKey: 'sms-checkin' }
    expect(stepSummary(step)).toBe('Text · sms-checkin')
  })
  it('labels a message step with no template', () => {
    expect(stepSummary({ channel: 'email' })).toBe('Email message')
  })
  it('summarizes a task with its name', () => {
    expect(stepSummary({ channel: 'task', taskName: 'Call back' })).toBe('Task · Call back')
  })
  it('defaults a nameless task', () => {
    expect(stepSummary({ channel: 'task' })).toBe('Task · Follow up')
  })
  it('summarizes add + remove tags', () => {
    const step: DisplayStep = { channel: 'tag', addTags: ['hot'], removeTags: ['cold'] }
    expect(stepSummary(step)).toBe('Tags · remove cold, add hot')
  })
  it('handles an empty tag step', () => {
    expect(stepSummary({ channel: 'tag' })).toBe('Tags · (none)')
  })
})

describe('cumulativeDays', () => {
  it('accumulates delayDays across steps', () => {
    const steps: DisplayStep[] = [
      { channel: 'email', delayDays: 0 },
      { channel: 'email', delayDays: 3 },
      { channel: 'task', delayDays: 7 },
    ]
    expect(cumulativeDays(steps)).toEqual([0, 3, 10])
  })
  it('treats missing or negative delays as zero', () => {
    const steps: DisplayStep[] = [
      { channel: 'email' },
      { channel: 'email', delayDays: -5 },
      { channel: 'email', delayDays: 2 },
    ]
    expect(cumulativeDays(steps)).toEqual([0, 0, 2])
  })
  it('returns an empty array for no steps', () => {
    expect(cumulativeDays([])).toEqual([])
  })
})

describe('sequenceStatusMeta', () => {
  it('maps active', () => {
    expect(sequenceStatusMeta('active')).toEqual({ label: 'Active', tone: 'active' })
  })
  it('maps archived', () => {
    expect(sequenceStatusMeta('archived')).toEqual({ label: 'Archived', tone: 'archived' })
  })
  it('treats paused and anything else as paused', () => {
    expect(sequenceStatusMeta('paused')).toEqual({ label: 'Paused', tone: 'paused' })
    expect(sequenceStatusMeta('draft')).toEqual({ label: 'Paused', tone: 'paused' })
  })
})
