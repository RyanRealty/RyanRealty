/**
 * THE ONE DOOR TO `unstable_cache`. Every cached read in the app imports it
 * from here, never from `next/cache` (ci:unstable-cache-door,
 * scripts/check-unstable-cache-door.mjs). Same name, same signature, same
 * cache keys: `cb.toString()` and `keyParts` reach Next unchanged, so no entry
 * is evicted by routing through this file.
 *
 * WHY: Next 16.1.6's unstable_cache can RESOLVE `undefined` in place of the
 * value. During static generation, a key this render missed leaves its
 * write, `cacheNewResult(...)` (a Promise<void>), in
 * `workStore.pendingRevalidates`. Read that key again in the same work store
 * once its window has passed and the entry is stale, the pending slot is
 * already taken, so Next returns that pending WRITE, which resolves
 * `undefined` (next/dist/server/web/spec-extension/unstable-cache.js, the
 * `cacheEntry.isStale` branch). runPublishedPageRender's build retry
 * (lib/site/degraded-isr.ts) re-renders a degraded page in the same work
 * store after reads that waited 18 to 36 s, so a 60 s listing window the first
 * render wrote comes back stale on the retry. On 2026-09-25 that undefined
 * reached buildPlaceAlertTypes as `buckets`, `input.buckets.find` threw, and
 * /cities/redmond took the production deploy down with it
 * (dpl_57NPHyuPyFiSkL23TpQzyNQ1rV4L). The same build logged
 * city:resortTiles "e is not iterable" from the same undefined.
 *
 * THE FIX: an undefined from the cache is not a value; read it again
 * uncached. No callback in this repo resolves undefined (a type-checker sweep
 * of all 223 unstable_cache / makeResilientCached callbacks on 2026-09-25
 * found none whose return type admits undefined, any or unknown), so this
 * branch runs only for the phantom. A callback that ever did resolve
 * undefined would get that same undefined back, at the cost of one query.
 * Errors propagate exactly as before; makeResilientCached still owns the
 * retry-then-fallback. Reproduced on the real unstable_cache in
 * lib/data/cache/resilient.test.ts.
 */
import { unstable_cache as nextUnstableCache } from 'next/cache'

export const unstable_cache: typeof nextUnstableCache = (cb, keyParts, options) => {
  const cached = nextUnstableCache(cb, keyParts, options)
  return (async (...args: Parameters<typeof cb>) => {
    const value = await cached(...args)
    return value !== undefined ? value : cb(...args)
  }) as typeof cb
}
