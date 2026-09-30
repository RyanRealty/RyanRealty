import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The per-send record's claim (review 2026-09-30): two overlapping cron runs
 * claim ONE row per subscription per cycle, so only one sends; a retry may
 * take over only an attempt that settled as a failure; an attempt still in
 * flight ('sending') counts as delivered.
 */

type Row = {
  id: number
  email_key: string
  person_id: number
  kind: string
  status: string
  error: string | null
  sent_at: string | null
  attempted_at: string
  hold_reason: string | null
  [k: string]: unknown
}

const h = vi.hoisted(() => ({ rows: [] as Row[], nextId: 1 }))

/** A filter chain over h.rows: eq / in / or(error.is.null,error.neq.X), then a terminal. */
function query() {
  const preds: Array<(r: Row) => boolean> = []
  let mode: 'select' | 'update' = 'select'
  let patch: Record<string, unknown> = {}
  const matches = () => h.rows.filter((r) => preds.every((p) => p(r)))
  const q = {
    select: () => q,
    update: (p: Record<string, unknown>) => {
      mode = 'update'
      patch = p
      return q
    },
    eq: (col: string, v: unknown) => (preds.push((r) => r[col] === v), q),
    in: (col: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[col])), q),
    or: (expr: string) => {
      const m = /^error\.is\.null,error\.neq\.(.+)$/.exec(expr)
      if (!m) throw new Error(`unsupported or(${expr})`)
      preds.push((r) => r.error == null || r.error !== m[1])
      return q
    },
    order: () => q,
    limit: async () => ({ data: matches(), error: null }),
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      if (mode === 'update') {
        const hit = matches()
        for (const r of hit) Object.assign(r, patch)
        resolve({ data: hit.map((r) => ({ id: r.id })), error: null })
      } else resolve({ data: matches(), error: null })
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      ...query(),
      upsert: async (row: Record<string, unknown>, opts: { ignoreDuplicates?: boolean }) => {
        const existing = h.rows.find((r) => r.email_key === row.email_key)
        if (existing) {
          if (opts.ignoreDuplicates) return { count: 0, error: null }
          Object.assign(existing, row)
          return { count: 1, error: null }
        }
        h.rows.push({ id: h.nextId++, ...(row as Omit<Row, 'id'>) } as Row)
        return { count: 1, error: null }
      },
    }),
  }),
}))

import {
  claimMarketReportSend,
  getLatestDeliveredReport,
  getLatestDeliveredReportAt,
  inFlightAbandoned,
  isInFlightSend,
  isSettledFailure,
  latestDeliveredAt,
  latestDelivery,
  SEND_CLAIM_MARK,
} from './marketReportSends'

const KEY = 'market-report:scheduled:9016:first'

function claimRow(attemptedAt: string) {
  return {
    subscriptionId: 9016,
    personId: 64138,
    emailKey: KEY,
    broker: 'matt',
    kind: 'scheduled' as const,
    recipientEmail: 'cheryl@example.com',
    attemptedAt,
    frequency: 'monthly',
    areas: ['bend'],
    subject: 'Bend market update',
    html: `<p>${attemptedAt}</p>`,
    plainText: 'x',
    figures: [],
  }
}

beforeEach(() => {
  h.rows = []
  h.nextId = 1
})

