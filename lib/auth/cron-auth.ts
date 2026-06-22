/**
 * Pure CRON_SECRET bearer check (audit p3.2 critical-path: auth).
 *
 * Extracted from isAuthorizedAdminOrCron (lib/auth/guards.ts) so the
 * security-critical comparison is unit-testable WITHOUT pulling in `server-only`
 * + the session/DB imports. A wrong comparison here is an auth-bypass hole, so it
 * gets its own test. Accepts either a raw secret or a `Bearer <secret>` header.
 * Returns false whenever the secret is unset (an unset secret must never auth).
 */
export function isValidCronAuth(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false
  const h = header ?? ''
  return h === `Bearer ${secret}` || h === secret
}
