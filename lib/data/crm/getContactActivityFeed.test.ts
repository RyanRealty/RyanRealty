import { describe, it, expect } from 'vitest'
import { classifyTimelineKind, buildSnippet, toFeedItem } from './getContactActivityFeed'

describe('getContactActivityFeed pure helpers (2.1)', () => {
  describe('classifyTimelineKind', () => {
    it('classifies inbound/outbound messages', () => {
      expect(classifyTimelineKind('sms_in')).toEqual({ category: 'message', direction: 'in', label: 'Text received' })
      expect(classifyTimelineKind('sms_out')).toEqual({ category: 'message', direction: 'out', label: 'Text sent' })
    })
    it('classifies email engagement', () => {
      expect(classifyTimelineKind('email_out').direction).toBe('out')
      expect(classifyTimelineKind('email_open')).toEqual({ category: 'email', direction: 'in', label: 'Email opened' })
      expect(classifyTimelineKind('email_click').label).toBe('Email link clicked')
    })
    it('classifies calls, voicemail, notes, milestones', () => {
      expect(classifyTimelineKind('call').category).toBe('call')
      expect(classifyTimelineKind('voicemail')).toEqual({ category: 'call', direction: 'in', label: 'Voicemail' })
      expect(classifyTimelineKind('note').category).toBe('note')
      expect(classifyTimelineKind('stage_change').category).toBe('milestone')
      expect(classifyTimelineKind('home_valuation').category).toBe('milestone')
    })
    it('humanizes an unknown kind to category other', () => {
      expect(classifyTimelineKind('some_new_kind')).toEqual({ category: 'other', direction: null, label: 'Some new kind' })
      expect(classifyTimelineKind('')).toEqual({ category: 'other', direction: null, label: 'Activity' })
    })
  })

  describe('buildSnippet', () => {
    it('prefers body, truncating long text', () => {
      expect(buildSnippet({ body: 'Hi there' })).toBe('Hi there')
      const long = 'x'.repeat(250)
      expect(buildSnippet({ body: long })).toHaveLength(200)
      expect(buildSnippet({ body: long })?.endsWith('...')).toBe(true)
    })
    it('falls back to title, then null', () => {
      expect(buildSnippet({ title: 'Inbound call', body: '' })).toBe('Inbound call')
      expect(buildSnippet({})).toBeNull()
    })
  })

  describe('toFeedItem', () => {
    it('maps a raw timeline row to a typed feed item', () => {
      const item = toFeedItem({
        id: 7,
        ts: '2026-06-20T10:00:00Z',
        kind: 'sms_in',
        title: null,
        body: 'Is this still available?',
        payload: {},
        broker: 'matt',
        source: 'twilio',
      })
      expect(item).toEqual({
        id: 7,
        ts: '2026-06-20T10:00:00Z',
        kind: 'sms_in',
        category: 'message',
        direction: 'in',
        label: 'Text received',
        snippet: 'Is this still available?',
        broker: 'matt',
        source: 'twilio',
      })
    })
    it('defaults source to app when missing', () => {
      expect(toFeedItem({ id: 1, ts: 't', kind: 'note', body: 'x' }).source).toBe('app')
    })
  })
})
