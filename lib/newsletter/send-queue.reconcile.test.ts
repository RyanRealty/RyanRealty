import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The hourly stall check pages Matt only for a send that could be sending and
 * is not: a schedule row whose day has come, with room under its cap, while
 * its tier still has someone queued. A skipped or failed recipient never
 * counts toward sent_count, so a row sized to its tier can end below its cap
 * with nobody left, and that is not a stall.
 */
type Row = { day_index: number; tier: number; cap: number; sent_count: number }
let schedule: Row[] = []
let queuedByTier = new Map<number, number>()
let queued = 0
const queueBrokerHealthAlert = vi.fn(async () => true)

vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: () => queueBrokerHealthAlert() }))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  getSendingNewsletters: vi.fn(async () => [{ id: 'nl-0', send_started_at: '2026-10-01T16:00:00Z' }]),
  requeueStaleClaims: vi.fn(async () => 0),
  finalizeNewsletter: vi.fn(async () => null),
  recipientStatusCounts: vi.fn(async () => ({ queued })),
  getSendSchedule: vi.fn(async () => schedule),
  queuedCountsByTier: vi.fn(async () => queuedByTier),
}))

import { reconcileSending } from './send-queue'

// Day 3 of the send.
const NOW = Date.parse('2026-10-04T18:00:00Z')

afterEach(() => {
  queueBrokerHealthAlert.mockClear()
})

describe('reconcileSending', () => {
  it('a row that ended below its cap with its tier empty is not a stall', async () => {
    // Tier 2 is done (one recipient skipped, so its carry row ended at 2,439 of 2,440);
    // tier 3's last recipient waits for day 4.
    schedule = [
      { day_index: 1, tier: 2, cap: 900, sent_count: 900 },
      { day_index: 2, tier: 2, cap: 2000, sent_count: 2000 },
      { day_index: 3, tier: 2, cap: 2440, sent_count: 2439 },
      { day_index: 3, tier: 3, cap: 1, sent_count: 1 },
      { day_index: 4, tier: 3, cap: 1, sent_count: 0 },
    ]
    queuedByTier = new Map([[3, 1]])
    queued = 1
    expect((await reconcileSending(NOW))[0]).toMatchObject({ action: 'draining' })
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('a row with room whose tier still has people queued past its day is a stall, and pages Matt', async () => {
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    expect((await reconcileSending(NOW))[0]).toMatchObject({ action: 'stalled' })
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
  })
})
