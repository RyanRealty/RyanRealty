import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  read: vi.fn(),
  cacheCalls: [] as Array<{ keyParts: string[]; opts: { revalidate?: number; tags?: string[] } }>,
  store: new Map<string, unknown>(),
  afterTasks: [] as Array<() => Promise<unknown>>,
  afterThrows: false,
}))

vi.mock('server-only', () => ({}))
// after() modelled as Next's request-scoped queue: it records the task, and
// throws outside a request scope the way next/dist/server/after/after.js does.
vi.mock('next/server', () => ({
  after: (task: () => Promise<unknown>) => {
    if (h.afterThrows) throw new Error('`after` was called outside a request scope.')
    h.afterTasks.push(task)
  },
}))
// unstable_cache modelled as a real cache that never stores a rejection, which
// is the property makeResilientCached relies on.
vi.mock('next/cache', () => ({
  unstable_cache:
    (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[], opts: { revalidate?: number; tags?: string[] }) => {
      h.cacheCalls.push({ keyParts, opts })
      return async (...args: unknown[]) => {
        const key = JSON.stringify([keyParts, args])
        if (h.store.has(key)) return h.store.get(key)
        const v = await fn(...args)
        h.store.set(key, v)
        return v
      }
    },
}))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({ readSubdivisionRing: h.read }))

import { getSubdivisionRingCached } from '@/lib/data/geo/subdivision-ring-cached'

const RING = { homeSlug: 'elkai-woods-townhomes-phase-iii', homeLabel: 'x', neighborhoodSlug: null, ring: [] }

beforeEach(() => {
  h.read.mockReset()
  h.store.clear()
  h.afterTasks.length = 0
  h.afterThrows = false
})

describe('getSubdivisionRingCached', () => {
  it('reads the RPC once per point and serves the second render from cache', async () => {
    h.read.mockResolvedValue(RING)
    await getSubdivisionRingCached(43.998697, -121.388213)
    // float noise below 1e-6 degrees is the same key
    const second = await getSubdivisionRingCached(43.9986970000001, -121.3882130000002)
    expect(second).toEqual(RING)
    expect(h.read).toHaveBeenCalledTimes(1)
    expect(h.read).toHaveBeenCalledWith(43.998697, -121.388213)
  })

  it('never caches a failed read (poison-null) and never throws', async () => {
    h.read.mockRejectedValue(new Error('statement timeout'))
    expect(await getSubdivisionRingCached(44.02542075, -121.316513)).toBeNull()
    h.read.mockResolvedValue(RING)
    expect(await getSubdivisionRingCached(44.02542075, -121.316513)).toEqual(RING)
  })

  it('skips the read when there is no point', async () => {
    expect(await getSubdivisionRingCached(null, -121.3)).toBeNull()
    expect(await getSubdivisionRingCached(44, Number.NaN)).toBeNull()
    expect(h.read).not.toHaveBeenCalled()
  })

  it('holds the invocation open until a read the page stopped waiting for settles (elkai-woods, P3)', async () => {
    // The page gives up on the ring at its budget; the read must still finish
    // and land in the cache so the next render has it.
    let settle!: (v: unknown) => void
    h.read.mockReturnValue(new Promise((r) => (settle = r)))
    const pending = getSubdivisionRingCached(43.998697, -121.388213)
    expect(h.afterTasks).toHaveLength(1)
    let taskDone = false
    const task = h.afterTasks[0]().then(() => (taskDone = true))
    await Promise.resolve()
    expect(taskDone).toBe(false)
    settle(RING)
    await task
    expect(taskDone).toBe(true)
    expect(await pending).toEqual(RING)
    // the late answer is now cached: the next render reads it without the RPC
    expect(await getSubdivisionRingCached(43.998697, -121.388213)).toEqual(RING)
    expect(h.read).toHaveBeenCalledTimes(1)
  })

  it('a failed read does not fail the after() task, and no request scope is not an error', async () => {
    h.read.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    expect(await getSubdivisionRingCached(44.101111, -121.372111)).toBeNull()
    await expect(h.afterTasks[0]()).resolves.toBeUndefined()

    h.afterThrows = true
    h.read.mockResolvedValue(RING)
    expect(await getSubdivisionRingCached(44.101111, -121.372111)).toEqual(RING)
  })

  it('registers no after() task when there is no point to read', async () => {
    await getSubdivisionRingCached(null, null)
    expect(h.afterTasks).toHaveLength(0)
  })

  it('caches for a day under the boundaries tag, never shortening the page window', () => {
    const call = h.cacheCalls.find((c) => c.keyParts.includes('subdivision-ring-v1'))
    expect(call?.opts.revalidate).toBe(86400)
    expect(call?.opts.tags).toContain('boundaries')
  })
})
