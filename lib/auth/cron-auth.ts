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

/**
 * Route-handler guard for every cron/worker endpoint. Returns null when
 * authorized, or a 401 Response to return early. Fail-CLOSED via isValidCronAuth.
 */
export function requireCronAuth(req: Request): Response | null {
  const header = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  if (isValidCronAuth(header, process.env.CRON_SECRET)) return null
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}
