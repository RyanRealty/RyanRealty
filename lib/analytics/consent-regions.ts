/**
 * Consent Mode v2 restricted regions and the first-party region signal.
 *
 * ONE list, used by the GTM bootstrap (Google resolves geo itself; the list is
 * what we send in the region-scoped default), the server tracking tier, and
 * the Meta Pixel. Matt 2026-10-08: analytics_storage denied in these regions
 * until the visitor accepts; granted elsewhere unless they declined or send
 * Global Privacy Control.
 *
 * ISO 3166-1 alpha-2. EEA = EU 27 + IS, LI, NO; plus UK (GB) and Switzerland.
 */

export const RESTRICTED_CONSENT_REGIONS = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
] as const

export type RestrictedConsentRegion = (typeof RESTRICTED_CONSENT_REGIONS)[number]

const RESTRICTED_SET: ReadonlySet<string> = new Set(RESTRICTED_CONSENT_REGIONS)

/** Vercel / edge placeholders that are not a real country. */
const NON_COUNTRY_CODES = new Set(['XX', 'T1', 'A1', 'A2', 'O1'])

/** First-party, non-identifying: 1 = restricted / unknown, 0 = not restricted. */
export const CONSENT_REGION_COOKIE = 'rr_cr'
export const CONSENT_REGION_RESTRICTED_VALUE = '1'
export const CONSENT_REGION_UNRESTRICTED_VALUE = '0'

export function normalizeCountryCode(country: string | null | undefined): string {
  return typeof country === 'string' ? country.trim().toUpperCase() : ''
}

/** True when the code is one of the shared restricted-region list. Unknown is not this. */
export function isKnownRestrictedConsentCountry(country: string | null | undefined): boolean {
  const code = normalizeCountryCode(country)
  return code.length === 2 && RESTRICTED_SET.has(code)
}

/**
 * True when we know the visitor is outside the restricted list. Missing,
 * placeholder, or malformed codes are NOT unrestricted (fail closed).
 */
export function isKnownUnrestrictedConsentCountry(country: string | null | undefined): boolean {
  const code = normalizeCountryCode(country)
  if (code.length !== 2 || NON_COUNTRY_CODES.has(code)) return false
  return !RESTRICTED_SET.has(code)
}

/**
 * Pixel and the client region cookie: unknown / missing is restricted.
 * Google's own consent defaults do not use this; Google resolves geo itself.
 */
export function isRestrictedConsentCountry(country: string | null | undefined): boolean {
  return !isKnownUnrestrictedConsentCountry(country)
}

export function consentRegionCookieValue(country: string | null | undefined): '0' | '1' {
  return isKnownUnrestrictedConsentCountry(country)
    ? CONSENT_REGION_UNRESTRICTED_VALUE
    : CONSENT_REGION_RESTRICTED_VALUE
}

export function readFirstPartyCookie(cookieSource: string | null | undefined, name: string): string | undefined {
  if (!cookieSource) return undefined
  const prefix = `${name}=`
  for (const part of cookieSource.split(';')) {
    const s = part.trim()
    if (s.startsWith(prefix)) return s.slice(prefix.length)
  }
  return undefined
}

/**
 * Client signal from `rr_cr`. Missing, `1`, or garbage → restricted (denied).
 * Only an explicit `0` is unrestricted.
 */
export function consentRegionRestrictedFromCookieHeader(cookieSource: string | null | undefined): boolean {
  return readFirstPartyCookie(cookieSource, CONSENT_REGION_COOKIE) !== CONSENT_REGION_UNRESTRICTED_VALUE
}
