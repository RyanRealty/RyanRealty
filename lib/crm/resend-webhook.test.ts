import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySvixSignature, isFreshTimestamp, classifyResendEvent } from './resend-webhook'

// Independent implementation of the Svix signing algorithm (the spec the verifier
// must match): HMAC-SHA256 over `${id}.${ts}.${body}` with the base64-decoded
// secret (after the `whsec_` prefix), base64-encoded, presented as `v1,<sig>`.
function signSvix(secret: string, id: string, ts: string, body: string): string {
  const sb = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  return 'v1,' + createHmac('sha256', sb).update(`${id}.${ts}.${body}`).digest('base64')
}

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const TS = '1614265330'
const BODY = '{"test": 2432232314}'
const base = { secret: SECRET, svixId: ID, svixTimestamp: TS, body: BODY }

describe('verifySvixSignature', () => {
  it('verifies a correctly-signed payload', () => {
    expect(verifySvixSignature({ ...base, signatureHeader: signSvix(SECRET, ID, TS, BODY) })).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifySvixSignature({ ...base, body: '{"test": 9999999999}', signatureHeader: signSvix(SECRET, ID, TS, BODY) })).toBe(false)
  })
  it('rejects a wrong/missing version prefix', () => {
    const sig = signSvix(SECRET, ID, TS, BODY).replace('v1,', 'v2,')
    expect(verifySvixSignature({ ...base, signatureHeader: sig })).toBe(false)
  })
  it('accepts when one of several space-delimited sigs matches', () => {
    const header = 'v1,aaaa ' + signSvix(SECRET, ID, TS, BODY)
    expect(verifySvixSignature({ ...base, signatureHeader: header })).toBe(true)
  })
  it('rejects a signature made without stripping the whsec_ prefix (proves correct secret handling)', () => {
    // A wrong signer that base64-decodes the whole secret incl. "whsec_".
    const wrong = 'v1,' + createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`${ID}.${TS}.${BODY}`).digest('base64')
    expect(verifySvixSignature({ ...base, signatureHeader: wrong })).toBe(false)
  })
  it('rejects empty inputs', () => {
    const sig = signSvix(SECRET, ID, TS, BODY)
    expect(verifySvixSignature({ ...base, secret: '', signatureHeader: sig })).toBe(false)
    expect(verifySvixSignature({ ...base, signatureHeader: '' })).toBe(false)
  })
})

describe('isFreshTimestamp', () => {
  it('accepts a timestamp within tolerance', () => {
    const now = 1614265330_000 + 60_000 // 60s after
    expect(isFreshTimestamp('1614265330', now)).toBe(true)
  })
  it('rejects a stale timestamp (replay)', () => {
    const now = 1614265330_000 + 600_000 // 10 min after, default tolerance 300s
    expect(isFreshTimestamp('1614265330', now)).toBe(false)
  })
})

describe('classifyResendEvent', () => {
  it('suppresses on complaint', () => {
    const e = classifyResendEvent({ type: 'email.complained', data: { to: ['A@B.com'] } })
    expect(e.suppressEmail).toBe(true)
    expect(e.suppressReason).toBe('complaint')
    expect(e.recipients).toEqual(['a@b.com'])
  })
  it('suppresses on a hard/unspecified bounce', () => {
    const e = classifyResendEvent({ type: 'email.bounced', data: { to: 'x@y.com', bounce: { type: 'Permanent' } } })
    expect(e.suppressEmail).toBe(true)
    expect(e.suppressReason).toBe('bounce')
    expect(e.recipients).toEqual(['x@y.com'])
  })
  it('does NOT suppress on a transient (soft) bounce', () => {
    const e = classifyResendEvent({ type: 'email.bounced', data: { to: ['x@y.com'], bounce: { type: 'Transient' } } })
    expect(e.suppressEmail).toBe(false)
    expect(e.suppressReason).toBeNull()
  })
  it('does not suppress on delivered/opened/clicked', () => {
    expect(classifyResendEvent({ type: 'email.delivered', data: { to: ['x@y.com'] } }).suppressEmail).toBe(false)
    const c = classifyResendEvent({ type: 'email.clicked', data: { to: ['x@y.com'], click: { link: 'https://z' } } })
    expect(c.suppressEmail).toBe(false)
    expect(c.clickUrl).toBe('https://z')
  })
  it('maps an unknown event type to null', () => {
    expect(classifyResendEvent({ type: 'email.scheduled' }).type).toBeNull()
  })
  it('classifies email.unsubscribed (T-8) without suppressing as a bounce', () => {
    const e = classifyResendEvent({ type: 'email.unsubscribed', data: { to: ['x@y.com'] } })
    expect(e.type).toBe('unsubscribed')
    expect(e.suppressEmail).toBe(false)
    expect(e.suppressReason).toBeNull()
  })
})
