import { describe, expect, it } from 'vitest'
import { isInternalRecipientEmail } from '@/lib/email/internal-recipient'

describe('isInternalRecipientEmail', () => {
  it.each([
    'matt@ryan-realty.com',
    'MATT@Ryan-Realty.com',
    '  paul@ryan-realty.com  ',
    'marketing+dana@ryan-realty.com',
    'marketing+blake@ryan-realty.com',
    'anyone@placeholder.ryan-realty.com',
  ])('treats %s as ours', (email) => {
    expect(isInternalRecipientEmail(email)).toBe(true)
  })

  it.each([
    'ashley.kuczek@gmail.com',
    'owner@example.com',
    'owner@ryan-realty.com.evil.example',
    'owner@notryan-realty.com',
    'owner@ryan-realty.co',
    'ryan-realty.com',
    '',
    '   ',
  ])('does not treat %j as ours', (email) => {
    expect(isInternalRecipientEmail(email)).toBe(false)
  })

  it('is false for a missing address', () => {
    expect(isInternalRecipientEmail(null)).toBe(false)
    expect(isInternalRecipientEmail(undefined)).toBe(false)
  })
})
