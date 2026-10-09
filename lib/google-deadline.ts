/**
 * Deadlines for Google API calls, shared by every Google client.
 *
 * google-auth-library gives a service-account JWT's token POST no timeout of
 * its own, and a googleapis request has none unless one is passed, so a stalled
 * Google endpoint hung a request or a cron until the platform killed it. Gmail
 * drafts and sends were fixed first (lib/gmail-draft.ts, 1d13861ff); Calendar,
 * Search Console, Postmaster and the marketing inbox followed on 2026-09-25.
 * One auth deadline, one race helper and one answered-or-not check, so the
 * clients cannot drift.
 *
 * Dependency-free on purpose: lib/data/loop/gsc-api.ts loads googleapis
 * lazily and can import this without pulling it in.
 */

/**
 * The service-account token exchange, which normally takes well under a
 * second. Used as the JWT's transporter timeout and to race an explicit
 * authorize().
 */
export const GOOGLE_AUTH_TIMEOUT_MS = 10_000

/**
 * JWT options with the auth deadline set: build every service-account JWT as
 * `new google.auth.JWT(withAuthDeadline({ ... }))`. ci:google-deadline holds
 * app/ and lib/ to it, because a JWT built without it gives its token POST no
 * timeout at all (lib/data/brokers/workspace-sync.ts and lib/crawl-probe/gsc.ts
 * were both missed by hand on 2026-09-25).
 */
export function withAuthDeadline<T extends object>(opts: T): T & { transporterOptions: { timeout: number } } {
  return { ...opts, transporterOptions: { timeout: GOOGLE_AUTH_TIMEOUT_MS } }
}

/**
 * Reject when `work` has not settled within `ms`. The timer is always cleared,
 * so a fast call leaves nothing ticking.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)
  })
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

/**
 * The HTTP status Google answered with, or null when no answer came back
 * (timeout, dropped connection). A send with no answer may still have gone out.
 */
export function answeredStatus(e: unknown): number | null {
  const status = (e as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}
