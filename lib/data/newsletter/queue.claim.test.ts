import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * list_send marks a send to the subscriber list, the only kind the CRM's
 * one-click send offers as the current issue (lib/data/newsletter/current-issue.ts)
 * and the only kind that counts as the list's history (warm-up, engagement
 * tiers). The list path claims with it; a one-off claim and a released claim
 * never carry it.
 */
const updates: Array<Record<string, unknown>> = []
const filters: Array<[string, unknown]> = []
let sentCount = 0
vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    let op = ''
    const builder: Record<string, unknown> = {
      from: () => { op = ''; return builder },
      update: (payload: Record<string, unknown>) => { op = 'update'; updates.push(payload); return builder },
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (op !== 'update') op = opts?.head ? 'count' : 'select'
        return builder
      },
      eq: (col: string, val: unknown) => { filters.push([col, val]); return builder },
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: unknown) => unknown) =>
        resolve(
          op === 'update'
            ? { data: [{ id: 'nl-1' }], error: null }
            : op === 'count'
              ? { count: sentCount, error: null }
              : { data: [], error: null },
        ),
    }
    return builder
  },
}))
vi.mock('@/lib/supabase/paginate', () => ({ fetchPagedRows: vi.fn(async () => ({ rows: [] })) }))

import { anyNewsletterEverSent, claimNewsletterForSending, getEngagementSets, releaseNewsletterLock } from './queue'

afterEach(() => {
  updates.length = 0
  filters.length = 0
  sentCount = 0
})

describe('claimNewsletterForSending', () => {
  it('marks a list send', async () => {
    expect(await claimNewsletterForSending('nl-1', { listSend: true })).toEqual(expect.any(String))
    expect(updates[0]).toMatchObject({ status: 'sending', list_send: true })
  })

  it('leaves a one-off send unmarked', async () => {
    await claimNewsletterForSending('nl-1')
    expect(updates[0]).toMatchObject({ status: 'sending' })
    expect(updates[0]).not.toHaveProperty('list_send')
  })
})

describe('releaseNewsletterLock', () => {
  it('a released claim sent nothing, so it is not a list send', async () => {
    await releaseNewsletterLock('nl-1')
    expect(updates[0]).toMatchObject({ status: 'draft', list_send: false })
  })
})

describe('the list\'s send history', () => {
  it('warm-up ends only once an issue went out to the list, never on a one-off', async () => {
    sentCount = 0
    expect(await anyNewsletterEverSent()).toBe(false)
    expect(filters).toEqual([['status', 'sent'], ['list_send', true]])
    sentCount = 1
    expect(await anyNewsletterEverSent()).toBe(true)
  })

  it('engagement tiers read the last issues that went to the list', async () => {
    await getEngagementSets()
    expect(filters).toEqual([['status', 'sent'], ['list_send', true]])
  })
})
