import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase, type Chain } from '@/test/fake-supabase-chain'

let answer: (chain: Chain) => unknown = () => ({ data: [], error: null })
const fake = fakeSupabase((c) => answer(c))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fake.client }))
// A stand-in that behaves like unstable_cache: a resolved value is stored per
// key and served again; a rejection stores nothing.
vi.mock('@/lib/data/cache/next-cache', () => {
  const store = new Map<string, unknown>()
  return {
    unstable_cache: (fn: () => Promise<unknown>, keyParts: string[]) => async () => {
      const key = JSON.stringify(keyParts)
      if (store.has(key)) return store.get(key)
      const v = await fn()
      store.set(key, v)
      return v
    },
  }
})

const { getWebsiteVisitors } = await import('./getWebsiteVisitors')
const { getWebsiteMarkets } = await import('./getWebsiteMarkets')

const current = { startIso: '2026-10-07T07:00:00.000Z', endIso: '2026-10-14T06:59:59.999Z' }
const previous = { startIso: '2026-09-30T07:00:00.000Z', endIso: '2026-10-07T06:59:59.999Z' }

describe('a failed read is never cached', () => {
  it('visitors: a timeout shows as unreadable once, and the next load reads again', async () => {
    answer = () => ({ data: null, count: null, error: { message: 'timeout' } })
    expect((await getWebsiteVisitors({ current, previous })).unreadable).toBe(true)
    answer = (c) => {
      const head = c.calls.find((k) => k.method === 'select')?.args[1] as { head?: boolean } | undefined
      return head?.head ? { count: 0, error: null } : { data: [], error: null }
    }
    expect((await getWebsiteVisitors({ current, previous })).unreadable).toBe(false)
  })

  it('markets: the same', async () => {
    answer = () => ({ data: null, error: { message: 'boom' } })
    expect((await getWebsiteMarkets(current)).unreadable).toBe(true)
    answer = () => ({ data: [], error: null })
    expect((await getWebsiteMarkets(current)).unreadable).toBe(false)
  })
})
