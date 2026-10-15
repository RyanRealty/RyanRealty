import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '@/test/fake-supabase-chain'

const fake = fakeSupabase(() => ({
  data: [
    { date: '2026-10-11', metric: 'avg_position', value: '11.28' },
    { date: '2026-10-11', metric: 'clicks', value: '13' },
    { date: '2026-10-11', metric: 'impressions', value: '823' },
    // The cron writes a not-yet-reported day as all zeros.
    { date: '2026-10-12', metric: 'avg_position', value: '0' },
    { date: '2026-10-12', metric: 'clicks', value: '0' },
    { date: '2026-10-12', metric: 'impressions', value: '0' },
  ],
  error: null,
}))
vi.mock('@/lib/data/client', () => ({ createServiceClient: () => fake.client }))

const { getGscDaily } = await import('./getGscMetrics')

describe('getGscDaily', () => {
  it('marks a day with no impressions as not reported, never a zero day', async () => {
    const r = await getGscDaily('2026-10-01', '2026-10-14')
    expect(r.unreadable).toBe(false)
    expect(r.days).toEqual([
      { date: '2026-10-11', reported: true, clicks: 13, impressions: 823, position: 11.28 },
      { date: '2026-10-12', reported: false, clicks: 0, impressions: 0, position: null },
    ])
    const c = fake.chains[0]
    expect(c.calls).toContainEqual({ method: 'eq', args: ['channel', 'gsc'] })
    expect(c.calls).toContainEqual({ method: 'eq', args: ['scope', 'account'] })
  })
})
