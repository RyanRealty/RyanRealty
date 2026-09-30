import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The hourly reconcile, the drain loop and the scheduled-send cron, over a
 * mocked queue:
 *   - a claimed issue with no schedule is still being queued, until
 *     ENQUEUE_GRACE_MS says its enqueue died, and then it goes back to draft
 *     and Matt is told;
 *   - a stall is a tranche day open longer than its volume takes to drain,
 *     with a row under its cap whose tier still has someone queued, on a send
 *     nobody paused (a row sized to its tier ends below its cap when anyone is
 *     skipped, and that is not a stall);
 *   - one issue's error never stops the others;
 *   - a scheduled send that does not go out is told to Matt.
 */
type Row = { day_index: number; tier: number; cap: number; sent_count: number }
type Sending = { id: string; send_started_at: string | null; send_paused: boolean | null }
let sending: Sending[] = []
let schedule: Row[] = []
let queuedByTier = new Map<number, number>()
let queued = 0
let failFor: string | null = null
const alerts: Array<{ key: string; body: string }> = []
const releaseDeadEnqueue = vi.fn(async (_id: string) => true)

vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: async (a: { key: string; body: string }) => {
    alerts.push(a)
    return true
  },
}))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  getSendingNewsletters: vi.fn(async () => sending),
  requeueStaleClaims: vi.fn(async () => 0),
  finalizeNewsletter: vi.fn(async () => null),
  recipientStatusCounts: vi.fn(async () => ({ queued })),
  getSendSchedule: vi.fn(async (id: string) => {
    if (id === failFor) throw new Error('getSendSchedule: read failed')
    return schedule
  }),
  queuedCountsByTier: vi.fn(async () => queuedByTier),
  releaseDeadEnqueue: (id: string) => releaseDeadEnqueue(id),
  isNewsletterPaused: vi.fn(async (id: string) => {
    if (id === failFor) throw new Error('isNewsletterPaused: read failed')
    return true
  }),
}))
const getDueScheduledNewsletterIds = vi.fn(async () => [] as string[])
vi.mock('@/lib/data/newsletter/scheduled', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/scheduled')>()),
  getDueScheduledNewsletterIds: () => getDueScheduledNewsletterIds(),
}))
const getNewsletter = vi.fn(async (_id: string) => null as unknown)
vi.mock('@/lib/data/newsletter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter')>()),
  getNewsletter: (id: string) => getNewsletter(id),
}))

import { drainAllSending, enqueueDueScheduled, reconcileSending } from './send-queue'

const STARTED = '2026-10-01T16:00:00Z'
const at = (dayIndex: number, hour: number) => Date.parse(STARTED) + dayIndex * 86_400_000 + hour * 3_600_000

beforeEach(() => {
  sending = [{ id: 'nl-0', send_started_at: STARTED, send_paused: false }]
})
afterEach(() => {
  alerts.length = 0
  failFor = null
  releaseDeadEnqueue.mockClear()
  releaseDeadEnqueue.mockResolvedValue(true)
})

describe('reconcileSending: an issue with no schedule', () => {
  it('is still being queued within the grace', async () => {
    schedule = []
    expect((await reconcileSending(at(0, 0.1)))[0]).toMatchObject({ action: 'draining', detail: 'being queued' })
    expect(releaseDeadEnqueue).not.toHaveBeenCalled()
  })

  it('past the grace is an enqueue that died: back to draft, and Matt is told', async () => {
    schedule = []
    expect((await reconcileSending(at(0, 1)))[0]).toMatchObject({ action: 'released' })
    expect(releaseDeadEnqueue).toHaveBeenCalledWith('nl-0')
    expect(alerts[0]!.key).toBe('newsletter-dead-enqueue:nl-0')
    expect(alerts[0]!.body).toContain('back to draft')
  })
})

