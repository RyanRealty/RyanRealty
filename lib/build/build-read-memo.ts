/**
 * The build's read-through memo for cached reads: one database read per
 * distinct cached read per build worker, not one per page.
 *
 * WHY (2026-10-14). The solo production build f7b23980c (848 prerendered
 * pages, 91 s of static generation) sent 10,347 requests to Supabase from its
 * one build machine. 4,562 of its 9,159 GETs repeated a URL the same build had
 * already read, and 1,914 of those repeats landed in the same second as the
 * identical request (Supabase edge logs, grouped by the build IP and the full
 * request URL). Two causes, both inside Next 16.1.6's unstable_cache
 * (next/dist/server/web/spec-extension/unstable-cache.js):
 *   1. No in-flight sharing. Seven workers each render eight pages at once;
 *      every page that misses a key reads the database, so the first wave of
 *      community pages read the same city tiles eight times over
 *      (listing_tile_mv city_lower=bend, active, SFR: 77 reads in that build;
 *      sunriver 79, redmond 76, sisters 74).
 *   2. Nested reads bypass the cache (`isNestedUnstableCache`). A cached read
 *      made inside another cached read's callback always reads live, so
 *      getRegistryResortPublicFigures, cached itself, re-paged every resort
 *      city's tiles each time it ran.
 * The repeats are not free: the build's reads queue for PostgREST's pool
 * (PGRST003 "Timed out acquiring connection from connection pool" in the
 * PostgREST log during the day's builds), so every repeat is time the page's
 * real reads wait, and the waits are the `[withTimeoutFallback:...] timed out`
 * lines and the ListingsUnavailableError prerenders that failed four
 * production builds that day.
 *
 * WHAT IT DOES. During `next build` only, the door
 * (lib/data/cache/next-cache.ts) runs every cached callback through
 * `read(key, ttlMs, run)`:
 *   - a key already read and still inside its window answers from memory;
 *   - a key being read right now joins that read instead of starting another;
 *   - anything else reads, and a success is kept for the entry's own
 *     `revalidate` window, the same freshness rule Next applies to the entry
 *     (a stale FETCH entry is re-read in static generation).
 * The key is the one Next builds for the entry (callback source, key parts,
 * JSON of the arguments), so the memo can only ever answer a read with the
 * value Next itself would have cached for it.
 *
 * WHAT IT NEVER DOES. A failed read is never kept: the next caller reads
 * again. A read that resolves `undefined` is not kept. Callers other than the
 * one whose read produced the value get a JSON copy, exactly what an
 * unstable_cache hit hands back, so no caller can mutate another's value.
 * Outside the build (runtime renders, on-demand revalidation, draft mode) the
 * door does not consult it at all.
 *
 * BOUNDED. Values are kept as their JSON text, at most `maxEntryChars` each
 * and `maxChars` in all, least recently used out first.
 *
 * Kept out of lib/data/cache/ on purpose: it is a pure in-memory structure
 * (no database, no Next import), and ci:dal-boundary reads every `.delete(`
 * under lib/data/cache/ as a Supabase write on a cached-read path.
 */

export type BuildReadMemoOptions = {
  /** Total JSON characters kept across entries. */
  maxChars: number
  /** One entry larger than this is shared while in flight but not kept. */
  maxEntryChars: number
  /** Milliseconds; injectable for tests. */
  now?: () => number
}

export type BuildReadMemoStats = {
  /** Reads that ran the callback (database reads). */
  reads: number
  /** Answers served from a kept value. */
  hits: number
  /** Answers that joined a read already in flight. */
  joins: number
  entries: number
  chars: number
}

export type BuildReadMemo = {
  read<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T>
  stats(): BuildReadMemoStats
  clear(): void
}

type Settled = { json: string; expiresAt: number }
type InFlight = Promise<{ value: unknown; json: string | undefined }>

function toJson(value: unknown): string | undefined {
  if (value === undefined) return undefined
  try {
    return JSON.stringify(value)
  } catch {
    // A value Next could not cache either (BigInt, a cycle): share it while in
    // flight, keep nothing.
    return undefined
  }
}

export function createBuildReadMemo(opts: BuildReadMemoOptions): BuildReadMemo {
  const now = opts.now ?? (() => Date.now())
  const settled = new Map<string, Settled>()
  const inflight = new Map<string, InFlight>()
  let chars = 0
  let reads = 0
  let hits = 0
  let joins = 0

  function drop(key: string): void {
    const entry = settled.get(key)
    if (!entry) return
    chars -= entry.json.length
    settled.delete(key)
  }

  function keep(key: string, json: string, ttlMs: number): void {
    if (!(ttlMs > 0) || json.length > opts.maxEntryChars) return
    drop(key)
    settled.set(key, { json, expiresAt: now() + ttlMs })
    chars += json.length
    // Map iteration is insertion order: the first key is the least recently used.
    for (const oldest of settled.keys()) {
      if (chars <= opts.maxChars) break
      drop(oldest)
    }
  }

  return {
    read<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T> {
      const kept = settled.get(key)
      if (kept) {
        if (kept.expiresAt > now()) {
          // Refresh its place in the LRU order.
          settled.delete(key)
          settled.set(key, kept)
          hits += 1
          return Promise.resolve(JSON.parse(kept.json) as T)
        }
        drop(key)
      }

      const pending = inflight.get(key)
      if (pending) {
        joins += 1
        return pending.then(({ value, json }) => (json !== undefined ? (JSON.parse(json) as T) : (value as T)))
      }

      reads += 1
      // `new Promise` turns a callback that throws before returning into a
      // rejection, the way Next's async wrapper surfaces it.
      const started: InFlight = new Promise<T>((resolve) => resolve(run())).then(
        (value) => {
          // The JSON is taken here, before any caller's continuation runs, so
          // a caller mutating its value cannot change what the others get.
          const json = toJson(value)
          inflight.delete(key)
          if (json !== undefined) keep(key, json, ttlMs)
          return { value, json }
        },
        (err: unknown) => {
          inflight.delete(key)
          throw err
        },
      )
      inflight.set(key, started)
      return started.then(({ value }) => value as T)
    },
    stats(): BuildReadMemoStats {
      return { reads, hits, joins, entries: settled.size, chars }
    },
    clear(): void {
      settled.clear()
      inflight.clear()
      chars = 0
      reads = 0
      hits = 0
      joins = 0
    },
  }
}
