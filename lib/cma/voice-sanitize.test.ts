import { describe, it, expect } from 'vitest'
import { sanitizeClientProse, sanitizeLetterEmDash } from '@/lib/cma/voice-sanitize'

describe('sanitizeClientProse', () => {
  it('strips the em-dash that killed cma-16923-torrance', () => {
    const audit = 'It cannot support the recommendation—broker must rebuild the comp set.'
    const out = sanitizeClientProse(audit)
    expect(out).not.toMatch(/[—–]/)
    expect(out).toBe('It cannot support the recommendation, broker must rebuild the comp set.')
  })

  it('reads a numeric range as "to", not a comma', () => {
    expect(sanitizeClientProse('$640,000—$700,000')).toBe('$640,000 to $700,000')
    expect(sanitizeClientProse('$446–$544/sqft')).toBe('$446 to $544/sqft')
  })

  it('replaces semicolons with periods', () => {
    expect(sanitizeClientProse('One thing; another thing')).toBe('One thing. another thing')
  })

  it('leaves compliant prose alone', () => {
    const clean = 'Three comps bracket the subject. All closed within five weeks.'
    expect(sanitizeClientProse(clean)).toBe(clean)
  })
})

describe('sanitizeLetterEmDash', () => {
  it('turns a stored price — size clause into a period and a capital', () => {
    const stored =
      'Each sale stays on its own sold and last-ask price — size and story class do not adjust.'
    expect(sanitizeLetterEmDash(stored)).toBe(
      'Each sale stays on its own sold and last-ask price. Size and story class do not adjust.',
    )
    expect(sanitizeLetterEmDash(stored)).not.toMatch(/[—–]/)
  })
})
