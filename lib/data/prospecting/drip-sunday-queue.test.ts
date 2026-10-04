/**
 * The Sunday queue is not the weekday drip.
 *
 * A row stamped sunday-queue (queued_at null, idempotency prefix) must not be
 * returned by the weekday FIFO, must not be sent by the weekday drain on a
 * Thursday or on Sunday, and must not be emailed before Sunday 2026-10-04
 * 08:00 America/Los_Angeles. At 08:00 the Sunday drain may send it, on the
 * existing 5-minute spacing, through the mocked intro (this test never calls
 * the real send).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const tables: { expired_listings: Row[]; fsbo_listings: Row[] } = {
    expired_listings: [],
    fsbo_listings: [],
  }
  function from(table: 'expired_listings' | 'fsbo_listings') {
    const filters: Array<(row: Row) => boolean> = []
    let order: { col: string; asc: boolean } | null = null
    let limit: number | null = null
    let patch: Row | null = null
    const api = {
      select() {
        return api
      },
      update(p: Row) {
        patch = p
        return api
      },
      eq(col: string, v: unknown) {
        filters.push((row) => row[col] === v)
        return api
      },
      neq(col: string, v: unknown) {
        filters.push((row) => row[col] !== v)
        return api
      },
      is(col: string, v: unknown) {
        filters.push((row) => (v === null ? row[col] == null : row[col] === v))
        return api
      },
      not(col: string, op: string, v: unknown) {
        if (op === 'is' && v === null) filters.push((row) => row[col] != null)
        return api
      },
      gt(col: string, v: unknown) {
        filters.push((row) => row[col] != null && String(row[col]) > String(v))
        return api
      },
      like(col: string, pattern: string) {
        const prefix = pattern.endsWith('%') ? pattern.slice(0, -1) : null
        filters.push((row) => {
          const cur = row[col]
          if (typeof cur !== 'string') return false
          return prefix == null ? cur === pattern : cur.startsWith(prefix)
        })
        return api
      },
      or(expr: string) {
        const preds = expr.split(',').map((part) => {
          const [col, op, ...rest] = part.split('.')
          const value = rest.join('.')
          if (!col || !op) throw new Error(`bad or clause ${part}`)
          if (op === 'eq') return (row: Row) => row[col] === value
          if (op === 'is' && value === 'null') return (row: Row) => row[col] == null
          throw new Error(`unsupported or clause ${part}`)
        })
        filters.push((row) => preds.some((pred) => pred(row)))
        return api
      },
      order(col: string, opts?: { ascending?: boolean }) {
        order = { col, asc: opts?.ascending !== false }
        return api
      },
      limit(n: number) {
        limit = n
        return api
      },
      maybeSingle() {
        let rows = tables[table].filter((row) => filters.every((f) => f(row)))
        if (order) {
          const { col, asc } = order
          rows = [...rows].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1))
        }
        if (limit != null) rows = rows.slice(0, limit)
        return Promise.resolve({ data: rows[0] ?? null, error: null })
      },
      then(resolve: (v: { data: null; error: null }) => unknown, reject?: (e: unknown) => unknown) {
        if (patch) {
          for (const row of tables[table]) {
            if (filters.every((f) => f(row))) Object.assign(row, patch)
          }
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
    }
    return api
  }
  return { tables, from }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: 'expired_listings' | 'fsbo_listings') => h.from(table),
  }),
}))

const sendProspectingEmailIntro = vi.hoisted(() => vi.fn())
vi.mock('@/app/actions/prospecting', () => ({
  sendProspectingEmailIntro: (...a: unknown[]) => sendProspectingEmailIntro(...a),
}))
vi.mock('@/lib/data/prospecting/batch', () => ({
  verifyNotRelisted: async () => ({ relisted: false, verifyFailed: false }),
  verifyFsboStillActive: async () => ({ active: true, verifyFailed: false }),
}))
vi.mock('@/lib/data/prospecting/drip-recover', () => ({
  recoverStuckFirstTouchSends: async () => [],
}))
vi.mock('@/lib/data', () => ({
  getProspect: async () => null,
}))
vi.mock('@/lib/cma/first-contact-override', () => ({
  loadCmaFirstContactOverride: async () => null,
}))

import { drainProspectingFirstTouchDrip } from './drip-drain'
import { drainSundayFirstTouchQueue } from './drip-sunday-drain'
import {
  enqueueProspectFirstTouchEmail,
  enqueueSundayFirstTouchEmail,
  peekOldestQueuedFirstTouch,
  peekOldestSundayQueue,
} from './drip-queue'
import { SUNDAY_QUEUE_IDEMPOTENCY_PREFIX, SUNDAY_QUEUE_STATUS, sundayQueueIdempotencyKey } from './drip-schedule'

const THU_8AM_PT = new Date('2026-09-03T15:00:00.000Z')
const SUN_759_PT = new Date('2026-10-04T14:59:00.000Z')
const SUN_800_PT = new Date('2026-10-04T15:00:00.000Z')

beforeEach(() => {
  h.tables.expired_listings = []
  h.tables.fsbo_listings = []
  sendProspectingEmailIntro.mockReset()
  sendProspectingEmailIntro.mockResolvedValue({
    ok: true,
    messageId: 'mock-only',
    personId: 1,
    sentAt: SUN_800_PT.toISOString(),
    transport: 'gmail',
  })
})

describe('sunday queue membership', () => {
  it('keeps a sunday-queue row off the weekday drip and unsent before Sunday 08:00 PT', async () => {
    h.tables.expired_listings = [
      {
        listing_key: 'PETROSA',
        street_address: '3722 NE Petrosa Avenue',
        city: 'Bend',
        expired_at: '2026-09-01T00:00:00.000Z',
        outreach_email_status: 'queued',
        outreach_email_queued_at: '2026-10-03T18:00:00.000Z',
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: null,
      },
    ]
    h.tables.fsbo_listings = [
      {
        fsbo_url: 'https://fsbo.example/weekday',
        street_address: '1 Weekday',
        city: 'Bend',
        detected_at: '2026-09-01T00:00:00.000Z',
        outreach_email_status: 'queued',
        outreach_email_queued_at: '2026-10-03T19:00:00.000Z',
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: null,
      },
    ]

    const queued = await enqueueSundayFirstTouchEmail('expired', 'PETROSA')
    expect(queued).toEqual({ ok: true, already: false })
    const row = h.tables.expired_listings[0]!
    expect(row.outreach_email_status).toBe(SUNDAY_QUEUE_STATUS)
    expect(row.outreach_email_queued_at).toBeNull()
    expect(String(row.outreach_email_idempotency_key).startsWith(SUNDAY_QUEUE_IDEMPOTENCY_PREFIX)).toBe(true)
    expect(row.outreach_email_status).not.toBe('queued')

    const again = await enqueueSundayFirstTouchEmail('expired', 'PETROSA')
    expect(again).toEqual({ ok: true, already: true })
    expect(h.tables.expired_listings[0]!.outreach_email_idempotency_key).toBe(row.outreach_email_idempotency_key)

    // A later weekday approve must not move it back onto the weekday FIFO.
    const weekday = await enqueueProspectFirstTouchEmail('expired', 'PETROSA')
    expect(weekday).toEqual({ ok: true, already: true })
    expect(h.tables.expired_listings[0]!.outreach_email_status).toBe(SUNDAY_QUEUE_STATUS)
    expect(h.tables.expired_listings[0]!.outreach_email_queued_at).toBeNull()

    const weekdayNext = await peekOldestQueuedFirstTouch()
    expect(weekdayNext?.kind).toBe('fsbo')
    expect(weekdayNext?.id).toBe('https://fsbo.example/weekday')
    const sundayNext = await peekOldestSundayQueue()
    expect(sundayNext).toMatchObject({
      kind: 'expired',
      id: 'PETROSA',
      idempotencyKey: row.outreach_email_idempotency_key,
    })

    // Weekday window open: the Sunday row is still not the one that would send.
    const thursday = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(thursday).toEqual({ ok: true, action: 'sent', kind: 'fsbo', id: 'https://fsbo.example/weekday' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
    expect(sendProspectingEmailIntro).toHaveBeenCalledWith(
      'fsbo',
      'https://fsbo.example/weekday',
      expect.objectContaining({ actor: 'drip-cron' }),
    )
    sendProspectingEmailIntro.mockClear()

    const sundayMorning = await drainProspectingFirstTouchDrip(SUN_800_PT)
    expect(sundayMorning).toEqual({ ok: true, action: 'idle', reason: 'weekend' })
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()

    const beforeOpen = await drainSundayFirstTouchQueue(SUN_759_PT)
    expect(beforeOpen).toEqual({ ok: true, action: 'idle', reason: 'before-open' })
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()

    const atOpen = await drainSundayFirstTouchQueue(SUN_800_PT)
    expect(atOpen).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'PETROSA' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
    expect(sendProspectingEmailIntro).toHaveBeenCalledWith(
      'expired',
      'PETROSA',
      expect.objectContaining({
        actor: 'drip-cron',
        idempotencyKey: row.outreach_email_idempotency_key,
      }),
    )
  })

  it('enqueues a row whose email status is still null', async () => {
    h.tables.expired_listings = [
      {
        listing_key: 'NULLSTATUS',
        street_address: '9 Null',
        city: 'Bend',
        outreach_email_status: null,
        outreach_email_queued_at: null,
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: null,
      },
    ]
    const queued = await enqueueSundayFirstTouchEmail('expired', 'NULLSTATUS')
    expect(queued).toEqual({ ok: true, already: false })
    expect(h.tables.expired_listings[0]).toMatchObject({
      outreach_email_status: SUNDAY_QUEUE_STATUS,
      outreach_email_queued_at: null,
    })
    expect(String(h.tables.expired_listings[0]!.outreach_email_idempotency_key).startsWith(SUNDAY_QUEUE_IDEMPOTENCY_PREFIX)).toBe(true)
    const next = await peekOldestSundayQueue()
    expect(next?.id).toBe('NULLSTATUS')
    const weekday = await peekOldestQueuedFirstTouch({ kinds: ['expired'] })
    expect(weekday).toBeNull()
  })

  it('orders the Sunday queue by the idempotency stamp, ignoring weekday rows', async () => {
    const earlier = sundayQueueIdempotencyKey('2026-10-03T20:00:00.000Z', 'expired', 'EARLY')
    const later = sundayQueueIdempotencyKey('2026-10-03T21:00:00.000Z', 'expired', 'LATE')
    h.tables.expired_listings = [
      {
        listing_key: 'LATE',
        outreach_email_status: SUNDAY_QUEUE_STATUS,
        outreach_email_queued_at: null,
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: later,
        street_address: '2',
        city: 'Bend',
        expired_at: null,
        status_change_timestamp: null,
      },
      {
        listing_key: 'EARLY',
        outreach_email_status: SUNDAY_QUEUE_STATUS,
        outreach_email_queued_at: null,
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: earlier,
        street_address: '1',
        city: 'Bend',
        expired_at: null,
        status_change_timestamp: null,
      },
      {
        listing_key: 'WEEKDAY',
        outreach_email_status: 'queued',
        outreach_email_queued_at: '2026-10-01T00:00:00.000Z',
        outreach_email_sent_at: null,
        outreach_email_message_id: null,
        outreach_email_idempotency_key: null,
        street_address: '9',
        city: 'Bend',
        expired_at: null,
        status_change_timestamp: null,
      },
    ]
    const next = await peekOldestSundayQueue()
    expect(next?.id).toBe('EARLY')
    const weekday = await peekOldestQueuedFirstTouch({ kinds: ['expired'] })
    expect(weekday?.id).toBe('WEEKDAY')
  })
})
