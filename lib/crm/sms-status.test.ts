import { describe, it, expect } from 'vitest'
import { classifyTwilioStatus, isForwardStateTransition } from './sms-status'

// Phase 9.4 delivery receipts. The /api/twilio/status route writes the result
// of classifyTwilioStatus onto the matching sms_out timeline row. These tests
// lock the four states the UI shows (delivered/undelivered/failed/queued), the
// carrier-filter detection (30007/30008), the opt-out suppression code (21610),
// and the forward-only transition rule that protects a 'delivered' row from a
// late, out-of-order 'sent' callback.

describe('classifyTwilioStatus', () => {
  it('maps delivered with no error code', () => {
    const r = classifyTwilioStatus('delivered', null)
    expect(r.state).toBe('delivered')
    expect(r.carrierFiltered).toBe(false)
    expect(r.shouldSuppress).toBe(false)
    expect(r.errorCode).toBe(null)
  })

  it('maps undelivered', () => {
    const r = classifyTwilioStatus('undelivered', undefined)
    expect(r.state).toBe('undelivered')
    expect(r.carrierFiltered).toBe(false)
    expect(r.shouldSuppress).toBe(false)
  })

  it('maps failed', () => {
    const r = classifyTwilioStatus('failed', '')
    expect(r.state).toBe('failed')
    expect(r.errorCode).toBe(null)
  })

  it('maps the interim sent/sending/queued states', () => {
    expect(classifyTwilioStatus('sent', null).state).toBe('sent')
    expect(classifyTwilioStatus('sending', null).state).toBe('sending')
    expect(classifyTwilioStatus('queued', null).state).toBe('queued')
    expect(classifyTwilioStatus('accepted', null).state).toBe('queued')
  })

  it('is case-insensitive and trims whitespace on the status', () => {
    expect(classifyTwilioStatus('  Delivered ', null).state).toBe('delivered')
    expect(classifyTwilioStatus('DELIVERED', null).state).toBe('delivered')
  })

  it('returns unknown for an unrecognized or missing status', () => {
    expect(classifyTwilioStatus('partially_delivered', null).state).toBe('unknown')
    expect(classifyTwilioStatus(null, null).state).toBe('unknown')
    expect(classifyTwilioStatus(undefined, undefined).state).toBe('unknown')
  })

  it('detects carrier filtering on 30007 (string error code)', () => {
    const r = classifyTwilioStatus('undelivered', '30007')
    expect(r.state).toBe('undelivered')
    expect(r.carrierFiltered).toBe(true)
    expect(r.errorCode).toBe(30007)
    // a single carrier filter does NOT suppress the channel
    expect(r.shouldSuppress).toBe(false)
  })

  it('detects carrier filtering on 30008 (numeric error code)', () => {
    const r = classifyTwilioStatus('undelivered', 30008)
    expect(r.carrierFiltered).toBe(true)
    expect(r.errorCode).toBe(30008)
    expect(r.shouldSuppress).toBe(false)
  })

  it('does not flag a non-carrier-filter error code as filtered', () => {
    const r = classifyTwilioStatus('failed', 30003)
    expect(r.carrierFiltered).toBe(false)
    expect(r.errorCode).toBe(30003)
    expect(r.shouldSuppress).toBe(false)
  })

  it('suppresses only on the STOP opt-out code 21610', () => {
    const r = classifyTwilioStatus('failed', 21610)
    expect(r.shouldSuppress).toBe(true)
    expect(r.carrierFiltered).toBe(false)
    expect(r.errorCode).toBe(21610)
  })

  it('ignores a non-numeric error code', () => {
    const r = classifyTwilioStatus('failed', 'not-a-number')
    expect(r.errorCode).toBe(null)
    expect(r.carrierFiltered).toBe(false)
    expect(r.shouldSuppress).toBe(false)
  })
})

describe('isForwardStateTransition (forward-only delivery state)', () => {
  it('always advances from a null/unknown current', () => {
    expect(isForwardStateTransition(null, 'sent')).toBe(true)
    expect(isForwardStateTransition(undefined, 'queued')).toBe(true)
    expect(isForwardStateTransition('unknown', 'sent')).toBe(true)
  })

  it('advances forward through the lifecycle', () => {
    expect(isForwardStateTransition('queued', 'sent')).toBe(true)
    expect(isForwardStateTransition('sent', 'delivered')).toBe(true)
    expect(isForwardStateTransition('sending', 'failed')).toBe(true)
  })

  it('rejects a late, out-of-order sent after delivered', () => {
    // The core forward-only guarantee: delivered must NOT be overwritten by a
    // stray 'sent' callback that lands afterward.
    expect(isForwardStateTransition('delivered', 'sent')).toBe(false)
    expect(isForwardStateTransition('delivered', 'queued')).toBe(false)
    expect(isForwardStateTransition('delivered', 'sending')).toBe(false)
  })

  it('does not overwrite one terminal state with another', () => {
    expect(isForwardStateTransition('delivered', 'failed')).toBe(false)
    expect(isForwardStateTransition('failed', 'delivered')).toBe(false)
    expect(isForwardStateTransition('undelivered', 'delivered')).toBe(false)
  })

  it('rejects re-applying the same state', () => {
    expect(isForwardStateTransition('sent', 'sent')).toBe(false)
    expect(isForwardStateTransition('delivered', 'delivered')).toBe(false)
  })
})
