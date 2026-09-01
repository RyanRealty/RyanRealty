import { unstable_rethrow } from 'next/navigation'

/**
 * The outcome of a guarded read. `ok: false` means `value` is the FALLBACK — the
 * read timed out or threw, so the real value is UNKNOWN, not empty.
 *
 * §0 (CLAUDE.md): unknown is not zero. A caller must never publish a count,
 * total, median, or "0 homes for sale" derived from a degraded read. A neighborhood
 * page shipped exactly that: a 4.5s boundary timeout returned the `{ pins: [] }`
 * fallback, the hero printed "0 homes for sale" beside a real $810,000 median, and
 * the false figure read as sourced because the true one sat next to it. When `ok`
 * is false, suppress the figure — a missing number beats a wrong one.
 *
 * Gated by `scripts/check-count-from-degraded-read.mjs` (ci:count-degraded-read):
 * a rendered inventory count may not have a non-nullable `number` type when it
 * derives from a guarded read, so "unknown" is always representable.
 */
export type TimeoutFallbackResult<T> = { value: T; ok: boolean }

/**
 * Race a promise against a timeout, reporting whether the value is real.
 * Prefer this over `withTimeoutFallback` wherever the value feeds a published
 * number, so the caller can tell "empty" from "we never found out".
 */
export function withTimeoutFallbackResult<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
  logLabel?: string
): Promise<TimeoutFallbackResult<T>> {
  return withTimeoutFallback(
    promise.then((value) => ({ value, ok: true })),
    { value: fallback, ok: false },
    timeoutMs,
    logLabel,
  )
}

/**
 * Race a promise against a timeout. Unlike Promise.race, rejections resolve to `fallback`
 * so streaming home sections do not crash the Suspense boundary when a query fails.
 *
 * The fallback is INDISTINGUISHABLE from a real empty result here. If the value
 * feeds a published figure, use `withTimeoutFallbackResult` instead.
 */
export function withTimeoutFallback<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
  logLabel?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    // A timeout is a silent no-op elsewhere in this file's history — a slow
    // (not failing) query degraded a whole page section to nothing with no
    // trace anywhere, e.g. the listing-detail "Similar homes" rail going
    // empty on every render with zero errors logged (design-audit P2). Warn
    // so a real fallback and a genuinely-empty result stay distinguishable.
    const t = setTimeout(() => {
      if (logLabel) console.warn(`[withTimeoutFallback:${logLabel}] timed out after ${timeoutMs}ms`)
      resolve(fallback)
    }, timeoutMs)
    promise
      .then((value) => {
        clearTimeout(t)
        resolve(value)
      })
      .catch((err: unknown) => {
        clearTimeout(t)
        // Next.js control-flow errors (redirect, notFound, dynamic-usage
        // bailout) are the framework talking to itself. Swallowing one into
        // `fallback` breaks the render protocol — a redirect never fires, or a
        // static pass dies later as an unexplained DYNAMIC_SERVER_USAGE 500.
        // Rethrow those; only real data failures degrade to the fallback.
        try {
          unstable_rethrow(err)
        } catch (frameworkErr) {
          reject(frameworkErr)
          return
        }
        if (logLabel) console.error(`[withTimeoutFallback:${logLabel}]`, err)
        resolve(fallback)
      })
  })
}
