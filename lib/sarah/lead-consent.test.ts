import { describe, expect, it } from 'vitest'
import {
  SARAH_CONSENT_ASK_TEMPLATE,
  SARAH_CONSENT_WORDING_VERSION,
  SARAH_POST_VOICE_YES_ASK,
  decideSarahConsent,
  isConsentNo,
  isConsentYes,
  sarahConsentAsk,
} from './lead-consent'

describe('Sarah Counsel consent', () => {
  it('uses the locked Counsel ask with the number filled in', () => {
    expect(SARAH_CONSENT_WORDING_VERSION).toBe('sarah-consent-v1-2026-10-15')
    expect(sarahConsentAsk('5415550100')).toBe(
      "Is it okay if Ryan Realty texts and calls you at (541) 555-0100, including with our AI assistant, about your request and real estate? Consent isn't required to buy anything. Msg and data rates may apply. Reply STOP to opt out, HELP for help.",
    )
    expect(SARAH_CONSENT_ASK_TEMPLATE).toContain('[number]')
    expect(SARAH_CONSENT_ASK_TEMPLATE).toContain('including with our AI assistant')
    expect(SARAH_CONSENT_ASK_TEMPLATE).not.toMatch(/\u2014/)
  })

  it('treats a typed yes as marketing consent', () => {
    expect(isConsentYes('Yes')).toBe(true)
    expect(decideSarahConsent('yes', 'typed')).toEqual({
      granted: true,
      marketing: true,
      needsPostVoiceYes: false,
    })
  })

  it('treats a spoken yes as request-only and queues a post-voice YES text', () => {
    expect(decideSarahConsent('Yeah', 'spoken')).toEqual({
      granted: true,
      marketing: false,
      needsPostVoiceYes: true,
    })
    expect(SARAH_POST_VOICE_YES_ASK).toMatch(/Reply YES/)
    expect(SARAH_POST_VOICE_YES_ASK).not.toMatch(/\u2014/)
  })

  it('treats an inbound YES reply as marketing consent', () => {
    expect(decideSarahConsent('YES', 'sms')).toEqual({
      granted: true,
      marketing: true,
      needsPostVoiceYes: false,
    })
  })

  it('records a clear no without marketing', () => {
    expect(isConsentNo('No thanks')).toBe(true)
    expect(decideSarahConsent('no', 'typed')).toEqual({
      granted: false,
      marketing: false,
      needsPostVoiceYes: false,
    })
  })
})
