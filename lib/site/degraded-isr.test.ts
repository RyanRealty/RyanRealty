import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * next/cache is modelled on what Next 16 actually does inside a runtime ISR
 * render (work unit `prerender-legacy`), because the SITE-118 tests that came
 * before these mocked `unstable_noStore` as a harmless spy and so never saw
 * that it is a 500 there (P3 — DATA-6, SEO-2, EXP-7, 2026-09-23):
 *   - unstable_noStore THROWS, as markCurrentScopeAsDynamic does.
 *   - unstable_cache lowers the page's ISR lifetime to the smallest
 *     `revalidate` it sees, as the prerender-legacy branch of
 *     unstable-cache.js does.
 */
const next = vi.hoisted(() => {
  const state = {
    pageRevalidate: 900,
    cacheThrows: false,
    shortened: [] as string[],
  }
  const noStore = vi.fn(() => {
    // E550, digest DYNAMIC_SERVER_USAGE: what the 2026-09-16 mechanism threw on
    // a Next 16.1.6 production server (P3 mini build).
    throw new Error(
      "Dynamic server usage: Route /subdivisions/[slug] couldn't be rendered statically because it used unstable_noStore()",
    )
  })
  return { state, noStore }
})

vi.mock('next/cache', () => ({
  unstable_noStore: () => next.noStore(),
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>, _keyParts: string[], opts: { revalidate?: number }) =>
    async (...args: A): Promise<R> => {
      if (next.state.cacheThrows) throw new Error('Invariant: incrementalCache missing in unstable_cache')
      if (typeof opts.revalidate === 'number') {
        next.state.pageRevalidate = Math.min(next.state.pageRevalidate, opts.revalidate)
      }
      next.state.shortened.push(String(args[0]))
      return fn(...args)
    },
}))

vi.mock('next/navigation', () => ({
  unstable_rethrow: () => {},
}))

import { skippableRail } from '@/lib/build-phase'
import {
  DEGRADED_ISR_REVALIDATE_S,
  isProductionBuildPhase,
  publishedDegrades,
  publishedRenderActive,
  refuseDegradedIsr,
  runPublishedPageRender,
} from '@/lib/site/degraded-isr'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'

const savedPhase = process.env.NEXT_PHASE

beforeEach(() => {
  next.noStore.mockClear()
  next.state.pageRevalidate = 900
  next.state.cacheThrows = false
  next.state.shortened = []
  delete process.env.NEXT_PHASE
})

