/**
 * The DAL half of the 2026-09-29 drip fix, pinned at the query level:
 *   - the busy guard reads claims newer than now - (maxDuration + 60 s);
 *   - the recovery reads claims older than now - (maxDuration + 5 min) that
 *     never stamped a message id or a sent time;
 *   - both recovery writes are fenced on the exact claim they examined, so a
 *     claim someone takes while Gmail is being checked is never touched.
 * A recording fake stands in for supabase-js; nothing reaches a database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = [string, ...unknown[]]
type Chain = { table: string; calls: Call[] }

const db = vi.hoisted(() => ({
  chains: [] as Array<{ table: string; calls: Array<[string, ...unknown[]]> }>,
  /** Result per table (or per `${table}:update`) for the awaited chain. */
  results: new Map<string, { data: unknown; error: { message: string } | null }>(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      const chain = { table, calls: [] as Array<[string, ...unknown[]]> }
      db.chains.push(chain)
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              const isUpdate = chain.calls.some((c) => c[0] === 'update')
              const r = db.results.get(isUpdate ? `${table}:update` : table) ?? { data: [], error: null }
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve(r).then(resolve, reject)
            }
            return (...args: unknown[]) => {
              chain.calls.push([String(prop), ...args])
              return builder
            }
          },
        },
      )
      return builder
    },
  }),
}))

import { findInFlightFirstTouchSend } from './drip-queue'
import {
  finalizeRecoveredFirstTouchSend,
  listEmailEventsSince,
  listStaleFirstTouchSends,
  STUCK_SEND_CANDIDATE_LIMIT,
  releaseStuckFirstTouchSend,
} from './stuck-send'

const NOW = new Date('2026-09-30T15:00:00.000Z')
const CLAIM = '2026-09-29T22:55:27.279426+00:00'
const QUEUED = '2026-09-29T22:53:48.909+00:00'

function chainFor(table: string): Chain {
  const c = db.chains.find((x) => x.table === table)
  if (!c) throw new Error(`no query on ${table}`)
  return c
}
const has = (c: Chain, ...call: Call) => expect(c.calls).toContainEqual(call)

beforeEach(() => {
  db.chains.length = 0
  db.results.clear()
})

describe('findInFlightFirstTouchSend — the busy guard read (B)', () => {
  it('reads sending claims newer than now - (maxDuration + 60 s) on both tables', async () => {
    await findInFlightFirstTouchSend(NOW)
    for (const table of ['expired_listings', 'fsbo_listings']) {
      const c = chainFor(table)
      has(c, 'eq', 'outreach_email_status', 'sending')
      has(c, 'gt', 'outreach_email_claim_at', '2026-09-30T14:54:00.000Z')
    }
  })

  it('returns the freshest claim across Expired and FSBO', async () => {
    db.results.set('expired_listings', { data: { listing_key: 'LK1', outreach_email_claim_at: '2026-09-30T14:58:00+00:00' }, error: null })
    db.results.set('fsbo_listings', { data: { fsbo_url: 'https://f/1', outreach_email_claim_at: '2026-09-30T14:59:00+00:00' }, error: null })
    expect(await findInFlightFirstTouchSend(NOW)).toEqual({
      kind: 'fsbo',
      id: 'https://f/1',
      claimAt: '2026-09-30T14:59:00+00:00',
    })
  })

  it('returns null when nothing is in flight, and throws on a read error', async () => {
    db.results.set('expired_listings', { data: null, error: null })
    db.results.set('fsbo_listings', { data: null, error: null })
    expect(await findInFlightFirstTouchSend(NOW)).toBeNull()
    db.results.set('fsbo_listings', { data: null, error: { message: 'timeout' } })
    await expect(findInFlightFirstTouchSend(NOW)).rejects.toThrow(/in-flight read \(fsbo\) failed: timeout/)
  })
})

