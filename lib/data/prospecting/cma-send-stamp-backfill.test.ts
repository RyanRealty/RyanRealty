import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The prospect-stamp backfill: the planning rules (pure), the guarded write, and
 * the read composer end to end against a scripted database. The rules under
 * test are the ones the header of cma-send-stamp-backfill.ts states.
 */

type Filter = [op: string, col: string, value: unknown]
type Recorded = {
  table: string
  op: 'select' | 'update'
  columns: string
  filters: Filter[]
  patch: Record<string, unknown> | null
}
type Reply = { data: unknown; error: { message: string } | null }

const h = vi.hoisted(() => ({
  recorded: [] as Array<{
    table: string
    op: 'select' | 'update'
    columns: string
    filters: Array<[string, string, unknown]>
    patch: Record<string, unknown> | null
  }>,
  respond: null as null | ((r: {
    table: string
    op: 'select' | 'update'
    columns: string
    filters: Array<[string, string, unknown]>
    patch: Record<string, unknown> | null
  }) => { data: unknown; error: { message: string } | null }),
  resolveProspect: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const rec: Recorded = { table, op: 'select', columns: '', filters: [], patch: null }
      const finish = () => {
        h.recorded.push(rec)
        return Promise.resolve(h.respond!(rec))
      }
      const q = {
        select(cols?: string) {
          if (cols) rec.columns = cols
          return q
        },
        update(patch: Record<string, unknown>) {
          rec.op = 'update'
          rec.patch = patch
          return q
        },
        eq(col: string, v: unknown) {
          rec.filters.push(['eq', col, v])
          return q
        },
        is(col: string, v: unknown) {
          rec.filters.push(['is', col, v])
          return q
        },
        in(col: string, v: unknown) {
          rec.filters.push(['in', col, v])
          return q
        },
        not(col: string, op: string, v: unknown) {
          rec.filters.push(['not', col, [op, v]])
          return q
        },
        order() {
          return q
        },
        range() {
          return q
        },
        maybeSingle() {
          return finish()
        },
        then(resolve: (v: Reply) => unknown, reject: (e: unknown) => unknown) {
          return finish().then(resolve, reject)
        },
      }
      return q
    },
  }),
}))

vi.mock('@/lib/data/prospecting/cma-send-prospect', () => ({
  resolveProspectForCmaSend: (...a: unknown[]) => h.resolveProspect(...a),
}))

import {
  applyCmaSendProspectStamp,
  buildStampPlan,
  planCmaSendProspectStampBackfill,
  prospectRowKey,
  type DeliveredCma,
  type ProspectEmailState,
} from '@/lib/data/prospecting/cma-send-stamp-backfill'
import type { CmaSendProspect } from '@/lib/data/prospecting/cma-send-prospect'

const NEVER: ProspectEmailState = {
  emailSentAt: null,
  emailStatus: null,
  messageId: null,
  crmPersonId: null,
  contactEmail: 'owner@example.com',
}

function cma(over: Partial<DeliveredCma> = {}): DeliveredCma {
  return {
    id: 'id-1',
    slug: 'cma-1-main',
    status: 'delivered',
    clientEmail: 'owner@example.com',
    deliveredAt: '2026-09-28T19:46:48.495+00:00',
    personId: 64201,
    ...over,
  }
}
const LK: CmaSendProspect = { kind: 'expired', id: 'LK-1', via: 'cma_id' }

function plan(over: {
  delivered: DeliveredCma[]
  prospects?: Array<[string, CmaSendProspect | null]>
  states?: Array<[string, ProspectEmailState | null]>
  sentEvents?: Array<[string, Array<{ messageId: string | null; recipientEmail: string; occurredAt: string }>]>
}) {
  return buildStampPlan({
    delivered: over.delivered,
    prospects: new Map(over.prospects ?? []),
    states: new Map(over.states ?? []),
    sentEvents: new Map(over.sentEvents ?? []),
  })
}

