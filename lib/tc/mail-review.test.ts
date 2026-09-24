import { describe, expect, it, vi } from 'vitest'
import type { gmail_v1 } from 'googleapis'
import type { DealFacts, MailDecision } from './mail-rules'

// fileOntoDeal (lib/tc/file-comms-write.ts) reaches its own Supabase client
// with createServiceClient() rather than taking the sb this file's fake
// passes around, and has its own test coverage elsewhere. Stubbing it here
// keeps this suite about mail-index.ts's own logic — deciding, indexing and
// writing the review row — without touching a real or fake document store.
vi.mock('@/lib/tc/file-comms-write', () => ({
  fileOntoDeal: vi.fn(async (input: { dealId: string; cycleId: string }) => ({
    filed: true,
    dealId: input.dealId,
    cycleId: input.cycleId,
    documentIds: [],
    checklistItemIds: [],
    documentBySource: {},
  })),
}))

import { indexGmailMessage, reviewMailbox, reviewReasonFor, reviewStageFor, type IndexResult, type MailUniverse } from './mail-index'

// ── a generic, self-recording fake Supabase chain ──────────────────────────
// Every builder method returns the same chain object so any call sequence
// this codebase actually uses (select/eq/in/contains/order/limit/maybeSingle/
// single/upsert/update/insert) works, and `await`-ing at any point resolves
// to whatever the last terminal call set. Reads default to "nothing on
// file" (empty array / null), which is what indexGmailMessage needs to take
// the "first time seeing this message" path.

type Call = { table: string; method: string; args: unknown[] }

/** Per-table override for what `.maybeSingle()` resolves to (default: no row). */
function fakeSb(maybeSingleByTable: Record<string, unknown> = {}) {
  const calls: Call[] = []
  const from = (table: string) => {
    let resolved: { data: unknown; error: unknown } = { data: [], error: null }
    const chain: Record<string, unknown> = {
      select: (...a: unknown[]) => (calls.push({ table, method: 'select', args: a }), chain),
      eq: (...a: unknown[]) => (calls.push({ table, method: 'eq', args: a }), chain),
      in: (...a: unknown[]) => (calls.push({ table, method: 'in', args: a }), chain),
      contains: (...a: unknown[]) => (calls.push({ table, method: 'contains', args: a }), chain),
      overlaps: (...a: unknown[]) => (calls.push({ table, method: 'overlaps', args: a }), (resolved = { data: [], error: null }), chain),
      order: (...a: unknown[]) => (calls.push({ table, method: 'order', args: a }), chain),
      limit: (...a: unknown[]) => (calls.push({ table, method: 'limit', args: a }), (resolved = { data: [], error: null }), chain),
      maybeSingle: () => (
        calls.push({ table, method: 'maybeSingle', args: [] }), (resolved = { data: maybeSingleByTable[table] ?? null, error: null }), chain
      ),
      single: () => (calls.push({ table, method: 'single', args: [] }), (resolved = { data: { id: 'row-1' }, error: null }), chain),
      upsert: (row: unknown, opts: unknown) => (calls.push({ table, method: 'upsert', args: [row, opts] }), (resolved = { data: null, error: null }), chain),
      update: (row: unknown) => (calls.push({ table, method: 'update', args: [row] }), (resolved = { data: null, error: null }), chain),
      insert: (row: unknown) => (calls.push({ table, method: 'insert', args: [row] }), (resolved = { data: null, error: null }), chain),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(resolved).then(resolve, reject),
    }
    return chain
  }
  return { sb: { from } as never, calls }
}

function reviewUpserts(calls: Call[]): Array<Record<string, unknown>> {
  return calls.filter((c) => c.table === 'tc_mail_reviews' && c.method === 'upsert').map((c) => c.args[0] as Record<string, unknown>)
}