describe('listStaleFirstTouchSends — the recovery read (D)', () => {
  it('reads sending claims older than now - (maxDuration + 5 min) with no message id and no sent time', async () => {
    await listStaleFirstTouchSends(NOW)
    for (const table of ['expired_listings', 'fsbo_listings']) {
      const c = chainFor(table)
      has(c, 'eq', 'outreach_email_status', 'sending')
      has(c, 'lt', 'outreach_email_claim_at', '2026-09-30T14:50:00.000Z')
      has(c, 'is', 'outreach_email_message_id', null)
      has(c, 'is', 'outreach_email_sent_at', null)
      has(c, 'order', 'outreach_email_claim_at', { ascending: true })
      has(c, 'limit', STUCK_SEND_CANDIDATE_LIMIT)
    }
  })

  it('merges both tables oldest first and keeps the claim stamp exactly as returned', async () => {
    db.results.set('expired_listings', {
      data: [
        {
          listing_key: '20260819192123649950000000',
          outreach_email_claim_at: CLAIM,
          outreach_email_queued_at: QUEUED,
          contact_email: 'owner@example.com',
          street_address: '3153 Cromwell',
        },
        { listing_key: 'NO-CLAIM', outreach_email_claim_at: null },
      ],
      error: null,
    })
    db.results.set('fsbo_listings', {
      data: [{ fsbo_url: 'https://f/1', outreach_email_claim_at: '2026-09-29T20:00:00+00:00', outreach_email_queued_at: null }],
      error: null,
    })
    expect(await listStaleFirstTouchSends(NOW)).toEqual([
      {
        kind: 'fsbo',
        id: 'https://f/1',
        claimAt: '2026-09-29T20:00:00+00:00',
        queuedAt: null,
        contactEmail: null,
        streetAddress: null,
      },
      {
        kind: 'expired',
        id: '20260819192123649950000000',
        claimAt: CLAIM,
        queuedAt: QUEUED,
        contactEmail: 'owner@example.com',
        streetAddress: '3153 Cromwell',
      },
    ])
  })

  it('throws on a read error so the drain fails closed', async () => {
    db.results.set('expired_listings', { data: null, error: { message: 'down' } })
    await expect(listStaleFirstTouchSends(NOW)).rejects.toThrow(/stuck sends read \(expired\) failed: down/)
  })
})

