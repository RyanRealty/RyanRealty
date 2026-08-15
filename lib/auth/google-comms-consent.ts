/**
 * Continue-with-Google comms door (PRODUCT.md Order 7).
 *
 * The OAuth redirect leaves the page, so choices cannot live in React state or
 * localStorage. A short-lived first-party cookie carries {emailOpt, smsOpt, phone}
 * to /auth/callback. Presence of a valid cookie means the ask already happened
 * (including both boxes left unchecked). Consent is never required to create
 * the account.
 */

export const GOOGLE_COMMS_COOKIE = 'rr_google_comms'
export const GOOGLE_COMMS_MAX_AGE_SEC = 10 * 60

export type GoogleCommsConsent = {
  emailOpt: boolean
  smsOpt: boolean
  phone: string
}

export function emptyGoogleCommsConsent(): GoogleCommsConsent {
  return { emailOpt: false, smsOpt: false, phone: '' }
}

export function normalizeGoogleCommsPhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 15)
}

/** Last-10 US digits when the number is complete; otherwise null. */
export function usableGoogleCommsPhone(raw: string): string | null {
  const digits = normalizeGoogleCommsPhone(raw)
  const last10 = digits.slice(-10)
  return last10.length === 10 ? last10 : null
}

export function serializeGoogleCommsConsent(input: GoogleCommsConsent): string {
  const payload = {
    e: input.emailOpt === true ? 1 : 0,
    s: input.smsOpt === true ? 1 : 0,
    p: normalizeGoogleCommsPhone(input.phone),
  }
  return encodeURIComponent(JSON.stringify(payload))
}

export function parseGoogleCommsConsent(raw: string | null | undefined): GoogleCommsConsent | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (!('e' in parsed) && !('emailOpt' in parsed)) return null
    return {
      emailOpt: parsed.e === 1 || parsed.e === true || parsed.emailOpt === true,
      smsOpt: parsed.s === 1 || parsed.s === true || parsed.smsOpt === true,
      phone: normalizeGoogleCommsPhone(String(parsed.p ?? parsed.phone ?? '')),
    }
  } catch {
    return null
  }
}

/** Cookie present and parseable: the comms ask was shown and persisted. */
export function hasGoogleCommsConsentRecorded(raw: string | null | undefined): boolean {
  return parseGoogleCommsConsent(raw) !== null
}

export function googleCommsCookieSetOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  maxAge: number
  path: string
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GOOGLE_COMMS_MAX_AGE_SEC,
    path: '/',
  }
}

export function googleCommsEnrichmentCustom(consent: GoogleCommsConsent): {
  cmaConsent: true
  googleCommsEmail: 0 | 1
  googleCommsSms: 0 | 1
} {
  const smsOk = consent.smsOpt === true && usableGoogleCommsPhone(consent.phone) !== null
  return {
    cmaConsent: true,
    googleCommsEmail: consent.emailOpt === true ? 1 : 0,
    googleCommsSms: smsOk ? 1 : 0,
  }
}