describe('buildStampPlan', () => {
  it('stamps the owner with the CMA delivered_at (the historical time), status sent, the event message id and the CMA person', () => {
    const { stamps, skipped } = plan({
      delivered: [cma()],
      prospects: [['cma-1-main', LK]],
      states: [[prospectRowKey(LK), NEVER]],
      sentEvents: [
        ['cma-1-main', [{ messageId: '1a0e98e3d3b9435d', recipientEmail: 'owner@example.com', occurredAt: '2026-09-28T19:46:48.495+00:00' }]],
      ],
    })
    expect(skipped).toEqual([])
    expect(stamps).toHaveLength(1)
    expect(stamps[0]!.patch).toEqual({
      outreach_email_sent_at: '2026-09-28T19:46:48.495+00:00',
      outreach_email_status: 'sent',
      outreach_email_message_id: '1a0e98e3d3b9435d',
      outreach_crm_person_id: 64201,
    })
    expect(stamps[0]!.prospect).toEqual(LK)
  })

  it('reports, without changing the plan, whether the recipient is the owner email on the prospect row', () => {
    const run = (contactEmail: string | null, clientEmail = 'Owner@Example.com') =>
      plan({
        delivered: [cma({ clientEmail })],
        prospects: [['cma-1-main', LK]],
        states: [[prospectRowKey(LK), { ...NEVER, contactEmail }]],
      }).stamps
    expect(run('owner@example.com')[0]!.recipientMatchesProspect).toBe(true)
    expect(run('someone.else@example.com')[0]!.recipientMatchesProspect).toBe(false)
    expect(run(null)[0]!.recipientMatchesProspect).toBeNull()
    // A mismatch is information for the reviewer, never a reason to drop the stamp.
    expect(run('someone.else@example.com')).toHaveLength(1)
  })

  it('leaves the message id out when no email_events sent row carries one', () => {
    const { stamps } = plan({
      delivered: [cma()],
      prospects: [['cma-1-main', LK]],
      states: [[prospectRowKey(LK), NEVER]],
      sentEvents: [['cma-1-main', [{ messageId: null, recipientEmail: 'owner@example.com', occurredAt: '2026-09-28T19:46:48.495+00:00' }]]],
    })
    expect(stamps[0]!.patch).not.toHaveProperty('outreach_email_message_id')
    expect(stamps[0]!.sentEvent).toBeNull()
  })

  it('does not overwrite a message id or a CRM person the prospect row already has', () => {
    const { stamps } = plan({
      delivered: [cma()],
      prospects: [['cma-1-main', LK]],
      states: [[prospectRowKey(LK), { ...NEVER, messageId: 'already-there', crmPersonId: 7 }]],
      sentEvents: [['cma-1-main', [{ messageId: 'from-events', recipientEmail: 'owner@example.com', occurredAt: '2026-09-28T19:46:48.495+00:00' }]]],
    })
    expect(stamps[0]!.patch).toEqual({
      outreach_email_sent_at: '2026-09-28T19:46:48.495+00:00',
      outreach_email_status: 'sent',
    })
  })

  it('leaves the CRM person out when the CMA has none', () => {
    const { stamps } = plan({
      delivered: [cma({ personId: null })],
      prospects: [['cma-1-main', LK]],
      states: [[prospectRowKey(LK), NEVER]],
    })
    expect(stamps[0]!.patch).not.toHaveProperty('outreach_crm_person_id')
  })

  it('picks the sent event nearest delivered_at when the CMA was sent more than once', () => {
    const { stamps } = plan({
      delivered: [cma({ deliveredAt: '2026-09-28T19:46:48.495+00:00' })],
      prospects: [['cma-1-main', LK]],
      states: [[prospectRowKey(LK), NEVER]],
      sentEvents: [
        [
          'cma-1-main',
          [
            { messageId: 'early', recipientEmail: 'owner@example.com', occurredAt: '2026-09-20T10:00:00.000+00:00' },
            { messageId: 'nearest', recipientEmail: 'owner@example.com', occurredAt: '2026-09-28T19:46:48.495+00:00' },
            { messageId: 'later', recipientEmail: 'owner@example.com', occurredAt: '2026-09-29T08:00:00.000+00:00' },
          ],
        ],
      ],
    })
    expect(stamps[0]!.patch.outreach_email_message_id).toBe('nearest')
    expect(stamps[0]!.sentEventCount).toBe(3)
  })

  it('skips an internal recipient: a test send never marks a real owner as emailed', () => {
    const { stamps, skipped } = plan({
      delivered: [
        cma({ slug: 'a', clientEmail: 'matt@ryan-realty.com' }),
        cma({ slug: 'b', clientEmail: 'marketing+dana@ryan-realty.com' }),
      ],
      prospects: [
        ['a', LK],
        ['b', LK],
      ],
      states: [[prospectRowKey(LK), NEVER]],
    })
    expect(stamps).toEqual([])
    expect(skipped.map((s) => [s.slug, s.reason])).toEqual([
      ['a', 'internal-recipient'],
      ['b', 'internal-recipient'],
    ])
  })

  it('skips a CMA with no recipient, no prospect row, or a row that already has a send stamp', () => {
    const { stamps, skipped } = plan({
      delivered: [
        cma({ slug: 'no-email', clientEmail: null, deliveredAt: '2026-09-01T00:00:00Z' }),
        cma({ slug: 'no-row', deliveredAt: '2026-09-02T00:00:00Z' }),
        cma({ slug: 'stamped', deliveredAt: '2026-09-03T00:00:00Z' }),
        cma({ slug: 'gone', deliveredAt: '2026-09-04T00:00:00Z' }),
      ],
      prospects: [
        ['no-row', null],
        ['stamped', { kind: 'expired', id: 'LK-S', via: 'cma_id' }],
        ['gone', { kind: 'fsbo', id: 'https://x', via: 'cma_id' }],
      ],
      states: [
        [prospectRowKey({ kind: 'expired', id: 'LK-S' }), { ...NEVER, emailSentAt: '2026-09-03T12:00:00+00:00', emailStatus: 'sent' }],
        [prospectRowKey({ kind: 'fsbo', id: 'https://x' }), null],
      ],
    })
    expect(stamps).toEqual([])
    expect(skipped.map((s) => [s.slug, s.reason])).toEqual([
      ['no-email', 'no-recipient'],
      ['no-row', 'no-prospect-row'],
      ['stamped', 'already-stamped'],
      ['gone', 'prospect-row-missing'],
    ])
  })

  it('stamps one prospect row once, from the earlier delivery, when two delivered CMAs resolve to it', () => {
    const orphan: CmaSendProspect = { kind: 'expired', id: 'LK-1', via: 'listing_key' }
    const { stamps, skipped } = plan({
      delivered: [
        cma({ slug: 'later-orphan', deliveredAt: '2026-09-28T22:00:00+00:00', personId: 2 }),
        cma({ slug: 'first-linked', deliveredAt: '2026-09-28T19:00:00+00:00', personId: 1 }),
      ],
      prospects: [
        ['later-orphan', orphan],
        ['first-linked', LK],
      ],
      states: [[prospectRowKey(LK), NEVER]],
    })
    expect(stamps.map((s) => s.cma.slug)).toEqual(['first-linked'])
    expect(stamps[0]!.patch.outreach_email_sent_at).toBe('2026-09-28T19:00:00+00:00')
    expect(skipped).toEqual([
      expect.objectContaining({ slug: 'later-orphan', reason: 'superseded-by-earlier-delivery' }),
    ])
  })
})

