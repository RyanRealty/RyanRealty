import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The hourly stall check pages Matt only for a send that could be sending and
 * is not: a schedule row from a day already over, with room under its cap,
 * while its tier still has someone queued, on a send nobody paused. Today's
 * tranche is mid-drain, and a skipped or failed recipient never counts toward
 * sent_count, so a row sized to its tier can end below its cap with nobody
 * left; neither is a stall.
 */
type Row = { day_index: number; tier: number; cap: number; sent_count: number }
type Sending = { id: string; send_started_at: string | null; send_paused: boolean | null }
let sending: Sending[] = []
let schedule: Row[] = []
let queuedByTier = new Map<number, number>()
let queued = 0
let failScheduleFor: string | null = null
const queueBrokerHealthAlert = vi.fn(async () => true)

vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: () => queueBrokerHealthAlert() }))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  getSendingNewsletters: vi.fn(async () => sending),
  requeueStaleClaims: vi.fn(async () => 0),
  finalizeNewsletter: vi.fn(async () => null),
  recipientStatusCounts: vi.fn(async () => ({ queued })),
  getSendSchedule: vi.fn(async (id: string) => {
    if (id === failScheduleFor) throw new Error('read failed')
    return schedule
  }),
  queuedCountsByTier: vi.fn(async () => queuedByTier),
}))

import { reconcileSending } from './send-queue'

const STARTED = '2026-10-01T16:00:00Z'
const day = (n: number, hour = 18) => Date.parse(STARTED) + n * 86_400_000 + (hour - 16) * 3_600_000

afterEach(() => {
  queueBrokerHealthAlert.mockClear()
  failScheduleFor = null
  sending = [{ id: 'nl-0', send_started_at: STARTED, send_paused: false }]
})
sending = [{ id: 'nl-0', send_started_at: STARTED, send_paused: false }]

describe('reconcileSending', () => {
  it('a past row that ended below its cap with its tier empty is not a stall', async () => {
    // Tier 2 is done (one recipient skipped, so its carry row ended at 2,439 of 2,440);
    // tier 3's last recipient waits for day 5.
    schedule = [
      { day_index: 3, tier: 2, cap: 2440, sent_count: 2439 },
      { day_index: 5, tier: 3, cap: 1, sent_count: 0 },
    ]
    queuedByTier = new Map([[3, 1]])
    queued = 1
    expect((await reconcileSending(day(4)))[0]).toMatchObject({ action: 'draining' })
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it("today's tranche mid-drain is not a stall", async () => {
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    expect((await reconcileSending(day(2)))[0]).toMatchObject({ action: 'draining' })
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('a row from a day already over, with room and its tier still queued, is a stall, and pages Matt', async () => {
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    expect((await reconcileSending(day(3)))[0]).toMatchObject({ action: 'stalled' })
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
  })

  it('a paused send is waiting on a person, not stalled', async () => {
    sending = [{ id: 'nl-0', send_started_at: STARTED, send_paused: true }]
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    expect((await reconcileSending(day(3)))[0]).toMatchObject({ action: 'draining', detail: 'paused' })
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it("one issue's failed read never stops the check of the others", async () => {
    sending = [
      { id: 'nl-bad', send_started_at: STARTED, send_paused: false },
      { id: 'nl-0', send_started_at: STARTED, send_paused: false },
    ]
    failScheduleFor = 'nl-bad'
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    const out = await reconcileSending(day(3))
    expect(out.map((r) => [r.newsletterId, r.action])).toEqual([
      ['nl-bad', 'draining'],
      ['nl-0', 'stalled'],
    ])
  })
})
