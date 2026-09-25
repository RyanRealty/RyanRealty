/**
 * Correction domain logic: a document nobody has acted on moves with its
 * message (archived on the old file); one a person already put to work
 * (checklist, envelope, principal sign-off, client share) is left in place
 * and flagged, never deleted. Every correction writes a tc_events row and
 * (unfiling) a tc_mail_reviews row with stage 'person'.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const fileIndexedMessageToDeal = vi.fn()
vi.mock('@/lib/tc/mail-index', () => ({
  fileIndexedMessageToDeal: (...args: unknown[]) => fileIndexedMessageToDeal(...args),
}))

type Resp = { data?: unknown; error?: { message: string } | null }
type Handler = Resp | ((method: string, args: unknown[]) => Resp)

/** A minimal fake Supabase query builder: every chain method records the call and returns itself; `maybeSingle`/`insert`/`upsert` resolve, and awaiting the bare chain (no terminal call) resolves the same way `select().eq().limit()` would for a real client. */
function makeSb(byTable: Record<string, Handler>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  function resolveFor(table: string, method: string, args: unknown[]): Resp {
    const h = byTable[table]
    if (!h) return { data: null, error: null }
    return typeof h === 'function' ? h(method, args) : h
  }
  function chain(table: string) {
    let lastSelect: unknown[] = []
    const c: Record<string, unknown> = {}
    const record = (name: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method: name, args })
        if (name === 'select') lastSelect = args
        return c
      }
    c.select = record('select')
    c.eq = record('eq')
    c.in = record('in')
    c.limit = record('limit')
    c.order = record('order')
    c.update = record('update')
    c.maybeSingle = () => {
      calls.push({ table, method: 'maybeSingle', args: lastSelect })
      return Promise.resolve(resolveFor(table, 'maybeSingle', lastSelect))
    }
    c.insert = (rows: unknown) => {
      calls.push({ table, method: 'insert', args: [rows] })
      return Promise.resolve(resolveFor(table, 'insert', [rows]))
    }
    c.upsert = (row: unknown, opts?: unknown) => {
      calls.push({ table, method: 'upsert', args: [row, opts] })
      return Promise.resolve(resolveFor(table, 'upsert', [row, opts]))
    }
    c.then = (onFulfilled: (v: Resp) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolveFor(table, 'terminal', lastSelect)).then(onFulfilled, onRejected)
    return c
  }
  return { sb: { from: (table: string) => chain(table) } as unknown as ReturnType<typeof import('@/lib/supabase/service').createServiceClient>, calls }
}

const EMPTY: Resp = { data: [], error: null }

afterEach(() => {
  vi.clearAllMocks()
})

import { documentTouchedByPerson, moveMailToDeal, unfileMailFromDeal } from './mail-refile'

describe('documentTouchedByPerson', () => {
  it('is false when nothing has touched the document', async () => {
    const { sb } = makeSb({
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
    })
    await expect(documentTouchedByPerson(sb, 'doc-1', 'cycle-1')).resolves.toBe(false)
  })

  it('is true when the document sits on a checklist item', async () => {
    const { sb } = makeSb({
      tc_checklist_assignments: { data: [{ item_id: 'i1' }], error: null },
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
    })
    await expect(documentTouchedByPerson(sb, 'doc-1', 'cycle-1')).resolves.toBe(true)
  })

  it('is true when a principal review named this document', async () => {
    const { sb } = makeSb({
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: { data: [{ document_ids: ['doc-9', 'doc-1'] }], error: null },
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
    })
    await expect(documentTouchedByPerson(sb, 'doc-1', 'cycle-1')).resolves.toBe(true)
  })

  it('is true when the document is shared with the client', async () => {
    const { sb } = makeSb({
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: true, is_broker_notes: false }, error: null },
    })
    await expect(documentTouchedByPerson(sb, 'doc-1', 'cycle-1')).resolves.toBe(true)
  })
})

