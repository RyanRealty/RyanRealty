/**
 * Server-side reading of the visitor's tracking choice, for identity paths that
 * do not go through /api/visitors/track (server actions, tracking pings, redirects).
 *
 * The rule is the one the track route and components/VisitTracker.tsx already
 * enforce (docs/TRACKING_POLICY.md, "What we collect at each consent tier"):
 *   - no banner answer         -> essential  (identification ALLOWED)
 *   - analytics and/or marketing granted -> allowed
 *   - explicit decline (both off, or an unparseable cookie) -> NOTHING recorded
 *   - Global Privacy Control   -> NOTHING recorded
 *
 * Pure: takes the raw cookie value and the Sec-GPC header, no Next imports.
 */

export const CONSENT_COOKIE = 'ryan_realty_cookie_consent'

/** True when the stored banner answer is an explicit decline. Mirrors getStoredConsent + consentLevel. */
export function consentCookieDeclines(raw: string | null | undefined): boolean {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return false // no answer yet = essential, not declined
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
    // CookieConsentBanner treats an unparseable value as both-off.
    return true
  }
}

/** Sec-GPC: 1 is a legally binding opt-out (CA/CO/CT); honored everywhere. */
export function gpcHeaderOptsOut(header: string | null | undefined): boolean {
  return typeof header === 'string' && header.trim() === '1'
}

/** May an identity path record anything for this request? */
export function identificationAllowed(args: { consentCookie?: string | null; secGpc?: string | null }): boolean {
  return !gpcHeaderOptsOut(args.secGpc) && !consentCookieDeclines(args.consentCookie)
}
