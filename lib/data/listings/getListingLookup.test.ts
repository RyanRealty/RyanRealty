import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A database failure is not a missing listing (2026-10-04).
 *
 * During the Supabase API Gateway degradation, active listings rendered "We
 * can't show this home" with robots noindex after a 16s stall, because the
 * lookup returned null for a failure exactly as for a miss. getListingLookup
 * keeps them apart so the page can serve a temporary state with no noindex.
 */

type Result = { data: unknown; error: unknown }
let next: () => Promise<Result>
let calls = 0

vi.mock('@/lib/data/cache/next-cache', () => ({
  unstable_cache: (cb: () => unknown) => cb,
}))

vi.mock('@/lib/data/client', () => ({
  supabaseAnon: () => {
    const q: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq', 'order', 'limit']) q[m] = () => q
    q.abortSignal = () => {
      calls += 1
      return next()
    }
    return q
  },
}))

const { getListingLookup } = await import('./getListingDetail')

beforeEach(() => {
  calls = 0
})

describe('getListingLookup', () => {
  it('returns error, not missing, when the database fails', async () => {
    next = () => Promise.resolve({ data: null, error: { message: '503 Service Unavailable' } })
    expect(await getListingLookup('220222540')).toEqual({ kind: 'error' })
  })

  it('stops at the two in-function attempts (8s worst case, not 16s)', async () => {
    next = () => Promise.resolve({ data: null, error: { message: 'timeout' } })
    await getListingLookup('220222541')
    expect(calls).toBe(2)
  })

  it('returns missing for a clean empty answer on both columns', async () => {
    next = () => Promise.resolve({ data: [], error: null })
    expect(await getListingLookup('220222542')).toEqual({ kind: 'missing' })
  })

  it('returns missing for a key that can never be a key, without touching the database', async () => {
    expect(await getListingLookup('')).toEqual({ kind: 'missing' })
    expect(calls).toBe(0)
  })

  it('treats a thrown network failure as an error too', async () => {
    next = () => Promise.reject(new Error('fetch failed'))
    expect(await getListingLookup('220222543')).toEqual({ kind: 'error' })
  })
})
