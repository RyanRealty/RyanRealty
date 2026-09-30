import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Subscriptions hub's market-report reads and writes
 * (lib/data/crm/subscriptionsAdmin.ts), against an in-memory double that
 * evaluates the PostgREST chains they build:
 *   - a scoped or searched list is cut from the subscription rows, and never
 *     sends a whole book of contact ids in one request;
 *   - a bulk change plans every row through the shared planner: already-so
 *     rows are left alone, a turn-on skips rows with no areas and rows the
 *     contact stopped herself, and only changed rows get a timeline row;
 *   - a bulk selection is scoped to the caller's book in chunked reads.
 */

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  inSizes: [] as Array<{ table: string; n: number }>,
}))

type Filter = (r: Row) => boolean

/** Parse the two .or() shapes the module builds. */
function orFilter(expr: string): Filter {
  const search = /^name\.ilike\.%(.*)%,emails::text\.ilike\.%(.*)%$/.exec(expr)
  if (search) {
    const q = search[1].toLowerCase()
    return (r) =>
      String(r.name ?? '').toLowerCase().includes(q) || JSON.stringify(r.emails ?? '').toLowerCase().includes(q)
  }
  const stop = /^stopped_via\.is\.null,stopped_via\.not\.in\.\((.*)\)$/.exec(expr)
  if (stop) {
    const vias = stop[1].split(',')
    return (r) => r.stopped_via == null || !vias.includes(String(r.stopped_via))
  }
  throw new Error(`unexpected or(): ${expr}`)
}

function query(table: string) {
  const filters: Filter[] = []
  const orders: Array<{ col: string; asc: boolean }> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'update' | 'insert' = 'select'
  let patch: Row = {}
  let insertRows: Row[] = []
  let wantCount = false

  const run = () => {
    const rows = h.tables[table] ?? (h.tables[table] = [])
    if (mode === 'insert') {
      rows.push(...insertRows)
      return { data: null, error: null }
    }
    let hit = rows.filter((r) => filters.every((f) => f(r)))
    if (mode === 'update') {
      for (const r of hit) Object.assign(r, patch)
      return { data: hit.map((r) => ({ person_id: r.person_id })), error: null }
    }
    for (const o of [...orders].reverse()) {
      hit = [...hit].sort((a, b) => {
        const x = a[o.col] as string | number
        const y = b[o.col] as string | number
        return x === y ? 0 : (x < y ? -1 : 1) * (o.asc ? 1 : -1)
      })
    }
    const count = hit.length
    if (range) hit = hit.slice(range[0], range[1] + 1)
    return { data: hit.map((r) => ({ ...r })), error: null, count: wantCount ? count : null }
  }

  const q = {
    select: (_cols?: string, opts?: { count?: string }) => {
      if (opts?.count) wantCount = true
      return q
    },
    eq: (col: string, v: unknown) => {
      filters.push((r) => r[col] === v)
      return q
    },
    in: (col: string, vals: unknown[]) => {
      h.inSizes.push({ table, n: vals.length })
      filters.push((r) => vals.includes(r[col]))
      return q
    },
    contains: (col: string, vals: unknown[]) => {
      filters.push((r) => Array.isArray(r[col]) && vals.every((v) => (r[col] as unknown[]).includes(v)))
      return q
    },
    or: (expr: string) => {
      filters.push(orFilter(expr))
      return q
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orders.push({ col, asc: opts?.ascending !== false })
      return q
    },
    range: (a: number, b: number) => {
      range = [a, b]
      return q
    },
    update: (p: Row) => {
      mode = 'update'
      patch = p
      return q
    },
    insert: (rows: Row | Row[]) => {
      mode = 'insert'
      insertRows = Array.isArray(rows) ? rows : [rows]
      return q
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }))
vi.mock('@/lib/data/crm/subscriptionsAdminEngagement', () => ({
  getAlertEngagementByIds: async () => new Map(),
  getReportEngagementByPersonIds: async () => new Map(),
  emptyEngagement: () => ({ sends: 0, opens: 0, clicks: 0, lastOpenAt: null }),
}))

import {
  bulkUpdateReportSubscriptions,
  filterPersonIdsInBrokerScope,
  listReportSubscriptionsAdmin,
} from './subscriptionsAdmin'

function subRow(personId: number, over: Row = {}): Row {
  return {
    id: personId + 1000,
    person_id: personId,
    areas: ['bend'],
    frequency: 'monthly',
    is_active: false,
    last_sent_at: null,
    last_attempt_at: null,
    created_at: null,
    updated_at: `2026-09-${String(10 + (personId % 20)).padStart(2, '0')}T00:00:00Z`,
    first_send_approved_at: null,
    first_send_approved_by: null,
    source: null,
    requested_at: null,
    consent_note: null,
    stopped_at: null,
    stopped_via: null,
    ...over,
  }
}

function personRow(id: number, over: Row = {}): Row {
  return { id, name: `Person ${id}`, emails: [{ value: `p${id}@example.com`, isPrimary: 1 }], assigned_broker: 'matt', deleted: false, ...over }
}

const ACTOR = { email: 'matt@ryan-realty.com', brokerSlug: 'matt' }

beforeEach(() => {
  h.tables = {}
  h.inSizes.length = 0
})