describe('the fenced writes (D)', () => {
  const FENCE: Call[] = [
    ['eq', 'outreach_email_status', 'sending'],
    ['eq', 'outreach_email_claim_at', CLAIM],
    ['is', 'outreach_email_message_id', null],
    ['is', 'outreach_email_sent_at', null],
  ]

  it('release puts a drip member back in the queue, only if it is still the same stuck claim', async () => {
    db.results.set('expired_listings:update', { data: [{ listing_key: 'LK' }], error: null })
    const wrote = await releaseStuckFirstTouchSend({ kind: 'expired', id: 'LK', claimAt: CLAIM, queuedAt: QUEUED })
    expect(wrote).toBe(true)
    const c = chainFor('expired_listings')
    has(c, 'update', { outreach_email_status: 'queued', outreach_email_claim_at: null })
    has(c, 'eq', 'listing_key', 'LK')
    for (const f of FENCE) has(c, ...f)
    has(c, 'eq', 'outreach_email_queued_at', QUEUED)
    has(c, 'select', 'listing_key')
  })

  it('release returns a never-queued manual claim to unsent', async () => {
    db.results.set('fsbo_listings:update', { data: [{ fsbo_url: 'https://f/1' }], error: null })
    await releaseStuckFirstTouchSend({ kind: 'fsbo', id: 'https://f/1', claimAt: CLAIM, queuedAt: null })
    const c = chainFor('fsbo_listings')
    has(c, 'update', { outreach_email_status: null, outreach_email_claim_at: null })
    has(c, 'eq', 'fsbo_url', 'https://f/1')
    has(c, 'is', 'outreach_email_queued_at', null)
    for (const f of FENCE) has(c, ...f)
  })

  it('release reports false when the row moved (someone re-claimed or settled it)', async () => {
    db.results.set('expired_listings:update', { data: [], error: null })
    expect(await releaseStuckFirstTouchSend({ kind: 'expired', id: 'LK', claimAt: CLAIM, queuedAt: QUEUED })).toBe(false)
  })

  it('finalize stamps the message id and the real send time, behind the same fence', async () => {
    db.results.set('expired_listings:update', { data: [{ listing_key: 'LK' }], error: null })
    const wrote = await finalizeRecoveredFirstTouchSend({
      kind: 'expired',
      id: 'LK',
      claimAt: CLAIM,
      messageId: 'g-1',
      sentAt: '2026-09-29T22:57:05.000Z',
      personId: 77,
    })
    expect(wrote).toBe(true)
    const c = chainFor('expired_listings')
    has(c, 'update', {
      outreach_email_status: 'sent',
      outreach_email_sent_at: '2026-09-29T22:57:05.000Z',
      outreach_email_message_id: 'g-1',
      outreach_crm_person_id: 77,
    })
    for (const f of FENCE) has(c, ...f)
  })

  it('finalize leaves the person link alone when none is known, and surfaces a write error', async () => {
    db.results.set('expired_listings:update', { data: [{ listing_key: 'LK' }], error: null })
    await finalizeRecoveredFirstTouchSend({ kind: 'expired', id: 'LK', claimAt: CLAIM, messageId: null, sentAt: 's', personId: null })
    has(chainFor('expired_listings'), 'update', {
      outreach_email_status: 'sent',
      outreach_email_sent_at: 's',
      outreach_email_message_id: null,
    })
    db.chains.length = 0
    db.results.set('expired_listings:update', { data: null, error: { message: 'conn reset' } })
    await expect(
      finalizeRecoveredFirstTouchSend({ kind: 'expired', id: 'LK', claimAt: CLAIM, messageId: 'g', sentAt: 's', personId: null }),
    ).rejects.toThrow(/finalize recovered send failed: conn reset/)
  })
})

describe('listEmailEventsSince', () => {
  it('reads by owner address and by the CMA key prefix, and dedupes rows', async () => {
    const row = {
      id: 9,
      event: 'sent',
      email_key: 'cma:cma-3153-cromwell',
      message_id: 'g-1',
      recipient_email: 'Owner@Example.com',
      person_id: 77,
      occurred_at: '2026-09-29T22:57:05+00:00',
    }
    db.results.set('email_events', { data: [row], error: null })
    const out = await listEmailEventsSince({
      recipients: ['Owner@Example.com', 'owner@example.com'],
      cmaBaseSlug: 'cma-3153-cromwell',
      sinceIso: '2026-09-29T22:54:27.279Z',
    })
    expect(out).toEqual([
      {
        id: 9,
        event: 'sent',
        emailKey: 'cma:cma-3153-cromwell',
        messageId: 'g-1',
        recipientEmail: 'owner@example.com',
        personId: 77,
        occurredAt: '2026-09-29T22:57:05+00:00',
      },
    ])
    const [byRecipient, byKey] = db.chains
    has(byRecipient!, 'in', 'recipient_email', ['owner@example.com'])
    has(byRecipient!, 'gte', 'occurred_at', '2026-09-29T22:54:27.279Z')
    has(byKey!, 'like', 'email_key', 'cma:cma-3153-cromwell%')
    has(byKey!, 'gte', 'occurred_at', '2026-09-29T22:54:27.279Z')
  })

  it('throws on a read error (a recovery that cannot read this proves nothing)', async () => {
    db.results.set('email_events', { data: null, error: { message: 'timeout' } })
    await expect(
      listEmailEventsSince({ recipients: ['o@example.com'], cmaBaseSlug: null, sinceIso: 'x' }),
    ).rejects.toThrow(/email_events read \(recipient\) failed: timeout/)
  })
})
