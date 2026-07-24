/**
 * Unit tests for alert-drain-core (W5.5) — the safety rules of the serverless
 * broker-alert drain. Pins the 2026-06-16 incident backstop: a non-broker
 * phone can NEVER pass the whitelist, regardless of formatting.
 */
import { describe, expect, it } from 'vitest'
import {
  brokerPhoneSet,
  isBrokerPhone,
  toE164,
  failureTransition,
  MAX_ATTEMPTS,
  last10,
} from './alert-drain-core'

const env = {
  TWILIO_FORWARD_MATT: '+15415551234',
  TWILIO_FORWARD_REBECCA: '541-555-2345',
  TWILIO_FORWARD_PAUL: '(541) 555-3456',
}

describe('alert-drain-core (W5.5)', () => {
  it('whitelists all three broker lines across formats', () => {
    const wl = brokerPhoneSet(env)
    expect(isBrokerPhone('+15415551234', wl)).toBe(true) // E164
    expect(isBrokerPhone('5415552345', wl)).toBe(true) // bare 10
    expect(isBrokerPhone('1-541-555-3456', wl)).toBe(true) // dashed 11
  })

  it('REFUSES a non-broker phone (the incident backstop)', () => {
    const wl = brokerPhoneSet(env)
    expect(isBrokerPhone('+15419998888', wl)).toBe(false) // a homeowner
    expect(isBrokerPhone('', wl)).toBe(false)
    expect(isBrokerPhone(null, wl)).toBe(false)
    expect(isBrokerPhone('555-1234', wl)).toBe(false) // short/garbage
  })

  it('an empty env whitelist refuses everything (fail closed)', () => {
    const wl = brokerPhoneSet({})
    expect(wl.size).toBe(0)
    expect(isBrokerPhone('+15415551234', wl)).toBe(false)
  })

  it('normalizes to E.164', () => {
    expect(toE164('+15415551234')).toBe('+15415551234')
    expect(toE164('541-555-1234')).toBe('+15415551234')
    expect(toE164('15415551234')).toBe('+15415551234')
  })

  it('retries until MAX_ATTEMPTS then goes terminal', () => {
    expect(failureTransition(0)).toEqual({ attempts: 1, status: 'pending' })
    expect(failureTransition(1)).toEqual({ attempts: 2, status: 'pending' })
    expect(failureTransition(MAX_ATTEMPTS - 1)).toEqual({ attempts: MAX_ATTEMPTS, status: 'failed' })
    expect(failureTransition(null)).toEqual({ attempts: 1, status: 'pending' })
  })

  it('last10 strips formatting and country code', () => {
    expect(last10('+1 (541) 555-1234')).toBe('5415551234')
  })
})
