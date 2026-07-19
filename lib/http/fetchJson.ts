/**
 * lib/http/fetchJson — the shared hardened outbound-HTTP primitive.
 *
 * Audit #3b: every Meta / Spark / Twilio call was a bare `fetch()` with no
 * timeout and no retry, on serverless functions with a hard execution budget. A
 * hung vendor call burned the whole budget; a transient 429/5xx was an unretried
 * hard failure.
 *
 * `resilientFetch` adds:
 *   - an AbortController TIMEOUT (default 15s) so a stuck call fails fast, and
 *   - RETRY-on-429/5xx with exponential backoff — but ONLY for idempotent
 *     methods (GET/HEAD/OPTIONS). A POST/PUT/PATCH/DELETE is NEVER auto-retried:
 *     retrying a send double-charges / double-sends (Twilio Messages, IG publish).
 *     A caller that KNOWS its POST is idempotent can pass `retries` explicitly.
 *
 * It returns the raw Response (even on !ok) so callers keep their own vendor
 * error-shaping (e.g. meta-graph's throwIfError extracts fb-specific fields).
 * `fetchJson<T>` is the convenience wrapper for callers with no custom handling.
 */

export interface ResilientFetchOptions extends Omit<RequestInit, 'signal'> {
  /** Abort the request after this many ms (default 15000). */
  timeoutMs?: number
  /** Max retries. Default: 2 for idempotent methods, 0 for non-idempotent. */
  retries?: number
  /** HTTP statuses that trigger a retry (default 429 + 5xx). */
  retryOn?: number[]
  /** Base backoff in ms; grows exponentially per attempt (default 500). */
  backoffMs?: number
}

const DEFAULT_RETRY_ON = [429, 500, 502, 503, 504]
const MAX_BACKOFF_MS = 30_000

function isIdempotent(method: string): boolean {
  const m = method.toUpperCase()
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Honor a 429 Retry-After header (seconds) if present, else exponential backoff. */
function backoffFor(attempt: number, baseMs: number, res: Response | null): number {
  const retryAfter = res?.headers.get('retry-after')
  if (retryAfter) {
    const secs = Number(retryAfter)
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, MAX_BACKOFF_MS)
  }
  return Math.min(baseMs * 2 ** attempt, MAX_BACKOFF_MS)
}

export async function resilientFetch(
  url: string,
  opts: ResilientFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 15_000, retryOn = DEFAULT_RETRY_ON, backoffMs = 500, retries, ...init } = opts
  const method = (init.method ?? 'GET').toUpperCase()
  const maxRetries = retries ?? (isIdempotent(method) ? 2 : 0)

  let attempt = 0
  for (;;) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (attempt < maxRetries && retryOn.includes(res.status)) {
        await sleep(backoffFor(attempt, backoffMs, res))
        attempt++
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      // Network error or timeout (AbortError). Retry only if idempotent + budget left.
      if (attempt < maxRetries) {
        await sleep(backoffFor(attempt, backoffMs, null))
        attempt++
        continue
      }
      throw err
    }
  }
}

/** Resilient fetch + JSON parse. Throws a generic error on !ok. Use resilientFetch
 * directly when the caller has vendor-specific error handling. */
export async function fetchJson<T>(url: string, opts: ResilientFetchOptions = {}): Promise<T> {
  const res = await resilientFetch(url, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as T
}
