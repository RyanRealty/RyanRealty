import { describe, expect, it } from 'vitest'
import { COOKIE_MATRIX, encodeConsent } from '@/test/consent-fixtures'
import {
  CONSENT_COOKIE,
  arrivalConsent,
  consentCookieDeclines,
  gpcFromNavigator,
  identificationAllowed,
  isAdTrafficSearch,
  recordingAllowed,
  parseConsentCookie,
  trackingLevelFromConsent,
  type ConsentState,
  type TrackingConsentLevel,
} from './consent'

/**
 * The shared consent mapping. What is pinned here is that pulling three copies
 * of the rule into one changed nothing: the ORACLES below are the previous
 * implementations, kept verbatim, and every cookie shape is run through both.
 */

// components/CookieConsentBanner.tsx getConsent(), before it delegated.
function legacyBannerParse(raw: string | undefined): ConsentState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as ConsentState
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) }
  } catch {
    if (raw === 'all') return { analytics: true, marketing: true }
    return { analytics: false, marketing: false }
  }
}

// components/VisitTracker.tsx consentLevel(), before it delegated.
function legacyVisitTrackerLevel(stored: ConsentState | null): TrackingConsentLevel {
  if (stored === null) return 'essential'
  if (stored.analytics && stored.marketing) return 'all'
  if (stored.analytics) return 'analytics'
  if (stored.marketing) return 'essential'
  return 'declined'
}

// components/CookieConsentBanner.tsx autoGrantConsentForAdTraffic() ad test, before it delegated.
function legacyIsAd(search: string): boolean {
  const qs = new URLSearchParams(search || '')
  return (
    qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid') ||
    [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  )
}

// lib/identity/consent.ts consentCookieDeclines(), before it delegated.
function legacyServerDeclines(raw: string | null | undefined): boolean {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return false
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    /* keep raw */
  }
  if (decoded === 'all') return false
  try {
    const parsed = JSON.parse(decoded) as { analytics?: unknown; marketing?: unknown }
    return !parsed.analytics && !parsed.marketing
  } catch {
    return true
  }
}

const enc = encodeConsent

describe('parseConsentCookie + trackingLevelFromConsent', () => {
  it.each(COOKIE_MATRIX)('$label reads as $level', ({ raw, level }) => {
    expect(trackingLevelFromConsent(parseConsentCookie(raw))).toBe(level)
  })

  it.each(COOKIE_MATRIX)('$label: identical to the banner and VisitTracker code it replaced', ({ raw }) => {
    expect(parseConsentCookie(raw)).toEqual(legacyBannerParse(raw))
    expect(trackingLevelFromConsent(parseConsentCookie(raw))).toBe(legacyVisitTrackerLevel(legacyBannerParse(raw)))
  })

  it('no answer is essential, never declined (the 99.5% who ignore the banner stay visible)', () => {
    expect(parseConsentCookie(undefined)).toBeNull()
    expect(parseConsentCookie('')).toBeNull()
    expect(parseConsentCookie(null)).toBeNull()
    expect(trackingLevelFromConsent(null)).toBe('essential')
  })

  it('marketing alone widens nothing we store', () => {
    expect(trackingLevelFromConsent({ analytics: false, marketing: true })).toBe('essential')
  })

  it('names the cookie the banner writes', () => {
    expect(CONSENT_COOKIE).toBe('ryan_realty_cookie_consent')
  })
})

describe('isAdTrafficSearch', () => {
  const searches = [
    '',
    '?',
    '?utm_source=email',
    '?utm_campaign=cma-1-main-st',
    '?UTM_Source=email',
    '?utm_=x',
    '?fbclid=abc',
    '?fbclid=',
    '?gclid=abc',
    '?msclkid=abc',
    '?ttclid=abc',
    '?agent=matt',
    '?_pid=abc',
    '?foo=utm_source',
    '?source=utm',
    '?agent=matt&utm_medium=email',
  ]
  it.each(searches)('%s: identical to the banner rule it replaced', (search) => {
    expect(isAdTrafficSearch(search)).toBe(legacyIsAd(search))
  })

  it('a campaign or click id is ad traffic; an internal or identity param is not', () => {
    expect(isAdTrafficSearch('?utm_source=email')).toBe(true)
    expect(isAdTrafficSearch('?UTM_SOURCE=email')).toBe(true)
    expect(isAdTrafficSearch('?fbclid=')).toBe(true)
    expect(isAdTrafficSearch('?agent=matt&_pid=abc')).toBe(false)
    expect(isAdTrafficSearch('')).toBe(false)
    expect(isAdTrafficSearch(null)).toBe(false)
    expect(isAdTrafficSearch(undefined)).toBe(false)
  })
})

