import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * finalizeNewsletter closes a send once nothing is queued or sending. An
 * enqueue claims the issue ('sending') first and writes its schedule last, so
 * a claimed issue with no schedule and nothing queued is an enqueue still
 * reading its audience, not a send that failed: the hourly reconcile at :00
 * and a send scheduled for 9:00 meet exactly. clearUnsentQueue gives each
 * enqueue a clean start.
 */
let byStatus: Record<string, number> = {}
let planned = 0
let startedAt: string | null = null
let updatedRows: Array<{ id: string }> = [{ id: 'nl-0' }]
const writes: Array<{ table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }> = []

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let call: { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]>; head?: boolean }
    const builder: Record<string, unknown> = {
      from: (table: string) => { call = { table, op: 'select', filters: [] }; return builder },
      select: (_cols: string, opts?: { head?: boolean }) => { call.head = opts?.head; return builder },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; writes.push(call); return builder },
      delete: () => { call.op = 'delete'; writes.push(call); return builder },
      eq: (col: string, val: unknown) => { call.filters.push([col, val]); return builder },
      maybeSingle: () => Promise.resolve({ data: { send_started_at: startedAt }, error: null }),
      then: (resolve: (v: unknown) => unknown) => {
        if (call.op === 'update') return resolve({ data: updatedRows, error: null })
        if (call.op === 'delete') return resolve({ data: null, error: null })
        if (call.table === 'newsletter_send_schedule') return resolve({ count: planned, error: null })
        const status = call.filters.find(([c]) => c === 'status')?.[1] as string
        return resolve({ count: byStatus[status] ?? 0, error: null })
      },
    }
    return builder
  },
}))
vi.mock('@/lib/supabase/paginate', () => ({ fetchPagedRows: vi.fn(async () => ({ rows: [] })) }))

import { clearUnsentQueue, ENQUEUE_GRACE_MS, finalizeNewsletter } from './queue'

const NOW = Date.parse('2026-10-03T16:00:30Z')

afterEach(() => {
  byStatus = {}
  planned = 0
  startedAt = null
  updatedRows = [{ id: 'nl-0' }]
  writes.length = 0
})

describe('finalizeNewsletter', () => {
  it('leaves alone an issue whose enqueue is still queueing its recipients', async () => {
    startedAt = '2026-10-03T16:00:04Z' // claimed 26 seconds ago, no schedule yet
    expect(await finalizeNewsletter('nl-0', NOW)).toBeNull()
    expect(writes).toEqual([])
  })

  it('marks failed an enqueue that died (no schedule long past the grace)', async () => {
    startedAt = new Date(NOW - ENQUEUE_GRACE_MS - 1000).toISOString()
    expect(await finalizeNewsletter('nl-0', NOW)).toBe('failed')
    expect(writes[0]!.filters).toEqual([['id', 'nl-0'], ['status', 'sending']])
  })

  it('closes a send that drained: sent when anyone got it', async () => {
    planned = 3
    byStatus = { sent: 5300, skipped: 40 }
    expect(await finalizeNewsletter('nl-0', NOW)).toBe('sent')
    expect(writes[0]!.payload).toMatchObject({ status: 'sent', sent_count: 5300 })
  })

  it('never closes while anything is queued or sending', async () => {
    planned = 3
    byStatus = { queued: 1, sent: 10 }
    expect(await finalizeNewsletter('nl-0', NOW)).toBeNull()
    expect(writes).toEqual([])
  })

  it('writes only over an issue still sending', async () => {
    planned = 3
    byStatus = { sent: 10 }
    updatedRows = []
    expect(await finalizeNewsletter('nl-0', NOW)).toBeNull()
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
