/**
 * Resilient cached reads — the antidote to "poison-null caching."
 *
 * The bug (hit repeatedly across this DAL, 2026-05): a resolver returned an
 * empty/null on BOTH a genuine miss AND a transient Supabase error, then wrapped
 * the call in unstable_cache. A single timeout / pooler `25P02` blip cached that
 * empty result and pinned the page to a broken state ("City Not Found", "0 homes
 * in this area", "Not available", em-dash KPIs) for the whole revalidate window.
 *
 * The fix pattern (proven on getGeoSnapshot + getListingDetail): the fetch fn
 * THROWS on a DB error and only returns data (or a GENUINE empty) on success.
 * unstable_cache never caches a rejected promise, so no poison is stored; we then
 * retry once uncached before falling back, so a blip recovers in-render instead
 * of caching brokenness. The public fn never throws.
 *
 * Usage:
 *   async function fetchX(input): Promise<X[]> {
 *     ...
 *     if (error) throw new Error(...)   // do NOT `return []` on error
 *     return rows
 *   }
 *   export const getX = makeResilientCached(fetchX, ['x-v2'], {revalidate, tags}, [])
 */
import { unstable_cache } from 'next/cache'

export function makeResilientCached<A extends unknown[], T>(
  fetchFn: (...args: A) => Promise<T>,
  keyParts: string[],
  opts: { revalidate: number | false; tags: string[] },
  fallback: T,
): (...args: A) => Promise<T> {
  const cached = unstable_cache(fetchFn, keyParts, opts)
  return async (...args: A): Promise<T> => {
    try {
      return await cached(...args)
    } catch {
      // Transient error bubbled up (NOT cached). One uncached retry before
      // falling back, so a blip doesn't strand the page on the fallback.
      try {
        return await fetchFn(...args)
      } catch {
        return fallback
      }
    }
  }
}

/**
 * Run a Supabase read with up to `attempts` retries, THROWING on persistent
 * error (so the caller — typically inside makeResilientCached's fetchFn — never
 * caches an error result). Returns the query result on the first success.
 * The query thunk must return Supabase's `{ data, error }` shape.
 */
export async function readOrThrow<T>(
  label: string,
  // Supabase query builders are PromiseLike (thenable), not Promise.
  query: () => PromiseLike<{ data: T; error: unknown }>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await query()
    if (!error) return data
    lastError = error
  }
  throw new Error(
    `${label} failed after ${attempts} attempts: ` +
      (lastError instanceof Error ? lastError.message : JSON.stringify(lastError)),
  )
}
