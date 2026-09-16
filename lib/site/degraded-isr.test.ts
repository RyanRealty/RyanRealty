import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const noStore = vi.fn()

vi.mock('next/cache', () => ({
  unstable_noStore: () => noStore(),
}))

vi.mock('next/navigation', () => ({
  unstable_rethrow: () => {},
}))

import { skippableRail } from '@/lib/build-phase'
import {
  isProductionBuildPhase,
  publishedDegrades,
  publishedRenderActive,
  refuseDegradedIsr,
  runPublishedPageRender,
} from '@/lib/site/degraded-isr'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'

const savedPhase = process.env.NEXT_PHASE

beforeEach(() => {
  noStore.mockClear()
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
  it('does not persist a timed-out atlas as the ISR copy for the next request', async () => {
    let cached: string | null = null
    const persist = (html: string) => {
      if (noStore.mock.calls.length === 0) cached = html
    }

    const first = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallback(sleep(80).then(() => 'DOTS'), 'EMPTY', 15, 'zip:atlas')
    })
    expect(first).toBe('EMPTY')
    expect(noStore).toHaveBeenCalledTimes(1)
    persist(first)
    expect(cached).toBeNull()

    noStore.mockClear()
    const second = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallback(Promise.resolve('DOTS'), 'EMPTY', 15, 'zip:atlas')
    })
    expect(second).toBe('DOTS')
    expect(noStore).not.toHaveBeenCalled()
    persist(second)
    expect(cached).toBe('DOTS')
  })

  it('does not call noStore when every published read lands', async () => {
    const html = await runPublishedPageRender('cities', async () => {
      const overlays = await withTimeoutFallback(Promise.resolve(new Map([['bend', 1]])), new Map(), 20, 'cities:leftoverOverlays')
      return overlays.size
    })
    expect(html).toBe(1)
    expect(noStore).not.toHaveBeenCalled()
  })

  it('does not dynamize chrome or sitemap when those callers time out outside the bag', async () => {
    const value = await withTimeoutFallback(sleep(50).then(() => 'pulse'), null, 10, 'chrome-live region')
    expect(value).toBeNull()
    expect(noStore).not.toHaveBeenCalled()
    expect(publishedRenderActive()).toBe(false)
    expect(publishedDegrades()).toEqual([])
  })

  it('notes a Result timeout as degraded and refuses ISR persist', async () => {
    const result = await runPublishedPageRender('zip', async () => {
      return withTimeoutFallbackResult(sleep(50).then(() => ['tile']), [] as string[], 10, 'zip:tiles')
    })
    expect(result).toEqual({ value: [], ok: false })
    expect(noStore).toHaveBeenCalledTimes(1)
  })

  it('notes a thrown published read as degraded', async () => {
    const value = await runPublishedPageRender('city', async () => {
      return withTimeoutFallback(Promise.reject(new Error('pooler')), null, 20, 'city:atlas')
    })
    expect(value).toBeNull()
    expect(noStore).toHaveBeenCalledTimes(1)
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
    expect(noStore).not.toHaveBeenCalled()
    expect(warn.mock.calls.flat().join('\n')).toMatch(/prerender degraded/)
    expect(warn.mock.calls.flat().join('\n')).toMatch(/prerender recovered on retry/)
    warn.mockRestore()
  })

  it('does not call noStore during SSG when the prerender stays thin after retry', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const html = await runPublishedPageRender('about', async () => {
      return withTimeoutFallback(sleep(200).then(() => 'atlas'), null, 10, 'about atlas')
    })

    expect(html).toBeNull()
    expect(noStore).not.toHaveBeenCalled()
    expect(warn.mock.calls.flat().join('\n')).toMatch(/not persisting thin copy as ISR at runtime/)
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
    expect(noStore).not.toHaveBeenCalled()
  })

  it('logs the refused persist so a load run can prove the copy was not written', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await runPublishedPageRender('cities', async () => {
      return withTimeoutFallback(sleep(40).then(() => 'ok'), 'thin', 10, 'cities:monthlyRuns')
    })
    expect(warn.mock.calls.flat().join('\n')).toMatch(
      /\[degraded-isr:cities\] refusing to persist ISR copy \(cities:monthlyRuns\)/,
    )
    warn.mockRestore()
  })
})

describe('refuseDegradedIsr', () => {
  it('is a no-op when nothing degraded', () => {
    refuseDegradedIsr('cities', [])
    expect(noStore).not.toHaveBeenCalled()
  })
})
