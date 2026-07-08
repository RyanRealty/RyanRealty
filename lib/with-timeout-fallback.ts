/**
 * Race a promise against a timeout. Unlike Promise.race, rejections resolve to `fallback`
 * so streaming home sections do not crash the Suspense boundary when a query fails.
 */
export function withTimeoutFallback<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
  logLabel?: string
): Promise<T> {
  return new Promise((resolve) => {
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
        if (logLabel) console.error(`[withTimeoutFallback:${logLabel}]`, err)
        resolve(fallback)
      })
  })
}
