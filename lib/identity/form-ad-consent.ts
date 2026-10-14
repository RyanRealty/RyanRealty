import { CONSENT_COOKIE, type ConsentState } from '@/lib/identity/consent'

/**
 * Form ad consent (Counsel memo 002, section 5.4, 2026-10-08).
 *
 * The ad-cookie box is separate from the SMS box. It is unchecked, never
 * required, and the valuation or message still sends when it is left empty.
 * Checked at submit writes the same consent cookie the banner's Accept all
 * writes: analytics true and marketing true. Unchecked writes nothing.
 *
 * EU/UK (restricted region, including unknown) replaces the notice's
 * hashed-matching sentence with a second unchecked box. That box is consent
 * for hashed ad matching, not a cookie grant, and it does not write this cookie.
 */

/** Memo 5.4, under the email or valuation fields. */
export const FORM_AD_COOKIE_LABEL =
  'Show me Ryan Realty ads matched to my home search on Facebook, Instagram and Google. This turns on marketing cookies on this browser. You can turn it off anytime in Cookie settings.'

/** Memo 5.4, the EU/UK box that replaces the hashed-matching sentence. */
export const FORM_AD_MATCH_LABEL =
  'Let Ryan Realty match a hashed version of my email with Meta and Google for advertising.'

/** Memo 5.4 notice, the sentences that stay in both regions. */
export const FORM_AD_NOTICE_LEAD =
  'We use what you send to reply and to send you market updates. Every email has an unsubscribe link.'

/** Memo 5.4 notice, the US hashed-matching sentence. EU/UK does not print this. */
export const FORM_AD_NOTICE_HASHED =
  'We may match a one-way hashed version of your email or phone with Meta and Google to measure our ads and show you our ads.'

/** Memo 5.4 notice, the opt-out words. The URL is the link text. */
export const FORM_AD_NOTICE_OPT_OUT_LEAD = 'Opt out anytime at'
export const FORM_AD_NOTICE_OPT_OUT_URL = 'ryan-realty.com/privacy#donotsell'
export const FORM_AD_NOTICE_OPT_OUT_HREF = '/privacy#donotsell'

/** The US notice, word for word from memo 5.4. */
export const FORM_AD_NOTICE_US = `${FORM_AD_NOTICE_LEAD} ${FORM_AD_NOTICE_HASHED} ${FORM_AD_NOTICE_OPT_OUT_LEAD} ${FORM_AD_NOTICE_OPT_OUT_URL}.`

/** What a checked ad-cookie box stores. Same shape as the banner's Accept all. */
export const FORM_AD_CONSENT_GRANT: ConsentState = { analytics: true, marketing: true }

const CONSENT_EXPIRY_YEARS = 1

export function formAdConsentCookieValue(state: ConsentState = FORM_AD_CONSENT_GRANT): string {
  return encodeURIComponent(JSON.stringify(state))
}

/**
 * Banner Accept all, called from a form submit. False writes nothing: it does
 * not store a decline. A decline would turn analytics off for a visitor who
 * simply left the box empty.
 */
export function writeFormAdConsent(checked: boolean): void {
  if (!checked || typeof document === 'undefined') return
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + CONSENT_EXPIRY_YEARS)
  document.cookie = `${CONSENT_COOKIE}=${formAdConsentCookieValue()}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
  }
}

/**
 * CRM custom fields for the EU/UK hashed-match box. Empty when the box was
 * not checked, so an unchecked submit records nothing. `at` is the submit time
 * the caller already has. This does not grant marketing cookies.
 */
export function adMatchConsentCustom(granted: boolean, at: string): Record<string, string> {
  if (!granted) return {}
  return { adMatchConsent: 'granted', adMatchConsentAt: at }
}
