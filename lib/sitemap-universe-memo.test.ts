import { describe, it, expect } from 'vitest'
import { createUniverseMemo } from './sitemap-universe-memo'

/**
 * Regression tests for the 2026-08-02 sitemap P0.
 *
 * The headline case is "a build slower than its own TTL is still reused". That
 * is the one the shipped code got wrong: TTL 60s, build 115-235s, freshness
 * stamped at build START, so the memo expired before it ever resolved and every
 * sequential request rebuilt the whole universe.
 */

/** Manual clock so the tests assert the rule, not the wall time. */
function fakeClock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

/** A build that resolves only when released, counting how often it was called. */
function controllableBuild<T>(value: T) {
  let calls = 0
  let release: (() => void) | null = null
  const build = () => {
    calls += 1
    return new Promise<T>((resolve) => {
      release = () => resolve(value)
    })
  }
  return {
    build,
    get calls() { return calls },
    finish: () => { release?.(); release = null },
  }
}

describe('createUniverseMemo', () => {
  it('reuses a build that took LONGER than its own TTL (the shipped bug)', async () => {
    const clock = fakeClock()
    const ctl = controllableBuild('universe')
    const get = createUniverseMemo(ctl.build, 100, clock.now)

    const first = get()
    // The build costs 300ms against a 100ms TTL — the exact shape of the P0.
    clock.advance(300)
    ctl.finish()
    await expect(first).resolves.toBe('universe')
    expect(ctl.calls).toBe(1)

    // The next sequential caller — a crawler fetching the next child sitemap —
    // must be served from the memo. Stamping freshness at build START made this
    // a second full rebuild.
    await expect(get()).resolves.toBe('universe')
    expect(ctl.calls).toBe(1)
  })

  it('serves a full sequential sweep of five children from one build', async () => {
    const clock = fakeClock()
    const ctl = controllableBuild('universe')
    const get = createUniverseMemo(ctl.build, 600_000, clock.now)

    const first = get()
    clock.advance(235_000) // measured local build cost
    ctl.finish()
    await first

    for (let i = 0; i < 4; i++) {
      clock.advance(1_000)
      await expect(get()).resolves.toBe('universe')
    }
    expect(ctl.calls).toBe(1)
  })

  it('collapses concurrent callers onto one build', async () => {
    const clock = fakeClock()
    const ctl = controllableBuild('universe')
    const get = createUniverseMemo(ctl.build, 100, clock.now)

    const all = Promise.all([get(), get(), get(), get(), get()])
    ctl.finish()
    expect(await all).toEqual(Array(5).fill('universe'))
    expect(ctl.calls).toBe(1)
  })

  it('does not treat an in-flight build as stale', async () => {
    const clock = fakeClock()
    const ctl = controllableBuild('universe')
    const get = createUniverseMemo(ctl.build, 100, clock.now)

    const first = get()
    clock.advance(5_000) // far past the TTL, but still building
    const second = get()
    expect(ctl.calls).toBe(1)

    ctl.finish()
    await Promise.all([first, second])
    expect(ctl.calls).toBe(1)
  })

  it('rebuilds once the value is genuinely stale', async () => {
    const clock = fakeClock()
    const ctl = controllableBuild('universe')
    const get = createUniverseMemo(ctl.build, 100, clock.now)

    const first = get()
    ctl.finish()
    await first
    expect(ctl.calls).toBe(1)

    clock.advance(101)
    const second = get()
    ctl.finish()
    await second
    expect(ctl.calls).toBe(2)
  })

  it('never caches a rejection', async () => {
    const clock = fakeClock()
    let calls = 0
    const get = createUniverseMemo(
      () => { calls += 1; return Promise.reject(new Error('supabase timeout')) },
      600_000,
      clock.now,
    )

    await expect(get()).rejects.toThrow('supabase timeout')
    await expect(get()).rejects.toThrow('supabase timeout')
    expect(calls).toBe(2)
  })
})
