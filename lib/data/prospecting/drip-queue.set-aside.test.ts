import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Setting a queued owner aside when the MLS relist check cannot answer for
 * that address (2026-09-30 review). The row moves to the back, counted, and
 * the peek does not serve it again until its stamp comes due. Run against an
 * in-memory table so the filters are exercised for real. `counter: false`
 * plays the database before migration 20260930140000.
 */

type Row = Record<string, unknown>
type Err = { code: string; message: string } | null

const h = vi.hoisted(() => ({
  counter: true,
  readError: null as { code: string; message: string } | null,
  tables: {
    expired_listings: [] as Array<Record<string, unknown>>,
    fsbo_listings: [] as Array<Record<string, unknown>>,
  },
}))

const COL = 'outreach_email_verify_attempts'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: 'expired_listings' | 'fsbo_listings') {
      let op: 'select' | 'update' = 'select'
      let cols: string[] = []
      let patch: Row = {}
      const filters: Array<(r: Row) => boolean> = []
      let order: { col: string; asc: boolean } | null = null
      let limit = Infinity
      const missing = (): Err => {
        if (h.counter) return null
        if (op === 'select' && cols.includes(COL)) return { code: '42703', message: `column ${table}.${COL} does not exist` }
        if (op === 'update' && COL in patch) return { code: 'PGRST204', message: `Could not find the '${COL}' column of '${table}' in the schema cache` }
        return null
      }
      const rows = () => {
        let out = h.tables[table].filter((r) => filters.every((f) => f(r)))
        if (order) {
          const { col, asc } = order
          out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1))
        }
        return out.slice(0, limit)
      }
      const q = {
        select(c: string) {
          op = 'select'
          cols = c.split(',').map((x) => x.trim())
          return q
        },
        update(p: Row) {
          op = 'update'
          patch = p
          return q
        },
        eq(col: string, v: unknown) {
          filters.push((r) => r[col] === v)
          return q
        },
        is(col: string, v: unknown) {
          filters.push((r) => (r[col] ?? null) === v)
          return q
        },
        not(col: string, _op: string, v: unknown) {
          filters.push((r) => (r[col] ?? null) !== v)
          return q
        },
        lte(col: string, v: string) {
          filters.push((r) => r[col] != null && String(r[col]) <= v)
          return q
        },
        order(col: string, o: { ascending: boolean }) {
          order = { col, asc: o.ascending }
          return q
        },
        limit(n: number) {
          limit = n
          return q
        },
        async maybeSingle() {
          const error = h.readError ?? missing()
          if (error) return { data: null, error }
          const hit = rows()[0]
          return { data: hit ? Object.fromEntries(cols.map((c) => [c, hit[c] ?? null])) : null, error: null }
        },
        then(resolve: (v: { error: Err }) => unknown, reject: (e: unknown) => unknown) {
          const error = missing()
          if (!error && op === 'update') for (const r of rows()) Object.assign(r, patch)
          return Promise.resolve({ error }).then(resolve, reject)
        },
      }
      return q
    },
  }),
}))

import {
  clearQueuedFirstTouchVerifyAttempts,
  peekOldestQueuedFirstTouch,
  setAsideQueuedFirstTouch,
} from '@/lib/data/prospecting/drip-queue'

const NOW = new Date('2026-09-30T15:00:00.000Z')
const RETRY = new Date('2026-09-30T16:00:00.000Z')

function queued(key: string, queuedAt: string, over: Row = {}): Row {
  return {
    listing_key: key,
    outreach_email_status: 'queued',
    outreach_email_queued_at: queuedAt,
    outreach_email_sent_at: null,
    street_address: `${key} Street`,
    city: 'Bend',
    postal_code: '97702',
    expired_at: '2026-08-01T00:00:00.000Z',
    status_change_timestamp: null,
    [COL]: 0,
    ...over,
  }
}

beforeEach(() => {
  h.counter = true
  h.readError = null
  h.tables.expired_listings = []
  h.tables.fsbo_listings = []
})

describe('setAsideQueuedFirstTouch', () => {
  it('counts the attempt and moves the stamp to the retry time', async () => {
    h.tables.expired_listings = [queued('LAND0', '2026-09-30T13:00:00.000Z', { [COL]: 1 })]
    const out = await setAsideQueuedFirstTouch('expired', 'LAND0', RETRY)
    expect(out).toEqual({ attempts: 2 })
    expect(h.tables.expired_listings[0]).toMatchObject({
      outreach_email_status: 'queued',
      outreach_email_queued_at: RETRY.toISOString(),
      [COL]: 2,
    })
  })

  it('moves nothing that is no longer queued (a send finished in between)', async () => {
    h.tables.expired_listings = [queued('SENT', '2026-09-30T13:00:00.000Z', { outreach_email_status: 'sent' })]
    await setAsideQueuedFirstTouch('expired', 'SENT', RETRY)
    expect(h.tables.expired_listings[0]).toMatchObject({ outreach_email_queued_at: '2026-09-30T13:00:00.000Z', [COL]: 0 })
  })

  it('before the counter migration: still sets the row aside, uncounted', async () => {
    h.counter = false
    h.tables.expired_listings = [queued('LAND0', '2026-09-30T13:00:00.000Z')]
    delete h.tables.expired_listings[0]![COL]
    const out = await setAsideQueuedFirstTouch('expired', 'LAND0', RETRY)
    expect(out).toEqual({ attempts: null })
    expect(h.tables.expired_listings[0]).toMatchObject({ outreach_email_queued_at: RETRY.toISOString() })
  })

  it('any other read error throws, so the drain sends nothing', async () => {
    h.readError = { code: '57014', message: 'canceling statement due to statement timeout' }
    h.tables.expired_listings = [queued('LAND0', '2026-09-30T13:00:00.000Z')]
    await expect(setAsideQueuedFirstTouch('expired', 'LAND0', RETRY)).rejects.toThrow(/statement timeout/)
  })
})

describe('peekOldestQueuedFirstTouch after a set-aside', () => {
  it('serves the next row, and the set-aside row only once its stamp comes due', async () => {
    h.tables.expired_listings = [queued('LAND0', '2026-09-30T13:00:00.000Z'), queued('NEXT', '2026-09-30T14:00:00.000Z')]
    expect((await peekOldestQueuedFirstTouch({ now: NOW }))?.id).toBe('LAND0')
    await setAsideQueuedFirstTouch('expired', 'LAND0', RETRY)
    expect(await peekOldestQueuedFirstTouch({ now: NOW })).toMatchObject({ id: 'NEXT', postalCode: '97702' })
    h.tables.expired_listings[1]!.outreach_email_status = 'sent'
    expect(await peekOldestQueuedFirstTouch({ now: NOW })).toBeNull()
    expect((await peekOldestQueuedFirstTouch({ now: new Date(RETRY.getTime() + 1) }))?.id).toBe('LAND0')
  })
})

describe('clearQueuedFirstTouchVerifyAttempts', () => {
  it('starts the count again, and is harmless before the migration', async () => {
    h.tables.expired_listings = [queued('LAND0', '2026-09-30T13:00:00.000Z', { [COL]: 3 })]
    await clearQueuedFirstTouchVerifyAttempts('expired', 'LAND0')
    expect(h.tables.expired_listings[0]![COL]).toBe(0)
    h.counter = false
    await expect(clearQueuedFirstTouchVerifyAttempts('expired', 'LAND0')).resolves.toBeUndefined()
  })
})
