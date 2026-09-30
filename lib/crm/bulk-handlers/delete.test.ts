import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Deleting contacts in bulk stops their market reports (review 2026-09-30):
 * before, the subscription stayed on and the cadence cron kept mailing a
 * record nobody could see.
 */

const h = vi.hoisted(() => ({
  people: [] as Array<{ id: number; deleted: boolean }>,
  deletedIds: [] as number[],
  stop: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ in: async (_c: string, ids: number[]) => ({ data: h.people.filter((p) => ids.includes(p.id)), error: null }) }),
      update: () => ({
        in: async (_c: string, ids: number[]) => {
          h.deletedIds.push(...ids)
          return { error: null }
        },
      }),
    }),
  }),
}))
vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  stopReportSubscriptionsForDeletedPeople: (...a: unknown[]) => h.stop(...a),
}))

import { deleteContactsHandler } from './delete'

const ctx = { jobId: 1, actorEmail: 'matt@ryan-realty.com', brokerScope: null }

beforeEach(() => {
  h.people = [
    { id: 1, deleted: false },
    { id: 2, deleted: false },
    { id: 3, deleted: true },
  ]
  h.deletedIds = []
  h.stop.mockReset()
  h.stop.mockResolvedValue({ ok: true, stopped: [2] })
})

describe('deleteContactsHandler', () => {
  it('stops the market report of every contact it deletes, and counts it', async () => {
    const res = await deleteContactsHandler([1, 2, 3, 4], {}, ctx)
    expect(h.deletedIds).toEqual([1, 2])
    expect(h.stop).toHaveBeenCalledWith([1, 2], { email: 'matt@ryan-realty.com' })
    expect(res.processed).toBe(2)
    expect(res.breakdown).toMatchObject({ deleted: 2, report_stopped: 1, already_deleted: 1, not_found: 1 })
  })

  it('says so when the report stop failed (the delete itself stands)', async () => {
    h.stop.mockResolvedValue({ ok: false, error: 'timeout' })
    const res = await deleteContactsHandler([1], {}, ctx)
    expect(res.processed).toBe(1)
    expect(res.breakdown).toMatchObject({ deleted: 1, report_stop_failed: 1 })
  })
})
