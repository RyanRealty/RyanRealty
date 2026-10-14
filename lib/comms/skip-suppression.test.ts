import { describe, expect, it } from 'vitest'
import {
  holdingSuppressionReasons,
  maySkipSoftSuppression,
  suppressionReasonMustHold,
} from './skip-suppression'

describe('suppressionReasonMustHold', () => {
  it('holds STOP, bounce, complaint, unsubscribe, and GPC', () => {
    expect(suppressionReasonMustHold('sms:stop-keyword')).toBe(true)
    expect(suppressionReasonMustHold('sms:twilio-opt-out')).toBe(true)
    expect(suppressionReasonMustHold('email:unsubscribe')).toBe(true)
    expect(suppressionReasonMustHold('all:unsubscribed')).toBe(true)
    expect(suppressionReasonMustHold('email:bounce')).toBe(true)
    expect(suppressionReasonMustHold('email:bounced')).toBe(true)
    expect(suppressionReasonMustHold('email:complaint')).toBe(true)
    expect(suppressionReasonMustHold('all:gpc-opt-out')).toBe(true)
    expect(suppressionReasonMustHold('value:sms:gpc')).toBe(true)
  })

  it('holds a hard-stop and a failed read', () => {
    expect(suppressionReasonMustHold('tag:compliance:hard-stop')).toBe(true)
    expect(suppressionReasonMustHold('suppression-check-failed: boom')).toBe(true)
    expect(suppressionReasonMustHold('tag-check-failed: down')).toBe(true)
  })

  it('does not hold a missing-consent or marketing-opt-in row', () => {
    expect(suppressionReasonMustHold('sms:no-sms-consent')).toBe(false)
    expect(suppressionReasonMustHold('sms:tcpa-hard-stop')).toBe(false)
    expect(suppressionReasonMustHold('email:no-email-consent')).toBe(false)
  })
})

describe('maySkipSoftSuppression', () => {
  it('is false unless skipSuppression is set', () => {
    expect(maySkipSoftSuppression({ initiatorKind: 'broker', purpose: 'crm:manual-sms' })).toBe(false)
  })

  it('allows a broker 1:1 compose', () => {
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        initiatorKind: 'broker',
        purpose: 'crm:manual-sms',
      }),
    ).toBe(true)
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        initiatorKind: 'broker',
        purpose: 'crm:manual-group-sms',
      }),
    ).toBe(true)
  })

  it('refuses drip, marketing, bulk, and system paths even when the flag is set', () => {
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        initiatorKind: 'system',
        purpose: 'prospecting:drip',
      }),
    ).toBe(false)
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        initiatorKind: 'broker',
        purpose: 'marketing-broadcast',
      }),
    ).toBe(false)
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        initiatorKind: 'system',
        source: 'sequence-engine',
      }),
    ).toBe(false)
    expect(
      maySkipSoftSuppression({
        skipSuppression: true,
        purpose: 'crm:manual-sms',
      }),
    ).toBe(true)
  })
})

describe('holdingSuppressionReasons', () => {
  it('keeps opt-outs when mixed with a skippable consent row', () => {
    expect(
      holdingSuppressionReasons(['sms:no-sms-consent', 'sms:stop-keyword']),
    ).toEqual(['sms:stop-keyword'])
  })
})
