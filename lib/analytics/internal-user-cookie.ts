import { INTERNAL_USER_COOKIE, INTERNAL_USER_COOKIE_MAX_AGE_S, isProductionHost } from './ga-suppression'

/**
 * The `rr_internal=1` cookie: this browser belongs to a broker or admin, so GA4
 * never counts it (lib/analytics/ga-suppression.ts) and its first-party sessions
 * are flagged `internal` (Matt 2026-10-05: internal users identified BY LOGIN).
 *
 * Set server-side on a verified admin sign-in (app/auth/callback, the One Tap
 * form through markInternalBrowser) and refreshed on every authenticated admin
 * page load. It holds no identity, only the flag: who signed in never leaves
 * the session cookie. Readable by the page (not httpOnly) because the GTM
 * bootstrap decides in the browser, before any Google tag loads. Scoped to the
 * registrable domain on production so the seller subdomain honors it too.
 */
export function internalUserCookie(host: string | null | undefined) {
  const onProduction = isProductionHost(host)
  return {
    name: INTERNAL_USER_COOKIE,
    value: '1',
    options: {
      maxAge: INTERNAL_USER_COOKIE_MAX_AGE_S,
      path: '/',
      sameSite: 'lax' as const,
      httpOnly: false,
      secure: onProduction,
      ...(onProduction ? { domain: 'ryan-realty.com' } : {}),
    },
  }
}
