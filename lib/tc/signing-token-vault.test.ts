import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openSigningToken, sealSigningToken } from './signing-token-vault'

// The signing-link-lifetime fix (docs: mintOrReuseSigningLink) depends on this
// round-tripping correctly and failing CLOSED (null, never a thrown error or a
// wrong-but-plausible string) on anything it cannot trust.
const OLD_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...OLD_ENV }
  delete process.env.SIGNING_TOKEN_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789'
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})


function flipByte(segment: string, at: number): string {
  const bytes = Buffer.from(segment, 'base64url')
  bytes[at] = bytes[at]! ^ 0x01
  return bytes.toString('base64url')
}

describe('sealSigningToken / openSigningToken', () => {
  it('round trips a raw token', () => {
    const token = 'abc123_XYZ-token-value'
    const enc = sealSigningToken(token)
    expect(openSigningToken(enc)).toBe(token)
  })

  it('produces a versioned, dot-delimited format', () => {
    const enc = sealSigningToken('some-token')
    const parts = enc.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('v1')
  })

  it('never produces the same ciphertext twice for the same token (random IV)', () => {
    const a = sealSigningToken('same-token')
    const b = sealSigningToken('same-token')
    expect(a).not.toBe(b)
    expect(openSigningToken(a)).toBe('same-token')
    expect(openSigningToken(b)).toBe('same-token')
  })

  it('returns null, never throws, on a tampered payload', () => {
    const enc = sealSigningToken('a-real-token')
    const [version, iv, payload] = enc.split('.')
    // Flip one real byte. Swapping the last base64url character can change
    // only padding bits, which decodes to the same bytes.
    const tampered = `${version}.${iv}.${flipByte(payload, 0)}`
    expect(() => openSigningToken(tampered)).not.toThrow()
    expect(openSigningToken(tampered)).toBeNull()
  })

  it('returns null, never throws, on a tampered IV', () => {
    const enc = sealSigningToken('a-real-token')
    const [version, iv, payload] = enc.split('.')
    const tampered = `${version}.${flipByte(iv, 0)}.${payload}`
    expect(openSigningToken(tampered)).toBeNull()
  })

  it('returns null for a token sealed under a different key', () => {
    const enc = sealSigningToken('a-real-token')
    process.env.SIGNING_TOKEN_KEY = 'a-completely-different-key-material'
    expect(openSigningToken(enc)).toBeNull()
  })

  it('SIGNING_TOKEN_KEY, when set, takes precedence over the service role key', () => {
    process.env.SIGNING_TOKEN_KEY = 'dedicated-signing-token-key'
    const enc = sealSigningToken('a-real-token')
    // Changing the service role key alone must not affect decryption once a
    // dedicated key is configured.
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-totally-different-service-role-key'
    expect(openSigningToken(enc)).toBe('a-real-token')
  })

  it('rejects an unrecognized format version', () => {
    const enc = sealSigningToken('a-real-token')
    const [, iv, payload] = enc.split('.')
    expect(openSigningToken(`v2.${iv}.${payload}`)).toBeNull()
  })

  it('returns null on garbage input instead of throwing', () => {
    expect(openSigningToken('not-a-sealed-token')).toBeNull()
    expect(openSigningToken('')).toBeNull()
    expect(openSigningToken(null)).toBeNull()
    expect(openSigningToken(undefined)).toBeNull()
    expect(openSigningToken('v1.short.short')).toBeNull()
  })

  it('throws when sealing without any key material configured', () => {
    delete process.env.SIGNING_TOKEN_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => sealSigningToken('a-real-token')).toThrow()
  })
})
