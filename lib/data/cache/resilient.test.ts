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

  it('says so when it serves the fallback, naming the read and both errors, never its arguments', async () => {
    // 2026-10-14: the sitemap read the indexable plat set as unreadable on
    // production and the silent fallback looked like an empty set.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const h = staticGenerationHarness()
      let call = 0
      const fetchFn = vi.fn(async (_email: string): Promise<string[]> => {
        call += 1
        throw new Error(call === 1 ? 'canceling statement due to statement timeout' : 'fetch failed')
      })
      const read = makeResilientCached(fetchFn, ['indexable-subdivisions-v3'], OPTS, [])
      await h.run(async () => {
        expect(await read('person@example.com')).toEqual([])
      })
      const lines = warn.mock.calls.map((c) => String(c[0]))
      expect(lines).toEqual([
        '[resilient-cache:indexable-subdivisions-v3] read failed twice; serving the fallback. ' +
          'first: canceling statement due to statement timeout; retry: fetch failed',
      ])
      expect(lines.join(' ')).not.toContain('person@example.com')
    } finally {
      warn.mockRestore()
    }
  })

  it('stays quiet when the uncached retry recovers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const h = staticGenerationHarness()
      let call = 0
      const read = makeResilientCached(
        async () => {
          call += 1
          if (call === 1) throw new Error('pooler 25P02')
          return ['ok']
        },
        ['resilient-recovers'],
        OPTS,
        [] as string[],
      )
      await h.run(async () => {
        expect(await read()).toEqual(['ok'])
      })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
