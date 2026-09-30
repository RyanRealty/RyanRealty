import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Plan-then-write (review 2026-09-30): a change is planned from the row as
 * read (lib/crm/market-report-subscription-control.ts) and written later. The
 * write was a blind update by id and person, so a stop, a pause or a broker's
 * change landing in between was overwritten by a patch planned from the old
 * state. Now the write matches only while the row is still in the state the
 * plan was made from (on/off, the stop stamp, updated_at); otherwise it
 * writes nothing and says 'changed'.
 */

type SubRow = Record<string, unknown>

const h = vi.hoisted(() => ({ row: null as SubRow | null, timeline: [] as Record<string, unknown>[] }))

function subsQuery() {
  const preds: Array<(r: SubRow) => boolean> = []
  let patch: Record<string, unknown> | null = null
  const q = {
    update: (p: Record<string, unknown>) => ((patch = p), q),
    eq: (col: string, v: unknown) => (preds.push((r) => r[col] === v), q),
    is: (col: string, v: unknown) => (preds.push((r) => (v === null ? r[col] == null : r[col] === v)), q),
    select: async () => {
      const hit = h.row && preds.every((p) => p(h.row!)) ? [h.row] : []
      if (patch) for (const r of hit) Object.assign(r, patch)
      return { data: hit.map((r) => ({ id: r.id })), error: null }
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === 'crm_timeline'
        ? {
            insert: async (r: Record<string, unknown>) => (h.timeline.push(r), { error: null }),
            upsert: async (r: Record<string, unknown>) => (h.timeline.push(r), { error: null }),
          }
        : subsQuery(),
  }),
}))

import { applyReportSubscriptionPatch } from './marketReportSubscription'

const READ = { id: 9016, personId: 64138, isActive: true, stoppedAt: null, updatedAt: '2026-09-30T10:00:00.000Z' }

beforeEach(() => {
  h.row = { id: 9016, person_id: 64138, is_active: true, stopped_at: null, updated_at: '2026-09-30T10:00:00.000Z' }
  h.timeline = []
})

describe('applyReportSubscriptionPatch', () => {
  it('writes a patch planned from the row as it still is, and logs it', async () => {
    const out = await applyReportSubscriptionPatch(READ, { frequency: 'weekly' }, { title: 't', source: 'email-link' })
    expect(out).toEqual({ ok: true })
    expect(h.row).toMatchObject({ frequency: 'weekly' })
    expect(h.timeline).toHaveLength(1)
  })

  it('a row that changed after the read (her stop landed) is not overwritten: nothing is written, and it says so', async () => {
    // She stopped it from the one-click while a broker's resume was being planned.
    Object.assign(h.row!, { is_active: false, stopped_at: '2026-09-30T10:00:05.000Z', stopped_via: 'one-click', updated_at: '2026-09-30T10:00:05.000Z' })
    const out = await applyReportSubscriptionPatch(READ, { is_active: true, stopped_at: null, stopped_via: null }, { title: 't', source: 'app' })
    expect(out).toEqual({ ok: false, error: 'changed' })
    expect(h.row).toMatchObject({ is_active: false, stopped_via: 'one-click' })
    expect(h.timeline).toHaveLength(0)
  })

  it('a change in updated_at alone (a broker edit) also refuses the stale plan', async () => {
    h.row!.updated_at = '2026-09-30T10:00:09.000Z'
    expect(await applyReportSubscriptionPatch(READ, { frequency: 'weekly' }, { title: 't', source: 'app' })).toEqual({ ok: false, error: 'changed' })
  })
})
