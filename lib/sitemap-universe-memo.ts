/**
 * A single-flight memo whose freshness window starts when the value is READY.
 *
 * Extracted from `app/sitemaps/[cls]/route.ts` on 2026-08-02 so the invariant
 * below is unit-testable instead of a comment nobody can run.
 *
 * THE BUG THIS ENCODES. The sitemap route memoised its ~10.7K-URL universe with
 * a 60s TTL stamped when the build STARTED. A universe build takes 115s in
 * production and 235s on a laptop, so the entry was always 2-4x past its TTL by
 * the time it resolved and the next request rebuilt from scratch. Five
 * sequential children therefore cost five full builds — the exact cost the memo
 * was added to remove.
 *
 * It looked correct because it was verified against five CONCURRENT cold
 * requests, where single-flight genuinely collapses them to one build. But
 * Googlebot fetches child sitemaps sequentially and the hourly warmer walks them
 * in a loop, so the only access pattern in production was the one never tested.
 *
 * THE INVARIANT: the reuse window is exactly `ttlMs` measured from completion,
 * whatever the build costs. A build slower than its own TTL must still be
 * reusable. An in-flight build is never stale, so concurrent callers share it.
 * A rejected build is never cached.
 */
export type UniverseMemo<T> = () => Promise<T>

export function createUniverseMemo<T>(
  build: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): UniverseMemo<T> {
  let promise: Promise<T> | null = null
  let readyAt = 0
  let inFlight = false

  return function get(): Promise<T> {
    // An in-flight build is never stale — that is what makes concurrent callers
    // share one build instead of stampeding.
    const stale = !inFlight && now() - readyAt > ttlMs
    if (!promise || stale) {
      inFlight = true
      promise = build()
        .then((value) => {
          // Stamped on RESOLVE, not on start. This single line is the fix.
          readyAt = now()
          inFlight = false
          return value
        })
        .catch((err) => {
          // Never cache a failure — the next caller must be free to retry.
          promise = null
          inFlight = false
          throw err
        })
    }
    return promise
  }
}
