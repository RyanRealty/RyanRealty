import { describe, expect, it } from 'vitest'
import {
  BROKER_RECLASS_CLEARED_REASON,
  isTrueOptOutSuppression,
  whereActiveSuppression,
} from './suppression-lifecycle'

describe('isTrueOptOutSuppression', () => {
  it('keeps STOP, Twilio opt-out, unsubscribe, bounce, complaint, and GPC', () => {
    expect(isTrueOptOutSuppression({ reason: 'stop-keyword', source: 'twilio' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'twilio-opt-out', source: 'twilio' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'unsubscribe', source: 'one-click' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'unsubscribed', source: 'newsletter' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'bounce', source: 'resend-webhook' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'bounced', source: 'gmail-dsn' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'complaint', source: 'resend-webhook' })).toBe(true)
    expect(isTrueOptOutSuppression({ reason: 'gpc-opt-out', source: 'gpc' })).toBe(true)
  })

  it('does not treat import hard-stops or no-sms-consent as opt-outs', () => {
    expect(isTrueOptOutSuppression({ reason: 'tcpa-hard-stop', source: 'import' })).toBe(false)
    expect(isTrueOptOutSuppression({ reason: 'no-sms-consent', source: 'import' })).toBe(false)
    expect(isTrueOptOutSuppression({ reason: 'compliance:hard-stop', source: 'app' })).toBe(false)
    expect(isTrueOptOutSuppression({ reason: '', source: 'twilio' })).toBe(false)
  })
})

describe('whereActiveSuppression', () => {
  it('adds cleared_at IS NULL', () => {
    const calls: Array<[string, null]> = []
    const q = {
      is(column: string, value: null) {
        calls.push([column, value])
        return this
      },
    }
    expect(whereActiveSuppression(q)).toBe(q)
    expect(calls).toEqual([['cleared_at', null]])
  })
})

describe('broker reclass reason', () => {
  it('is the exact cleared_reason the backfill writes', () => {
    expect(BROKER_RECLASS_CLEARED_REASON).toBe('broker reclass')
  })
})
