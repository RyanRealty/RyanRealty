import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  leadingCandidateRun,
  planMembershipRefresh,
  refreshChangedPlaceMembership,
} from './refreshPlaceMembership'

const NOW = new Date('2026-09-23T06:00:00.000Z')

describe('planMembershipRefresh (the refresh_place_membership_changed rule)', () => {
  it('puts listings with no rows first, then rows older than the change, newest change first', () => {
    const plan = planMembershipRefresh(
      [
        { key: 'K3', modifiedAt: '2026-09-23T05:00:00Z' },
        { key: 'K1', modifiedAt: '2026-09-23T04:00:00Z' },
        { key: 'K2', modifiedAt: '2026-09-22T04:00:00Z' },
        { key: 'K9', modifiedAt: '2026-09-23T05:30:00Z' },
        { key: 'K5', modifiedAt: '2026-09-23T01:00:00Z' },
        { key: 'K9', modifiedAt: '2026-09-23T05:30:00Z' },
      ],
      new Map([
        ['K3', '2026-08-23T21:32:49Z'], // older than its change: stale
        ['K2', '2026-08-23T21:32:49Z'], // older than its change: stale
        ['K5', '2026-09-23T02:00:00Z'], // rebuilt after its change: current
      ]),
    )
    expect(plan.missing).toEqual(['K1', 'K9'])
    expect(plan.stale).toEqual(['K3', 'K2'])
  })
})

describe('leadingCandidateRun', () => {
  it('counts only the unbroken candidate prefix, capped', () => {
    const pending = new Set(['a', 'b', 'd'])
    expect(leadingCandidateRun(['a', 'b', 'c', 'd'], pending)).toBe(2)
    expect(leadingCandidateRun(['c', 'd'], pending)).toBe(0)
    expect(leadingCandidateRun(['a', 'b'], pending, 1)).toBe(1)
  })
})

type Listing = { ListingKey: string; ModificationTimestamp: string }
type RpcCall = { fn: string; args: Record<string, unknown> }

/**
 * In-memory stand-in for the two tables and two RPCs the refresher touches.
 * refresh_place_membership mirrors the SQL: the p_limit keys after p_after in
 * ListingKey order get fresh rows.
 */
function fakeDb(opts: {
  listings: Listing[]
  membership: Record<string, string>
  changedFn?: 'missing' | { data: unknown }
  failKeysetCall?: number
}) {
  const listings = [...opts.listings].sort((a, b) => (a.ListingKey < b.ListingKey ? -1 : 1))
  const membership = new Map(Object.entries(opts.membership))
  const calls: RpcCall[] = []

  const from = (table: string) => {
    const f: { gte?: string; lt?: string; gt?: string; in?: string[]; desc?: boolean; limit?: number; range?: [number, number] } = {}
    const run = () => {
      if (table === 'listings') {
        let rows = listings
        if (f.gte) rows = rows.filter((r) => r.ModificationTimestamp >= f.gte!)
        if (f.lt) rows = rows.filter((r) => r.ListingKey < f.lt!)
        if (f.gt !== undefined) rows = rows.filter((r) => r.ListingKey > f.gt!)
        if (f.gte) rows = [...rows].sort((a, b) => (a.ModificationTimestamp < b.ModificationTimestamp ? 1 : -1))
        else if (f.desc) rows = [...rows].reverse()
        if (f.range) rows = rows.slice(f.range[0], f.range[1] + 1)
        if (f.limit != null) rows = rows.slice(0, f.limit)
        return { data: rows, error: null }
      }
      const rows = (f.in ?? [])
        .filter((k) => membership.has(k))
        .map((k) => ({ listing_key: k, computed_at: membership.get(k)! }))
      return { data: f.range ? rows.slice(f.range[0], f.range[1] + 1) : rows, error: null }
    }
    const chain: Record<string, unknown> = {
      select: () => chain,
      gte: (_c: string, v: string) => ((f.gte = v), chain),
      lt: (_c: string, v: string) => ((f.lt = v), chain),
      gt: (_c: string, v: string) => ((f.gt = v), chain),
      in: (_c: string, v: string[]) => ((f.in = v), chain),
      order: (c: string, o: { ascending: boolean }) => {
        if (c === 'ListingKey' && o.ascending === false) f.desc = true
        return chain
      },
      range: (a: number, b: number) => ((f.range = [a, b]), Promise.resolve(run())),
      limit: (n: number) => ((f.limit = n), Promise.resolve(run())),
    }
    return chain
  }

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    if (fn === 'refresh_place_membership_changed') {
      if (opts.changedFn && opts.changedFn !== 'missing') return { data: opts.changedFn.data, error: null }
      return {
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.refresh_place_membership_changed(p_limit, p_lookback_hours) in the schema cache' },
      }
    }
    const keysetCalls = calls.filter((c) => c.fn === 'refresh_place_membership').length
    if (opts.failKeysetCall === keysetCalls) return { data: null, error: { message: 'upstream request timeout' } }
    const after = String(args.p_after)
    const lim = Number(args.p_limit)
    const keys = listings.filter((l) => l.ListingKey > after).slice(0, lim).map((l) => l.ListingKey)
    for (const k of keys) membership.set(k, NOW.toISOString())
    return { data: { ok: true, upserted: keys.length * 4, last_key: keys[keys.length - 1], done: false }, error: null }
  }

  return { client: { from, rpc } as unknown as SupabaseClient, calls, membership }
}

