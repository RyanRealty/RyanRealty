import { describe, it, expect } from 'vitest'
import { firstEmail } from './getEmailCohortRecipients'

describe('firstEmail', () => {
  it('returns "" for non-arrays', () => {
    expect(firstEmail(null)).toBe('')
    expect(firstEmail(undefined)).toBe('')
    expect(firstEmail('a@b.com')).toBe('')
    expect(firstEmail({})).toBe('')
  })

  it('returns "" for an empty array', () => {
    expect(firstEmail([])).toBe('')
  })

  it('pulls the value off object entries', () => {
    expect(firstEmail([{ value: 'a@b.com' }])).toBe('a@b.com')
  })

  it('prefers the isPrimary-flagged entry', () => {
    expect(
      firstEmail([
        { value: 'second@b.com', isPrimary: false },
        { value: 'primary@b.com', isPrimary: 1 },
      ]),
    ).toBe('primary@b.com')
  })

  it('trims values', () => {
    expect(firstEmail([{ value: '  a@b.com  ' }])).toBe('a@b.com')
  })

  it('handles bare string entries', () => {
    expect(firstEmail(['s@b.com'])).toBe('s@b.com')
  })

  it('skips empty entries and finds the first usable one', () => {
    expect(firstEmail([{ value: '' }, { value: '   ' }, { value: 'real@b.com' }])).toBe('real@b.com')
  })
})