function fakeMessage(opts: { id: string; threadId?: string; internalDateMs: number; headers: Record<string, string>; bodyText?: string }): gmail_v1.Schema$Message {
  return {
    id: opts.id,
    threadId: opts.threadId ?? `t-${opts.id}`,
    internalDate: String(opts.internalDateMs),
    snippet: (opts.bodyText ?? '').slice(0, 100),
    payload: {
      headers: Object.entries(opts.headers).map(([name, value]) => ({ name, value })),
      mimeType: 'text/plain',
      body: { data: Buffer.from(opts.bodyText ?? '', 'utf8').toString('base64url') },
    },
  }
}

function fakeGmail(msg: gmail_v1.Schema$Message): gmail_v1.Gmail {
  return {
    users: {
      messages: {
        get: vi.fn(async () => ({ data: msg })),
        attachments: { get: vi.fn(async () => ({ data: { data: '' } })) },
      },
    },
  } as unknown as gmail_v1.Gmail
}

const emptyUniverse: MailUniverse = { deals: [], listingSide: new Set(), sellerEmails: new Map() }

const dealWithEscrow: DealFacts = {
  dealId: 'deal-1',
  address: '2680 NW Nordic Ave',
  city: 'Bend',
  stage: 'pending',
  cycles: [
    {
      id: 'cycle-1',
      kind: 'sale',
      status: 'Pending',
      mlsNumber: null,
      escrowNumber: '25-123456',
      listingDate: null,
      acceptanceDate: '2026-09-01',
      closeDate: null,
      deadDate: null,
      createdAt: '2026-09-01',
    },
  ],
  partyEmails: [],
  contactEmails: [],
}

describe('indexGmailMessage → tc_mail_reviews', () => {
  it('writes a review row for bulk mail, no subject/body carried', async () => {
    const { sb, calls } = fakeSb()
    const meta = fakeMessage({
      id: 'a',
      internalDateMs: 1_700_000_000_000,
      headers: { From: 'newsletter@example.com', To: 'matt@ryan-realty.com', Subject: 'Weekly digest', 'List-Unsubscribe': '<mailto:x>' },
      bodyText: 'unsubscribe here',
    })
    const gmail = fakeGmail(meta)
    const r = await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'a', universe: emptyUniverse, meta, sb })
    expect(r.status).toBe('bulk')
    const [row] = reviewUpserts(calls)
    expect(row).toMatchObject({ mailbox: 'matt@ryan-realty.com', gmail_id: 'a', status: 'bulk', stage: 'rules', message_key: null, deal_id: null })
    expect(String(row.reason)).not.toContain('Weekly digest')
  })

  it('writes a review row for ordinary not_deal mail with no candidates and no deal address', async () => {
    const { sb, calls } = fakeSb()
    const meta = fakeMessage({
      id: 'b',
      internalDateMs: 1_700_000_000_000,
      headers: { From: 'friend@example.com', To: 'matt@ryan-realty.com', Subject: 'Lunch next week?' },
      bodyText: 'Are you free Tuesday?',
    })
    const gmail = fakeGmail(meta)
    const r = await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'b', universe: emptyUniverse, meta, sb })
    expect(r.status).toBe('not_deal')
    const [row] = reviewUpserts(calls)
    expect(row.status).toBe('not_deal')
    expect(row.message_key).toBeNull()
    expect(String(row.reason)).not.toContain('Lunch next week')
  })

  it('writes a filed review row carrying the message_key and deal_id', async () => {
    const { sb, calls } = fakeSb()
    const universe: MailUniverse = { deals: [dealWithEscrow], listingSide: new Set(), sellerEmails: new Map() }
    const meta = fakeMessage({
      id: 'c',
      internalDateMs: 1_700_000_000_000,
      headers: { From: 'title@westerntitle.com', To: 'matt@ryan-realty.com', Subject: 'Escrow 25-123456 opened — 2680 NW Nordic Ave' },
      bodyText: 'Escrow 25-123456 is now open on 2680 NW Nordic Ave.',
    })
    const gmail = fakeGmail(meta)
    const r = await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'c', universe, meta, sb })
    expect(r.status).toBe('filed')
    expect(r.dealId).toBe('deal-1')
    const [row] = reviewUpserts(calls)
    expect(row).toMatchObject({ status: 'filed', deal_id: 'deal-1', stage: 'rules' })
    expect(row.message_key).toEqual(r.messageKey)
    expect(String(row.reason)).toContain('2680 NW Nordic Ave')
  })

  it('writes an error review row when Gmail fails, with the system error as the reason', async () => {
    const { sb, calls } = fakeSb()
    const gmail = {
      users: { messages: { get: vi.fn(async () => { throw new Error('gmail: rate limited') }) } },
    } as unknown as gmail_v1.Gmail
    const r = await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'd', universe: emptyUniverse, sb })
    expect(r.status).toBe('error')
    const [row] = reviewUpserts(calls)
    expect(row.status).toBe('error')
    expect(String(row.reason)).toContain('rate limited')
  })

  it('never writes a review row on a dry run', async () => {
    const { sb, calls } = fakeSb()
    const meta = fakeMessage({ id: 'e', internalDateMs: 1_700_000_000_000, headers: { From: 'a@b.com', To: 'matt@ryan-realty.com', Subject: 'hi' }, bodyText: 'hi' })
    const gmail = fakeGmail(meta)
    await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'e', universe: emptyUniverse, meta, dryRun: true, sb })
    expect(reviewUpserts(calls)).toHaveLength(0)
  })

  it('never calls the model stage unless explicitly opted in, even on a leftover not_deal message', async () => {
    const { sb } = fakeSb()
    const meta = fakeMessage({
      id: 'f',
      internalDateMs: 1_700_000_000_000,
      headers: { From: 'a@b.com', To: 'matt@ryan-realty.com', Subject: 'inspection report' },
      bodyText: 'see attached inspection notes',
    })
    const gmail = fakeGmail(meta)
    // modelStage omitted (falsy) — if this reached out to xAI in a test run it
    // would throw for lack of an API key; the assertion is that it does not try.
    const r = await indexGmailMessage({ gmail, mailbox: 'matt@ryan-realty.com', brokerSlug: 'matt', gmailId: 'f', universe: emptyUniverse, meta, sb })
    expect(r.modelStage ?? null).toBeNull()
  })
})

