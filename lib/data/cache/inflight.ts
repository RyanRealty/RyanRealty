/**
 * Process-level in-flight dedupe and a small concurrency gate.
 *
 * `unstable_cache` does not coalesce concurrent misses (lib/atlas/build-place-atlas.ts
 * documented the same stampede: sixty plat pages, sixty identical reads). A
 * static build or a burst of community/listing renders that miss together
 * would otherwise pin CPU on the same PostgREST select. One promise per key
 * per process; a caller cap keeps a walk of every geo from opening them all.
 */

const inflight = new Map<string, Promise<unknown>>()
const forgetInflight = Map.prototype.delete.bind(inflight) as (key: string) => boolean

export function dedupeInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const pending = run().finally(() => {
    forgetInflight(key)
  })
  inflight.set(key, pending)
  return pending
}

export function withConcurrency(limit: number): <T>(run: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiters: Array<() => void> = []
  return async function runLimited<T>(run: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    }
    active += 1
    try {
      return await run()
    } finally {
      active -= 1
      const next = waiters.shift()
      if (next) next()
    }
  }
}
