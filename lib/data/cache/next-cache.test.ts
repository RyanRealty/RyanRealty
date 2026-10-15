// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The raw Next export, on purpose: the first test pins the upstream behaviour
// the door exists for (test files are outside ci:unstable-cache-door).
import { unstable_cache as nextUnstableCache } from 'next/cache'
import { buildReadMemo, unstable_cache } from '@/lib/data/cache/next-cache'

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

describe('what the data cache keeps of a failed read (search matrix, 2026-10-14)', () => {
  it('serves a RETURNED null for the whole window, even after the read has recovered', async () => {
    // The matrix build used to return null when its inventory read hit a
    // statement timeout. unstable_cache stored that null for the hour, so a
    // blip stood in for the last good value until the window ran out.
    const h = staticGenerationHarness()
    let healthy = false
    const build = vi.fn(async () => (healthy ? { positive: ['/homes-for-sale/bend/condos'] } : null))
    const read = unstable_cache(build, ['returned-null'], { revalidate: 3600, tags: ['listings'] })
    await h.run(async () => {
      expect(await read()).toBeNull()
      await h.flushWrites()
      healthy = true
      h.clock.now += 120_000
      expect(await read()).toBeNull()
    })
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('does not store a THROWN failure, so the next read runs again and recovers', async () => {
    const h = staticGenerationHarness()
    let healthy = false
    const build = vi.fn(async () => {
      if (!healthy) throw new Error('canceling statement due to statement timeout')
      return { positive: ['/homes-for-sale/bend/condos'] }
    })
    const read = unstable_cache(build, ['thrown-failure'], { revalidate: 3600, tags: ['listings'] })
    await h.run(async () => {
      await expect(read()).rejects.toThrow('statement timeout')
      healthy = true
      h.clock.now += 120_000
      expect(await read()).toEqual({ positive: ['/homes-for-sale/bend/condos'] })
    })
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('re-runs a WARM entry when it is read from inside another unstable_cache callback', async () => {
    // app/sitemap.ts builds inside getClassRows (lib/sitemap-class-rows.ts), an
    // unstable_cache callback, so the sitemap's matrix read never sees the warm
    // entry the page reads: every universe build is a live database read, and
    // it is also why a last-known-good value cannot be read back from the data
    // cache there. Next 16.1.6, unstable-cache.js: `!isNestedUnstableCache`.
    const h = staticGenerationHarness()
    const inner = vi.fn(async () => ({ built: true }))
    const readInner = unstable_cache(inner, ['nested-inner'], { revalidate: 3600, tags: ['listings'] })
    const readOuter = unstable_cache(async () => readInner(), ['nested-outer'], { revalidate: 3600, tags: ['x'] })
    await h.run(async () => {
      await readInner()
      await h.flushWrites()
      expect(inner).toHaveBeenCalledTimes(1)
      await readInner() // a top-level read is served from the entry
      expect(inner).toHaveBeenCalledTimes(1)
      await readOuter() // the same read, nested, runs the callback again
      await h.flushWrites()
      expect(inner).toHaveBeenCalledTimes(2)
    })
  })
})

describe('the door during next build: one read per worker (2026-10-14)', () => {
  // The production build sets NEXT_PHASE in every static-generation worker;
  // lib/site/degraded-isr.ts reads the same variable.
  beforeEach(() => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    buildReadMemo().clear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    buildReadMemo().clear()
  })

  it('runs one read when eight pages miss the same key at once', async () => {
    // Seven workers x eight concurrent pages: the first wave of community
    // pages each missed the city tile key and each read it (77 identical
    // listing_tile_mv reads for Bend in the solo build f7b23980c).
    const h = staticGenerationHarness('/communities/[slug]')
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const tiles = vi.fn(async (city: string) => {
      await held
      return [{ city, listingKey: '20260911203657678671000000' }]
    })
    const read = unstable_cache(tiles, ['door-herd'], OPTS)
    await h.run(async () => {
      const pages = Array.from({ length: 8 }, () => read('Bend'))
      release()
      const answers = await Promise.all(pages)
      expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1)
    })
    expect(tiles).toHaveBeenCalledTimes(1)
  })

  it('serves a nested read from the read the build already made', async () => {
    // Next bypasses the cache for a read made inside another cached read's
    // callback (getRegistryResortPublicFigures paging every resort city's
    // tiles); during the build the memo answers it instead.
    const h = staticGenerationHarness()
    const inner = vi.fn(async () => ({ built: true }))
    const readInner = unstable_cache(inner, ['nested-inner'], { revalidate: 3600, tags: ['listings'] })
    const readOuter = unstable_cache(async () => readInner(), ['nested-outer'], { revalidate: 3600, tags: ['x'] })
    await h.run(async () => {
      await readInner()
      await h.flushWrites()
      expect(await readOuter()).toEqual({ built: true })
      await h.flushWrites()
    })
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('reads again once the entry window has passed, as Next does', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const h = staticGenerationHarness()
      const pulse = vi.fn(async () => ({ active: 31 }))
      const read = unstable_cache(pulse, ['door-window'], OPTS)
      await h.run(async () => {
        await read()
        h.newRender()
        await h.flushWrites()
      })
      // Next's entry and the memo age together: 61 s later both are stale.
      vi.setSystemTime(Date.now() + 61_000)
      h.clock.now += 61_000
      await h.run(async () => {
        h.newRender()
        await read()
        await h.flushWrites()
      })
      expect(pulse).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets a failed read reject for every page that joined it, and reads again after', async () => {
    const h = staticGenerationHarness()
    let healthy = false
    const build = vi.fn(async () => {
      if (!healthy) throw new Error('canceling statement due to statement timeout')
      return ['/homes-for-sale/bend/condos']
    })
    const read = unstable_cache(build, ['door-failed'], OPTS)
    await h.run(async () => {
      const both = [read(), read()]
      await expect(both[0]).rejects.toThrow('statement timeout')
      await expect(both[1]).rejects.toThrow('statement timeout')
      healthy = true
      expect(await read()).toEqual(['/homes-for-sale/bend/condos'])
    })
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('prints a tally line in the build log every 250 answers, the production proof', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const h = staticGenerationHarness()
      const read = unstable_cache(async (n: number) => ({ n }), ['door-tally'], OPTS)
      await h.run(async () => {
        for (let n = 0; n < 250; n++) await read(n)
      })
      const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[build-read-memo]'))
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatch(/250 answers, 250 read the database, 0 from memory, 0 joined in flight/)
    } finally {
      log.mockRestore()
    }
  })

  it('moves no cache key: the entry Next writes is keyed by the callback source', async () => {
    const h = staticGenerationHarness()
    const cb = async (slug: string) => ({ slug })
    const read = unstable_cache(cb, ['door-key-v1'], OPTS)
    await h.run(async () => {
      await read('tetherow')
      await h.flushWrites()
    })
    expect(h.keys()).toEqual([`${cb.toString()}-door-key-v1-["tetherow"]`])
  })
})

describe('the door outside the build', () => {
  it('leaves concurrent misses to Next: each page reads, as before', async () => {
    // Runtime renders (ISR, on-demand revalidation, draft mode) never consult
    // the build memo, so a revalidation can never be answered by an older read.
    const h = staticGenerationHarness()
    const cb = vi.fn(async () => ['row'])
    const read = unstable_cache(cb, ['door-runtime'], OPTS)
    await h.run(async () => {
      await Promise.all([read(), read(), read()])
    })
    expect(cb).toHaveBeenCalledTimes(3)
  })
})
