import { describe, it, expect } from 'vitest'
import { smsDisplayBody } from '@/lib/crm/sms-display-body'

describe('smsDisplayBody', () => {
  it('strips a leading participant + month-day header', () => {
    expect(
      smsDisplayBody('Matt Ryan Tanya Hogan Patrick Hogan Jun 3 Sounds like a plan'),
    ).toBe('Sounds like a plan')
  })

  it('strips when a year follows the day', () => {
    expect(
      smsDisplayBody('Matt Ryan Tanya Hogan Jun 3, 2024 Sounds like a plan'),
    ).toBe('Sounds like a plan')
  })

  it('leaves a normal 1:1 SMS alone', () => {
    expect(smsDisplayBody('Hey — are you free tomorrow around 3?')).toBe(
      'Hey — are you free tomorrow around 3?',
    )
  })

  it('leaves a sentence that merely mentions a date alone', () => {
    expect(smsDisplayBody('See you Jun 3 at the open house')).toBe(
      'See you Jun 3 at the open house',
    )
  })

  it('is null/empty safe', () => {
    expect(smsDisplayBody(null)).toBe('')
    expect(smsDisplayBody(undefined)).toBe('')
    expect(smsDisplayBody('')).toBe('')
    expect(smsDisplayBody('   ')).toBe('')
  })

  it('does not strip a single CapWord before a date (too ambiguous)', () => {
    expect(smsDisplayBody('Thanks Jun 3 was great')).toBe('Thanks Jun 3 was great')
  })
})
