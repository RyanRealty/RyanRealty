import { describe, expect, it, vi } from 'vitest'
import { createBuildReadMemo } from '@/lib/build/build-read-memo'

function memoAt(clock: { now: number }, limits = { maxChars: 1_000_000, maxEntryChars: 100_000 }) {
  return createBuildReadMemo({ ...limits, now: () => clock.now })
}

/** A read the test settles by hand, to hold it in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('build read memo', () => {
  it('runs one read for eight pages asking for the same key at once', async () => {
    // The first wave of community pages in one worker: eight concurrent
    // renders, one city tile read.
    const memo = memoAt({ now: 0 })
    const gate = deferred<string[]>()
    const run = vi.fn(() => gate.promise)
    const answers = Array.from({ length: 8 }, () => memo.read('tiles:bend', 60_000, run))
    gate.resolve(['20260911203657678671000000'])
    expect(await Promise.all(answers)).toEqual(Array.from({ length: 8 }, () => ['20260911203657678671000000']))
    expect(run).toHaveBeenCalledTimes(1)
    expect(memo.stats()).toMatchObject({ reads: 1, joins: 7, hits: 0 })
  })

  it('answers a later page from memory inside the window, and reads again once it has passed', async () => {
    const clock = { now: 0 }
    const memo = memoAt(clock)
    const run = vi.fn(async () => ({ active: 77 }))
    await memo.read('pulse:bend', 60_000, run)
    clock.now += 59_000
    expect(await memo.read('pulse:bend', 60_000, run)).toEqual({ active: 77 })
    expect(run).toHaveBeenCalledTimes(1)
    clock.now += 2_000
    await memo.read('pulse:bend', 60_000, run)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('gives every caller but the reader its own copy, as a cache hit does', async () => {
    const memo = memoAt({ now: 0 })
    const gate = deferred<{ keys: string[] }>()
    const first = memo.read('k', 60_000, () => gate.promise)
    const joined = memo.read('k', 60_000, () => gate.promise)
    gate.resolve({ keys: ['a', 'b'] })
    const mine = await first
    mine.keys.reverse() // a caller sorting its rows in place
    expect(await joined).toEqual({ keys: ['a', 'b'] })
    const later = await memo.read('k', 60_000, async () => ({ keys: [] }))
    expect(later).toEqual({ keys: ['a', 'b'] })
    expect(later).not.toBe(mine)
  })

  it('keeps nothing that failed: every caller of the failed read sees the error, the next caller reads again', async () => {
    const memo = memoAt({ now: 0 })
    const gate = deferred<string>()
    const a = memo.read('k', 60_000, () => gate.promise)
    const b = memo.read('k', 60_000, () => gate.promise)
    gate.reject(new Error('canceling statement due to statement timeout'))
    await expect(a).rejects.toThrow('statement timeout')
    await expect(b).rejects.toThrow('statement timeout')
    const retry = vi.fn(async () => 'rows')
    expect(await memo.read('k', 60_000, retry)).toBe('rows')
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('turns a callback that throws before returning into a rejection', async () => {
    const memo = memoAt({ now: 0 })
    await expect(
      memo.read('k', 60_000, () => {
        throw new Error('supabase not configured')
      }),
    ).rejects.toThrow('supabase not configured')
    expect(await memo.read('k', 60_000, async () => 1)).toBe(1)
  })

  it('keeps no undefined and no value JSON cannot carry', async () => {
    const memo = memoAt({ now: 0 })
    const nothing = vi.fn(async () => undefined)
    await memo.read('u', 60_000, nothing)
    await memo.read('u', 60_000, nothing)
    expect(nothing).toHaveBeenCalledTimes(2)
    const big = vi.fn(async () => ({ n: BigInt(1) }))
    await memo.read('b', 60_000, big)
    await memo.read('b', 60_000, big)
    expect(big).toHaveBeenCalledTimes(2)
  })

  it('keeps a null and an empty list, which are values', async () => {
    const memo = memoAt({ now: 0 })
    const none = vi.fn(async () => null)
    const empty = vi.fn(async () => [])
    await memo.read('n', 60_000, none)
    await memo.read('e', 60_000, empty)
    expect(await memo.read('n', 60_000, none)).toBeNull()
    expect(await memo.read('e', 60_000, empty)).toEqual([])
    expect(none).toHaveBeenCalledTimes(1)
    expect(empty).toHaveBeenCalledTimes(1)
  })

  it('treats an endless window as the build lifetime and a zero window as no keeping', async () => {
    const clock = { now: 0 }
    const memo = memoAt(clock)
    const forever = vi.fn(async () => 'registry')
    await memo.read('f', Number.POSITIVE_INFINITY, forever)
    clock.now += 10 * 60_000
    await memo.read('f', Number.POSITIVE_INFINITY, forever)
    expect(forever).toHaveBeenCalledTimes(1)
    const never = vi.fn(async () => 'x')
    await memo.read('z', 0, never)
    await memo.read('z', 0, never)
    expect(never).toHaveBeenCalledTimes(2)
  })

  it('stays inside its size budget, least recently used out first', async () => {
    const memo = memoAt({ now: 0 }, { maxChars: 30, maxEntryChars: 20 })
    const row = (n: number) => async () => 'x'.repeat(n) // JSON adds the two quotes
    await memo.read('a', 60_000, row(8)) // 10 chars
    await memo.read('b', 60_000, row(8)) // 20
    await memo.read('a', 60_000, row(8)) // touch a: b is now the oldest
    await memo.read('c', 60_000, row(8)) // 30, still inside
    await memo.read('d', 60_000, row(8)) // 40: b goes
    expect(memo.stats()).toMatchObject({ entries: 3, chars: 30 })
    const b = vi.fn(row(8))
    await memo.read('b', 60_000, b)
    expect(b).toHaveBeenCalledTimes(1)
    const tooBig = vi.fn(row(30)) // 32 chars, over the one-entry cap
    await memo.read('big', 60_000, tooBig)
    await memo.read('big', 60_000, tooBig)
    expect(tooBig).toHaveBeenCalledTimes(2)
  })
})
