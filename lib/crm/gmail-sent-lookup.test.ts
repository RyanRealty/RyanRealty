/**
 * The read-only "did it leave" check. A fake Gmail client stands in for DWD, so
 * nothing here reaches Google. The distinction under test is absent (every
 * search ran and found nothing) versus unknown (something could not be
 * searched): only the first may lead a caller to send again.
 */
import { describe, expect, it, vi } from 'vitest'
import type { gmail_v1 } from 'googleapis'

// The default client must never be built in a unit test.
vi.mock('@/lib/crm/gmail', () => ({
  getGmailFor: () => {
    throw new Error('unit tests must inject getGmail')
  },
}))

import {
  findSentMessageTo,
  GMAIL_SENT_LOOKUP_TIMEOUT_MS,
  SENT_LOOKUP_SKEW_MS,
  sentSearchQuery,
} from './gmail-sent-lookup'

const CLAIM = new Date('2026-09-29T22:55:27.279Z')
const OWNER = 'owner@example.com'

type Msg = { id: string; internalDate?: string | null; threadId?: string }

function fakeGmail(
  opts: { byQuery?: Record<string, Msg[]>; listError?: Error; getError?: Error; failIds?: string[] } = {},
) {
  const list = vi.fn(async (params: { q: string }) => {
    if (opts.listError) throw opts.listError
    const msgs = opts.byQuery?.[params.q] ?? []
    return { data: { messages: msgs.map((m) => ({ id: m.id })) } }
  })
  const get = vi.fn(async (params: { id: string }) => {
    if (opts.getError) throw opts.getError
    if (opts.failIds?.includes(params.id)) throw new Error(`read ${params.id} timed out`)
    const all = Object.values(opts.byQuery ?? {}).flat()
    const m = all.find((x) => x.id === params.id)
    return { data: { id: params.id, threadId: m?.threadId ?? null, internalDate: m?.internalDate ?? null } }
  })
  const client = { users: { messages: { list, get } } } as unknown as gmail_v1.Gmail
  return { client, list, get }
}

const q = sentSearchQuery(OWNER, CLAIM)

describe('sentSearchQuery', () => {
  it('searches Sent for the address from a minute before the claim, in epoch seconds', () => {
    const afterSec = Math.floor((CLAIM.getTime() - SENT_LOOKUP_SKEW_MS) / 1000)
    expect(q).toBe(`in:sent to:${OWNER} after:${afterSec}`)
    expect(afterSec).toBe(1790722467)
  })
})

