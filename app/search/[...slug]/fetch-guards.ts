export async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    // A rejection (e.g. a 57014 statement-timeout on a cold heavy read) must
    // degrade to the fallback, NOT propagate and blank the whole page. The race
    // alone only handles HANGS — a promise that rejects before timeoutMs would
    // reject the race. Catch it so every guarded fetch fails soft.
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/**
 * Settled timeout for inventory reads. Distinguishes a true empty result
 * from timeout/error so callers can render retry honesty instead of
 * inventing "0 homes" (§0: unknown is not zero).
 *
 *   - promise resolves → `{ data, degraded: false }` (empty is a real zero)
 *   - promise rejects OR times out → `{ data: fallback, degraded: true }`
 */
export async function withTimeoutSettled<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = 4000,
): Promise<{ data: T; degraded: boolean }> {
  let settled = false
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ data: fallback, degraded: true })
    }, timeoutMs)
    promise.then(
      (data) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve({ data, degraded: false })
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve({ data: fallback, degraded: true })
      },
    )
  })
}

/**
 * Timeout for the primary listings fetch. The common case resolves from the
 * slim MV in well under a second; this ceiling exists only to cover the heavy
 * search_listings_advanced RPC fallback (jsonb feature filters / deep pages),
 * whose cold scan can take ~8s. It is long enough that a real result is never
 * truncated to an empty fallback (the original bug, where a 2.5s timeout cut
 * off the ~8s cold RPC) and short enough to fail loud if the data layer is
 * genuinely stuck. The RPC warms to ~1-2s, so 12s comfortably covers a cold run.
 */
export const LISTINGS_FETCH_TIMEOUT_MS = 12000
