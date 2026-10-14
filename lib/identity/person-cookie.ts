/**
 * The `rr_pid` first-party identity cookie: which contact this browser belongs to.
 *
 * Set by the identity loop when a browser proves who it is (a signed tracked
 * link, a sign-in) or arrives already known (the track route, on a new session
 * whose rr_vid the identity map holds), and read by the track route,
 * /api/identity/me, the landing-page forms and the CMA document gate.
 *
 * Signed since 2026-09-23 (P7). The value used to be the raw crm_people.id, so
 * anyone could set `rr_pid=<id>` in their own browser and pass the CMA
 * recipient gate for that contact's private valuation. The value is now a
 * signed token (lib/identity/link-token.ts).
 *
 * PROVENANCE (consent integrity, 2026-10-14). The signed value also says HOW
 * the browser came to be known, and the code that mints it decides:
 *   - `verified`: a channel the person controls proved it. A signed link we
 *     sent to their own email or phone (the track route, the identify action),
 *     or a sign-in whose email the auth provider confirmed.
 *   - `claimed`: a visitor typed an email into a form, and the browser's next
 *     session was born identified from that (rr_vid_carryover). Anyone can type
 *     anyone's email, so this is attribution, not proof.
 *   - `legacy`: a value minted before provenance existed. Unknown, so unverified.
 * Consent capture (the CMA consent bar and its POST, and any surface that
 * records an email or SMS opt-in against a contact the visitor did not type in
 * that same submit) reads verifiedPersonIdFromCookie. A claimed or legacy
 * cookie gets no consent ask; the person verifies by the normal path (the
 * tracked link in the email we sent them mints a verified cookie on arrival).
 *
 * Legacy raw values already in browsers (90-day max age, set before 2026-09-23)
 * are still READ for low-stakes uses (prefilling who a no-email form submit
 * belongs to, the GA4 user id) and reported as `signed: false`. The identity
 * loop accepts only `signed: true`; consent accepts only `verified`.
 */
import 'server-only'
import {
  isLegacyRawPersonId,
  signPersonCookieToken,
  verifyPersonCookieToken,
  type IdentityProvenance,
} from '@/lib/identity/link-token'

export type { IdentityProvenance } from '@/lib/identity/link-token'

export const PERSON_COOKIE = 'rr_pid'
/** 90 days, the lifetime this cookie has always had (identity-bridge, auth callback). */
export const PERSON_COOKIE_MAX_AGE = 90 * 24 * 60 * 60

/** The signed cookie value. `provenance` is required: every minting site states it. */
export function personCookieValue(personId: number, provenance: IdentityProvenance): string {
  return signPersonCookieToken(personId, provenance)
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

/** How a cookie value came to name its person. Only `verified` is proof. */
export type PersonCookieProvenance = IdentityProvenance | 'legacy' | 'unsigned'

export type PersonCookieRead = { personId: number; signed: boolean; provenance: PersonCookieProvenance }

/**
 * Parse a cookie value. A signed cookie token verifies and carries its
 * provenance (`cookie`-channel values from before 2026-10-14 read as `legacy`);
 * a bare id reads as unsigned. A link token is not a cookie value and reads as null.
 */
export function readPersonCookie(value: string | null | undefined): PersonCookieRead | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const verified = verifyPersonCookieToken(raw)
  if (verified) {
    const provenance: PersonCookieProvenance = verified.channel === 'cookie' ? 'legacy' : verified.channel
    return { personId: verified.personId, signed: true, provenance }
  }
  if (isLegacyRawPersonId(raw)) return { personId: Number(raw), signed: false, provenance: 'unsigned' }
  return null
}

/**
 * The id only when the cookie is signed by this server; null otherwise. Any
 * provenance: this is the identity loop's read (analytics, the timeline, Known
 * people, recording a GPC opt-out). Never use it to decide consent.
 */
export function signedPersonIdFromCookie(value: string | null | undefined): number | null {
  const read = readPersonCookie(value)
  return read?.signed ? read.personId : null
}

/**
 * The id only when the cookie is signed AND its identity was proven by a
 * channel the person controls. The one read consent capture uses.
 */
export function verifiedPersonIdFromCookie(value: string | null | undefined): number | null {
  const read = readPersonCookie(value)
  return read?.signed && read.provenance === 'verified' ? read.personId : null
}

/**
 * Should this identification (re)write the cookie, and with what provenance?
 * null = leave the cookie as it is. A different person, or no signed cookie,
 * writes. The same person writes only to upgrade to `verified`: a claimed
 * identification never downgrades a verified cookie, so a person who clicked
 * our link and later fills a form on the same browser stays verified.
 */
export function personCookieWrite(
  current: PersonCookieRead | null,
  personId: number,
  provenance: IdentityProvenance,
): IdentityProvenance | null {
  if (!current || !current.signed || current.personId !== personId) return provenance
  if (provenance === 'verified' && current.provenance !== 'verified') return 'verified'
  return null
}

/**
 * The provenance a sign-in gives the cookie: `verified` when the auth provider
 * confirmed the email (Google, Facebook, an email link, a confirmed password
 * account), else `claimed`. Email sign-ups must confirm before they can sign in
 * (Supabase mailer_autoconfirm is off, read 2026-10-14), so `claimed` here is
 * the fail-closed answer for a configuration that changes later.
 */
export function signInProvenance(
  user: { email_confirmed_at?: string | null } | null | undefined,
): IdentityProvenance {
  return user?.email_confirmed_at ? 'verified' : 'claimed'
}
