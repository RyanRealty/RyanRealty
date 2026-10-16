import { describe, expect, it } from 'vitest'
import * as scripts from './scripts'

const COPY_KEYS = [
  'WEB_GREETING_EN',
  'WEB_SAVED_NOTICE_EN',
  'WEB_VOICE_NOTICE_EN',
  'WEB_VOICE_TALK_EN',
  'WEB_VOICE_HINT_LISTEN_EN',
  'WEB_VOICE_HINT_END_EN',
  'WEB_VOICE_HINT_SPEAK_EN',
  'WEB_VOICE_HINT_THINK_EN',
  'VOICE_GREETING_EN',
  'PRICE_VALUE_EN',
  'CONTRACT_ADVICE_EN',
  'SCHOOLS_SAFETY_EN',
  'RESPA_VENDOR_EN',
  'HAS_AGENT_WRAP_EN',
  'BOOKING_PENDING_EN',
  'SHOWING_ASK_EN',
  'CMA_KICKOFF_EN',
  'YES_CONSENT_TEXT',
  'LISTING_TEASER_EN',
  'WEB_HELP_EN',
  'LET_ME_FIND_OUT_EN',
  'PUBLIC_RECORDS_VERIFY_EN',
  'PUBLIC_RECORDS_NOT_LEGAL_EN',
  'PUBLIC_RECORDS_NOT_FOUND_EN',
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

  it('uses Matt\'s short web intro and saved-chats notice, with no unlicensed line', () => {
    expect(scripts.WEB_GREETING_EN).toBe(
      "Hi, I'm Sarah. I work with Matt and his team at Ryan Realty. How can I help you today?",
    )
    expect(scripts.WEB_SAVED_NOTICE_EN).toBe('Chats are saved so our team can follow up.')
    expect(scripts.WEB_GREETING_EN).not.toMatch(/not a licensed broker/i)
    expect(scripts.WEB_GREETING_EN).not.toMatch(/AI assistant/i)
    expect(scripts.WEB_SAVED_NOTICE_EN).not.toMatch(/not a licensed broker/i)
    expect(scripts.webGreetingEn('Rebecca')).toBe(
      "Hi, I'm Sarah. I work with Rebecca and his team at Ryan Realty. How can I help you today?",
    )
    expect(scripts.WEB_VOICE_NOTICE_EN).toMatch(/Voice chats are recorded and transcribed/)
    expect(scripts.WEB_VOICE_TALK_EN).toMatch(/contractions/)
    expect(scripts.WEB_VOICE_TALK_EN).toMatch(/Don't read lists/)
    expect(scripts.WEB_VOICE_HINT_LISTEN_EN).toBe('Just start talking')
    expect(scripts.WEB_VOICE_HINT_END_EN).toBe('Tap to end')
    expect(scripts.bookingPendingEn('Paul')).toMatch(/Paul will confirm/)
  })

  it('keeps the Counsel phone greeting unchanged', () => {
    expect(scripts.VOICE_GREETING_EN).toBe(
      "Thanks for calling Ryan Realty in Bend. This is Sarah, the office's AI assistant. I'm not a person and I'm not a licensed broker. This call is recorded and transcribed to help our team follow up. I can share listing details, set up a showing, or connect you with one of our licensed brokers. How can I help?",
    )
  })

  it('says not a licensed broker on price, contract, and advice replies', () => {
    expect(scripts.PRICE_VALUE_EN).toMatch(/not a licensed broker/i)
    expect(scripts.CONTRACT_ADVICE_EN).toMatch(/not a licensed broker/i)
    expect(scripts.COMMISSION_EN).toMatch(/not a licensed broker/i)
    expect(scripts.GOOD_DEAL_EN).toMatch(/not a licensed broker/i)
    expect(scripts.OFFER_EN).toMatch(/not a licensed broker/i)
  })
})
