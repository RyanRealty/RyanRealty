import { describe, expect, it } from 'vitest'
import {
  LINK_CHANNELS,
  identifiedViaForChannel,
  isLegacyRawPersonId,
  looksLikePersonToken,
  signPersonLinkToken,
  verifyPersonLinkToken,
} from './link-token'
import { personCookieValue, readPersonCookie, signedPersonIdFromCookie } from './person-cookie'

describe('signed person token — round trip (P7 identity loop)', () => {
  it('verifies back to the same person and channel for every channel', () => {
    for (const channel of LINK_CHANNELS) {
      const token = signPersonLinkToken(64115, channel)
      expect(looksLikePersonToken(token)).toBe(true)
      expect(verifyPersonLinkToken(token)).toEqual({ personId: 64115, channel })
    }
  })

  it('is deterministic (the same link twice is the same token) and URL-safe', () => {
    const a = signPersonLinkToken(13168, 'sms')
    expect(signPersonLinkToken(13168, 'sms')).toBe(a)
    expect(encodeURIComponent(a)).toBe(a)
    expect(a.startsWith('13168.sms.')).toBe(true)
  })

  it('never carries an email, phone or name', () => {
    const t = signPersonLinkToken(42, 'email')
    expect(t).not.toMatch(/@|%40|\+1|\s/)
  })
})

describe('signed person token — forgery is refused', () => {
  it('refuses a bare legacy id (the pre-2026-09-23 link shape)', () => {
    expect(verifyPersonLinkToken('64115')).toBeNull()
    expect(isLegacyRawPersonId('64115')).toBe(true)
  })

  it('refuses a token whose id was edited to another contact', () => {
    const token = signPersonLinkToken(64115, 'email')
    const forged = token.replace(/^64115\./, '64116.')
    expect(verifyPersonLinkToken(forged)).toBeNull()
  })

  it('refuses a token whose channel was edited', () => {
    const token = signPersonLinkToken(64115, 'email')
    expect(verifyPersonLinkToken(token.replace('.email.', '.sms.'))).toBeNull()
  })

  it('refuses a truncated or padded signature, garbage, and non-strings', () => {
    const token = signPersonLinkToken(7, 'document')
    expect(verifyPersonLinkToken(token.slice(0, -1))).toBeNull()
    expect(verifyPersonLinkToken(`${token}x`)).toBeNull()
    expect(verifyPersonLinkToken('7.document.AAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
    for (const bad of [null, undefined, 7, {}, '', 'abc', '0.email.AAAAAAAAAAAAAAAAAAAAAA']) {
      expect(verifyPersonLinkToken(bad)).toBeNull()
    }
  })

  it('refuses an unknown channel even with a well-formed shape', () => {
    expect(verifyPersonLinkToken('7.bogus.AAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
  })

  it('throws on a bad id or channel at signing time (a programmer error, never a silent bad link)', () => {
    expect(() => signPersonLinkToken(0, 'email')).toThrow()
    expect(() => signPersonLinkToken(1.5, 'email')).toThrow()
    // @ts-expect-error channel outside the enum
    expect(() => signPersonLinkToken(5, 'bogus')).toThrow()
  })
})

describe('identified_via label', () => {
  it('names the channel', () => {
    expect(identifiedViaForChannel('sms')).toBe('tracked_link:sms')
  })
})

describe('rr_pid cookie', () => {
  it('writes a signed cookie value and reads it back as signed', () => {
    const v = personCookieValue(64115)
    expect(v).not.toBe('64115')
    expect(readPersonCookie(v)).toEqual({ personId: 64115, signed: true })
    expect(signedPersonIdFromCookie(v)).toBe(64115)
  })

  it('reads a legacy bare-id cookie as UNSIGNED, and access decisions get null', () => {
    expect(readPersonCookie('64115')).toEqual({ personId: 64115, signed: false })
    expect(signedPersonIdFromCookie('64115')).toBeNull()
  })

  it('reads nothing from garbage', () => {
    expect(readPersonCookie('')).toBeNull()
    expect(readPersonCookie(undefined)).toBeNull()
    expect(readPersonCookie('64115.cookie.forged')).toBeNull()
  })
})
