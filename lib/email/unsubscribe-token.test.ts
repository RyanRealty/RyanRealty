import { describe, it, expect } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl } from './unsubscribe-token'

describe('email unsubscribe token (9.3)', () => {
  it('round-trips a person id through sign -> verify', () => {
    const token = signUnsubscribeToken(4242)
    expect(verifyUnsubscribeToken(token)).toEqual({ personId: 4242, channel: 'email' })
  })

  it('does not cross-contaminate ids', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(1))).toEqual({ personId: 1, channel: 'email' })
    expect(verifyUnsubscribeToken(signUnsubscribeToken(999))).toEqual({ personId: 999, channel: 'email' })
  })

  it('rejects a tampered signature', () => {
    const token = signUnsubscribeToken(7)
    const [payload] = token.split('.')
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(7)
    const [, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ p: 8, c: 'email' })).toString('base64url')
    expect(verifyUnsubscribeToken(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects empty / malformed tokens', () => {
    expect(verifyUnsubscribeToken('')).toBeNull()
    expect(verifyUnsubscribeToken(null)).toBeNull()
    expect(verifyUnsubscribeToken('no-dot')).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c')).toBeNull()
  })

  it('builds an absolute one-click URL carrying the signed token', () => {
    const url = buildUnsubscribeUrl(55)
    expect(url).toMatch(/\/api\/email\/unsubscribe\?t=/)
    const token = decodeURIComponent(url.split('t=')[1])
    expect(verifyUnsubscribeToken(token)).toEqual({ personId: 55, channel: 'email' })
  })
})
