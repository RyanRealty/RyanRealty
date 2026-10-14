import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '@/test/fake-supabase-chain'

const fake = fakeSupabase(() => ({
  data: [
    { date: '2026-10-10', metric: 'business_impressions_mobile_search', value: '5' },
    { date: '2026-10-06', metric: 'business_direction_requests', value: '3' },
  ],
  error: null,
}))
vi.mock('@/lib/data/client', () => ({ createServiceClient: () => fake.client }))

const { getGbpDaily, latestGbpDate, summarizeGbp } = await import('./getGbpMetrics')

const rows = [
  { date: '2026-10-10', metric: 'business_impressions_mobile_search', value: 5 },
  { date: '2026-10-10', metric: 'business_impressions_desktop_maps', value: 2 },
  { date: '2026-10-09', metric: 'business_impressions_mobile_search', value: 5 },
  { date: '2026-10-06', metric: 'business_direction_requests', value: 3 },
  { date: '2026-10-06', metric: 'call_clicks', value: 1 },
  { date: '2026-10-05', metric: 'website_clicks', value: 1 },
  { date: '2026-10-01', metric: 'business_direction_requests', value: 3 },
]

describe('summarizeGbp', () => {
  it('sums one window and counts only the days Google reported', () => {
    expect(summarizeGbp(rows, '2026-10-04', '2026-10-10')).toEqual({
      reportedDays: 4,
      calls: 1,
      websiteClicks: 1,
      directionRequests: 3,
      impressions: 12,
    })
    expect(summarizeGbp(rows, '2026-09-27', '2026-10-03')).toMatchObject({ reportedDays: 1, directionRequests: 3 })
    expect(summarizeGbp([], '2026-10-04', '2026-10-10').reportedDays).toBe(0)
  })

  it('finds the newest reported day', () => {
    expect(latestGbpDate(rows)).toBe('2026-10-10')
    expect(latestGbpDate([])).toBeNull()
  })
})

describe('getGbpDaily', () => {
  it('reads the account rows for the action and impression metrics, numbers as numbers', async () => {
    const r = await getGbpDaily('2026-08-30', '2026-10-14')
    expect(r.unreadable).toBe(false)
    expect(r.rows[0]).toEqual({ date: '2026-10-10', metric: 'business_impressions_mobile_search', value: 5 })
    const c = fake.chains[0]
    expect(c.calls).toContainEqual({ method: 'eq', args: ['channel', 'gbp'] })
    expect(c.calls).toContainEqual({ method: 'eq', args: ['scope', 'account'] })
  })
})
