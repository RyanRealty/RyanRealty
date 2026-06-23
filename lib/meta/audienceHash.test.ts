import { describe, it, expect } from 'vitest'
import {
  sha256Hex,
  normalizeEmail,
  normalizePhone,
  normalizeName,
  buildAudienceUserData,
  toSchemaRow,
  AUDIENCE_SCHEMA,
} from './audienceHash'

// Known Meta test vectors (computed with node:crypto, the same primitive the
// module uses). The email vector matches Meta's published "preparing hashed
// data" example for test@test.com.
const SHA = {
  testEmail: 'f660ab912ec121d1b1e928a0bb4bc61b15f5ad44d5efdc4e1c92a25e99b8e44a', // sha256('test@test.com')
  phoneE164: 'd6736136ea896c1bfdc553e0e86e702c70d060d805696ca3e4e9e0961353860a', // sha256('15551234567')
  fnJohn: '96d9632f363564cc3032521409cf22a852f2032eec099ed5967c0d000cec607a', // sha256('john')
  lnSmith: '6627835f988e2c5e50533d491163072d3f4f41f5c8b04630150debb3722ca2dd', // sha256('smith')
}

describe('sha256Hex', () => {
  it('produces the documented Meta hash for test@test.com', () => {
    expect(sha256Hex('test@test.com')).toBe(SHA.testEmail)
  })
  it('is 64 lowercase hex chars', () => {
    expect(sha256Hex('anything')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims to Meta-normalized form', () => {
    expect(normalizeEmail('  TEST@Test.com ')).toBe('test@test.com')
  })
  it('rejects blank, null, and non-email tokens', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('two@@at')).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('strips formatting and prefixes the US country code for a 10-digit number', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('15551234567')
    expect(normalizePhone('555.123.4567')).toBe('15551234567')
  })
  it('keeps an 11-digit number that already carries the country code', () => {
    expect(normalizePhone('1-555-123-4567')).toBe('15551234567')
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567')
  })
  it('rejects too-short and empty values', () => {
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone('555-1234')).toBeNull() // only 7 digits
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
  it('honors a non-US default country code', () => {
    expect(normalizePhone('7911 123456', '44')).toBe('447911123456')
  })
})

describe('normalizeName', () => {
  it('lowercases, trims, and strips whitespace + ignored punctuation', () => {
    expect(normalizeName('  John ')).toBe('john')
    expect(normalizeName("O'Brien")).toBe('obrien')
    expect(normalizeName('Mary-Jane')).toBe('maryjane')
    expect(normalizeName('Van Der Berg')).toBe('vanderberg')
  })
  it('preserves accented letters (UTF-8 byte match)', () => {
    // "Jose" with an acute-e (U+00E9). ASCII-escaped source so the file stays
    // ASCII-only per repo test convention; the runtime value is still accented.
    expect(normalizeName('Jos\u00e9')).toBe('jos\u00e9')
  })
  it('returns null for blank/null/punctuation-only', () => {
    expect(normalizeName('')).toBeNull()
    expect(normalizeName('   ')).toBeNull()
    expect(normalizeName('---')).toBeNull()
    expect(normalizeName(null)).toBeNull()
    expect(normalizeName(undefined)).toBeNull()
  })
})

describe('buildAudienceUserData', () => {
  it('builds the full MULTI_KEY hashed record from a person', () => {
    const out = buildAudienceUserData({
      email: 'TEST@test.com',
      phone: '(555) 123-4567',
      firstName: 'John',
      lastName: 'Smith',
    })
    expect(out).toEqual({
      EMAIL: SHA.testEmail,
      PHONE: SHA.phoneE164,
      FN: SHA.fnJohn,
      LN: SHA.lnSmith,
    })
  })

  it('omits keys the person has no value for', () => {
    const out = buildAudienceUserData({ email: 'test@test.com' })
    expect(out).toEqual({ EMAIL: SHA.testEmail })
    expect(out).not.toHaveProperty('PHONE')
    expect(out).not.toHaveProperty('FN')
  })

  it('returns null when there is no usable email AND no usable phone', () => {
    // Name-only rows can never match a Meta customer file -> excluded.
    expect(buildAudienceUserData({ firstName: 'John', lastName: 'Smith' })).toBeNull()
    expect(buildAudienceUserData({ email: 'bad', phone: '123' })).toBeNull()
    expect(buildAudienceUserData({})).toBeNull()
  })

  it('picks the first usable email/phone from the list when the scalar is missing', () => {
    const out = buildAudienceUserData({
      emails: [null, '  ', 'TEST@test.com', 'second@x.com'],
      phones: ['bad', '555-123-4567'],
    })
    expect(out?.EMAIL).toBe(SHA.testEmail)
    expect(out?.PHONE).toBe(SHA.phoneE164)
  })

  it('never emits raw PII -- every value is a 64-char hex digest', () => {
    const out = buildAudienceUserData({
      email: 'person@example.com',
      phone: '5551239876',
      firstName: 'Pat',
      lastName: 'Lee',
    })!
    for (const v of Object.values(out)) {
      expect(v).toMatch(/^[0-9a-f]{64}$/)
    }
    // No plaintext leaked.
    expect(JSON.stringify(out)).not.toContain('person@example.com')
    expect(JSON.stringify(out)).not.toContain('pat')
  })
})

describe('toSchemaRow', () => {
  it('projects into the AUDIENCE_SCHEMA column order with empty strings for gaps', () => {
    expect(AUDIENCE_SCHEMA).toEqual(['EMAIL', 'PHONE', 'FN', 'LN'])
    const row = toSchemaRow({ EMAIL: SHA.testEmail, LN: SHA.lnSmith })
    expect(row).toEqual([SHA.testEmail, '', '', SHA.lnSmith])
  })
})
