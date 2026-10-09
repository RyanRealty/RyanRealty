import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FORM_AD_COOKIE_LABEL,
  FORM_AD_MATCH_LABEL,
  FORM_AD_NOTICE_HASHED,
  FORM_AD_NOTICE_LEAD,
  FORM_AD_NOTICE_OPT_OUT_LEAD,
  FORM_AD_NOTICE_OPT_OUT_URL,
  FORM_AD_NOTICE_US,
  adMatchConsentCustom,
} from '@/lib/identity/form-ad-consent'

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function callBlock(src: string, name: string): string {
  const start = src.indexOf(`${name}(`)
  if (start < 0) throw new Error(`missing ${name}(`)
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`unclosed ${name}(`)
}

const MEMO_US_NOTICE =
  'We use what you send to reply and to send you market updates. Every email has an unsubscribe link. We may match a one-way hashed version of your email or phone with Meta and Google to measure our ads and show you our ads. Opt out anytime at ryan-realty.com/privacy#donotsell.'

describe('form ad consent copy (counsel memo 002 §5.4)', () => {
  it('prints the ad-cookie box word for word', () => {
    expect(FORM_AD_COOKIE_LABEL).toBe(
      'Show me Ryan Realty ads matched to my home search on Facebook, Instagram and Google. This turns on marketing cookies on this browser. You can turn it off anytime in Cookie settings.',
    )
  })

  it('prints the EU/UK hashed-match box word for word', () => {
    expect(FORM_AD_MATCH_LABEL).toBe(
      'Let Ryan Realty match a hashed version of my email with Meta and Google for advertising.',
    )
  })

  it('prints the US notice word for word', () => {
    expect(FORM_AD_NOTICE_US).toBe(MEMO_US_NOTICE)
    expect(FORM_AD_NOTICE_US).toBe(
      `${FORM_AD_NOTICE_LEAD} ${FORM_AD_NOTICE_HASHED} ${FORM_AD_NOTICE_OPT_OUT_LEAD} ${FORM_AD_NOTICE_OPT_OUT_URL}.`,
    )
  })

  it('has no em dash and no client name', () => {
    for (const line of [FORM_AD_COOKIE_LABEL, FORM_AD_MATCH_LABEL, FORM_AD_NOTICE_US]) {
      expect(line).not.toContain('\u2014')
      expect(line.toLowerCase()).not.toContain('not a fit')
    }
  })
})

describe('ad-match CRM fields', () => {
  it('writes nothing when the box is unchecked', () => {
    expect(adMatchConsentCustom(false, '2026-10-08T00:00:00.000Z')).toEqual({})
  })

  it('records a grant and the submit time when the box is checked', () => {
    const at = '2026-10-08T17:00:00.000Z'
    expect(adMatchConsentCustom(true, at)).toEqual({
      adMatchConsent: 'granted',
      adMatchConsentAt: at,
    })
  })
})

describe('form wiring', () => {
  const sell = read('app/sell/_v3/SellValueForm.tsx')
  const contact = read('app/contact/_v3/ContactAsk.client.tsx')
  const sellerAction = read('app/lp/seller-home-value/actions.ts')
  const contactAction = read('app/contact/actions.ts')

  it('keeps the valuation email required attribute next to its id', () => {
    expect(sell).toMatch(/id="sell-value-email"[\s\S]{0,220}required/)
  })

  it('writes the cookie on the valuation send, not on Continue', () => {
    const qualify = sell.slice(sell.indexOf('function handleQualifySubmit'), sell.indexOf('function closeSheet'))
    expect(qualify).not.toContain('writeFormAdConsent')
    expect(sell).toContain('writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render')
    expect(sell).toContain('...(restricted && adMatch ? { adMatchConsent: true } : {})')
  })

  it('keeps the SMS box separate on both forms', () => {
    expect(sell).toContain('<SmsConsentDisclosure')
    expect(contact).toContain('<SmsConsentDisclosure')
    expect(sell).toContain('<FormAdCookieBox')
    expect(contact).toContain('<FormAdCookieBox')
  })

  it('writes contact consent only from the submit handler', () => {
    expect(contact).toContain('writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render')
    expect(contact).toContain("if (restricted && adMatch) formData.set('adMatchConsent', 'yes')")
  })

  it('does not add consent fields to generate_lead', () => {
    for (const src of [sellerAction, contactAction]) {
      const block = callBlock(src, 'fireLeadGenerated')
      expect(block).toContain('lead_type')
      expect(block).toContain('form_id')
      expect(block).not.toContain('adMatch')
      expect(block).not.toContain('consent')
      expect(block).not.toContain('email')
      expect(block).not.toContain('phone')
    }
  })

  it('stores a checked EU match on the person, and still builds the lead', () => {
    expect(sellerAction).toContain('adMatchConsentCustom(submission.adMatchConsent === true')
    expect(sellerAction).toContain('createCmaRequest')
    expect(contactAction).toContain("formData.get('adMatchConsent') === 'yes'")
    expect(contactAction).toContain('adMatchConsentCustom(true, new Date().toISOString())')
  })
})