describe('reviewReasonFor', () => {
  const deals: DealFacts[] = [dealWithEscrow]

  function decisionWith(reasons: string[], status: MailDecision['status'], dealId: string | null = null): MailDecision {
    return { status, dealId, cycleId: null, method: null, score: 0, category: 'general', direction: 'inbound', reasons, candidates: [], propertyHint: null }
  }

  it('takes only the LAST reason for a not_deal outcome, never an earlier subject-derived one', () => {
    const decision = decisionWith(['subject names 909 delaware, which is not the sender\'s deal', 'no deal evidence'], 'not_deal')
    const reason = reviewReasonFor({ status: 'not_deal', decision, deals })
    expect(reason).toBe('not_deal: no deal evidence')
    expect(reason).not.toContain('909 delaware')
  })

  it('does the same for a bulk outcome', () => {
    const decision = decisionWith(['bulk headers'], 'bulk')
    expect(reviewReasonFor({ status: 'bulk', decision, deals })).toBe('bulk: bulk headers')
  })

  it('names the deal address for a filed outcome', () => {
    const decision = decisionWith(['escrow number of one deal'], 'filed', 'deal-1')
    expect(reviewReasonFor({ status: 'filed', decision, deals })).toBe('filed: escrow number of one deal on 2680 NW Nordic Ave')
  })

  it('formats an error outcome from the caught message, not a decision', () => {
    expect(reviewReasonFor({ status: 'error', decision: null, error: 'boom', deals })).toBe('error: boom')
  })
})

