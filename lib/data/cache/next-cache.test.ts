// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { describe, expect, it, vi } from 'vitest'
// The raw Next export, on purpose: the first test pins the upstream behaviour
// the door exists for (test files are outside ci:unstable-cache-door).
import { unstable_cache as nextUnstableCache } from 'next/cache'
import { unstable_cache } from '@/lib/data/cache/next-cache'

/*
 * These run Next 16.1.6's REAL unstable_cache inside a static-generation work
 * store (test/next-fetch-cache-harness.ts), not a pass-through mock, because
 * the failure lives inside Next's own branches.
 */

const OPTS = { revalidate: 60, tags: ['listings'] }

describe('Next 16.1.6 unstable_cache during static generation', () => {
  it('hands back undefined, not the value, when an entry this render wrote has gone stale', async () => {
    // Characterization. If a Next upgrade makes this fail, the phantom is gone
    // upstream and the door's re-read simply never runs.
    const h = staticGenerationHarness()
    const read = nextUnstableCache(async () => ['houses'], ['phantom-characterization'], OPTS)
    await h.run(async () => {
      expect(await read()).toEqual(['houses'])
      await h.flushWrites()
      // The degraded-ISR retry re-renders the page after the first render's
      // slow reads, so the 60 s entry the first render wrote is now stale.
      h.clock.now += 61_000
      expect(await read()).toBeUndefined()
    })
  })
})

describe('the unstable_cache door', () => {
  it('reads uncached when Next hands back the phantom, so the caller gets the value', async () => {
    const h = staticGenerationHarness()
    const rows = [{ slug: 'eagle-crest', activeCount: 31 }]
    const cb = vi.fn(async (city: string) => (city === 'Redmond' ? rows : []))
    const read = unstable_cache(cb, ['door-phantom'], OPTS)
    await h.run(async () => {
      expect(await read('Redmond')).toEqual(rows)
      await h.flushWrites()
      h.clock.now += 61_000
      expect(await read('Redmond')).toEqual(rows)
    })
    // Once through the cache on the miss, once uncached for the phantom.
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith('Redmond')
  })

  it('serves a fresh entry from the cache without calling the callback again', async () => {
    const h = staticGenerationHarness()
    const cb = vi.fn(async () => ({ total: 7 }))
    const read = unstable_cache(cb, ['door-fresh'], OPTS)
    await h.run(async () => {
      expect(await read()).toEqual({ total: 7 })
      await h.flushWrites()
      h.clock.now += 5_000
      expect(await read()).toEqual({ total: 7 })
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('passes null and empty values through as values', async () => {
    const h = staticGenerationHarness()
    const nothing = vi.fn(async () => null)
    const empty = vi.fn(async () => [])
    const readNothing = unstable_cache(nothing, ['door-null'], OPTS)
    const readEmpty = unstable_cache(empty, ['door-empty'], OPTS)
    await h.run(async () => {
      expect(await readNothing()).toBeNull()
      expect(await readEmpty()).toEqual([])
      await h.flushWrites()
      h.clock.now += 5_000
      expect(await readNothing()).toBeNull()
      expect(await readEmpty()).toEqual([])
    })
    expect(nothing).toHaveBeenCalledTimes(1)
    expect(empty).toHaveBeenCalledTimes(1)
  })

  it('lets a failed read reject, as unstable_cache does', async () => {
    const h = staticGenerationHarness()
    const read = unstable_cache(
      async () => {
        throw new Error('pooler 25P02')
      },
      ['door-error'],
      OPTS,
    )
    await h.run(async () => {
      await expect(read()).rejects.toThrow('pooler 25P02')
    })
  })
})
