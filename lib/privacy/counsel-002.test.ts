import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRIVACY_CLICK_ID_ENDING,
  PRIVACY_MILESTONE,
  PRIVACY_OPT_OUT_BROWSER,
  PRIVACY_OPT_OUT_TAIL,
  PRIVACY_OTHER_SOURCES,
  privacyClickIdParagraph,
  privacyDoNotSellOptOut,
  privacyOptOutSentence,
} from '@/lib/privacy/counsel-002'

const page = readFileSync(join(process.cwd(), 'app/privacy/page.tsx'), 'utf8')

describe('privacy copy (counsel memo 002 §4)', () => {
  it('adds the other-sources paragraph word for word', () => {
    expect(PRIVACY_OTHER_SOURCES).toBe(
      'We also get information from other sources: public property records (such as owner names and mailing addresses), the multiple listing service, and data providers that supply contact details such as phone numbers and email addresses. We combine this with what you give us.',
    )
    expect(page).toContain('PRIVACY_OTHER_SOURCES')
  })

  it('replaces the click-id ending and drops the false sentence', () => {
    expect(PRIVACY_CLICK_ID_ENDING).toBe(
      'That tells us which of our ads, emails and posts are working. If we already know who you are, for example because you clicked a link we sent you, we connect this to your contact record. If you decline cookies, or your browser sends a Global Privacy Control signal, we record nothing at all.',
    )
    expect(privacyClickIdParagraph().startsWith('Whatever you choose, we record how each visit reached us')).toBe(true)
    expect(privacyClickIdParagraph()).toContain(PRIVACY_CLICK_ID_ENDING)
    expect(privacyClickIdParagraph().match(/That tells us/g)).toHaveLength(1)
    expect(page).not.toContain('It describes the link, not you.')
    expect(page).toContain('privacyClickIdParagraph()')
  })

  it('adds the milestone sentence after recognizing you', () => {
    expect(PRIVACY_MILESTONE).toBe(
      'When a client relationship reaches a milestone, such as a signed listing, a pending sale or a closing, we may tell Meta and Google that the milestone happened, using the same one-way hashed email or phone, and for a closing, the commission we earned. This lets them measure which ads led to real business. We never send them your raw email or phone, your sale price, or details of your transaction documents.',
    )
    const recognizing = page.indexOf("term: 'Recognizing you and targeted advertising'")
    const milestone = page.indexOf('PRIVACY_MILESTONE', recognizing)
    expect(recognizing).toBeGreaterThan(-1)
    expect(milestone).toBeGreaterThan(recognizing)
  })

  it('replaces only the cross-system opt-out and keeps the browser sentences', () => {
    const email = 'admin@ryan-realty.com'
    const sentence = privacyOptOutSentence(email)
    expect(sentence).toBe(
      'To opt out across our systems, email us at admin@ryan-realty.com with the subject line Do Not Sell or Share, or use the Stop ad matching link in any of our emails. Within 15 days we will remove you from our advertising audiences and stop sending your hashed identifiers, including for ad measurement.',
    )
    const paragraph = privacyDoNotSellOptOut(email)
    expect(paragraph.startsWith(PRIVACY_OPT_OUT_BROWSER)).toBe(true)
    expect(paragraph).toContain(sentence)
    expect(paragraph.endsWith(PRIVACY_OPT_OUT_TAIL)).toBe(true)
    expect(page).toContain('privacyDoNotSellOptOut(contactEmail)')
    expect(page).toContain("id: 'donotsell'")
    expect(page).toContain('<div id="sms">')
    expect(page).not.toContain('<div id="donotsell">')
  })

  it('keeps the Google Signals copy from PR 446', () => {
    expect(page).toContain("term: 'Google Signals (demographics and cross-device measurement)'")
    expect(page).toContain('including Google Signals.')
  })

  it('has no em dash in the new sentences', () => {
    for (const line of [PRIVACY_OTHER_SOURCES, PRIVACY_CLICK_ID_ENDING, PRIVACY_MILESTONE, privacyOptOutSentence('admin@ryan-realty.com')]) {
      expect(line).not.toContain('\u2014')
    }
  })
})