describe('reconcileSending: stalls', () => {
  it('a past row that ended below its cap with its tier empty is not a stall', async () => {
    schedule = [
      { day_index: 3, tier: 2, cap: 2440, sent_count: 2439 },
      { day_index: 5, tier: 3, cap: 1, sent_count: 0 },
    ]
    queuedByTier = new Map([[3, 1]])
    queued = 1
    expect((await reconcileSending(at(4, 2)))[0]).toMatchObject({ action: 'draining' })
    expect(alerts).toEqual([])
  })

  it("today's tranche inside its drain time is not a stall", async () => {
    schedule = [{ day_index: 2, tier: 2, cap: 2000, sent_count: 1200 }]
    queuedByTier = new Map([[2, 800]])
    queued = 800
    expect((await reconcileSending(at(2, 1)))[0]).toMatchObject({ action: 'draining' })
    expect(alerts).toEqual([])
  })

  it('a large tranche gets the time its volume takes (25,000 at 3,000 an hour)', async () => {
    schedule = [{ day_index: 5, tier: 3, cap: 25000, sent_count: 15000 }]
    queuedByTier = new Map([[3, 10000]])
    queued = 10000
    expect((await reconcileSending(at(5, 6)))[0]).toMatchObject({ action: 'draining' })
    expect((await reconcileSending(at(5, 11)))[0]).toMatchObject({ action: 'stalled' })
  })

  it('a day past its drain time with its tier still queued is a stall, and pages Matt', async () => {
    schedule = [{ day_index: 0, tier: 1, cap: 600, sent_count: 0 }]
    queuedByTier = new Map([[1, 600]])
    queued = 600
    expect((await reconcileSending(at(0, 3)))[0]).toMatchObject({ action: 'stalled' })
    expect(alerts[0]!.key).toBe('newsletter-stall:nl-0')
  })

  it('a paused send is waiting on a person, not stalled', async () => {
    sending = [{ id: 'nl-0', send_started_at: STARTED, send_paused: true }]
    schedule = [{ day_index: 0, tier: 1, cap: 600, sent_count: 0 }]
    queuedByTier = new Map([[1, 600]])
    queued = 600
    expect((await reconcileSending(at(0, 3)))[0]).toMatchObject({ action: 'draining', detail: 'paused' })
    expect(alerts).toEqual([])
  })

  it("one issue's failed read is reported as a failed check and never stops the others", async () => {
    sending = [
      { id: 'nl-bad', send_started_at: STARTED, send_paused: false },
      { id: 'nl-0', send_started_at: STARTED, send_paused: false },
    ]
    failFor = 'nl-bad'
    schedule = [{ day_index: 0, tier: 1, cap: 600, sent_count: 0 }]
    queuedByTier = new Map([[1, 600]])
    queued = 600
    const out = await reconcileSending(at(0, 3))
    expect(out.map((r) => [r.newsletterId, r.action])).toEqual([
      ['nl-bad', 'check-failed'],
      ['nl-0', 'stalled'],
    ])
  })
})

describe('drainAllSending', () => {
  it("one issue's error ends its own tick, never the others'", async () => {
    sending = [
      { id: 'nl-bad', send_started_at: STARTED, send_paused: false },
      { id: 'nl-0', send_started_at: STARTED, send_paused: false },
    ]
    failFor = 'nl-bad'
    const out = await drainAllSending(at(0, 1))
    expect(out[0]).toMatchObject({ newsletterId: 'nl-bad', error: 'isNewsletterPaused: read failed' })
    expect(out[1]).toMatchObject({ newsletterId: 'nl-0', paused: true })
  })
})

describe('enqueueDueScheduled', () => {
  it('tells Matt when a scheduled send does not go out, and not when another path already took it', async () => {
    getDueScheduledNewsletterIds.mockResolvedValueOnce(['nl-gone'])
    expect(await enqueueDueScheduled()).toEqual({ enqueued: [], skipped: [{ id: 'nl-gone', error: 'not_found' }] })
    expect(alerts[0]!.key).toBe('newsletter-scheduled-failed:nl-gone')
    expect(alerts[0]!.body).toContain('did not go out (not_found)')

    alerts.length = 0
    getDueScheduledNewsletterIds.mockResolvedValueOnce(['nl-0'])
    getNewsletter.mockResolvedValueOnce({ id: 'nl-0', status: 'sending', body_html: '<p>x</p>', body_text: null, created_by: null, citations: [] })
    expect((await enqueueDueScheduled()).skipped).toEqual([{ id: 'nl-0', error: 'already_sending' }])
    expect(alerts).toEqual([])
  })
})
