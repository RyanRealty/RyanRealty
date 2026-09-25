/**
 * Run code inside a Next 16 static-generation work store, so the REAL
 * `unstable_cache` from `next/cache` executes its own branches instead of a
 * vitest pass-through mock.
 *
 * The incremental cache is an in-memory FETCH store with a clock the test
 * moves. Its staleness rule is the one Next 16.1.6 applies to FETCH entries
 * (node_modules/next/dist/server/lib/incremental-cache/index.js, `get`):
 * `age = now - lastModified`, stale when `age > revalidate`, where the
 * memory cache stamps `lastModified` at write time.
 *
 * Why this exists: during `next build`, runPublishedPageRender
 * (lib/site/degraded-isr.ts) retries a degraded page inside the SAME work
 * store. A key the first render missed holds `cacheNewResult(...)` in
 * `workStore.pendingRevalidates`; when the retry finds that entry stale it
 * returns that pending write, which resolves `undefined`, in place of the
 * value (next/dist/server/web/spec-extension/unstable-cache.js). That is how
 * /cities/redmond failed its prerender on 2026-09-25
 * (dpl_57NPHyuPyFiSkL23TpQzyNQ1rV4L).
 *
 * IMPORT THIS BEFORE `next/cache` (or anything that loads it). Next builds its
 * storage singletons when the module loads, and only uses a real
 * AsyncLocalStorage if its server baseline already put one on globalThis;
 * otherwise every `run` throws "AsyncLocalStorage accessed in runtime where it
 * is not available". The baseline import below is the one a Next server loads
 * first.
 */
import 'next/dist/server/node-environment-baseline'
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'

type FetchEntry = { value: { kind: 'FETCH'; data: unknown; revalidate: number }; lastModified: number }

export type StaticGenerationHarness = {
  /** Milliseconds; move it forward to age cache entries. */
  clock: { now: number }
  /** Run `fn` inside the static-generation work store. */
  run<T>(fn: () => Promise<T>): Promise<T>
  /** Settle every cache write the work store has queued. */
  flushWrites(): Promise<void>
}

export function staticGenerationHarness(route = '/cities/[slug]'): StaticGenerationHarness {
  const clock = { now: 1_790_000_000_000 }
  const entries = new Map<string, FetchEntry>()
  const incrementalCache = {
    isOnDemandRevalidate: false,
    async generateCacheKey(key: string): Promise<string> {
      return key
    },
    async get(key: string, ctx: { revalidate?: number | false }) {
      const entry = entries.get(key)
      if (!entry) return null
      const revalidate = typeof ctx.revalidate === 'number' ? ctx.revalidate : entry.value.revalidate
      const ageSeconds = (clock.now - entry.lastModified) / 1000
      return {
        isStale: ageSeconds > revalidate,
        value: { kind: 'FETCH' as const, data: entry.value.data, revalidate },
      }
    },
    async set(key: string, value: FetchEntry['value']): Promise<void> {
      entries.set(key, { value, lastModified: clock.now })
    },
  }
  const workStore = {
    route,
    incrementalCache,
    isStaticGeneration: true,
    isOnDemandRevalidate: false,
    isDraftMode: false,
    fetchCache: undefined,
    nextFetchId: 1,
    pendingRevalidates: undefined as Record<string, Promise<unknown>> | undefined,
  }
  return {
    clock,
    run: (fn) => workAsyncStorage.run(workStore as never, fn),
    async flushWrites() {
      await Promise.all(Object.values(workStore.pendingRevalidates ?? {}))
    },
  }
}
