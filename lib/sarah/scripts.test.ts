import { describe, expect, it } from 'vitest'
import * as scripts from './scripts'

const COPY_KEYS = [
  'WEB_GREETING_EN',
  'VOICE_GREETING_EN',
  'PRICE_VALUE_EN',
  'SCHOOLS_SAFETY_EN',
  'RESPA_VENDOR_EN',
  'HAS_AGENT_WRAP_EN',
  'BOOKING_PENDING_EN',
  'SHOWING_ASK_EN',
  'CMA_KICKOFF_EN',
  'YES_CONSENT_TEXT',
  'LISTING_TEASER_EN',
  'WEB_HELP_EN',
] as const

describe('Sarah public copy', () => {
  it('has no em dash or double-hyphen dash', () => {
    for (const key of COPY_KEYS) {
      const value = scripts[key]
      expect(value, key).not.toMatch(/\u2014/)
      expect(value, key).not.toMatch(/ -- /)
    }
  })

  it('keeps the RESPA line as written', () => {
    expect(scripts.RESPA_VENDOR_EN).toBe(
      "We don't recommend a specific lender, title company, or inspector on this line. A licensed broker can share a list of several local options, and you're free to choose any provider.",
    )
  })
})
