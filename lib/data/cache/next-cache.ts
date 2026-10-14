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
 *
 * ONE READ PER BUILD WORKER (2026-10-14). During `next build` the callback
 * Next runs on a miss goes through the build read memo
 * (./build-read-memo.ts): a read already made in this worker and still inside
 * its `revalidate` window is answered from memory, and a read already in
 * flight is joined instead of repeated. Next's unstable_cache shares neither
 * (no in-flight sharing, and a cached read nested in another cached read's
 * callback always reads live), which is how one solo production build sent
 * 4,562 repeat GETs to Supabase. The memo is keyed by the same invocation key
 * Next builds for the entry, keeps nothing that failed, and is never consulted
 * outside the build. The function handed to Next answers `toString()` with
 * the callback's own source, so Next's entry keys do not move.
 */
import { unstable_cache as nextUnstableCache } from 'next/cache'
import { createBuildReadMemo, type BuildReadMemo } from '@/lib/data/cache/build-read-memo'

/**
 * Sized against the worker heap, not the data: at most 48M characters of JSON
 * kept per build worker (7 workers on the production build machine), one entry
 * at most 4M. Next's own build memory cache is 50 MB and refuses entries over
 * 2 MB; an entry this memo cannot keep is still shared while it is in flight.
 */
const BUILD_MEMO_MAX_CHARS = 48_000_000
const BUILD_MEMO_MAX_ENTRY_CHARS = 4_000_000

/** The build log carries one tally line per worker every this many answers. */
const BUILD_MEMO_TALLY_EVERY = 250

/**
 * One memo per process, shared by every copy of this module a bundle may hold
 * (each route's server chunk can carry its own module instance).
 */
const MEMO_SLOT = Symbol.for('ryan-realty.build-read-memo.v1')

export function buildReadMemo(): BuildReadMemo {
  const slot = globalThis as typeof globalThis & { [MEMO_SLOT]?: BuildReadMemo }
  slot[MEMO_SLOT] ??= createBuildReadMemo({
    maxChars: BUILD_MEMO_MAX_CHARS,
    maxEntryChars: BUILD_MEMO_MAX_ENTRY_CHARS,
  })
  return slot[MEMO_SLOT]
}

/**
 * `[build-read-memo] pid 123: 250 answers, 103 read the database, 126 from
 * memory, 21 joined in flight, 98 kept (1.3M chars)`. Answers count only the
 * reads Next's own cache missed. The production proof of the memo is these
 * lines in the build log.
 */
function logTally(memo: BuildReadMemo): void {
  const s = memo.stats()
  const answers = s.reads + s.hits + s.joins
  if (answers === 0 || answers % BUILD_MEMO_TALLY_EVERY !== 0) return
  console.log(
    `[build-read-memo] pid ${process.pid}: ${answers} answers, ${s.reads} read the database, ${s.hits} from memory, ` +
      `${s.joins} joined in flight, ${s.entries} kept (${(s.chars / 1_000_000).toFixed(1)}M chars)`,
  )
}

function inProductionBuild(): boolean {
  // The same test lib/site/degraded-isr.ts makes; inlined because that module
  // imports this one.
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export const unstable_cache: typeof nextUnstableCache = (cb, keyParts, options) => {
  // Next's own key for the entry: next/dist/server/web/spec-extension/unstable-cache.js
  // builds `${cb.toString()}-${keyParts.join(',')}` and appends JSON.stringify(args).
  const fixedKey = `${cb.toString()}-${Array.isArray(keyParts) && keyParts.join(',')}`
  const ttlMs = typeof options?.revalidate === 'number' ? options.revalidate * 1000 : Number.POSITIVE_INFINITY

  const read = ((...args: Parameters<typeof cb>) => {
    if (!inProductionBuild()) return cb(...args)
    const memo = buildReadMemo()
    const answer = memo.read(`${fixedKey}-${JSON.stringify(args)}`, ttlMs, () => cb(...args))
    logTally(memo)
    return answer
  }) as typeof cb
  // Next keys the entry by the function's source and names its log line by
  // the function's name: both stay the callback's own.
  Object.defineProperty(read, 'toString', { value: () => cb.toString() })
  Object.defineProperty(read, 'name', { value: cb.name })

  const cached = nextUnstableCache(read, keyParts, options)
  return (async (...args: Parameters<typeof cb>) => {
    const value = await cached(...args)
    return value !== undefined ? value : read(...args)
  }) as typeof cb
}
