import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { GscRequest } from './gsc-api'
import type { GscTrend } from './gsc-trend'

const trend: GscTrend = {
  status: 'unreadable',
  note: 'gsc_page_daily missing',
  anchor: null,
  windows: null,
  classes28: [],
  degraded: [],
  wow: [],
  source: 'test',
}

vi.mock('./signals', () => ({
  collectCompanyScoreboardSignals: vi.fn(async (_sb: unknown, now: Date) => ({
    fetchedAt: now.toISOString(),
    gsc: { status: 'unreadable', rows28d: 0, trend, source: 'test' },
    ledger: { openWindows: 1, expiredUnlearned: 0 },
    crm: { people: 10 },
  })),
}))

const { runWeeklyMeasure, storePullRange, STORE_MAX_DAYS_PER_RUN } = await import('./weekly-measure')

type Call = { table: string; op: string; filters: unknown[][]; payload?: unknown }
const MISSING = { code: 'PGRST205', message: "Could not find the table in the schema cache" }

function fakeSb(missing: Set<string>): { sb: SupabaseClient; calls: Call[] } {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'gte', 'lte', 'like', 'order', 'limit', 'range', 'single']) {
      b[m] = (...args: unknown[]) => {
        call.filters.push([m, ...args])
        return b
      }
    }
    for (const op of ['update', 'insert', 'upsert']) {
      b[op] = (payload: unknown) => {
        call.op = op
        call.payload = payload
        return b
      }
    }
    b.then = (res: (v: unknown) => unknown) => {
      calls.push(call)
      if (missing.has(table)) return Promise.resolve(res({ data: null, error: MISSING }))
      if (call.op === 'upsert') {
        const rows = call.payload as Array<{ version_gap: string }>
        return Promise.resolve(res({ data: rows.map((r, i) => ({ id: `id-${i}`, version_gap: r.version_gap })), error: null }))
      }
      if (table === 'loop_work_nodes') return Promise.resolve(res({ data: [{ version_gap: 'SITE-192', title: 'x', state: 'done', updated_at: '2026-09-22T00:00:00Z' }], error: null }))
      return Promise.resolve(res({ data: [], error: null }))
    }
    return b
  }
  return { sb: { from, rpc: async () => ({ data: null, error: MISSING }) } as unknown as SupabaseClient, calls }
}

const gsc = async (req: GscRequest) =>
  req.dimensions.join('+') === 'query'
    ? [{ keys: ['sunriver homes for sale'], clicks: 0, impressions: 300, ctr: 0, position: 40 }]
    : []

const now = new Date('2026-09-28T13:00:00Z')

describe('storePullRange', () => {
  it('fills the whole 56-day trend span when the store is empty', () => {
    expect(storePullRange({ now, storedMaxDate: null })).toEqual({ startDate: '2026-08-01', endDate: '2026-09-25', capped: false })
  })

  it('re-pulls a week of overlap after the newest stored day', () => {
    expect(storePullRange({ now, storedMaxDate: '2026-09-18' })).toEqual({ startDate: '2026-09-11', endDate: '2026-09-25', capped: false })
  })

  it('caps an explicit backfill range and never ends inside the GSC lag', () => {
    const r = storePullRange({ now, storedMaxDate: null, explicit: { startDate: '2025-06-01', endDate: '2026-09-27' } })
    expect(r.endDate).toBe('2026-09-25')
    expect(r.capped).toBe(true)
    expect(r.startDate).toBe(new Date(Date.parse('2026-09-25T00:00:00Z') - (STORE_MAX_DAYS_PER_RUN - 1) * 86_400_000).toISOString().slice(0, 10))
  })
})

describe('runWeeklyMeasure', () => {
  it('no-ops the store and snapshot steps when the migration is missing, and still seeds', async () => {
    const { sb, calls } = fakeSb(new Set(['gsc_page_daily', 'gsc_query_page_daily', 'loop_scoreboard_snapshots']))
    const res = await runWeeklyMeasure({ sb, gsc }, { now })
    expect(res.store.status).toBe('missing')
    expect(res.snapshot.status).toBe('missing')
    expect(res.seed.status).toBe('written')
    expect(res.seed.titles).toEqual([
      'SITE-193 GSC gap [zero-click] sunriver homes for sale → /communities/sunriver (pos 40.0, 300 impr, CTR 0.00%)',
    ])
    expect(res.ok).toBe(true)
    // A missing store is not pulled from GSC: no store upsert was attempted.
    expect(calls.some((c) => c.table === 'gsc_page_daily' && c.op === 'upsert')).toBe(false)
  })

  it('dry run writes nothing anywhere', async () => {
    const { sb, calls } = fakeSb(new Set())
    const res = await runWeeklyMeasure({ sb, gsc }, { now, dryRun: true })
    expect(res.dryRun).toBe(true)
    expect(calls.filter((c) => c.op !== 'select')).toEqual([])
    expect(res.seed.status).toBe('dry-run')
    expect(res.snapshot.status).toBe('dry-run')
  })

  it('without GSC credentials the store skips with a reason', async () => {
    const { sb } = fakeSb(new Set())
    const res = await runWeeklyMeasure({ sb, gsc: null }, { now, steps: { learn: false, seed: false, snapshot: false } })
    expect(res.store).toEqual({ status: 'skipped', reason: 'no GSC service-account credentials' })
  })
})
