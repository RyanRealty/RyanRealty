/**
 * The rr_pid cookie's provenance (consent integrity, 2026-10-14).
 *
 * A form submit maps the visitor's browser to whatever email was typed, and the
 * next session on that browser is born identified from it. Before this change
 * that carryover minted the same signed cookie a tracked link mints, and the
 * CMA consent bar read any signed cookie as proof: a stranger who typed someone
 * else's email into a form could later record SMS or email consent in that
 * person's name. The cookie now carries how it was proven, and consent capture
 * reads only `verified`.
 */
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  personCookieValue,
  personCookieWrite,
  readPersonCookie,
  signInProvenance,
  signedPersonIdFromCookie,
  verifiedPersonIdFromCookie,
} from './person-cookie'
import { signPersonLinkToken } from './link-token'

const SECRET = 'person-cookie-test-secret'
let savedSecret: string | undefined

beforeEach(() => {
  savedSecret = process.env.EMAIL_TRACKING_SECRET
  process.env.EMAIL_TRACKING_SECRET = SECRET
})
afterEach(() => {
  if (savedSecret === undefined) delete process.env.EMAIL_TRACKING_SECRET
  else process.env.EMAIL_TRACKING_SECRET = savedSecret
})

/** The exact value the server set before 2026-10-14: channel `cookie`, same HMAC. */
function legacyCookieValue(personId: number): string {
  const mac = createHmac('sha256', SECRET).update(`rr-identity:v1:${personId}:cookie`).digest('base64url').slice(0, 22)
  return `${personId}.cookie.${mac}`
}

describe('reading the cookie', () => {
  it('a verified value reads back as signed and verified', () => {
    const v = personCookieValue(64115, 'verified')
    expect(v).not.toBe('64115')
    expect(readPersonCookie(v)).toEqual({ personId: 64115, signed: true, provenance: 'verified' })
    expect(signedPersonIdFromCookie(v)).toBe(64115)
    expect(verifiedPersonIdFromCookie(v)).toBe(64115)
  })

  it('a claimed value is signed (the identity loop keeps it) but never verified (consent refuses it)', () => {
    const v = personCookieValue(64115, 'claimed')
    expect(readPersonCookie(v)).toEqual({ personId: 64115, signed: true, provenance: 'claimed' })
    expect(signedPersonIdFromCookie(v)).toBe(64115)
    expect(verifiedPersonIdFromCookie(v)).toBeNull()
  })

  it('a value minted before provenance existed still identifies, and is unverified (fail closed)', () => {
    const v = legacyCookieValue(64115)
    expect(readPersonCookie(v)).toEqual({ personId: 64115, signed: true, provenance: 'legacy' })
    expect(signedPersonIdFromCookie(v)).toBe(64115)
    expect(verifiedPersonIdFromCookie(v)).toBeNull()
  })

  it('a bare legacy id is unsigned: low-stakes reads only, never the loop, never consent', () => {
    expect(readPersonCookie('64115')).toEqual({ personId: 64115, signed: false, provenance: 'unsigned' })
    expect(signedPersonIdFromCookie('64115')).toBeNull()
    expect(verifiedPersonIdFromCookie('64115')).toBeNull()
  })

  it('a link token dropped into the cookie is not a cookie value', () => {
    expect(readPersonCookie(signPersonLinkToken(64115, 'email'))).toBeNull()
  })

  it('reads nothing from garbage or a forged signature', () => {
    expect(readPersonCookie('')).toBeNull()
    expect(readPersonCookie(undefined)).toBeNull()
    expect(readPersonCookie('64115.verified.forged')).toBeNull()
    expect(readPersonCookie('64115.verified.AAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
  })
})

describe('when an identification rewrites the cookie', () => {
  // Read inside each test: the secret is set in beforeEach.
  let verified: ReturnType<typeof readPersonCookie>
  let claimed: ReturnType<typeof readPersonCookie>
  let legacy: ReturnType<typeof readPersonCookie>
  beforeEach(() => {
    verified = readPersonCookie(personCookieValue(7, 'verified'))
    claimed = readPersonCookie(personCookieValue(7, 'claimed'))
    legacy = readPersonCookie(legacyCookieValue(7))
    expect([verified?.provenance, claimed?.provenance, legacy?.provenance]).toEqual(['verified', 'claimed', 'legacy'])
  })

  it('no cookie, or an unsigned one: write what the identification proved', () => {
    expect(personCookieWrite(null, 7, 'claimed')).toBe('claimed')
    expect(personCookieWrite(null, 7, 'verified')).toBe('verified')
    expect(personCookieWrite(readPersonCookie('7'), 7, 'claimed')).toBe('claimed')
  })

  it('a different person: write, whatever the old cookie was (a shared browser follows the newest identity)', () => {
    expect(personCookieWrite(verified, 8, 'claimed')).toBe('claimed')
    expect(personCookieWrite(claimed, 8, 'verified')).toBe('verified')
  })

  it('the same person: a signed link upgrades a claimed or legacy cookie to verified', () => {
    expect(personCookieWrite(claimed, 7, 'verified')).toBe('verified')
    expect(personCookieWrite(legacy, 7, 'verified')).toBe('verified')
  })

  it('the same person: a claimed identification never downgrades or rewrites', () => {
    expect(personCookieWrite(verified, 7, 'claimed')).toBeNull()
    expect(personCookieWrite(claimed, 7, 'claimed')).toBeNull()
    expect(personCookieWrite(legacy, 7, 'claimed')).toBeNull()
    expect(personCookieWrite(verified, 7, 'verified')).toBeNull()
  })
})

describe('a sign-in', () => {
  it('is verified once the provider confirmed the email, a claim otherwise', () => {
    expect(signInProvenance({ email_confirmed_at: '2026-10-14T00:00:00Z' })).toBe('verified')
    expect(signInProvenance({ email_confirmed_at: null })).toBe('claimed')
    expect(signInProvenance({})).toBe('claimed')
    expect(signInProvenance(null)).toBe('claimed')
  })
})
