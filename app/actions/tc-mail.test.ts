/**
 * The mail correction actions: same auth/scope checks as the existing queue
 * actions (ctxForEdit / dealFor / own-mailbox), and the exact args they hand
 * to lib/tc/mail-refile.ts. The refile/document logic itself is covered by
 * lib/tc/mail-refile.test.ts — these tests mock that module and assert the
 * boundary: who may call this, and what deal/message it is allowed to touch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Ctx = { email: string; role: 'superuser' | 'broker'; brokerSlug: string | null }
let authResult: { ok: true; ctx: Ctx } | { ok: false; error: string; code: 'unauthenticated' | 'forbidden' }
const checkAdminAction = vi.fn((...args: unknown[]) => (void args, Promise.resolve(authResult)))
vi.mock('@/lib/admin/require-admin', () => ({
  checkAdminAction: (...args: unknown[]) => checkAdminAction(...args),
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

// tc-mail.ts's own writes (dismissQueuedMail, fileQueuedMail) go straight
// through createServiceClient — a tiny recording stub covers both.
const sbCalls: Array<{ table: string; method: string; args: unknown[] }> = []
function makeStubSb() {
  function chain(table: string) {
    const c: Record<string, unknown> = {}
    const rec = (name: string) =>
      (...args: unknown[]) => {
        sbCalls.push({ table, method: name, args })
        return c
      }
    c.select = rec('select')
    c.eq = rec('eq')
    c.in = rec('in')
    c.update = rec('update')
    c.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve)
    c.insert = (rows: unknown) => {
      sbCalls.push({ table, method: 'insert', args: [rows] })
      return Promise.resolve({ error: null })
    }
    return c
  }
  return { from: (table: string) => chain(table) }
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeStubSb(),
}))

const fileIndexedMessageToDeal = vi.fn()
const openInboundFile = vi.fn()
const sweepDealMail = vi.fn()
vi.mock('@/lib/tc/mail-index', () => ({
  fileIndexedMessageToDeal: (...a: unknown[]) => fileIndexedMessageToDeal(...a),
  openInboundFile: (...a: unknown[]) => openInboundFile(...a),
  sweepDealMail: (...a: unknown[]) => sweepDealMail(...a),
}))

const moveMailToDeal = vi.fn()
const unfileMailFromDeal = vi.fn()
const writePersonReview = vi.fn((...args: unknown[]) => (void args, Promise.resolve()))
vi.mock('@/lib/tc/mail-refile', () => ({
  moveMailToDeal: (...a: unknown[]) => moveMailToDeal(...a),
  unfileMailFromDeal: (...a: unknown[]) => unfileMailFromDeal(...a),
  writePersonReview: (...a: unknown[]) => writePersonReview(...a),
}))

type MessageRow = {
  id: string
  status: string
  gmail_refs: unknown
  subject: string | null
  deal_id: string | null
  message_key: string | null
  gmail_thread_ids: unknown
  sent_at: string | null
}
let messageRows: MessageRow[] = []
const getMailMessagesForAction = vi.fn((...args: unknown[]) => (void args, Promise.resolve(messageRows)))
type DealRow = { id: string; address: string; property_key: string; broker_name: string | null }
let dealRows: Record<string, DealRow | null> = {}
const getDealScopeRow = vi.fn((...args: unknown[]) => Promise.resolve(dealRows[String(args[0])] ?? null))
vi.mock('@/lib/data/tc/mail-reads', () => ({
  getMailMessagesForAction: (...a: unknown[]) => getMailMessagesForAction(...a),
  getDealScopeRow: (...a: unknown[]) => getDealScopeRow(...a),
}))

import { dismissQueuedMail, moveFiledMailToDeal, unfileDealMail } from '@/app/actions/tc-mail'

function msg(p: Partial<MessageRow> & { id: string }): MessageRow {
  return {
    status: 'filed',
    gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'g1' }],
    subject: 'Subject',
    deal_id: 'deal-a',
    message_key: 'rfc:1',
    gmail_thread_ids: ['t1'],
    sent_at: '2026-09-20T00:00:00Z',
    ...p,
  }
}

beforeEach(() => {
  authResult = { ok: true, ctx: { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' } }
  messageRows = []
  dealRows = {}
  sbCalls.length = 0
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('moveFiledMailToDeal', () => {
  it('refuses an unauthenticated caller without touching the refile lib', async () => {
    authResult = { ok: false, error: 'Admin sign-in required.', code: 'unauthenticated' }
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: false, error: 'Admin sign-in required.' })
    expect(moveMailToDeal).not.toHaveBeenCalled()
  })

  it('refuses a broker moving email from a mailbox that is not their own', async () => {
    authResult = { ok: true, ctx: { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' } }
    messageRows = [msg({ id: 'msg-1', gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'g1' }] })]
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: false, error: 'You can only file email from your own mailbox.' })
    expect(moveMailToDeal).not.toHaveBeenCalled()
  })

  it('refuses a message that is not filed to a deal', async () => {
    messageRows = [msg({ id: 'msg-1', deal_id: null })]
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: false, error: 'That email is not filed to a deal.' })
    expect(moveMailToDeal).not.toHaveBeenCalled()
  })

  it("refuses a destination deal the caller can't see", async () => {
    messageRows = [msg({ id: 'msg-1', deal_id: 'deal-a' })]
    dealRows = { 'deal-a': { id: 'deal-a', address: '1 Main St', property_key: 'k-a', broker_name: 'Matt Ryan' } }
    // deal-c is never in dealRows, so getDealScopeRow returns null.
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: false, error: 'Pick a file you can see.' })
    expect(moveMailToDeal).not.toHaveBeenCalled()
  })

  it('refuses a destination deal outside a restricted broker scope', async () => {
    authResult = { ok: true, ctx: { email: 'paul@ryan-realty.com', role: 'broker', brokerSlug: 'paul' } }
    messageRows = [msg({ id: 'msg-1', deal_id: 'deal-a', gmail_refs: [{ mailbox: 'paul@ryan-realty.com', gmail_id: 'g1' }] })]
    dealRows = {
      'deal-a': { id: 'deal-a', address: '1 Main St', property_key: 'k-a', broker_name: 'Paul Stevenson' },
      'deal-c': { id: 'deal-c', address: '3 Third St', property_key: 'k-c', broker_name: 'Matt Ryan' },
    }
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: false, error: 'Pick a file you can see.' })
    expect(moveMailToDeal).not.toHaveBeenCalled()
  })

  it('hands the refile lib the resolved from/to deals and actor', async () => {
    messageRows = [msg({ id: 'msg-1', deal_id: 'deal-a' })]
    dealRows = {
      'deal-a': { id: 'deal-a', address: '1 Main St', property_key: 'k-a', broker_name: 'Matt Ryan' },
      'deal-c': { id: 'deal-c', address: '3 Third St', property_key: 'k-c', broker_name: 'Matt Ryan' },
    }
    moveMailToDeal.mockResolvedValue({ ok: true, message: 'Moved to 3 Third St.', documentsMoved: 1, documentsFlagged: 0 })
    const res = await moveFiledMailToDeal({ messageId: 'msg-1', toDealId: 'deal-c' })
    expect(res).toEqual({ ok: true, message: 'Moved to 3 Third St.', dealKey: 'k-c' })
    expect(moveMailToDeal).toHaveBeenCalledWith({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-c',
      toAddress: '3 Third St',
      actor: 'matt@ryan-realty.com',
    })
  })
})

describe('unfileDealMail', () => {
  it('refuses a message that is not filed to a deal', async () => {
    messageRows = [msg({ id: 'msg-1', deal_id: null })]
    const res = await unfileDealMail({ messageId: 'msg-1' })
    expect(res).toEqual({ ok: false, error: 'That email is not filed to a deal.' })
    expect(unfileMailFromDeal).not.toHaveBeenCalled()
  })

  it('hands the refile lib the resolved deal and actor', async () => {
    messageRows = [msg({ id: 'msg-1', deal_id: 'deal-a' })]
    dealRows = { 'deal-a': { id: 'deal-a', address: '1 Main St', property_key: 'k-a', broker_name: 'Matt Ryan' } }
    unfileMailFromDeal.mockResolvedValue({ ok: true, message: 'Marked not a deal.', documentsMoved: 0, documentsFlagged: 0 })
    const res = await unfileDealMail({ messageId: 'msg-1' })
    expect(res).toEqual({ ok: true, message: 'Marked not a deal.' })
    expect(unfileMailFromDeal).toHaveBeenCalledWith({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      actor: 'matt@ryan-realty.com',
    })
  })
})

describe('dismissQueuedMail', () => {
  it('writes a tc_events row and a person tc_mail_reviews row per dismissed message', async () => {
    messageRows = [
      msg({ id: 'msg-1', deal_id: null, subject: 'Listing alert' }),
      msg({
        id: 'msg-2',
        deal_id: null,
        subject: 'Newsletter',
        message_key: 'rfc:2',
        gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'g2' }],
      }),
    ]
    const res = await dismissQueuedMail({ messageIds: ['msg-1', 'msg-2'] })
    expect(res).toEqual({ ok: true, message: 'Marked 2 emails as not a deal.' })

    const update = sbCalls.find((c) => c.table === 'tc_mail_messages' && c.method === 'update')
    expect(update?.args[0]).toMatchObject({ status: 'dismissed', decided_by: 'matt@ryan-realty.com' })

    const eventInsert = sbCalls.find((c) => c.table === 'tc_events' && c.method === 'insert')
    expect(eventInsert?.args[0]).toEqual([
      expect.objectContaining({ deal_id: null, action: 'mail_dismissed', detail: expect.objectContaining({ mail_message_id: 'msg-1' }) }),
      expect.objectContaining({ deal_id: null, action: 'mail_dismissed', detail: expect.objectContaining({ mail_message_id: 'msg-2' }) }),
    ])

    expect(writePersonReview).toHaveBeenCalledTimes(2)
    expect(writePersonReview).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dismissed', messageKey: 'rfc:1', dealId: null }),
    )
    expect(writePersonReview).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dismissed', messageKey: 'rfc:2', dealId: null }),
    )
  })
})
