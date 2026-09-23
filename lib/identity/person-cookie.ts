/**
 * The `rr_pid` first-party identity cookie: which contact this browser belongs to.
 *
 * Set by the identity loop when a browser proves who it is (a signed tracked
 * link, a sign-in, a form submit resolved server-side) and read by the track
 * route, /api/identity/me, the landing-page forms and the CMA document gate.
 *
 * Signed since 2026-09-23 (P7). The value used to be the raw crm_people.id, so
 * anyone could set `rr_pid=<id>` in their own browser and pass the CMA
 * recipient gate for that contact's private valuation. The value is now a
 * `cookie`-channel token (lib/identity/link-token.ts).
 *
 * Legacy raw values already in browsers (90-day max age, set before this
 * change) are still READ for low-stakes uses — prefilling who a no-email form
 * submit belongs to, the GA4 user id — and reported as `signed: false`. Access
 * decisions (the CMA gate, the consent-bar POST) and the identity loop itself
 * accept only `signed: true`.
 */
import 'server-only'
import {
  isLegacyRawPersonId,
  signPersonLinkToken,
  verifyPersonLinkToken,
} from '@/lib/identity/link-token'

export const PERSON_COOKIE = 'rr_pid'
/** 90 days, the lifetime this cookie has always had (identity-bridge, auth callback). */
export const PERSON_COOKIE_MAX_AGE = 90 * 24 * 60 * 60

export function personCookieValue(personId: number): string {
  return signPersonLinkToken(personId, 'cookie')
}

export function personCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: PERSON_COOKIE_MAX_AGE,
    path: '/',
  }
}

export type PersonCookieRead = { personId: number; signed: boolean }

/** Parse a cookie value. Signed tokens (any channel) verify; a bare id reads as unsigned. */
export function readPersonCookie(value: string | null | undefined): PersonCookieRead | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const verified = verifyPersonLinkToken(raw)
  if (verified) return { personId: verified.personId, signed: true }
  if (isLegacyRawPersonId(raw)) return { personId: Number(raw), signed: false }
  return null
}

/** The id only when the cookie is signed by this server; null otherwise. */
export function signedPersonIdFromCookie(value: string | null | undefined): number | null {
  const read = readPersonCookie(value)
  return read?.signed ? read.personId : null
}
