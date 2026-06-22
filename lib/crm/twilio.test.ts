import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { validateTwilioSignature } from './twilio'

// Inbound-SMS webhook auth (audit p3.2 security). A forged/replayed webhook could
// spoof a TCPA opt-out/opt-in or inject CRM events; validateTwilioSignature is the
// only thing standing between Twilio and our handler. Lock accept/reject + fail-closed.
const TOKEN = 'test-auth-token'
const sign = (url: string, params: Record<string, string>) =>
  crypto
    .createHmac('sha1', TOKEN)
    .update(Buffer.from(url + Object.keys(params).sort().map((k) => k + params[k]).join(''), 'utf8'))
    .digest('base64')

const ORIG_SID = process.env.TWILIO_ACCOUNT_SID
const ORIG_TOKEN = process.env.TWILIO_AUTH_TOKEN

beforeEach(() => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = TOKEN
})
afterEach(() => {
  if (ORIG_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID
  else process.env.TWILIO_ACCOUNT_SID = ORIG_SID
  if (ORIG_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN
  else process.env.TWILIO_AUTH_TOKEN = ORIG_TOKEN
})

describe('validateTwilioSignature', () => {
  const url = 'https://ryan-realty.com/api/twilio/inbound-sms'
  const params = { From: '+15415551234', Body: 'STOP', MessageSid: 'SM123' }

  it('accepts a correctly-signed request', () => {
    expect(validateTwilioSignature(url, params, sign(url, params))).toBe(true)
  })

  it('is independent of param insertion order (params are sorted before hashing)', () => {
    const reordered = { MessageSid: 'SM123', Body: 'STOP', From: '+15415551234' }
    expect(validateTwilioSignature(url, reordered, sign(url, params))).toBe(true)
  })

  it('rejects a forged signature, a tampered body, or a swapped URL', () => {
    expect(validateTwilioSignature(url, params, 'forged')).toBe(false)
    expect(validateTwilioSignature(url, { ...params, Body: 'START' }, sign(url, params))).toBe(false)
    expect(validateTwilioSignature('https://evil.example.com/x', params, sign(url, params))).toBe(false)
  })

  it('rejects a null signature', () => {
    expect(validateTwilioSignature(url, params, null)).toBe(false)
  })

  it('fails closed when Twilio creds are not configured', () => {
    delete process.env.TWILIO_AUTH_TOKEN
    expect(validateTwilioSignature(url, params, sign(url, params))).toBe(false)
  })
})
