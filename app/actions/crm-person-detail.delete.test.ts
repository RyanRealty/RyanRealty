import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Deleting one contact stops her market report (review 2026-09-30): the
 * subscription used to stay on, and the cadence cron kept mailing a record
 * nobody could see.
 */

const h = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; op: string; value: unknown }>,
  stop: vi.fn(),
}))

class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect ${to}`)
  }
}

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirect(to)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({ personIdsByEmailCi: async () => [] }))
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: async () => ({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }),
  requirePersonInScope: async () => ({ ok: true }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      update: (value: unknown) => ({
        eq: async () => {
          h.writes.push({ table, op: 'update', value })
          return { error: null }
        },
      }),
      insert: async (value: unknown) => {
        h.writes.push({ table, op: 'insert', value })
        return { error: null }
      },
    }),
  }),
}))
vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  stopReportSubscriptionsForDeletedPeople: (...a: unknown[]) => h.stop(...a),
}))

import { deleteCrmPersonAction } from './crm-person-detail'

function form(personId: number): FormData {
  const f = new FormData()
  f.set('personId', String(personId))
  return f
}

async function run(personId: number): Promise<string> {
  try {
    await deleteCrmPersonAction(form(personId))
  } catch (e) {
    if (e instanceof Redirect) return e.to
    throw e
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  h.writes = []
  h.stop.mockReset()
  h.stop.mockResolvedValue({ ok: true, stopped: [64138] })
})

describe('deleteCrmPersonAction', () => {
  it('soft-deletes the contact AND stops her market report, naming the admin', async () => {
    const to = await run(64138)
    expect(h.writes[0]).toMatchObject({ table: 'crm_people', op: 'update', value: expect.objectContaining({ deleted: true }) })
    expect(h.stop).toHaveBeenCalledWith([64138], { email: 'matt@ryan-realty.com', brokerSlug: 'matt' })
    expect(decodeURIComponent(to)).toContain('Person deleted.')
  })

  it('tells the broker when the report stop did not save', async () => {
    h.stop.mockResolvedValue({ ok: false, error: 'timeout' })
    const to = await run(64138)
    expect(decodeURIComponent(to)).toContain('Their market report could not be stopped')
  })
})
