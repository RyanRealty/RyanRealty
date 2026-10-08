import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { consentModeDefaultJs } from './consent-defaults'
import { META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE, metaPixelBootstrapScript } from './meta-pixel-consent'
import {
  CONSENT_REGION_COOKIE,
  RESTRICTED_CONSENT_REGIONS,
  consentRegionCookieValue,
  consentRegionRestrictedFromCookieHeader,
  isKnownRestrictedConsentCountry,
  isKnownUnrestrictedConsentCountry,
  isRestrictedConsentCountry,
} from './consent-regions'
import { effectiveTrackingConsent, trackingLevelFromConsent } from '@/lib/identity/consent'

describe('RESTRICTED_CONSENT_REGIONS', () => {
  it('is the EEA (EU 27 + IS LI NO), UK, and Switzerland', () => {
    const expected = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
      'IS', 'LI', 'NO',
      'GB', 'CH',
    ]
    expect([...RESTRICTED_CONSENT_REGIONS]).toEqual(expected)
    expect(RESTRICTED_CONSENT_REGIONS).toHaveLength(32)
  })

  it('middleware sets the rr_cr cookie from the edge country header on HTML responses', () => {
    const mw = readFileSync('middleware.ts', 'utf8')
    expect(mw).toContain('CONSENT_REGION_COOKIE')
    expect(mw).toContain('attachConsentRegionCookie')
    expect(mw).toContain("request.headers.get('x-vercel-ip-country')")
    expect(mw).toContain('attachTrackingCookies')
  })

  it('is the one list the bootstrap, server tier, and pixel import', () => {
    expect(consentModeDefaultJs()).toContain(JSON.stringify([...RESTRICTED_CONSENT_REGIONS]))
    expect(metaPixelBootstrapScript('123')).toContain(CONSENT_REGION_COOKIE)
    expect(trackingLevelFromConsent(null, { country: 'DE' })).toBe('essential')
    expect(trackingLevelFromConsent(null, { country: 'US' })).toBe('analytics')
    expect(META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE).toBe(true)
  })
})

describe('country classification', () => {
  it('treats US as unrestricted and DE/GB/CH as restricted', () => {
    expect(isKnownUnrestrictedConsentCountry('US')).toBe(true)
    expect(isKnownUnrestrictedConsentCountry('us')).toBe(true)
    expect(isKnownRestrictedConsentCountry('DE')).toBe(true)
    expect(isKnownRestrictedConsentCountry('GB')).toBe(true)
    expect(isKnownRestrictedConsentCountry('CH')).toBe(true)
    expect(isRestrictedConsentCountry('DE')).toBe(true)
    expect(isRestrictedConsentCountry('US')).toBe(false)
  })

  it('treats unknown, missing, and placeholder codes as restricted for the pixel and cookie', () => {
    expect(isRestrictedConsentCountry(undefined)).toBe(true)
    expect(isRestrictedConsentCountry('')).toBe(true)
    expect(isRestrictedConsentCountry('XX')).toBe(true)
    expect(isKnownUnrestrictedConsentCountry(undefined)).toBe(false)
    expect(consentRegionCookieValue('US')).toBe('0')
    expect(consentRegionCookieValue('DE')).toBe('1')
    expect(consentRegionCookieValue(undefined)).toBe('1')
    expect(consentRegionCookieValue('XX')).toBe('1')
  })

  it('reads rr_cr: only 0 is unrestricted; missing is restricted', () => {
    expect(consentRegionRestrictedFromCookieHeader('rr_cr=0')).toBe(false)
    expect(consentRegionRestrictedFromCookieHeader('rr_cr=1')).toBe(true)
    expect(consentRegionRestrictedFromCookieHeader('')).toBe(true)
    expect(consentRegionRestrictedFromCookieHeader(undefined)).toBe(true)
    expect(consentRegionRestrictedFromCookieHeader('foo=bar')).toBe(true)
  })
})

describe('effectiveTrackingConsent (server clamp)', () => {
  it('US visitor with no answer is analytics granted', () => {
    expect(effectiveTrackingConsent({ posted: 'essential', country: 'US' })).toBe('analytics')
    expect(effectiveTrackingConsent({ posted: 'analytics', country: 'US' })).toBe('analytics')
  })

  it('DE and GB visitors with no answer are essential', () => {
    expect(effectiveTrackingConsent({ posted: 'analytics', country: 'DE' })).toBe('essential')
    expect(effectiveTrackingConsent({ posted: 'all', country: 'GB' })).toBe('essential')
    expect(effectiveTrackingConsent({ posted: 'essential', country: 'DE' })).toBe('essential')
  })

  it('unknown country does not rewrite a posted analytics tier (tests / missing header)', () => {
    expect(effectiveTrackingConsent({ posted: 'analytics' })).toBe('analytics')
    expect(effectiveTrackingConsent({ posted: 'essential' })).toBe('essential')
    expect(effectiveTrackingConsent({ posted: 'all' })).toBe('all')
  })

  it('a stored decline wins even in the US', () => {
    const declined = encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))
    expect(effectiveTrackingConsent({ posted: 'analytics', cookieValue: declined, country: 'US' })).toBe('declined')
  })
})