describe('reviewStageFor', () => {
  it('reads "thread" only from the rules decision method', () => {
    const decision: MailDecision = { status: 'filed', dealId: 'd1', cycleId: null, method: 'thread', score: 0, category: 'general', direction: 'inbound', reasons: [], candidates: [], propertyHint: null }
    expect(reviewStageFor(decision, null)).toBe('thread')
  })

  it('reads "model" whenever the model stage ran, even if the method underneath happens to be null', () => {
    const decision: MailDecision = { status: 'filed', dealId: 'd1', cycleId: null, method: null, score: 0, category: 'general', direction: 'inbound', reasons: [], candidates: [], propertyHint: null }
    expect(reviewStageFor(decision, { confidence: 0.95, reason: 'r', filed: true })).toBe('model')
  })

  it('defaults to "rules"', () => {
    const decision: MailDecision = { status: 'filed', dealId: 'd1', cycleId: null, method: 'escrow', score: 0, category: 'general', direction: 'inbound', reasons: [], candidates: [], propertyHint: null }
    expect(reviewStageFor(decision, null)).toBe('rules')
  })
})

describe('reviewMailbox', () => {
  const mailbox = 'matt@ryan-realty.com'

  function fakeGmailList(pages: Array<Array<{ id: string }>>): gmail_v1.Gmail {
    const list = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
      const i = pageToken ? Number(pageToken) : 0
      return { data: { messages: pages[i] ?? [], nextPageToken: i + 1 < pages.length ? String(i + 1) : undefined } }
    })
    return { users: { messages: { list } } } as unknown as gmail_v1.Gmail
  }

  it('skips ids the ledger already holds and indexes only the rest', async () => {
    const { sb } = fakeSb()
    const index = vi.fn(async ({ gmailId }: { gmailId: string }) => ({ messageKey: `k:${gmailId}`, status: 'not_deal', stored: false, dealId: null, documents: 0, offerId: null, decision: null, subject: null } as IndexResult))
    const res = await reviewMailbox({
      mailbox,
      sb,
      gmailFor: () => fakeGmailList([[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]),
      indexed: async () => new Set(['b']),
      index: index as never,
      universe: { deals: [], listingSide: new Set(), sellerEmails: new Map() },
    })
    expect(index.mock.calls.map((c) => c[0].gmailId).sort()).toEqual(['a', 'c'])
    expect(res).toMatchObject({ listed: 3, skipped: 1, reviewed: 2, finished: true, complete: true })
  })

  it('stops at the deadline and does not mark the walk finished', async () => {
    let now = 1_000
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      const { sb } = fakeSb()
      const index = vi.fn(async ({ gmailId }: { gmailId: string }) => {
        now += 400
        return { messageKey: `k:${gmailId}`, status: 'not_deal', stored: false, dealId: null, documents: 0, offerId: null, decision: null, subject: null } as IndexResult
      })
      const res = await reviewMailbox({
        mailbox,
        deadline: 1_500,
        sb,
        gmailFor: () => fakeGmailList([[{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]]),
        indexed: async () => new Set(),
        index: index as never,
        universe: { deals: [], listingSide: new Set(), sellerEmails: new Map() },
      })
      expect(res.complete).toBe(false)
      expect(res.finished).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('resumes from a stored cursor instead of walking the mailbox from page 1', async () => {
    // page_token '1' means "already did page 0" — resuming must not re-list it.
    const { sb } = fakeSb({
      tc_mail_review_cursors: { page_token: '1', listed: 3, reviewed: 3, started_at: '2026-09-01T00:00:00Z', finished_at: null },
    })
    const index = vi.fn(
      async ({ gmailId }: { gmailId: string }) =>
        ({ messageKey: `k:${gmailId}`, status: 'not_deal', stored: false, dealId: null, documents: 0, offerId: null, decision: null, subject: null }) as IndexResult,
    )
    await reviewMailbox({
      mailbox,
      sb,
      gmailFor: () => fakeGmailList([[{ id: 'page0-a' }], [{ id: 'page1-a' }]]),
      indexed: async () => new Set(),
      index: index as never,
      universe: { deals: [], listingSide: new Set(), sellerEmails: new Map() },
    })
    // Resuming from page_token '1' means only page1's message was indexed — page0-a never comes back.
    expect(index.mock.calls.map((c) => c[0].gmailId)).toEqual(['page1-a'])
  })
})
