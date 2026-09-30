import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Closing a send (finalizeNewsletter), clearing a failed enqueue's rows
 * (clearUnsentQueue), and releasing an enqueue that died (releaseDeadEnqueue).
 * The mock is a small stateful table: recipient rows by status, schedule rows,
 * and the issue's own status, so reads and writes in any order see each other.
 */
type Db = {
  byStatus: Record<string, number>
  planned: number
  issueStatus: string
  listSend: boolean
  failCounts: boolean
}
const db: Db = { byStatus: {}, planned: 0, issueStatus: 'sending', listSend: true, failCounts: false }
const writes: Array<{ table: string; op: string; payload?: Record<string, unknown>; filters: Array<[string, unknown]> }> = []

vi.mock('@/lib/data/client', () => ({
  // One builder per query, as supabase-js does: parallel reads never share state.
  createServiceClient: () => ({
    // One grouped count, one snapshot (newsletter_recipient_status_counts).
    rpc: (name: string) => {
      if (name !== 'newsletter_recipient_status_counts') throw new Error(`unexpected rpc ${name}`)
      if (db.failCounts) return Promise.resolve({ data: null, error: { message: 'statement timeout' } })
      const rows = Object.entries(db.byStatus).filter(([, n]) => n > 0).map(([status, n]) => ({ status, n: String(n) }))
      return Promise.resolve({ data: rows, error: null })
    },
    from: (table: string) => {
      const call: { table: string; op: string; payload?: Record<string, unknown>; filters: Array<[string, unknown]> } = { table, op: 'select', filters: [] }
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (payload: Record<string, unknown>) => { call.op = 'update'; call.payload = payload; writes.push(call); return builder },
        delete: () => { call.op = 'delete'; writes.push(call); return builder },
        eq: (col: string, val: unknown) => { call.filters.push([col, val]); return builder },
        maybeSingle: () => Promise.resolve({ data: { list_send: db.listSend }, error: null }),
        then: (resolve: (v: unknown) => unknown) => {
          const filter = (col: string) => call.filters.find(([c]) => c === col)?.[1]
          if (call.table === 'newsletter_send_schedule') {
            if (call.op === 'delete') db.planned = 0
            return resolve({ count: db.planned, data: null, error: null })
          }
          if (call.table === 'newsletter_recipients') {
            if (call.op === 'delete') {
              db.byStatus.queued = 0
              return resolve({ data: null, error: null })
            }
            return resolve({ count: db.byStatus[filter('status') as string] ?? 0, error: null })
          }
          // newsletters: a conditional update takes only while the issue is still 'sending'
          if (call.op === 'update') {
            const took = filter('status') === undefined || filter('status') === db.issueStatus
            if (took) db.issueStatus = String(call.payload?.status ?? db.issueStatus)
            return resolve({ data: took ? [{ id: 'nl-0' }] : [], error: null })
          }
          return resolve({ data: null, error: null })
        },
      }
      return builder
    },
  }),
}))
vi.mock('@/lib/supabase/paginate', () => ({ fetchPagedRows: vi.fn(async () => ({ rows: [] })) }))

import { clearUnsentQueue, finalizeNewsletter, releaseDeadEnqueue, sentTotal } from './queue'

afterEach(() => {
  Object.assign(db, { byStatus: {}, planned: 0, issueStatus: 'sending', listSend: true, failCounts: false })
  writes.length = 0
})