describe('refreshChangedPlaceMembership', () => {
  it('uses refresh_place_membership_changed when the migration is applied, and nothing else', async () => {
    const db = fakeDb({ listings: [], membership: {}, changedFn: { data: { ok: true, candidates: 3, upserted: 12 } } })
    const res = await refreshChangedPlaceMembership(db.client, { now: NOW })
    expect(res.mode).toBe('pg_function')
    expect(res.ok).toBe(true)
    expect(db.calls.map((c) => c.fn)).toEqual(['refresh_place_membership_changed'])
  })

  it('falls back to the keyset RPC on PGRST202 and rebuilds only candidate runs', async () => {
    const db = fakeDb({
      listings: [
        { ListingKey: 'A1', ModificationTimestamp: '2026-01-01T00:00:00Z' }, // outside lookback
        { ListingKey: 'B1', ModificationTimestamp: '2026-09-23T01:00:00Z' }, // current rows
        { ListingKey: 'B2', ModificationTimestamp: '2026-09-23T02:00:00Z' }, // stale rows
        { ListingKey: 'C1', ModificationTimestamp: '2026-09-23T03:00:00Z' }, // no rows
        { ListingKey: 'C2', ModificationTimestamp: '2026-09-23T04:00:00Z' }, // no rows
        { ListingKey: 'C3', ModificationTimestamp: '2026-09-23T05:00:00Z' }, // no rows
      ],
      membership: { A1: '2026-08-23T21:32:49Z', B1: '2026-09-23T01:30:00Z', B2: '2026-08-23T21:32:49Z' },
    })
    const res = await refreshChangedPlaceMembership(db.client, { now: NOW })
    expect(res).toMatchObject({ mode: 'keyset_fallback', ok: true, missing: 3, stale: 1, rebuiltKeys: 4, remaining: 0 })
    const keyset = db.calls.filter((c) => c.fn === 'refresh_place_membership').map((c) => c.args)
    // One call for the contiguous C1..C3 run, one for B2 alone; A1 and B1 untouched.
    expect(keyset).toEqual([
      { p_after: 'B2', p_limit: 3 },
      { p_after: 'B1', p_limit: 1 },
    ])
    expect(db.membership.get('A1')).toBe('2026-08-23T21:32:49Z')
    expect(db.membership.get('B1')).toBe('2026-09-23T01:30:00Z')
  })

  it('stops at the first failed call instead of retrying it', async () => {
    const db = fakeDb({
      listings: [
        { ListingKey: 'C1', ModificationTimestamp: '2026-09-23T03:00:00Z' },
        { ListingKey: 'D1', ModificationTimestamp: '2026-09-23T04:00:00Z' },
        { ListingKey: 'E1', ModificationTimestamp: '2026-09-23T05:00:00Z' },
      ],
      membership: { D1: '2026-09-23T05:30:00Z' },
      failKeysetCall: 1,
    })
    const res = await refreshChangedPlaceMembership(db.client, { now: NOW })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('upstream request timeout')
    expect(db.calls.filter((c) => c.fn === 'refresh_place_membership')).toHaveLength(1)
    expect(res.remaining).toBe(2)
  })
})