afterEach(() => {
  if (savedPhase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = savedPhase
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('runPublishedPageRender', () => {
  it('serves the elkai-woods degrade as a 200 with a short ISR copy, never a 500', async () => {
    // The deterministic production case: on /subdivisions/elkai-woods the
    // cma_subdivision_ring read took 5,335 ms against its 3,500 ms budget
    // (P3 harness, 2026-09-23), the page noted `sub:nearbyRing`, and the old
    // noStore() turned that into HTTP 500 on every fetch. Scaled here to 80 ms
    // against 15 ms.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = await runPublishedPageRender('subdivision', async () => {
      const ring = await withTimeoutFallback(sleep(80).then(() => ({ ring: ['x'] })), null, 15, 'sub:nearbyRing')
      return ring == null ? 'PAGE-WITHOUT-NEARBY' : 'FULL'
    })
    expect(html).toBe('PAGE-WITHOUT-NEARBY')
    expect(next.noStore).not.toHaveBeenCalled()
    expect(next.state.pageRevalidate).toBe(DEGRADED_ISR_REVALIDATE_S)
    expect(next.state.shortened).toEqual(['subdivision'])
    warn.mockRestore()
  })

  it('keeps a timed-out atlas short-lived and lets the next clean render keep the page window', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallback(sleep(80).then(() => 'DOTS'), 'EMPTY', 15, 'zip:atlas')
    })
    expect(first).toBe('EMPTY')
    expect(next.state.pageRevalidate).toBe(DEGRADED_ISR_REVALIDATE_S)

    next.state.pageRevalidate = 900
    const second = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallback(Promise.resolve('DOTS'), 'EMPTY', 15, 'zip:atlas')
    })
    expect(second).toBe('DOTS')
    expect(next.state.pageRevalidate).toBe(900)
    expect(next.noStore).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('leaves the ISR lifetime alone when every published read lands', async () => {
    const html = await runPublishedPageRender('cities', async () => {
      const overlays = await withTimeoutFallback(Promise.resolve(new Map([['bend', 1]])), new Map(), 20, 'cities:leftoverOverlays')
      return overlays.size
    })
    expect(html).toBe(1)
    expect(next.state.pageRevalidate).toBe(900)
    expect(next.state.shortened).toEqual([])
  })

  it('does not touch chrome or sitemap when those callers time out outside the bag', async () => {
    const value = await withTimeoutFallback(sleep(50).then(() => 'pulse'), null, 10, 'chrome-live region')
    expect(value).toBeNull()
    expect(next.state.shortened).toEqual([])
    expect(publishedRenderActive()).toBe(false)
    expect(publishedDegrades()).toEqual([])
  })

  it('notes a Result timeout as degraded and shortens the copy', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallbackResult(sleep(50).then(() => ['tile']), [] as string[], 10, 'zip:tiles')
    })
    expect(result).toEqual({ value: [], ok: false })
    expect(next.state.pageRevalidate).toBe(DEGRADED_ISR_REVALIDATE_S)
    warn.mockRestore()
  })

  it('notes a thrown published read as degraded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const value = await runPublishedPageRender('city', async () => {
      return withTimeoutFallback(Promise.reject(new Error('pooler')), null, 20, 'city:atlas')
    })
    expect(value).toBeNull()
    expect(next.state.pageRevalidate).toBe(DEGRADED_ISR_REVALIDATE_S)
    expect(next.noStore).not.toHaveBeenCalled()
    warn.mockRestore()
    err.mockRestore()
  })

  it('re-renders a degraded prerender before persist and recovers', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(isProductionBuildPhase()).toBe(true)
    let attempts = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const html = await runPublishedPageRender('cities', async () => {
      attempts += 1
      if (attempts === 1) {
        return withTimeoutFallback(sleep(80).then(() => 'FULL'), 'THIN', 10, 'cities:leftoverOverlays')
      }
      return withTimeoutFallback(Promise.resolve('FULL'), 'THIN', 10, 'cities:leftoverOverlays')
    })

    expect(html).toBe('FULL')
    expect(attempts).toBe(2)
    expect(next.state.pageRevalidate).toBe(900)
    expect(warn.mock.calls.flat().join('\n')).toMatch(/prerender degraded/)
    expect(warn.mock.calls.flat().join('\n')).toMatch(/prerender recovered on retry/)
    warn.mockRestore()
  })

  it('ships a prerender that stays thin after retry with the short lifetime', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const html = await runPublishedPageRender('about', async () => {
      return withTimeoutFallback(sleep(200).then(() => 'atlas'), null, 10, 'about atlas')
    })

    expect(html).toBeNull()
    expect(next.noStore).not.toHaveBeenCalled()
    expect(next.state.pageRevalidate).toBe(DEGRADED_ISR_REVALIDATE_S)
    expect(warn.mock.calls.flat().join('\n')).toMatch(/prerender still degraded after retry/)
    warn.mockRestore()
  })

  it('does not treat a planned build-phase skippableRail skip as a degraded persist', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const start = vi.fn(async () => ['posts'])
    const html = await runPublishedPageRender('city', async () => {
      return skippableRail(start, [] as string[], 20, 'city:blog')
    })
    expect(html).toEqual([])
    expect(start).not.toHaveBeenCalled()
    expect(next.state.shortened).toEqual([])
  })

  it('logs the shortened copy so a load run can prove what happened', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await runPublishedPageRender('cities', async () => {
      return withTimeoutFallback(sleep(40).then(() => 'ok'), 'thin', 10, 'cities:monthlyRuns')
    })
    expect(warn.mock.calls.flat().join('\n')).toMatch(
      /\[degraded-isr:cities\] degraded render, ISR copy limited to 60s \(cities:monthlyRuns\)/,
    )
    warn.mockRestore()
  })
})

describe('refuseDegradedIsr', () => {
  it('is a no-op when nothing degraded', async () => {
    await refuseDegradedIsr('cities', [])
    expect(next.state.shortened).toEqual([])
    expect(next.state.pageRevalidate).toBe(900)
  })

  it('never throws, even with no incremental cache to shorten', async () => {
    next.state.cacheThrows = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(refuseDegradedIsr('place-type-atlas', ['place-type:boundary'])).resolves.toBeUndefined()
    expect(next.noStore).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('holds the one-minute window the header documents', () => {
    expect(DEGRADED_ISR_REVALIDATE_S).toBe(60)
  })
})
