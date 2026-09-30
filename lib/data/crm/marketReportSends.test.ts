import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The per-send record's claim (reviews of 2026-09-30).
 *
 *   - Two overlapping cron runs claim ONE row per subscription per cycle, so
 *     only one sends.
 *   - The claim stores the exact provider request (its payload) with its
 *     idempotency key. A retry of a settled failure REPLAYS that request byte
 *     for byte under the same key (Resend keeps a key 24 hours and answers a
 *     same-key, same-payload repeat with the first result, sending nothing);
 *     after the replay window it sends its own new render under a new key.
 *   - An attempt still in flight ('sending'), including one whose answer never
 *     came (UNKNOWN), is never taken over and counts as delivered.
 *   - A held row at a send key is unexpected (holds use their own keys); it is
 *     taken over (nothing went out under it) and the caller is told, to page.
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
  message_id?: string | null
  html?: string | null
  payload?: unknown
  [k: string]: unknown
}

type EventRow = { email_key: string; event: string; message_id: string | null; occurred_at: string }

const h = vi.hoisted(() => ({ rows: [] as Row[], events: [] as EventRow[], nextId: 1 }))

/** A PostgREST-ish condition: col.op.value, with eq, neq, is.null, like and not.like (`*` wildcard). */
function cond(expr: string): (r: Record<string, unknown>) => boolean {
  const m = /^([a-z_]+)\.(not\.like|like|eq|neq|is)\.(.+)$/.exec(expr)
  if (!m) throw new Error(`unsupported condition ${expr}`)
  const [, col, op, raw] = m
  const likeRe = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`)
  return (r) => {
    const v = r[col!]
    if (op === 'is') return raw === 'null' ? v == null : v === raw
    if (op === 'eq') return v === raw
    if (op === 'neq') return v != null && v !== raw
    if (op === 'like') return typeof v === 'string' && likeRe(raw!).test(v)
    return v != null && typeof v === 'string' && !likeRe(raw!).test(v)
  }
}

/** A filter chain over one table: eq / in / is / like / or, then a terminal. */
function query(table: 'crm_report_sends' | 'email_events') {
  const preds: Array<(r: Record<string, unknown>) => boolean> = []
  let mode: 'select' | 'update' = 'select'
  let patch: Record<string, unknown> = {}
  const rows = () => (table === 'crm_report_sends' ? (h.rows as Record<string, unknown>[]) : (h.events as unknown as Record<string, unknown>[]))
  const matches = () => rows().filter((r) => preds.every((p) => p(r)))
  const q = {
    select: () => q,
    update: (p: Record<string, unknown>) => {
      mode = 'update'
      patch = p
      return q
    },
    eq: (col: string, v: unknown) => (preds.push((r) => r[col] === v), q),
    is: (col: string, v: unknown) => (preds.push((r) => (v === null ? r[col] == null : r[col] === v)), q),
    in: (col: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[col])), q),
    not: (col: string, op: string, v: unknown) => (preds.push((r) => !(op === 'is' && v === null ? r[col] == null : r[col] === v)), q),
    like: (col: string, pattern: string) => (preds.push(cond(`${col}.like.${pattern}`)), q),
    or: (expr: string) => {
      const parts = expr.split(',').map(cond)
      preds.push((r) => parts.some((p) => p(r)))
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
    from: (table: 'crm_report_sends' | 'email_events') => ({
      ...query(table),
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
  claimInFlightRecovery,
  claimMarketReportSend,
  getLatestDeliveredReport,
  getLatestDeliveredReportAt,
  getMarketReportSentEvidence,
  inFlightAbandoned,
  isInFlightSend,
  isSettledFailure,
  latestDeliveredAt,
  latestDelivery,
  markMarketReportSendUnknown,
  REPLAY_WINDOW_MS,
  SEND_CLAIM_MARK,
  settleMarketReportSend,
  type ReportSendPayload,
} from './marketReportSends'

const KEY = 'market-report:scheduled:9016:first'

function payload(html: string, builtAt: string): ReportSendPayload {
  return {
    v: 1,
    idempotencyKey: `${KEY}:${html.length}`,
    builtAt,
    request: { from: 'Matt', to: 'cheryl@example.com', replyTo: 'matt@ryan-realty.com', subject: 'Bend', html, text: 'x', headers: {} },
  }
}

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
    payload: payload(`<p>tracked ${attemptedAt}</p>`, attemptedAt),
  }
}

beforeEach(() => {
  h.rows = []
  h.events = []
  h.nextId = 1
})

describe('claimMarketReportSend', () => {
  it('two overlapping runs claim the same cycle key: the first claims, the second does not', async () => {
    const a = await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    const b = await claimMarketReportSend(claimRow('2026-09-30T16:00:02Z'))
    expect(a).toEqual({ ok: true, claimed: true, takeover: false, from: null, replay: null })
    expect(b).toMatchObject({ ok: true, claimed: false, existing: { status: 'failed', error: SEND_CLAIM_MARK } })
    expect(h.rows).toHaveLength(1)
    // The in-flight row keeps the first attempt's copy AND its exact request.
    expect(h.rows[0]!.html).toBe('<p>2026-09-30T16:00:01Z</p>')
    expect(h.rows[0]!.payload).toEqual(payload('<p>tracked 2026-09-30T16:00:01Z</p>', '2026-09-30T16:00:01Z'))
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

  it('a retry inside the replay window takes over a SETTLED failure and replays the stored request, keeping the stored copy', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    Object.assign(h.rows[0]!, { status: 'failed', error: 'Resend 500' })
    const retry = await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'), new Date('2026-09-30T22:00:00Z'))
    expect(retry).toEqual({
      ok: true,
      claimed: true,
      takeover: true,
      from: 'failed',
      replay: payload('<p>tracked 2026-09-30T16:00:01Z</p>', '2026-09-30T16:00:01Z'),
    })
    // In flight again, with the FIRST attempt's copy and request (the ones it replays).
    expect(h.rows[0]).toMatchObject({ status: 'failed', error: SEND_CLAIM_MARK, attempted_at: '2026-09-30T22:00:00Z', html: '<p>2026-09-30T16:00:01Z</p>' })
    expect(h.rows[0]!.payload).toEqual(payload('<p>tracked 2026-09-30T16:00:01Z</p>', '2026-09-30T16:00:01Z'))
    // And only one retry takes it.
    const second = await claimMarketReportSend(claimRow('2026-09-30T22:00:05Z'), new Date('2026-09-30T22:00:05Z'))
    expect(second).toMatchObject({ ok: true, claimed: false, existing: { error: SEND_CLAIM_MARK } })
  })

  it('past the replay window a retry sends its own new render under its own key', async () => {
    await claimMarketReportSend(claimRow('2026-09-29T16:00:01Z'))
    Object.assign(h.rows[0]!, { status: 'failed', error: 'Resend 500' })
    const later = new Date(Date.parse('2026-09-29T16:00:01Z') + REPLAY_WINDOW_MS + 60_000)
    const retry = await claimMarketReportSend(claimRow(later.toISOString()), later)
    expect(retry).toEqual({ ok: true, claimed: true, takeover: true, from: 'failed', replay: null })
    expect(h.rows[0]!.html).toBe(`<p>${later.toISOString()}</p>`)
    expect(h.rows[0]!.payload).toEqual(payload(`<p>tracked ${later.toISOString()}</p>`, later.toISOString()))
  })

  it('a held row at a send key is unexpected: nothing went out under it, so it is taken over, flagged for a page', async () => {
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
    const out = await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'), new Date('2026-09-30T22:00:00Z'))
    expect(out).toMatchObject({ ok: true, claimed: true, takeover: true, from: 'held' })
    expect(h.rows[0]).toMatchObject({ status: 'failed', error: SEND_CLAIM_MARK, hold_reason: null })
  })

  it('an attempt whose answer never came stays in flight: never taken over', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    expect(await markMarketReportSendUnknown(KEY, 'Unable to fetch data')).toEqual({ ok: true })
    expect(isInFlightSend(h.rows[0]! as never)).toBe(true)
    expect(h.rows[0]!.error).toContain('Unable to fetch data')
    const retry = await claimMarketReportSend(claimRow('2026-09-30T22:00:00Z'), new Date('2026-09-30T22:00:00Z'))
    expect(retry).toMatchObject({ ok: true, claimed: false, existing: { status: 'failed' } })
  })
})

describe('settling never overwrites a delivery', () => {
  it('a failure or an unknown answer lands only on a row still in flight', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    await settleMarketReportSend(KEY, { status: 'sent', messageId: 'msg-1', sentAt: '2026-09-30T16:00:03Z' })
    await settleMarketReportSend(KEY, { status: 'failed', error: 'Resend 500' })
    await markMarketReportSendUnknown(KEY, 'lost')
    expect(h.rows[0]).toMatchObject({ status: 'sent', message_id: 'msg-1', error: null })
  })
})

describe('recovering an abandoned in-flight attempt', () => {
  it('only one of two runs wins the recovery of the same attempt', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    const [a, b] = await Promise.all([
      claimInFlightRecovery(KEY, '2026-09-30T16:00:01Z', '2026-09-30T22:00:00Z'),
      claimInFlightRecovery(KEY, '2026-09-30T16:00:01Z', '2026-09-30T22:00:01Z'),
    ])
    expect([a, b].filter(Boolean)).toHaveLength(1)
  })

  it('reads the provider message id the send recorded as evidence', async () => {
    h.events.push({ email_key: KEY, event: 'sent', message_id: 'msg-7', occurred_at: '2026-09-30T16:00:04Z' })
    h.events.push({ email_key: 'other', event: 'sent', message_id: 'msg-8', occurred_at: '2026-09-30T16:00:05Z' })
    expect(await getMarketReportSentEvidence(KEY)).toEqual({ messageId: 'msg-7', at: '2026-09-30T16:00:04Z' })
    expect(await getMarketReportSentEvidence('none')).toBeNull()
  })
})

describe('in flight counts as delivered', () => {
  it('isInFlightSend / isSettledFailure', () => {
    expect(isInFlightSend({ status: 'failed', error: SEND_CLAIM_MARK })).toBe(true)
    expect(isInFlightSend({ status: 'failed', error: `${SEND_CLAIM_MARK} (unknown outcome: lost)` })).toBe(true)
    expect(isSettledFailure({ status: 'failed', error: SEND_CLAIM_MARK })).toBe(false)
    expect(isSettledFailure({ status: 'failed', error: 'Resend 500' })).toBe(true)
    expect(isSettledFailure({ status: 'failed', error: null })).toBe(true)
    expect(isInFlightSend({ status: 'sent', error: null })).toBe(false)
  })

  it('latestDeliveredAt counts sent rows and in-flight rows, never previews, failures or holds', () => {
    expect(
      latestDeliveredAt([
        { emailKey: 'a', kind: 'scheduled', status: 'sent', error: null, sentAt: '2026-08-30T16:00:05Z', attemptedAt: '2026-08-30T16:00:00Z' },
        { emailKey: 'b', kind: 'scheduled', status: 'failed', error: SEND_CLAIM_MARK, sentAt: null, attemptedAt: '2026-09-30T16:00:00Z' },
        { emailKey: 'c', kind: 'scheduled', status: 'failed', error: 'Resend 500', sentAt: null, attemptedAt: '2026-10-01T16:00:00Z' },
        { emailKey: 'd', kind: 'preview', status: 'sent', error: null, sentAt: '2026-10-02T16:00:00Z', attemptedAt: '2026-10-02T16:00:00Z' },
        { emailKey: 'e', kind: 'scheduled', status: 'held', error: 'x', sentAt: null, attemptedAt: '2026-10-03T16:00:00Z' },
      ]),
    ).toBe('2026-09-30T16:00:00Z')
    expect(latestDeliveredAt([])).toBeNull()
  })

  it('getLatestDeliveredReportAt sees an in-flight attempt the cadence backstop must not repeat', async () => {
    await claimMarketReportSend(claimRow('2026-09-30T16:00:01Z'))
    expect(await getLatestDeliveredReportAt(64138)).toBe('2026-09-30T16:00:01Z')
    expect(await getLatestDeliveredReport(64138)).toEqual({ at: '2026-09-30T16:00:01Z', inFlight: true, emailKey: KEY })
  })

  it('latestDelivery flags an in-flight delivery and names its key; an attempt is abandoned only after the settle window', () => {
    expect(
      latestDelivery([{ emailKey: 'm1', kind: 'manual', status: 'sent', error: null, sentAt: '2026-09-30T16:00:05Z', attemptedAt: '2026-09-30T16:00:00Z' }]),
    ).toEqual({ at: '2026-09-30T16:00:05Z', inFlight: false, emailKey: 'm1' })
    const now = new Date('2026-09-30T16:20:00Z')
    expect(inFlightAbandoned('2026-09-30T16:19:00Z', now)).toBe(false)
    expect(inFlightAbandoned('2026-09-30T16:00:00Z', now)).toBe(true)
  })
})
