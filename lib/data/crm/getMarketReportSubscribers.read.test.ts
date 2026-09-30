import { describe, expect, it, vi } from 'vitest'

/**
 * The cron's subscription read (review 2026-09-30): an error reading
 * crm_report_subscriptions must THROW, like the people read, so the cron's
 * alarm pages Matt. Returning [] read as "nobody is subscribed" and the run
 * reported a quiet, empty success.
 */

const h = vi.hoisted(() => ({ subsError: null as { message: string } | null }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        limit: async () =>
          table === 'crm_report_subscriptions'
            ? { data: h.subsError ? null : [], error: h.subsError }
            : { data: [], error: null },
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      }
      return q
    },
  }),
}))

import { getActiveMarketReportSubscriptions } from './getMarketReportSubscribers'

describe('getActiveMarketReportSubscriptions', () => {
  it('throws when the subscription read fails, so the cron pages Matt', async () => {
    h.subsError = { message: 'canceling statement due to statement timeout' }
    await expect(getActiveMarketReportSubscriptions(10)).rejects.toThrow('statement timeout')
  })

  it('an empty table is an empty list, not an error', async () => {
    h.subsError = null
    await expect(getActiveMarketReportSubscriptions(10)).resolves.toEqual([])
  })
})
