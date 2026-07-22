/**
 * Channel-aware sent-state + email-channel guard helpers (the pure, extractable
 * pieces of the email-intro wiring — the claim/finalize state machine itself
 * lives in row-locked SQL RPCs, migration 20260722010100, and is not
 * unit-testable from TS).
 *
 * Locks:
 * - mergeChannelSentState: a row is "sent" when EITHER channel sent; sentAt is
 *   the FIRST touch; per-channel stamps survive the merge.
 * - hasSendableEmail: the display/guard email-presence twin of hasSendablePhone.
 * - isUndefinedColumnError: the 42703 feature-detect that keeps the dashboard
 *   rendering before the email-outreach migration is applied.
 */
import { describe, expect, it } from 'vitest'
import { hasSendableEmail, isUndefinedColumnError, mergeChannelSentState } from './types'

describe('mergeChannelSentState', () => {
  it('returns null when neither channel has sent (row is not "sent")', () => {
    expect(mergeChannelSentState(null, null)).toBeNull()
  })

  it('sms-only send: sentAt = sms stamp, email stays null', () => {
    expect(mergeChannelSentState('2026-07-20T18:00:00Z', null)).toEqual({
      sentAt: '2026-07-20T18:00:00Z',
      smsSentAt: '2026-07-20T18:00:00Z',
      emailSentAt: null,
    })
  })

  it('email-only send: sentAt = email stamp, sms stays null', () => {
    expect(mergeChannelSentState(null, '2026-07-21T02:30:00Z')).toEqual({
      sentAt: '2026-07-21T02:30:00Z',
      smsSentAt: null,
      emailSentAt: '2026-07-21T02:30:00Z',
    })
  })

  it('both channels sent: sentAt is the FIRST touch (earliest), both stamps kept', () => {
    const smsFirst = mergeChannelSentState('2026-07-19T10:00:00Z', '2026-07-21T02:30:00Z')
    expect(smsFirst?.sentAt).toBe('2026-07-19T10:00:00Z')
    expect(smsFirst?.smsSentAt).toBe('2026-07-19T10:00:00Z')
    expect(smsFirst?.emailSentAt).toBe('2026-07-21T02:30:00Z')

    const emailFirst = mergeChannelSentState('2026-07-21T02:30:00Z', '2026-07-19T10:00:00Z')
    expect(emailFirst?.sentAt).toBe('2026-07-19T10:00:00Z')
  })

  it('identical stamps pick that stamp', () => {
    const same = mergeChannelSentState('2026-07-20T18:00:00Z', '2026-07-20T18:00:00Z')
    expect(same?.sentAt).toBe('2026-07-20T18:00:00Z')
  })
})

describe('hasSendableEmail', () => {
  it('accepts a plain valid address', () => {
    expect(hasSendableEmail('owner@example.com')).toBe(true)
    expect(hasSendableEmail('  Owner.Name+tag@sub.example.co  ')).toBe(true)
  })

  it('rejects null / empty / whitespace', () => {
    expect(hasSendableEmail(null)).toBe(false)
    expect(hasSendableEmail(undefined)).toBe(false)
    expect(hasSendableEmail('')).toBe(false)
    expect(hasSendableEmail('   ')).toBe(false)
  })

  it('rejects structurally broken addresses', () => {
    expect(hasSendableEmail('not-an-email')).toBe(false)
    expect(hasSendableEmail('owner@')).toBe(false)
    expect(hasSendableEmail('@example.com')).toBe(false)
    expect(hasSendableEmail('owner@example')).toBe(false)
    expect(hasSendableEmail('owner name@example.com')).toBe(false)
  })
})

describe('isUndefinedColumnError', () => {
  it('matches SQLSTATE 42703 by code', () => {
    expect(isUndefinedColumnError({ code: '42703', message: 'column expired_listings.outreach_email_sent_at does not exist' })).toBe(true)
  })

  it('matches by message when the code is missing', () => {
    expect(isUndefinedColumnError({ message: 'column "outreach_email_status" does not exist' })).toBe(true)
  })

  it('does not match other errors or empty input', () => {
    expect(isUndefinedColumnError(null)).toBe(false)
    expect(isUndefinedColumnError(undefined)).toBe(false)
    expect(isUndefinedColumnError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(false)
    expect(isUndefinedColumnError({ code: '57014', message: 'statement timeout' })).toBe(false)
  })
})
