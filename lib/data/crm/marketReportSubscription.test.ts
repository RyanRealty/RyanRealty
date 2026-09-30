import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The two DAL behaviors the no-login links and the admin paths lean on:
 *   - resolveReportLinkContact follows a contact merge (custom.merged_into)
 *     to the survivor, never around a loop, and a chain that ends at a
 *     DELETED contact resolves to that contact (so she can still stop);
 *   - stopReportSubscriptionsForDeletedPeople stops only rows not already
 *     stopped, and logs each one;
 *   - createReportSubscription says whether it actually created the row, and
 *     writes its timeline row only when it did.
 */

type Person = { id: number; name: string; first_name: string; emails: unknown; assigned_broker: string; deleted: boolean; custom: unknown }

const h = vi.hoisted(() => ({
  people: new Map<number, Person>(),
  peopleReads: [] as number[],
  subscription: null as Record<string, unknown> | null,
  upsertCount: 0,
  timelineInserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Record<string, unknown> }>,
  /** Person ids whose row is not yet stopped (what the update's filter would match). */
  stoppable: [] as number[],
}))

function peopleQuery() {
  let id = -1
  const q = {
    select: () => q,
    eq: (_col: string, v: unknown) => {
      id = Number(v)
      return q
    },
    maybeSingle: async () => {
      h.peopleReads.push(id)
      return { data: h.people.get(id) ?? null, error: null }
    },
  }
  return q
}

function subscriptionsQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: h.subscription, error: null }),
    upsert: async () => ({ count: h.upsertCount, error: null }),
    update: (patch: Record<string, unknown>) => {
      const filters: Record<string, unknown> = {}
      const u = {
        in: (col: string, v: unknown) => ((filters[col] = v), u),
        is: (col: string, v: unknown) => ((filters[`${col}:is`] = v), u),
        select: async () => {
          h.updates.push({ patch, filters })
          const ids = (filters.person_id as number[]) ?? []
          return { data: h.stoppable.filter((id) => ids.includes(id)).map((person_id) => ({ person_id })), error: null }
        },
      }
      return u
    },
  }
  return q
}

function timelineQuery() {
  return {
    insert: async (row: Record<string, unknown>) => {
      h.timelineInserts.push(row)
      return { error: null }
    },
    upsert: async (row: Record<string, unknown>) => {
      h.timelineInserts.push(row)
      return { error: null }
    },
  }
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (t: string) =>
      t === 'crm_people' ? peopleQuery() : t === 'crm_report_subscriptions' ? subscriptionsQuery() : timelineQuery(),
  }),
}))

import {
  createReportSubscription,
  resolveReportLinkContact,
  stopReportSubscriptionsForDeletedPeople,
} from './marketReportSubscription'

function person(id: number, over: Partial<Person> = {}): Person {
  return {
    id,
    name: `Person ${id}`,
    first_name: 'P',
    emails: [{ value: `p${id}@example.com`, isPrimary: 1 }],
    assigned_broker: 'matt',
    deleted: false,
    custom: {},
    ...over,
  }
}

const SUB_ROW = {
  id: 9016,
  person_id: 64138,
  areas: ['bend'],
  frequency: 'monthly',
  is_active: false,
  last_sent_at: null,
  last_attempt_at: null,
  created_at: null,
  updated_at: null,
  first_send_approved_at: null,
  first_send_approved_by: null,
  source: null,
  requested_at: null,
  consent_note: null,
  stopped_at: '2026-09-30T16:00:00Z',
  stopped_via: 'one-click',
}

beforeEach(() => {
  h.people.clear()
  h.peopleReads.length = 0
  h.subscription = null
  h.upsertCount = 0
  h.timelineInserts.length = 0
  h.updates.length = 0
  h.stoppable = []
})

