import { describe, it, expect } from 'vitest'
import { canSubscribe, isSoftDefaultSuppression, type SuppressionSignal } from './membership-consent'

describe('canSubscribe', () => {
  it('allows subscribing a clean contact (no suppressions)', () => {
    expect(canSubscribe('email', [])).toEqual({ allowed: true })
    expect(canSubscribe('sms', [])).toEqual({ allowed: true })
  })

  it('refuses every channel when a compliance hard-stop is on all', () => {
    const rows: SuppressionSignal[] = [{ channel: 'all', reason: 'hard-stop' }]
    expect(canSubscribe('email', rows).allowed).toBe(false)
    expect(canSubscribe('sms', rows).allowed).toBe(false)
    expect(canSubscribe('email', rows).reason).toContain('hard-stop')
  })

  it('refuses email re-subscribe after a CAN-SPAM unsubscribe', () => {
    const rows: SuppressionSignal[] = [{ channel: 'email', reason: 'unsubscribe' }]
    const result = canSubscribe('email', rows)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('unsubscribe')
  })

  it('refuses email re-subscribe after a hard bounce or complaint', () => {
    expect(canSubscribe('email', [{ channel: 'email', reason: 'bounce' }]).allowed).toBe(false)
    expect(canSubscribe('email', [{ channel: 'email', reason: 'complaint' }]).allowed).toBe(false)
  })

  it('refuses sms re-subscribe after a STOP stop-keyword opt-out', () => {
    const rows: SuppressionSignal[] = [{ channel: 'sms', reason: 'stop-keyword' }]
    const result = canSubscribe('sms', rows)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('stop-keyword')
  })

  it('refuses sms re-subscribe after a twilio carrier opt-out', () => {
    expect(canSubscribe('sms', [{ channel: 'sms', reason: 'twilio-opt-out' }]).allowed).toBe(false)
  })

  it('refuses sms re-subscribe over a TCPA do-not-text', () => {
    expect(canSubscribe('sms', [{ channel: 'sms', reason: 'do-not-text' }]).allowed).toBe(false)
  })

  it('allows sms re-subscribe when only the soft no-sms-consent default is present', () => {
    const rows: SuppressionSignal[] = [{ channel: 'sms', reason: 'no-sms-consent' }]
    expect(canSubscribe('sms', rows)).toEqual({ allowed: true })
  })

  it('treats an unknown reason as a hard-stop (fail closed)', () => {
    const rows: SuppressionSignal[] = [{ channel: 'sms', reason: 'some-future-opt-out' }]
    expect(canSubscribe('sms', rows).allowed).toBe(false)
  })

  it('ignores a suppression on a different channel', () => {
    // An email unsubscribe must not block an sms subscribe, and vice-versa.
    expect(canSubscribe('sms', [{ channel: 'email', reason: 'unsubscribe' }])).toEqual({ allowed: true })
    expect(canSubscribe('email', [{ channel: 'sms', reason: 'stop-keyword' }])).toEqual({ allowed: true })
  })

  it('refuses sms even when a soft default coexists with a real opt-out', () => {
    const rows: SuppressionSignal[] = [
      { channel: 'sms', reason: 'no-sms-consent' },
      { channel: 'sms', reason: 'stop-keyword' },
    ]
    expect(canSubscribe('sms', rows).allowed).toBe(false)
  })

  it('refuses an all hard-stop even when the channel itself only has a soft default', () => {
    const rows: SuppressionSignal[] = [
      { channel: 'all', reason: 'hard-stop' },
      { channel: 'sms', reason: 'no-sms-consent' },
    ]
    expect(canSubscribe('sms', rows).allowed).toBe(false)
  })

  it('handles a reason with surrounding whitespace and case', () => {
    expect(canSubscribe('sms', [{ channel: 'sms', reason: '  No-SMS-Consent  ' }])).toEqual({ allowed: true })
    expect(canSubscribe('email', [{ channel: 'email', reason: '  UNSUBSCRIBE ' }]).allowed).toBe(false)
  })
})

describe('isSoftDefaultSuppression', () => {
  it('treats only no-sms-consent as a soft default', () => {
    expect(isSoftDefaultSuppression('no-sms-consent')).toBe(true)
    expect(isSoftDefaultSuppression('NO-SMS-CONSENT')).toBe(true)
    expect(isSoftDefaultSuppression('stop-keyword')).toBe(false)
    expect(isSoftDefaultSuppression('unsubscribe')).toBe(false)
    expect(isSoftDefaultSuppression('bounce')).toBe(false)
    expect(isSoftDefaultSuppression('')).toBe(false)
  })
})
