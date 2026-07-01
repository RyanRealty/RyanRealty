import { describe, it, expect } from 'vitest'
import { composeContactName, isLikelyEmail, mergeEmail } from './addUnknownCallerContact'
import { isValidDraftChannel } from './drafts'
import { isUnknownCaller } from '@/lib/crm/display-name'

describe('unknown-caller Add Person pure helpers (Inbox delivery #5)', () => {
  describe('composeContactName', () => {
    it('joins first + last, trimming', () => {
      expect(composeContactName(' Amy ', ' Mora ')).toBe('Amy Mora')
    })
    it('allows first-only or last-only', () => {
      expect(composeContactName('Amy', '')).toBe('Amy')
      expect(composeContactName('', 'Mora')).toBe('Mora')
    })
    it('is empty when both are blank', () => {
      expect(composeContactName('  ', '')).toBe('')
    })
  })

  describe('isLikelyEmail', () => {
    it('accepts a real-shaped address', () => {
      expect(isLikelyEmail('gschider@guildmortgage.net')).toBe(true)
    })
    it('rejects garbage / empty', () => {
      expect(isLikelyEmail('')).toBe(false)
      expect(isLikelyEmail('not-an-email')).toBe(false)
      expect(isLikelyEmail('a@b')).toBe(false)
    })
  })

  describe('mergeEmail', () => {
    it('adds a new email as primary on an empty list', () => {
      expect(mergeEmail([], 'a@b.com')).toEqual([{ value: 'a@b.com', isPrimary: 1 }])
    })
    it('adds a secondary email (not primary) when others exist', () => {
      const out = mergeEmail([{ value: 'x@y.com', isPrimary: 1 }], 'a@b.com')
      expect(out).toHaveLength(2)
      expect(out[1]).toEqual({ value: 'a@b.com', isPrimary: 0 })
    })
    it('is a no-op when the email already exists (case-insensitive)', () => {
      const existing = [{ value: 'A@B.com', isPrimary: 1 }]
      expect(mergeEmail(existing, 'a@b.com')).toBe(existing)
    })
    it('ignores a blank email', () => {
      const existing = [{ value: 'x@y.com', isPrimary: 1 }]
      expect(mergeEmail(existing, '  ')).toBe(existing)
    })
  })
})

describe('isUnknownCaller (Inbox Add Person trigger)', () => {
  it('is true for the webhook phone placeholders', () => {
    expect(isUnknownCaller('Text lead 5412079190')).toBe(true)
    expect(isUnknownCaller('Call lead 5412079190')).toBe(true)
    expect(isUnknownCaller('Lead anna@example.com')).toBe(true)
  })
  it('is true for a bare phone number or empty name', () => {
    expect(isUnknownCaller('(541) 207-9190')).toBe(true)
    expect(isUnknownCaller('')).toBe(true)
    expect(isUnknownCaller(null)).toBe(true)
  })
  it('is false for a real name', () => {
    expect(isUnknownCaller('Amy Mora')).toBe(false)
    expect(isUnknownCaller('Ginny Schider')).toBe(false)
  })
})

describe('isValidDraftChannel (draft action validator)', () => {
  it('accepts text + email', () => {
    expect(isValidDraftChannel('text')).toBe(true)
    expect(isValidDraftChannel('email')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isValidDraftChannel('')).toBe(false)
    expect(isValidDraftChannel('sms')).toBe(false)
    expect(isValidDraftChannel('call')).toBe(false)
  })
})