describe('listReportSubscriptionsAdmin (scoped and searched lists)', () => {
  it("a scoped broker lists only their own contacts' subscriptions, newest first, with the right total", async () => {
    h.tables.crm_people = [personRow(1, { assigned_broker: 'paul' }), personRow(2), personRow(3, { assigned_broker: 'paul' }), personRow(4, { assigned_broker: 'paul', deleted: true })]
    h.tables.crm_report_subscriptions = [subRow(1), subRow(2), subRow(3), subRow(4)]
    const res = await listReportSubscriptionsAdmin({ scopeBroker: 'paul', limit: 50 })
    expect(res.total).toBe(2)
    expect(res.rows.map((r) => r.personId)).toEqual([3, 1])
  })

  it('never puts more than a chunk of contact ids in one request, however many subscribe', async () => {
    const people: Row[] = []
    const subs: Row[] = []
    for (let id = 1; id <= 450; id++) {
      people.push(personRow(id, { assigned_broker: id % 2 ? 'paul' : 'rebecca' }))
      subs.push(subRow(id))
    }
    h.tables.crm_people = people
    h.tables.crm_report_subscriptions = subs
    const res = await listReportSubscriptionsAdmin({ scopeBroker: 'paul', limit: 20, offset: 20 })
    expect(res.total).toBe(225)
    expect(res.rows).toHaveLength(20)
    expect(Math.max(...h.inSizes.map((s) => s.n))).toBeLessThanOrEqual(200)
  })

  it('a search keeps the scope and matches name or email; an unmapped broker sees nothing', async () => {
    h.tables.crm_people = [personRow(1, { name: 'Cheryl Younger', assigned_broker: 'paul' }), personRow(2, { name: 'Cheryl Other' })]
    h.tables.crm_report_subscriptions = [subRow(1), subRow(2)]
    expect((await listReportSubscriptionsAdmin({ q: 'cheryl', scopeBroker: 'paul' })).rows.map((r) => r.personId)).toEqual([1])
    expect((await listReportSubscriptionsAdmin({ q: 'p2@example' })).rows.map((r) => r.personId)).toEqual([2])
    expect(await listReportSubscriptionsAdmin({ scopeBroker: '__unmapped__' })).toEqual({ rows: [], total: 0 })
  })

  it('the row filters still apply on the scoped path', async () => {
    h.tables.crm_people = [personRow(1, { assigned_broker: 'paul' }), personRow(2, { assigned_broker: 'paul' })]
    h.tables.crm_report_subscriptions = [subRow(1, { is_active: true, frequency: 'weekly' }), subRow(2)]
    const res = await listReportSubscriptionsAdmin({ scopeBroker: 'paul', status: 'active', frequency: 'weekly' })
    expect(res.rows.map((r) => r.personId)).toEqual([1])
    expect(res.rows[0]).toMatchObject({ state: 'on', frequency: 'weekly', areaLabels: ['Bend'] })
  })
})

describe('bulkUpdateReportSubscriptions (the hub bulk bar)', () => {
  it('turns on paused and admin-stopped rows, skips contact-stopped and area-less ones, and leaves on rows alone', async () => {
    h.tables.crm_report_subscriptions = [
      subRow(1),
      subRow(2, { stopped_at: '2026-09-20T00:00:00Z', stopped_via: 'admin' }),
      subRow(3, { stopped_at: '2026-09-20T00:00:00Z', stopped_via: 'one-click' }),
      subRow(4, { areas: [] }),
      subRow(5, { is_active: true }),
    ]
    const res = await bulkUpdateReportSubscriptions([1, 2, 3, 4, 5], { active: true }, ACTOR)
    expect(res).toEqual({ updated: 2, skippedContactStopped: 1, skippedNoAreas: 1, error: null })
    const byId = new Map(h.tables.crm_report_subscriptions.map((r) => [r.person_id, r]))
    expect(byId.get(1)).toMatchObject({ is_active: true })
    expect(byId.get(2)).toMatchObject({ is_active: true, stopped_at: null, stopped_via: null })
    expect(byId.get(3)).toMatchObject({ is_active: false, stopped_via: 'one-click' })
    expect(byId.get(4)).toMatchObject({ is_active: false })
    const timeline = h.tables.crm_timeline ?? []
    expect(timeline.map((t) => t.person_id).sort()).toEqual([1, 2])
    expect(timeline.find((t) => t.person_id === 1)?.title).toBe(
      'Market report resumed by matt@ryan-realty.com (Subscriptions hub, bulk)',
    )
    expect(timeline.find((t) => t.person_id === 2)?.title).toBe(
      'Market report restarted by matt@ryan-realty.com (Subscriptions hub, bulk)',
    )
  })

  it('an interval change touches only rows not already on it', async () => {
    h.tables.crm_report_subscriptions = [subRow(1, { frequency: 'weekly' }), subRow(2)]
    const res = await bulkUpdateReportSubscriptions([1, 2], { frequency: 'weekly' }, ACTOR)
    expect(res.updated).toBe(1)
    expect((h.tables.crm_timeline ?? []).map((t) => t.person_id)).toEqual([2])
  })
})

describe('filterPersonIdsInBrokerScope', () => {
  it('the owner keeps every id; a broker keeps their own; an unmapped broker keeps none', async () => {
    h.tables.crm_people = [personRow(1, { assigned_broker: 'paul' }), personRow(2), personRow(3, { assigned_broker: 'paul' })]
    expect(await filterPersonIdsInBrokerScope([1, 2, 3], null)).toEqual({ ids: [1, 2, 3], error: null })
    expect(await filterPersonIdsInBrokerScope([1, 2, 3], 'paul')).toEqual({ ids: [1, 3], error: null })
    expect(await filterPersonIdsInBrokerScope([1, 2, 3], '__unmapped__')).toEqual({ ids: [], error: null })
  })
})