describe('applyCmaSendProspectStamp', () => {
  beforeEach(() => {
    h.recorded.length = 0
  })

  const patch = {
    outreach_email_sent_at: '2026-09-28T19:46:48.495+00:00',
    outreach_email_status: 'sent' as const,
    outreach_email_message_id: 'msg-1',
  }

  it('writes an expired owner by listing_key, guarded by outreach_email_sent_at IS NULL', async () => {
    h.respond = () => ({ data: [{ listing_key: 'LK-1' }], error: null })
    const res = await applyCmaSendProspectStamp({ prospect: { kind: 'expired', id: 'LK-1', via: 'cma_id' }, patch })
    expect(res).toEqual({ ok: true, updated: true })
    expect(h.recorded).toHaveLength(1)
    expect(h.recorded[0]).toMatchObject({ table: 'expired_listings', op: 'update', patch })
    expect(h.recorded[0]!.filters).toEqual([
      ['eq', 'listing_key', 'LK-1'],
      ['is', 'outreach_email_sent_at', null],
    ])
  })

  it('writes an FSBO owner by fsbo_url with the same guard', async () => {
    h.respond = () => ({ data: [{ fsbo_url: 'https://fsbo.example.com/1' }], error: null })
    await applyCmaSendProspectStamp({ prospect: { kind: 'fsbo', id: 'https://fsbo.example.com/1', via: 'cma_id' }, patch })
    expect(h.recorded[0]).toMatchObject({ table: 'fsbo_listings', op: 'update' })
    expect(h.recorded[0]!.filters).toEqual([
      ['eq', 'fsbo_url', 'https://fsbo.example.com/1'],
      ['is', 'outreach_email_sent_at', null],
    ])
  })

  it('reports updated:false when the guard matched nothing (a real send stamped it first)', async () => {
    h.respond = () => ({ data: [], error: null })
    await expect(
      applyCmaSendProspectStamp({ prospect: { kind: 'expired', id: 'LK-1', via: 'cma_id' }, patch }),
    ).resolves.toEqual({ ok: true, updated: false })
  })

  it('returns the database error instead of throwing', async () => {
    h.respond = () => ({ data: null, error: { message: 'permission denied' } })
    await expect(
      applyCmaSendProspectStamp({ prospect: { kind: 'expired', id: 'LK-1', via: 'cma_id' }, patch }),
    ).resolves.toEqual({ ok: false, error: 'permission denied' })
  })
})