describe('moveMailToDeal', () => {
  const baseMessage = {
    id: 'msg-1',
    status: 'filed',
    deal_id: 'deal-a',
    cycle_id: 'cycle-a',
    attachments: [{ name: 'x.pdf', document_id: 'doc-1' }],
    subject: 'Escrow instructions',
  }

  it('refuses to move onto the same deal', async () => {
    const { sb } = makeSb({})
    const res = await moveMailToDeal({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-a',
      toAddress: '1 Main St',
      actor: 'matt@ryan-realty.com',
      sb,
    })
    expect(res).toEqual({ ok: false, error: 'Pick a different file.' })
    expect(fileIndexedMessageToDeal).not.toHaveBeenCalled()
  })

  it('refuses when the message is no longer filed on the deal the caller expects', async () => {
    const { sb } = makeSb({
      tc_mail_messages: { data: { ...baseMessage, deal_id: 'deal-b' }, error: null },
    })
    const res = await moveMailToDeal({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-c',
      toAddress: '3 Third St',
      actor: 'matt@ryan-realty.com',
      sb,
    })
    expect(res.ok).toBe(false)
    expect(fileIndexedMessageToDeal).not.toHaveBeenCalled()
  })

  it('re-files through fileIndexedMessageToDeal, archives an untouched document, and writes a tc_events row naming from/to', async () => {
    fileIndexedMessageToDeal.mockResolvedValue({ ok: true, documents: 1 })
    const { sb, calls } = makeSb({
      tc_mail_messages: { data: baseMessage, error: null },
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
      tc_events: { data: null, error: null },
    })
    const res = await moveMailToDeal({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-c',
      toAddress: '3 Third St',
      actor: 'matt@ryan-realty.com',
      sb,
    })
    expect(res).toEqual({ ok: true, message: 'Moved to 3 Third St.', documentsMoved: 1, documentsFlagged: 0 })
    expect(fileIndexedMessageToDeal).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg-1', dealId: 'deal-c', actor: 'matt@ryan-realty.com' }),
    )
    const archiveUpdate = calls.find((c) => c.table === 'tc_documents' && c.method === 'update')
    expect(archiveUpdate?.args[0]).toMatchObject({ archived: true })
    const event = calls.find((c) => c.table === 'tc_events' && c.method === 'insert')
    expect(event?.args[0]).toMatchObject({
      deal_id: 'deal-a',
      action: 'mail_message_moved',
      detail: expect.objectContaining({ from_deal_id: 'deal-a', to_deal_id: 'deal-c', mail_message_id: 'msg-1' }),
    })
  })

  it('leaves and flags a document already on a checklist instead of archiving it', async () => {
    fileIndexedMessageToDeal.mockResolvedValue({ ok: true, documents: 1 })
    const { sb, calls } = makeSb({
      tc_mail_messages: { data: baseMessage, error: null },
      tc_checklist_assignments: { data: [{ item_id: 'i1' }], error: null },
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: (method, args) => {
        const fields = String((args as unknown[])[0] ?? '')
        if (fields.includes('classification')) return { data: { classification: { source: 'gmail_auto_file' } }, error: null }
        return { data: { client_visible: false, is_broker_notes: false }, error: null }
      },
      tc_events: { data: null, error: null },
    })
    const res = await moveMailToDeal({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-c',
      toAddress: '3 Third St',
      actor: 'matt@ryan-realty.com',
      sb,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('expected ok')
    expect(res.documentsMoved).toBe(0)
    expect(res.documentsFlagged).toBe(1)
    expect(res.message).toMatch(/stayed on 1 Main St/)
    const flagUpdate = calls.find((c) => c.table === 'tc_documents' && c.method === 'update')
    expect(flagUpdate?.args[0]).toMatchObject({
      classification: expect.objectContaining({
        source: 'gmail_auto_file',
        refile_flag: expect.objectContaining({ flagged_by: 'matt@ryan-realty.com', moved_to_deal_id: 'deal-c' }),
      }),
    })
  })

  it('does not release documents or write the event when the re-file itself fails', async () => {
    fileIndexedMessageToDeal.mockResolvedValue({ ok: false, error: 'Mailbox not reachable.' })
    const { sb, calls } = makeSb({
      tc_mail_messages: { data: baseMessage, error: null },
    })
    const res = await moveMailToDeal({
      messageId: 'msg-1',
      fromDealId: 'deal-a',
      fromAddress: '1 Main St',
      toDealId: 'deal-c',
      toAddress: '3 Third St',
      actor: 'matt@ryan-realty.com',
      sb,
    })
    expect(res).toEqual({ ok: false, error: 'Mailbox not reachable.' })
    expect(calls.some((c) => c.table === 'tc_events')).toBe(false)
    expect(calls.some((c) => c.table === 'tc_documents')).toBe(false)
  })
})

describe('unfileMailFromDeal', () => {
  const baseMessage = {
    id: 'msg-2',
    status: 'filed',
    deal_id: 'deal-a',
    cycle_id: 'cycle-a',
    attachments: [{ name: 'x.pdf', document_id: 'doc-1' }],
    subject: 'Offer',
    message_key: 'rfc:abc',
    gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'g1' }],
    gmail_thread_ids: ['t1'],
    sent_at: '2026-09-20T00:00:00Z',
  }

  it('refuses when the message is not filed on the deal the caller expects', async () => {
    const { sb } = makeSb({
      tc_mail_messages: { data: { ...baseMessage, status: 'dismissed' }, error: null },
    })
    const res = await unfileMailFromDeal({ messageId: 'msg-2', fromDealId: 'deal-a', fromAddress: '1 Main St', actor: 'matt@ryan-realty.com', sb })
    expect(res.ok).toBe(false)
  })

  it('dismisses the message, archives its untouched document, and writes tc_events + a person tc_mail_reviews row', async () => {
    const { sb, calls } = makeSb({
      tc_mail_messages: { data: baseMessage, error: null },
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
      tc_events: { data: null, error: null },
      tc_mail_reviews: { data: null, error: null },
    })
    const res = await unfileMailFromDeal({ messageId: 'msg-2', fromDealId: 'deal-a', fromAddress: '1 Main St', actor: 'matt@ryan-realty.com', sb })
    expect(res).toEqual({ ok: true, message: 'Marked not a deal.', documentsMoved: 1, documentsFlagged: 0 })

    const messageUpdate = calls.find((c) => c.table === 'tc_mail_messages' && c.method === 'update')
    expect(messageUpdate?.args[0]).toMatchObject({ status: 'dismissed', deal_id: null, cycle_id: null, decided_by: 'matt@ryan-realty.com' })

    const event = calls.find((c) => c.table === 'tc_events' && c.method === 'insert')
    expect(event?.args[0]).toMatchObject({ deal_id: 'deal-a', action: 'mail_message_unfiled' })

    const review = calls.find((c) => c.table === 'tc_mail_reviews' && c.method === 'upsert')
    expect(review?.args[0]).toEqual([
      expect.objectContaining({ mailbox: 'matt@ryan-realty.com', gmail_id: 'g1', status: 'dismissed', stage: 'person', message_key: 'rfc:abc' }),
    ])
  })

  it('records the person decision on every mailbox copy of the message, not only the first', async () => {
    const { sb, calls } = makeSb({
      tc_mail_messages: {
        data: {
          ...baseMessage,
          gmail_refs: [
            { mailbox: 'matt@ryan-realty.com', gmail_id: 'g1' },
            { mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: 'g9' },
          ],
        },
        error: null,
      },
      tc_checklist_assignments: EMPTY,
      tc_envelope_documents: EMPTY,
      tc_principal_reviews: EMPTY,
      tc_documents: { data: { client_visible: false, is_broker_notes: false }, error: null },
      tc_events: { data: null, error: null },
      tc_mail_reviews: { data: null, error: null },
    })
    const res = await unfileMailFromDeal({ messageId: 'msg-2', fromDealId: 'deal-a', fromAddress: '1 Main St', actor: 'matt@ryan-realty.com', sb })
    expect(res.ok).toBe(true)
    const review = calls.find((c) => c.table === 'tc_mail_reviews' && c.method === 'upsert')
    expect(review?.args[0]).toEqual([
      expect.objectContaining({ mailbox: 'matt@ryan-realty.com', gmail_id: 'g1', stage: 'person', status: 'dismissed' }),
      expect.objectContaining({ mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: 'g9', stage: 'person', status: 'dismissed' }),
    ])
  })
})