describe('finalizeNewsletter', () => {
  it('leaves alone an issue with no schedule yet (still being queued), without reading its counts', async () => {
    expect(await finalizeNewsletter('nl-0')).toBeNull()
    expect(writes).toEqual([])
    expect(db.issueStatus).toBe('sending')
  })

  it('reads the schedule first, so rows queued during the close are never mistaken for nothing to send', async () => {
    // The old order: counts (all zero) first, then the enqueue inserts and schedules, then the close.
    db.planned = 3
    db.byStatus = { queued: 300 }
    expect(await finalizeNewsletter('nl-0')).toBeNull()
    expect(db.issueStatus).toBe('sending')
  })

  it('never closes on counts it could not read (one grouped read, one snapshot)', async () => {
    db.planned = 3
    db.byStatus = { queued: 40000, sent: 100 }
    db.failCounts = true
    await expect(finalizeNewsletter('nl-0')).rejects.toThrow('recipientStatusCounts: statement timeout')
    expect(db.issueStatus).toBe('sending')
  })

  it('counts every row that was sent, whatever the webhooks said since', async () => {
    db.planned = 3
    // Most rows moved on to delivered/opened/clicked; the last tick's were all skipped.
    db.byStatus = { delivered: 800, opened: 60, clicked: 10, bounced: 3, skipped: 27 }
    expect(await finalizeNewsletter('nl-0')).toEqual({ status: 'sent', sent: 873, failed: 0, skipped: 27, recipients: 900 })
    const close = writes.find((w) => w.table === 'newsletters')!
    expect(close.payload).toMatchObject({ status: 'sent', sent_count: 873, recipient_count: 900 })
    expect(close.payload).toHaveProperty('sent_at')
    expect(close.filters).toEqual([['id', 'nl-0'], ['status', 'sending']])
  })

  it('closes as failed only when no one was sent it', async () => {
    db.planned = 1
    db.byStatus = { failed: 2, skipped: 1 }
    expect(await finalizeNewsletter('nl-0')).toMatchObject({ status: 'failed', sent: 0, failed: 2, skipped: 1 })
  })

  it('never closes while anything is queued or sending, and writes only over an issue still sending', async () => {
    db.planned = 3
    db.byStatus = { sending: 5, sent: 10 }
    expect(await finalizeNewsletter('nl-0')).toBeNull()
    db.byStatus = { sent: 10 }
    db.issueStatus = 'draft'
    expect(await finalizeNewsletter('nl-0')).toBeNull()
    expect(db.issueStatus).toBe('draft')
  })

  it('sums the sent statuses', () => {
    expect(sentTotal({ queued: 9, sending: 9, skipped: 9, failed: 9, sent: 1, delivered: 2, opened: 3, clicked: 4, bounced: 5, complained: 6 })).toBe(21)
  })
})

describe('clearUnsentQueue', () => {
  it('removes only the queued rows and the schedule of that issue', async () => {
    await clearUnsentQueue('nl-0')
    expect(writes.map((w) => [w.table, w.op, w.filters])).toEqual([
      ['newsletter_recipients', 'delete', [['newsletter_id', 'nl-0'], ['status', 'queued']]],
      ['newsletter_send_schedule', 'delete', [['newsletter_id', 'nl-0']]],
    ])
  })
})

describe('releaseDeadEnqueue', () => {
  it('closes a dead one-off instead: back in draft it would go to the whole list', async () => {
    db.listSend = false
    db.byStatus = { queued: 300 }
    expect(await releaseDeadEnqueue('nl-0')).toBe('failed')
    expect(db.issueStatus).toBe('failed')
    expect(db.byStatus.queued).toBe(0)
  })

  it('puts a list send whose enqueue died back to draft, with what it queued cleared', async () => {
    db.byStatus = { queued: 2400 }
    expect(await releaseDeadEnqueue('nl-0')).toBe('draft')
    expect(db.issueStatus).toBe('draft')
    expect(db.byStatus.queued).toBe(0)
    const release = writes.find((w) => w.table === 'newsletters')!
    expect(release.payload).toMatchObject({ status: 'draft', lock_token: null, send_started_at: null, list_send: false })
    expect(release.filters).toEqual([['id', 'nl-0'], ['status', 'sending']])
  })

  it('leaves alone an issue that has a schedule (its enqueue finished)', async () => {
    db.planned = 2
    expect(await releaseDeadEnqueue('nl-0')).toBeNull()
    expect(writes).toEqual([])
  })
})