describe('claimMarketReportSend', () => {
  it('two overlapping runs claim the same cycle key: the first claims, the second does not', async () => {
    const a = await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    const b = await claimMarketReportSend(claimRow('2026-09-30T16:00:02Z'))
    expect(a).toEqual({ ok: true, claimed: true, takeover: false })
    expect(b).toMatchObject({ ok: true, claimed: false, existing: { status: 'failed', error: SEND_CLAIM_MARK } })
    expect(h.rows).toHaveLength(1)
    // The in-flight row keeps the first attempt's copy.
    expect(h.rows[0]!.html).toBe('<p>2026-09-30T16:00:01Z</p>')
  })

  it('a sent row is never claimed again', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    Object.assign(h.rows[0]!, { status: 'sent', error: null, sent_at: '2026-09-30T16:00:03Z' })
    expect(await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'))).toMatchObject({
      ok: true,
      claimed: false,
      existing: { status: 'sent', sentAt: '2026-09-30T16:00:03Z' },
    })
  })

  it('a retry takes over only an attempt that SETTLED as a failure, and only one retry does', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    Object.assign(h.rows[0]!, { status: 'failed', error: 'Resend 500' })
    const retry = await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'))
    expect(retry).toEqual({ ok: true, claimed: true, takeover: true })
    expect(h.rows[0]).toMatchObject({ status: 'failed', error: SEND_CLAIM_MARK, attempted_at: '2026-09-30T22:00:00Z' })
    // The row is in flight again: a second retry cannot take it.
    const second = await claimMarketReportSend(claimRow('2026-09-30T22:00:05Z'))
    expect(second).toMatchObject({ ok: true, claimed: false, existing: { error: SEND_CLAIM_MARK } })
  })

  it('a held row is not taken over', async () => {
    h.rows.push({
      id: 9,
      email_key: KEY,
      person_id: 64138,
      kind: 'scheduled',
      status: 'held',
      error: 'email:unsubscribe',
      sent_at: null,
      attempted_at: '2026-09-30T16:00:00Z',
      hold_reason: 'suppressed',
    })
    expect(await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'))).toMatchObject({
      ok: true,
      claimed: false,
      existing: { status: 'held', holdReason: 'suppressed' },
    })
  })
})

describe('in flight counts as delivered', () => {
  it('isInFlightSend / isSettledFailure', () => {
    expect(isInFlightSend({ status: 'failed', error: SEND_CLAIM_MARK })).toBe(true)
    expect(isSettledFailure({ status: 'failed', error: SEND_CLAIM_MARK })).toBe(false)
    expect(isSettledFailure({ status: 'failed', error: 'Resend 500' })).toBe(true)
    expect(isSettledFailure({ status: 'failed', error: null })).toBe(true)
    expect(isInFlightSend({ status: 'sent', error: null })).toBe(false)
  })

  it('latestDeliveredAt counts sent rows and in-flight rows, never previews, failures or holds', () => {
    expect(
      latestDeliveredAt([
        { kind: 'scheduled', status: 'sent', error: null, sentAt: '2026-08-30T16:00:05Z', attemptedAt: '2026-08-30T16:00:00Z' },
        { kind: 'scheduled', status: 'failed', error: SEND_CLAIM_MARK, sentAt: null, attemptedAt: '2026-09-30T16:00:00Z' },
        { kind: 'scheduled', status: 'failed', error: 'Resend 500', sentAt: null, attemptedAt: '2026-10-01T16:00:00Z' },
        { kind: 'preview', status: 'sent', error: null, sentAt: '2026-10-02T16:00:00Z', attemptedAt: '2026-10-02T16:00:00Z' },
        { kind: 'scheduled', status: 'held', error: 'x', sentAt: null, attemptedAt: '2026-10-03T16:00:00Z' },
      ]),
    ).toBe('2026-09-30T16:00:00Z')
    expect(latestDeliveredAt([])).toBeNull()
  })

  it('getLatestDeliveredReportAt sees an in-flight attempt the cadence backstop must not repeat', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    expect(await getLatestDeliveredReportAt(64138)).toBe('2026-09-30T16:00:01Z')
    expect(await getLatestDeliveredReport(64138)).toEqual({ at: '2026-09-30T16:00:01Z', inFlight: true })
  })

  it('latestDelivery flags an in-flight delivery; an attempt is abandoned only after the settle window', () => {
    expect(
      latestDelivery([{ kind: 'manual', status: 'sent', error: null, sentAt: '2026-09-30T16:00:05Z', attemptedAt: '2026-09-30T16:00:00Z' }]),
    ).toEqual({ at: '2026-09-30T16:00:05Z', inFlight: false })
    const now = new Date('2026-09-30T16:20:00Z')
    expect(inFlightAbandoned('2026-09-30T16:19:00Z', now)).toBe(false)
    expect(inFlightAbandoned('2026-09-30T16:00:00Z', now)).toBe(true)
  })
})
