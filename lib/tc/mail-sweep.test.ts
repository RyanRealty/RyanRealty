import { describe, expect, it, vi } from 'vitest'
import type { gmail_v1 } from 'googleapis'
import { indexedGmailIds, sweepQuery, type IndexResult, type MailUniverse } from './mail-index'

type Msg = { id: string; threadId: string }

/** A fake Gmail whose search returns `pages` in order. */
function fakeGmail(pages: Msg[][]): gmail_v1.Gmail {
  const list = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
    const i = pageToken ? Number(pageToken) : 0
    return { data: { messages: pages[i] ?? [], nextPageToken: i + 1 < pages.length ? String(i + 1) : undefined } }
  })
  return { users: { messages: { list } } } as unknown as gmail_v1.Gmail
}

const universe = { deals: [] } as unknown as MailUniverse
const mailbox = { email: 'matt@ryan-realty.com', slug: 'matt' }

function filed(gmailId: string): IndexResult {
  return { messageKey: `k:${gmailId}`, status: 'filed', stored: true, dealId: 'd1', documents: 0, offerId: null, decision: null, subject: gmailId }
}

const page = (ids: string[]): Msg[] => ids.map((id) => ({ id, threadId: `t-${id}` }))

describe('sweepQuery', () => {
  it('skips mail the index already holds for the mailbox and indexes the rest', async () => {
    const index = vi.fn(async ({ gmailId }: { gmailId: string }) => filed(gmailId))
    const res = await sweepQuery({
      query: 'q',
      universe,
      mailboxes: [mailbox],
      sb: {} as never,
      gmailFor: () => fakeGmail([page(['a', 'b', 'c']), page(['d'])]),
      indexed: async () => new Set(['b']),
      index: index as never,
    })
    expect(index.mock.calls.map((c) => c[0].gmailId).sort()).toEqual(['a', 'c', 'd'])
    expect(res).toMatchObject({ seen: 3, skipped: 1, filed: 3, complete: true })
  })

  it('--reindex re-decides mail the index already holds', async () => {
    const indexed = vi.fn(async () => new Set(['a']))
    const index = vi.fn(async ({ gmailId }: { gmailId: string }) => filed(gmailId))
    const res = await sweepQuery({
      query: 'q',
      universe,
      mailboxes: [mailbox],
      reindex: true,
      sb: {} as never,
      gmailFor: () => fakeGmail([page(['a', 'b'])]),
      indexed: indexed as never,
      index: index as never,
    })
    expect(indexed).not.toHaveBeenCalled()
    expect(res).toMatchObject({ seen: 2, skipped: 0 })
  })

  it('stops at the deadline and reports the sweep incomplete', async () => {
    let now = 1_000
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      const index = vi.fn(async ({ gmailId }: { gmailId: string }) => {
        now += 400 // each message takes 400 ms
        return filed(gmailId)
      })
      const res = await sweepQuery({
        query: 'q',
        universe,
        mailboxes: [mailbox, { email: 'paul@ryan-realty.com', slug: 'paul' }],
        deadline: 1_500,
        sb: {} as never,
        gmailFor: () => fakeGmail([page(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])]),
        indexed: async () => new Set(),
        index: index as never,
      })
      expect(res.complete).toBe(false)
      // four workers start before the clock passes the deadline; none after
      expect(index.mock.calls.length).toBeLessThan(8)
      expect(res.mailboxes).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('never indexes more than maxPerMailbox across pages', async () => {
    const index = vi.fn(async ({ gmailId }: { gmailId: string }) => filed(gmailId))
    await sweepQuery({
      query: 'q',
      universe,
      mailboxes: [mailbox],
      maxPerMailbox: 3,
      sb: {} as never,
      gmailFor: () => fakeGmail([page(['a', 'b']), page(['c', 'd']), page(['e'])]),
      indexed: async () => new Set(),
      index: index as never,
    })
    expect(index.mock.calls.map((c) => c[0].gmailId).sort()).toEqual(['a', 'b', 'c'])
  })

  it('counts a message seen twice (two Gmail copies of one email) once', async () => {
    const res = await sweepQuery({
      query: 'q',
      universe,
      mailboxes: [mailbox],
      sb: {} as never,
      gmailFor: () => fakeGmail([page(['a', 'b'])]),
      indexed: async () => new Set(),
      index: (async () => filed('same')) as never,
    })
    expect(res.seen).toBe(1)
  })
})

describe('indexedGmailIds', () => {
  function fakeSb(rows: Array<{ gmail_refs: unknown }>) {
    const overlaps = vi.fn(async () => ({ data: rows, error: null }))
    return { sb: { from: () => ({ select: () => ({ overlaps }) }) } as never, overlaps }
  }

  it('matches mailbox and Gmail id exactly, narrowed by thread', async () => {
    const { sb, overlaps } = fakeSb([
      { gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'a' }, { mailbox: 'paul@ryan-realty.com', gmail_id: 'b' }] },
      { gmail_refs: [{ mailbox: 'matt@ryan-realty.com', gmail_id: 'zzz' }] },
    ])
    const got = await indexedGmailIds(sb, 'matt@ryan-realty.com', page(['a', 'b', 'c']))
    expect([...got]).toEqual(['a'])
    expect(overlaps).toHaveBeenCalledWith('gmail_thread_ids', ['t-a', 't-b', 't-c'])
  })

  it('asks nothing for a page with no thread ids', async () => {
    const { sb, overlaps } = fakeSb([])
    const got = await indexedGmailIds(sb, 'matt@ryan-realty.com', [{ id: 'a', threadId: null }])
    expect(got.size).toBe(0)
    expect(overlaps).not.toHaveBeenCalled()
  })

  it('surfaces a read error instead of treating the page as new', async () => {
    const sb = { from: () => ({ select: () => ({ overlaps: async () => ({ data: null, error: { message: 'boom' } }) }) }) } as never
    await expect(indexedGmailIds(sb, 'm', page(['a']))).rejects.toThrow('boom')
  })
})