describe('arrivalConsent (the campaign-link grant)', () => {
  const ad = '?utm_source=cma&utm_campaign=1-main-st'

  it('grants analytics + marketing when there is no answer and the link is a campaign', () => {
    expect(arrivalConsent({ cookieValue: undefined, search: ad, gpc: false })).toEqual({ level: 'all', grant: true })
    expect(arrivalConsent({ cookieValue: '', search: '?gclid=1', gpc: false })).toEqual({ level: 'all', grant: true })
  })

  it('never overrides an answer, a decline included', () => {
    const declined = enc({ analytics: false, marketing: false })
    expect(arrivalConsent({ cookieValue: declined, search: ad, gpc: false })).toEqual({ level: 'declined', grant: false })
    expect(arrivalConsent({ cookieValue: enc({ analytics: false, marketing: true }), search: ad, gpc: false })).toEqual({
      level: 'essential',
      grant: false,
    })
    expect(arrivalConsent({ cookieValue: '%%%not-json', search: ad, gpc: false })).toEqual({ level: 'declined', grant: false })
  })

  it('an ordinary arrival with no answer is essential and grants nothing', () => {
    expect(arrivalConsent({ cookieValue: undefined, search: '', gpc: false })).toEqual({ level: 'essential', grant: false })
    expect(arrivalConsent({ cookieValue: undefined, search: '?agent=matt&_pid=t', gpc: false })).toEqual({
      level: 'essential',
      grant: false,
    })
  })

  it('gpc is a required argument: no caller can leave the opt-out out (review of 2026-09-30)', () => {
    // The banner restated this rule by hand and could drift from it; it now calls
    // arrivalConsent, and tsc refuses a call that does not say whether the browser
    // sends Global Privacy Control.
    // @ts-expect-error gpc is required
    expect(arrivalConsent({ cookieValue: undefined, search: ad }).grant).toBe(true)
  })

  it('never grants anything to a browser sending Global Privacy Control (review of 2026-09-30)', () => {
    // An opt-out of sale and sharing is not consent to marketing. The grant wrote the
    // `all` cookie for it on every campaign link, report pages included.
    expect(arrivalConsent({ cookieValue: undefined, search: ad, gpc: true })).toEqual({ level: 'essential', grant: false })
    expect(arrivalConsent({ cookieValue: '', search: '?fbclid=1', gpc: true })).toEqual({ level: 'essential', grant: false })
    // an answer already given is still read as it was (the route drops the events for GPC itself)
    expect(arrivalConsent({ cookieValue: enc({ analytics: true, marketing: true, gpc: false }), search: ad, gpc: true })).toEqual({
      level: 'all',
      grant: false,
    })
    // and with the signal off, nothing changes
    expect(arrivalConsent({ cookieValue: undefined, search: ad, gpc: false })).toEqual({ level: 'all', grant: true })
  })
})

describe('gpcFromNavigator', () => {
  it('is on only when the browser says true', () => {
    expect(gpcFromNavigator({ globalPrivacyControl: true })).toBe(true)
    expect(gpcFromNavigator({ globalPrivacyControl: false })).toBe(false)
    expect(gpcFromNavigator({ globalPrivacyControl: 'true' })).toBe(false)
    expect(gpcFromNavigator({})).toBe(false)
    expect(gpcFromNavigator(undefined)).toBe(false)
    expect(gpcFromNavigator(null)).toBe(false)
  })
})

describe('the server identify paths read the same mapping', () => {
  it.each(COOKIE_MATRIX)('$label: consentCookieDeclines agrees with the level, and with the code it replaced', ({ raw, level }) => {
    expect(consentCookieDeclines(raw)).toBe(level === 'declined')
    expect(consentCookieDeclines(raw)).toBe(legacyServerDeclines(raw))
  })

  it('a cookie Next already URL-decoded still reads the same', () => {
    expect(consentCookieDeclines(JSON.stringify({ analytics: false, marketing: false }))).toBe(true)
    expect(consentCookieDeclines(JSON.stringify({ analytics: true, marketing: false }))).toBe(false)
  })

  it('Global Privacy Control blocks identification whatever the banner says', () => {
    expect(identificationAllowed({ secGpc: '1', consentCookie: enc({ analytics: true, marketing: true }) })).toBe(false)
    expect(identificationAllowed({ consentCookie: enc({ analytics: true, marketing: true }) })).toBe(true)
    expect(identificationAllowed({ consentCookie: enc({ analytics: false, marketing: false }) })).toBe(false)
  })

  it('recordingAllowed is the same test, for the server actions that write an event (review of 2026-09-30)', () => {
    const cookies = [undefined, '', enc({ analytics: true, marketing: true }), enc({ analytics: false, marketing: false }), enc({ analytics: false, marketing: true }), '%%%']
    for (const consentCookie of cookies) {
      for (const secGpc of [null, '1', '0']) {
        expect(recordingAllowed({ consentCookie, secGpc })).toBe(identificationAllowed({ consentCookie, secGpc }))
      }
    }
    expect(recordingAllowed({ consentCookie: undefined, secGpc: null })).toBe(true)
    expect(recordingAllowed({ consentCookie: enc({ analytics: false, marketing: false }) })).toBe(false)
    expect(recordingAllowed({ secGpc: '1' })).toBe(false)
  })
})
