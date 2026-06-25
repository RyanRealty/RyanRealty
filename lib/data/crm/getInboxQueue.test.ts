import { describe, it, expect } from 'vitest'
import {
  effectiveStatus,
  needsReply,
  matchesScope,
  deriveConversationFromMessages,
  isValidConversationStatus,
  isAssignableBroker,
} from './getInboxQueue'

describe('getInboxQueue pure helpers (Wave 7 inbox triage)', () => {
  describe('effectiveStatus', () => {
    it('defaults a missing/null state to unread', () => {
      expect(effectiveStatus(undefined)).toBe('unread')
      expect(effectiveStatus(null)).toBe('unread')
      expect(effectiveStatus('')).toBe('unread')
    })
    it('passes through the four valid states', () => {
      expect(effectiveStatus('unread')).toBe('unread')
      expect(effectiveStatus('open')).toBe('open')
      expect(effectiveStatus('handled')).toBe('handled')
      expect(effectiveStatus('closed')).toBe('closed')
    })
    it('treats an unknown stored value as unread', () => {
      expect(effectiveStatus('garbage')).toBe('unread')
    })
  })

  describe('needsReply', () => {
    it('is false with no inbound', () => {
      expect(needsReply('open', null, null)).toBe(false)
      expect(needsReply('open', null, '2026-06-01T00:00:00Z')).toBe(false)
    })
    it('is true when an inbound exists and no outbound has happened', () => {
      expect(needsReply('open', '2026-06-01T00:00:00Z', null)).toBe(true)
      expect(needsReply('unread', '2026-06-01T00:00:00Z', null)).toBe(true)
    })
    it('is true when inbound is newer than outbound', () => {
      expect(needsReply('open', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(true)
    })
    it('is false when outbound is newer than inbound (we replied)', () => {
      expect(needsReply('open', '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z')).toBe(false)
    })
    it('is always false for a closed conversation', () => {
      expect(needsReply('closed', '2026-06-02T00:00:00Z', null)).toBe(false)
    })
  })

  describe('matchesScope', () => {
    const mattOpen = { status: 'open' as const, assignedBroker: 'matt' }
    const rebeccaOpen = { status: 'open' as const, assignedBroker: 'rebecca' }
    const unread = { status: 'unread' as const, assignedBroker: 'matt' }
    const closed = { status: 'closed' as const, assignedBroker: 'matt' }

    it('all: every non-closed conversation', () => {
      expect(matchesScope('all', mattOpen, null)).toBe(true)
      expect(matchesScope('all', unread, null)).toBe(true)
      expect(matchesScope('all', closed, null)).toBe(false)
    })
    it('unread: only unread status', () => {
      expect(matchesScope('unread', unread, null)).toBe(true)
      expect(matchesScope('unread', mattOpen, null)).toBe(false)
      expect(matchesScope('unread', closed, null)).toBe(false)
    })
    it('closed: only closed status', () => {
      expect(matchesScope('closed', closed, null)).toBe(true)
      expect(matchesScope('closed', mattOpen, null)).toBe(false)
    })
    it('mine for a superuser (null scope): every non-closed (no mine distinction)', () => {
      expect(matchesScope('mine', mattOpen, null)).toBe(true)
      expect(matchesScope('mine', rebeccaOpen, null)).toBe(true)
      expect(matchesScope('mine', closed, null)).toBe(false)
    })
    it('mine for a scoped broker: only their own non-closed conversations', () => {
      expect(matchesScope('mine', mattOpen, 'matt')).toBe(true)
      expect(matchesScope('mine', rebeccaOpen, 'matt')).toBe(false)
      expect(matchesScope('mine', closed, 'matt')).toBe(false)
    })
  })

  describe('deriveConversationFromMessages', () => {
    it('returns empty derivation for no messages', () => {
      const d = deriveConversationFromMessages([])
      expect(d.snippet).toBeNull()
      expect(d.lastMessageAt).toBeNull()
      expect(d.lastInboundAt).toBeNull()
      expect(d.lastOutboundAt).toBeNull()
      expect(d.lastDirection).toBeNull()
    })
    it('takes the latest message (newest-first) for snippet + direction', () => {
      const d = deriveConversationFromMessages([
        { person_id: 1, ts: '2026-06-03T00:00:00Z', kind: 'sms_out', title: null, body: 'Latest sent reply' },
        { person_id: 1, ts: '2026-06-02T00:00:00Z', kind: 'sms_in', title: null, body: 'Earlier inbound' },
      ])
      expect(d.snippet).toBe('Latest sent reply')
      expect(d.lastDirection).toBe('out')
      expect(d.lastKindLabel).toBe('Text sent')
      expect(d.lastMessageAt).toBe('2026-06-03T00:00:00Z')
    })
    it('tracks the newest inbound and newest outbound clocks independently', () => {
      const d = deriveConversationFromMessages([
        { person_id: 1, ts: '2026-06-05T00:00:00Z', kind: 'sms_in', title: null, body: 'A question' },
        { person_id: 1, ts: '2026-06-04T00:00:00Z', kind: 'email_out', title: null, body: 'My answer' },
        { person_id: 1, ts: '2026-06-01T00:00:00Z', kind: 'email_in', title: 'old email', body: 'old text' },
      ])
      // sms_in (2026-06-05) is the newest inbound; email_in also counts as inbound.
      expect(d.lastInboundAt).toBe('2026-06-05T00:00:00Z')
      expect(d.lastOutboundAt).toBe('2026-06-04T00:00:00Z')
      // latest message is the inbound text -> waiting on us
      expect(d.lastDirection).toBe('in')
    })
    it('falls back to title when body is empty', () => {
      const d = deriveConversationFromMessages([
        { person_id: 1, ts: '2026-06-03T00:00:00Z', kind: 'email_in', title: 'Subject only', body: null },
      ])
      expect(d.snippet).toBe('Subject only')
    })
    it('a call (inbound-classified, no direction-out) advances the inbound clock', () => {
      const d = deriveConversationFromMessages([
        { person_id: 1, ts: '2026-06-03T00:00:00Z', kind: 'voicemail', title: 'New voicemail', body: null },
      ])
      expect(d.lastInboundAt).toBe('2026-06-03T00:00:00Z')
      expect(d.lastOutboundAt).toBeNull()
    })
  })

  // The two validators below back the crm-inbox triage actions (state-only
  // mutations). They live in this DAL module so Vitest imports them without the
  // 'use server' action import chain; the actions re-import them.
  describe('isValidConversationStatus (action validator)', () => {
    it('accepts the four triage states', () => {
      expect(isValidConversationStatus('unread')).toBe(true)
      expect(isValidConversationStatus('open')).toBe(true)
      expect(isValidConversationStatus('handled')).toBe(true)
      expect(isValidConversationStatus('closed')).toBe(true)
    })
    it('rejects anything else', () => {
      expect(isValidConversationStatus('')).toBe(false)
      expect(isValidConversationStatus('archived')).toBe(false)
      expect(isValidConversationStatus('Unread')).toBe(false)
    })
  })

  describe('isAssignableBroker (action validator)', () => {
    it('accepts null / empty as clearing the owner', () => {
      expect(isAssignableBroker(null)).toBe(true)
      expect(isAssignableBroker('')).toBe(true)
    })
    it('accepts the known CRM broker slugs', () => {
      expect(isAssignableBroker('matt')).toBe(true)
      expect(isAssignableBroker('rebecca')).toBe(true)
      expect(isAssignableBroker('paul')).toBe(true)
    })
    it('rejects an unknown broker slug', () => {
      expect(isAssignableBroker('steve')).toBe(false)
      expect(isAssignableBroker('Matt')).toBe(false)
    })
  })
})
