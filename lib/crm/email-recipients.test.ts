import { describe, it, expect } from 'vitest'
import { isValidEmailAddress, parseRecipientFields } from './email-recipients'

describe('isValidEmailAddress', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmailAddress('matt@ryan-realty.com')).toBe(true)
    expect(isValidEmailAddress('jane.doe+tag@example.co.uk')).toBe(true)
    expect(isValidEmailAddress("o'brien@example.com")).toBe(true)
  })
  it('rejects junk', () => {
    expect(isValidEmailAddress('not-an-email')).toBe(false)
    expect(isValidEmailAddress('a@b')).toBe(false)
    expect(isValidEmailAddress('me @example.com')).toBe(false)
    expect(isValidEmailAddress('')).toBe(false)
  })
})

describe('parseRecipientFields', () => {
  it('empty fields → empty lists (the action falls back to primary)', () => {
    const r = parseRecipientFields({ to: '', cc: null, bcc: undefined })
    expect(r).toEqual({ ok: true, recipients: { to: [], cc: [], bcc: [], all: [] } })
  })
  it('parses and lowercases all three fields', () => {
    const r = parseRecipientFields({
      to: JSON.stringify(['Buyer@Example.com']),
      cc: JSON.stringify(['spouse@example.com']),
      bcc: JSON.stringify(['broker@ryan-realty.com']),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.recipients.to).toEqual(['buyer@example.com'])
      expect(r.recipients.cc).toEqual(['spouse@example.com'])
      expect(r.recipients.bcc).toEqual(['broker@ryan-realty.com'])
      expect(r.recipients.all).toHaveLength(3)
    }
  })
  it('dedupes across fields — To wins over Cc over Bcc', () => {
    const r = parseRecipientFields({
      to: JSON.stringify(['a@x.com']),
      cc: JSON.stringify(['A@X.com', 'b@x.com']),
      bcc: JSON.stringify(['b@x.com']),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.recipients.to).toEqual(['a@x.com'])
      expect(r.recipients.cc).toEqual(['b@x.com'])
      expect(r.recipients.bcc).toEqual([])
    }
  })
  it('rejects malformed JSON and invalid addresses with the field named', () => {
    expect(parseRecipientFields({ to: '{nope' }).ok).toBe(false)
    const bad = parseRecipientFields({ cc: JSON.stringify(['not-an-email']) })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('Cc')
  })
  it('enforces per-field and total caps', () => {
    const many = (n: number, d: string) => Array.from({ length: n }, (_, i) => `p${i}@${d}.com`)
    expect(parseRecipientFields({ to: JSON.stringify(many(11, 'a')) }).ok).toBe(false)
    const total = parseRecipientFields({
      to: JSON.stringify(many(10, 'a')),
      cc: JSON.stringify(many(10, 'b')),
      bcc: JSON.stringify(many(1, 'c')),
    })
    expect(total.ok).toBe(false)
  })
})
