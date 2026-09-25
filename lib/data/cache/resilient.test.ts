// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { describe, expect, it, vi } from 'vitest'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/*
 * makeResilientCached on Next 16.1.6's REAL unstable_cache inside a
 * static-generation work store (test/next-fetch-cache-harness.ts). The
 * upstream phantom itself is pinned in ./next-cache.test.ts.
 */

const OPTS = { revalidate: 60, tags: ['listings'] }

describe('makeResilientCached', () => {
  it('returns the value, not undefined, when the build retry re-reads a stale entry', async () => {
    // getPlaceOpeningListings on /cities/redmond, 2026-09-25: this came back
    // undefined on the degraded-ISR retry and buildPlaceAlertTypes threw.
    const h = staticGenerationHarness()
    const buckets = [{ key: 'houses', listings: [] }]
    const fetchFn = vi.fn(async () => buckets)
    const read = makeResilientCached(fetchFn, ['resilient-phantom'], OPTS, [])
    await h.run(async () => {
      expect(await read()).toEqual(buckets)
      await h.flushWrites()
      h.clock.now += 61_000
      expect(await read()).toEqual(buckets)
    })
    // Once through the cache on the miss, once uncached for the phantom.
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('serves a fresh cached entry without calling the fetch fn again', async () => {
    const h = staticGenerationHarness()
    const fetchFn = vi.fn(async () => [1, 2, 3])
    const read = makeResilientCached(fetchFn, ['resilient-fresh'], OPTS, [])
    await h.run(async () => {
      expect(await read()).toEqual([1, 2, 3])
      await h.flushWrites()
      h.clock.now += 5_000
      expect(await read()).toEqual([1, 2, 3])
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('falls back only when the uncached retry also fails', async () => {
    const h = staticGenerationHarness()
    const fetchFn = vi.fn(async (): Promise<number[]> => {
      throw new Error('pooler 25P02')
    })
    const read = makeResilientCached(fetchFn, ['resilient-fallback'], OPTS, [])
    await h.run(async () => {
      expect(await read()).toEqual([])
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
