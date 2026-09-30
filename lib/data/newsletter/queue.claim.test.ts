import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * list_send marks a send to the subscriber list, the only kind the CRM's
 * one-click send offers as the current issue (lib/data/newsletter/current-issue.ts).
 * The list path claims with it; a one-off claim and a released claim never
 * carry it.
 */
const updates: Array<Record<string, unknown>> = []
vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    const builder: Record<string, unknown> = {
      from: () => builder,
      update: (payload: Record<string, unknown>) => { updates.push(payload); return builder },
      eq: () => builder,
      in: () => builder,
      select: () => Promise.resolve({ data: [{ id: 'nl-1' }], error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
    }
    return builder
  },
}))
vi.mock('@/lib/supabase/paginate', () => ({ fetchPagedRows: vi.fn() }))

import { claimNewsletterForSending, releaseNewsletterLock } from './queue'

afterEach(() => { updates.length = 0 })

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