describe('planCmaSendProspectStampBackfill', () => {
  beforeEach(() => {
    h.recorded.length = 0
    h.resolveProspect.mockReset()
  })

  it('reads the tables, resolves only external recipients, and never writes', async () => {
    const delivered = [
      { id: 'c1', slug: 'cma-owner', status: 'delivered', client_email: 'Owner@Example.com', delivered_at: '2026-09-28T19:46:48.495+00:00', person_id: 64201 },
      { id: 'c2', slug: 'cma-test', status: 'delivered', client_email: 'marketing+dana@ryan-realty.com', delivered_at: '2026-09-09T18:45:29.987+00:00', person_id: 63427 },
      { id: 'c3', slug: 'cma-blank', status: 'delivered', client_email: null, delivered_at: '2026-07-10T13:58:55.172+00:00', person_id: null },
    ]
    h.resolveProspect.mockImplementation(async (slug: string) =>
      slug === 'cma-owner' ? { kind: 'expired', id: 'LK-OWNER', via: 'cma_id' } : null,
    )
    h.respond = (r) => {
      if (r.table === 'cmas') return { data: delivered, error: null }
      if (r.table === 'expired_listings') {
        return {
          data: {
            outreach_email_sent_at: null,
            outreach_email_status: null,
            outreach_email_message_id: null,
            outreach_crm_person_id: null,
            contact_email: 'owner@example.com',
          },
          error: null,
        }
      }
      if (r.table === 'email_events') {
        return {
          data: [
            { email_key: 'cma:cma-owner', message_id: '1a0e98e3d3b9435d', recipient_email: 'owner@example.com', occurred_at: '2026-09-28T19:46:48.495+00:00' },
          ],
          error: null,
        }
      }
      throw new Error(`unscripted read: ${r.table}`)
    }

    const result = await planCmaSendProspectStampBackfill()

    expect(result.delivered).toBe(3)
    expect(result.stamps).toHaveLength(1)
    expect(result.stamps[0]!.patch).toEqual({
      outreach_email_sent_at: '2026-09-28T19:46:48.495+00:00',
      outreach_email_status: 'sent',
      outreach_email_message_id: '1a0e98e3d3b9435d',
      outreach_crm_person_id: 64201,
    })
    expect(result.skipped.map((s) => [s.slug, s.reason]).sort()).toEqual([
      ['cma-blank', 'no-recipient'],
      ['cma-test', 'internal-recipient'],
    ])
    // Only the external recipient reached the resolver.
    expect(h.resolveProspect.mock.calls.map((c) => c[0])).toEqual(['cma-owner'])
    // Read-only: no update was ever issued.
    expect(h.recorded.some((r) => r.op === 'update')).toBe(false)
    // The sent-events read is scoped to the CMA that could be stamped.
    const events = h.recorded.find((r) => r.table === 'email_events')!
    expect(events.filters).toContainEqual(['in', 'email_key', ['cma:cma-owner']])
    expect(events.filters).toContainEqual(['eq', 'event', 'sent'])
  })

  it('throws when a read fails, instead of planning from partial data', async () => {
    h.respond = () => ({ data: null, error: { message: 'timeout' } })
    await expect(planCmaSendProspectStampBackfill()).rejects.toThrow(/cmas delivered read failed: timeout/)
  })
})
