import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * An enqueue that wins the send lock starts from nothing (clearUnsentQueue,
 * before it queues anyone) and, when queueing fails, clears what it queued
 * before it gives the lock back (S-2), so no draft keeps rows it never sent.
 */
const order: string[] = []
const insertQueuedRecipients = vi.fn(async (_id: string, rows: unknown[]) => {
  order.push('insert')
  return rows.length
})

vi.mock('@/lib/data/newsletter', () => ({
  getNewsletter: vi.fn(async () => ({ id: 'nl-1', status: 'draft', body_html: '<p>x</p>', body_text: null, audience: 'all', created_by: 'matt@ryan-realty.com', citations: [] })),
  getActiveSubscribersForSend: vi.fn(async () => [
    { id: 's1', email: 'a@example.invalid', crm_person_id: null },
    { id: 's2', email: 'b@example.invalid', crm_person_id: null },
  ]),
}))
vi.mock('@/lib/data/newsletter/current-issue', () => ({ editionEmailFiguresCurrent: vi.fn(async () => true) }))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  claimNewsletterForSending: vi.fn(async () => {
    order.push('claim')
    return 'tok'
  }),
  clearUnsentQueue: vi.fn(async () => {
    order.push('clear')
  }),
  getAssignedBrokersByPersonId: vi.fn(async () => new Map()),
  getEngagementSets: vi.fn(async () => ({ engaged: new Set<string>(), everSent: new Set<string>() })),
  insertQueuedRecipients: (id: string, rows: unknown[]) => insertQueuedRecipients(id, rows),
  anyNewsletterEverSent: vi.fn(async () => true),
  writeSendSchedule: vi.fn(async () => {
    order.push('schedule')
  }),
  releaseNewsletterLock: vi.fn(async (_id: string, status: string, token?: string) => {
    order.push(`release:${status}:${token}`)
  }),
}))

import { enqueueNewsletter } from './send-queue'

afterEach(() => {
  order.length = 0
  insertQueuedRecipients.mockClear()
})

describe('enqueueNewsletter past a won claim', () => {
  it('clears what an earlier enqueue left before it queues anyone, and schedules last', async () => {
    expect(await enqueueNewsletter('nl-1')).toMatchObject({ ok: true, queued: 2 })
    expect(order).toEqual(['claim', 'clear', 'insert', 'schedule'])
  })

  it('when queueing fails, clears what it queued and then gives the lock back', async () => {
    insertQueuedRecipients.mockImplementationOnce(async () => {
      order.push('insert')
      throw new Error('insertQueuedRecipients: timeout')
    })
    expect(await enqueueNewsletter('nl-1')).toEqual({ ok: false, error: 'insertQueuedRecipients: timeout' })
    expect(order).toEqual(['claim', 'clear', 'insert', 'clear', 'release:draft:tok'])
  })
})
