import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * addSuppression surfaces its error (review 2026-09-30). It ignored the insert
 * result, so "Stop all Ryan Realty email" told a contact email was off when
 * the suppression row was never written. Every caller keeps its behaviour: a
 * write the database refused is now returned and logged instead of vanishing,
 * and a write that throws still throws, logged first.
 */

const h = vi.hoisted(() => ({
  insertError: null as { message: string } | null,
  insertThrows: null as Error | null,
  inserted: [] as Record<string, unknown>[],
  enqueue: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (h.insertThrows) throw h.insertThrows
        if (!h.insertError) h.inserted.push(row)
        return { error: h.insertError }
      },
    }),
  }),
}))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({ personIdsByEmailCi: vi.fn(async () => []) }))
vi.mock('@/lib/data/crm/enqueueAudienceRemoval', () => ({ enqueueAudienceRemoval: h.enqueue }))

import { addSuppression } from './suppressions'

beforeEach(() => {
  h.insertError = null
  h.insertThrows = null
  h.inserted = []
  h.enqueue.mockClear()
})

describe('addSuppression', () => {
  it('reports a write that landed', async () => {
    const out = await addSuppression({ personId: 64138, channel: 'email', reason: 'unsubscribe', source: 'report-email-link', value: 'a@b.com' })
    expect(out).toEqual({ ok: true })
    expect(h.inserted).toEqual([{ person_id: 64138, channel: 'email', reason: 'unsubscribe', source: 'report-email-link', value: 'a@b.com' }])
    expect(h.enqueue).toHaveBeenCalledTimes(1)
  })

  it('returns and logs a write that failed, and does not queue the audience removal for a row that is not there', async () => {
    h.insertError = { message: 'permission denied for table crm_suppressions' }
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const out = await addSuppression({ personId: 64138, channel: 'email', reason: 'unsubscribe' })
    expect(out).toEqual({ ok: false, error: 'permission denied for table crm_suppressions' })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[suppressions] addSuppression failed'), expect.stringContaining('permission denied'))
    expect(h.enqueue).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('a write that THROWS still throws to its caller, as it always did, and is logged first', async () => {
    h.insertThrows = new Error('fetch failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(addSuppression({ personId: 64138, channel: 'email', reason: 'unsubscribe' })).rejects.toThrow('fetch failed')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[suppressions] addSuppression failed'), 'fetch failed')
    expect(h.enqueue).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