describe('findSentMessageTo', () => {
  it('finds the earliest message to the owner sent after the claim', async () => {
    const matt = fakeGmail({
      byQuery: {
        [q]: [
          { id: 'late', internalDate: String(Date.parse('2026-09-29T23:10:00.000Z')) },
          { id: 'first', internalDate: String(Date.parse('2026-09-29T22:57:05.000Z')), threadId: 't1' },
        ],
      },
    })
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: () => matt.client,
    })
    expect(out).toEqual({
      status: 'found',
      hit: {
        mailbox: 'matt@ryan-realty.com',
        recipient: OWNER,
        messageId: 'first',
        threadId: 't1',
        sentAt: '2026-09-29T22:57:05.000Z',
      },
    })
    expect(matt.list).toHaveBeenCalledWith(
      { userId: 'me', q, maxResults: 10, includeSpamTrash: true },
      { timeout: GMAIL_SENT_LOOKUP_TIMEOUT_MS, retry: false },
    )
    expect(matt.get).toHaveBeenCalledWith(
      { userId: 'me', id: 'first', format: 'minimal' },
      { timeout: GMAIL_SENT_LOOKUP_TIMEOUT_MS, retry: false },
    )
  })

  it('is absent only when every mailbox was searched cleanly', async () => {
    const empty = fakeGmail()
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com', 'PAUL@ryan-realty.com ', 'matt@ryan-realty.com'],
      recipients: [OWNER, 'Owner@Example.com'],
      since: CLAIM,
      getGmail: () => empty.client,
    })
    // Deduped and lowercased: 2 mailboxes x 1 address.
    expect(out).toEqual({ status: 'absent', searched: 2 })
    expect(empty.list).toHaveBeenCalledTimes(2)
  })

  it('ignores a match Gmail dated before the claim (minus the skew margin)', async () => {
    const old = fakeGmail({
      byQuery: { [q]: [{ id: 'old', internalDate: String(CLAIM.getTime() - SENT_LOOKUP_SKEW_MS - 1) }] },
    })
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: () => old.client,
    })
    expect(out).toEqual({ status: 'absent', searched: 1 })
  })

  it('is unknown, not absent, when a mailbox has no DWD client', async () => {
    const empty = fakeGmail()
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com', 'paul@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: (mb) => (mb === 'paul@ryan-realty.com' ? null : empty.client),
    })
    expect(out).toEqual({
      status: 'unknown',
      errors: ['paul@ryan-realty.com: no Gmail client (service account missing)'],
    })
  })

  it('is unknown when the Gmail API errors', async () => {
    const broken = fakeGmail({ listError: new Error('Request failed with status code 500') })
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: () => broken.client,
    })
    expect(out).toEqual({ status: 'unknown', errors: ['matt@ryan-realty.com: Request failed with status code 500'] })
  })

  it('still reports found when one mailbox errors and another has the message', async () => {
    const broken = fakeGmail({ listError: new Error('timeout') })
    const matt = fakeGmail({
      byQuery: { [q]: [{ id: 'm1', internalDate: String(Date.parse('2026-09-29T22:58:00.000Z')) }] },
    })
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com', 'paul@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: (mb) => (mb === 'paul@ryan-realty.com' ? broken.client : matt.client),
    })
    expect(out).toMatchObject({ status: 'found', hit: { messageId: 'm1', mailbox: 'matt@ryan-realty.com' } })
  })

  it('reads matches in parallel: a failed read is unknown, unless another read found the message', async () => {
    const at = String(Date.parse('2026-09-29T22:58:00.000Z'))
    const oneFails = fakeGmail({ byQuery: { [q]: [{ id: 'bad', internalDate: at }] }, failIds: ['bad'] })
    expect(
      await findSentMessageTo({ mailboxes: ['matt@ryan-realty.com'], recipients: [OWNER], since: CLAIM, getGmail: () => oneFails.client }),
    ).toEqual({ status: 'unknown', errors: ['matt@ryan-realty.com: read bad timed out'] })

    const mixed = fakeGmail({ byQuery: { [q]: [{ id: 'bad', internalDate: at }, { id: 'good', internalDate: at }] }, failIds: ['bad'] })
    expect(
      await findSentMessageTo({ mailboxes: ['matt@ryan-realty.com'], recipients: [OWNER], since: CLAIM, getGmail: () => mixed.client }),
    ).toMatchObject({ status: 'found', hit: { messageId: 'good' } })
    expect(mixed.get).toHaveBeenCalledTimes(2)
  })

  it('is unknown when Gmail matched a message but gave no send time', async () => {
    const odd = fakeGmail({ byQuery: { [q]: [{ id: 'x', internalDate: null }] } })
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com'],
      recipients: [OWNER],
      since: CLAIM,
      getGmail: () => odd.client,
    })
    expect(out).toEqual({ status: 'unknown', errors: ['matt@ryan-realty.com: message x has no send time'] })
  })

  it('refuses to search an address the query could not carry safely', async () => {
    const empty = fakeGmail()
    const out = await findSentMessageTo({
      mailboxes: ['matt@ryan-realty.com'],
      recipients: ['"odd name"@example.com'],
      since: CLAIM,
      getGmail: () => empty.client,
    })
    expect(out.status).toBe('unknown')
    expect(empty.list).not.toHaveBeenCalled()
  })

  it('is unknown with nothing to search', async () => {
    const empty = fakeGmail()
    const getGmail = () => empty.client
    expect(await findSentMessageTo({ mailboxes: [], recipients: [OWNER], since: CLAIM, getGmail })).toMatchObject({
      status: 'unknown',
    })
    expect(await findSentMessageTo({ mailboxes: ['m@ryan-realty.com'], recipients: [null, ''], since: CLAIM, getGmail })).toMatchObject({
      status: 'unknown',
    })
    expect(
      await findSentMessageTo({ mailboxes: ['m@ryan-realty.com'], recipients: [OWNER], since: new Date('bad'), getGmail }),
    ).toMatchObject({ status: 'unknown' })
  })
})