describe('resolveReportLinkContact', () => {
  it('returns a live contact as is', async () => {
    h.people.set(64138, person(64138))
    expect(await resolveReportLinkContact(64138)).toMatchObject({ personId: 64138, deleted: false, mergedInto: null })
  })

  it('follows a merge to the survivor, across more than one merge', async () => {
    h.people.set(64138, person(64138, { deleted: true, custom: { merged_into: 70000 } }))
    h.people.set(70000, person(70000, { deleted: true, custom: { merged_into: '71000' } }))
    h.people.set(71000, person(71000))
    expect(await resolveReportLinkContact(64138)).toMatchObject({ personId: 71000, primaryEmail: 'p71000@example.com', deleted: false })
    expect(h.peopleReads).toEqual([64138, 70000, 71000])
  })

  it('a deleted contact that was not merged resolves to herself, marked deleted (she can still stop)', async () => {
    h.people.set(1, person(1, { deleted: true }))
    expect(await resolveReportLinkContact(1)).toMatchObject({ personId: 1, deleted: true })
  })

  it('a merge into a contact that no longer exists, or a loop, ends at the last contact reached', async () => {
    h.people.set(2, person(2, { deleted: true, custom: { merged_into: 3 } }))
    expect(await resolveReportLinkContact(2)).toMatchObject({ personId: 2, deleted: true })
    h.people.set(4, person(4, { deleted: true, custom: { merged_into: 5 } }))
    h.people.set(5, person(5, { deleted: true, custom: { merged_into: 4 } }))
    expect(await resolveReportLinkContact(4)).toMatchObject({ personId: 5, deleted: true })
    expect(h.peopleReads.filter((id) => id === 4)).toHaveLength(1)
  })

  it('a contact that does not exist is null', async () => {
    expect(await resolveReportLinkContact(999)).toBeNull()
  })

  it('an unresolvable chain (longer than the hop limit) is null, never a contact partway along it', async () => {
    for (let id = 100; id < 130; id++) h.people.set(id, person(id, { deleted: true, custom: { merged_into: id + 1 } }))
    h.people.set(130, person(130))
    expect(await resolveReportLinkContact(100)).toBeNull()
    expect(h.peopleReads.length).toBeLessThanOrEqual(21)
  })
})

describe('stopReportSubscriptionsForDeletedPeople', () => {
  it('stops only rows not already stopped, as a broker stop, and logs each one', async () => {
    h.stoppable = [7]
    const res = await stopReportSubscriptionsForDeletedPeople([7, 8, 7, -1], { email: 'matt@ryan-realty.com' }, new Date('2026-09-30T12:00:00Z'))
    expect(res).toEqual({ ok: true, stopped: [7] })
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0]!.patch).toMatchObject({ is_active: false, stopped_at: '2026-09-30T12:00:00.000Z', stopped_via: 'admin' })
    // A row already stopped (hers or a broker's) keeps its stop: the update only matches stopped_at is null.
    expect(h.updates[0]!.filters).toMatchObject({ person_id: [7, 8], 'stopped_at:is': null })
    expect(h.timelineInserts).toHaveLength(1)
    expect(h.timelineInserts[0]).toMatchObject({ person_id: 7, title: 'Market report stopped: the contact was deleted by matt@ryan-realty.com' })
  })

  it('does nothing for no ids', async () => {
    expect(await stopReportSubscriptionsForDeletedPeople([], { email: 'x' })).toEqual({ ok: true, stopped: [] })
    expect(h.updates).toHaveLength(0)
  })
})

describe('createReportSubscription', () => {
  const values = { areas: ['bend'], frequency: 'monthly' as const, isActive: false, stoppedAt: '2026-09-30T16:00:00Z', stoppedVia: 'one-click' }
  const timeline = { title: 'Market report stopped', source: 'one-click' }

  it('reports created and logs the timeline when the row is new', async () => {
    h.upsertCount = 1
    h.subscription = SUB_ROW
    const res = await createReportSubscription(64138, values, timeline)
    expect(res).toMatchObject({ ok: true, created: true, record: { id: 9016, stoppedVia: 'one-click' } })
    expect(h.timelineInserts).toHaveLength(1)
  })

  it('reports NOT created, and logs nothing, when a row already existed', async () => {
    h.upsertCount = 0
    h.subscription = { ...SUB_ROW, is_active: true, stopped_at: null, stopped_via: null }
    const res = await createReportSubscription(64138, values, timeline)
    expect(res).toMatchObject({ ok: true, created: false, record: { id: 9016, isActive: true } })
    expect(h.timelineInserts).toHaveLength(0)
  })
})
