/**
 * Shared secret-verification helper for cron routes, webhook endpoints,
 * and worker APIs. Returns { ok: true } when authorised.
 *
 * In production: the env var MUST be set, and the request header MUST match.
 * In non-production: logs a warning if the var is missing but still blocks if
 * the header was provided and doesn't match (catches config errors early).
 */
export function requireSecret(
  request: Request,
  envVar: string,
  headerName = 'authorization',
): { ok: true } | { ok: false; status: number; message: string } {
  const secret = (process.env[envVar] || '').trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  if (!secret) {
    if (isProd) {
      console.error(`[requireSecret] ${envVar} is not set in production — blocking request`)
      return { ok: false, status: 500, message: `${envVar} not configured` }
    }
    console.warn(`[requireSecret] ${envVar} not set — allowing in dev`)
    return { ok: true }
  }

  const header = request.headers.get(headerName) || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header

  if (token !== secret) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  return { ok: true }
}
