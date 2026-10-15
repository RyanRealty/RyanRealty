import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase, type Chain } from '@/test/fake-supabase-chain'

let answer: (chain: Chain) => unknown = () => ({ data: [], error: null })
const fake = fakeSupabase((c) => answer(c))
vi.mock('@/lib/data/client', () => ({ createServiceClient: () => fake.client }))

const { getMetaAdSpend } = await import('./getMetaAdSpend')

describe('getMetaAdSpend', () => {
  it("reads the metric the Meta cron writes ('spend'), account scope only", async () => {
    fake.chains.length = 0
    answer = () => ({ data: [{ date: '2026-10-01', value: '12.5' }, { date: '2026-10-02', value: 7.5 }], error: null })
    const r = await getMetaAdSpend('2026-10-01', '2026-10-07')
    expect(r).toEqual({ spendUsd: 20, days: 2, unreadable: false })
    const c = fake.chains[0]
    expect(c.table).toBe('marketing_channel_daily')
    expect(c.calls).toContainEqual({ method: 'eq', args: ['channel', 'meta_ads'] })
    expect(c.calls).toContainEqual({ method: 'eq', args: ['metric', 'spend'] })
    // Campaign rows repeat the same dollars; summing them too would double count.
    expect(c.calls).toContainEqual({ method: 'eq', args: ['scope', 'account'] })
  })

  it('no rows is "not synced" (null), never a made-up $0', async () => {
    answer = () => ({ data: [], error: null })
    expect(await getMetaAdSpend('2026-10-01', '2026-10-07')).toEqual({ spendUsd: null, days: 0, unreadable: false })
  })

  it('a failed read says so', async () => {
    answer = () => ({ data: null, error: { message: 'down' } })
    expect((await getMetaAdSpend('2026-10-01', '2026-10-07')).unreadable).toBe(true)
  })
})
