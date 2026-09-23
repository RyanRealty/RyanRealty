import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  foldPageRows,
  foldQueryPageRows,
  isMissingRelationError,
  pullGscStoreRange,
  readGscClassRollup,
  readGscStoreCoverage,
  writeGscStore,
} from './gsc-store'
import type { GscRequest } from './gsc-api'

type Call = { table: string; op: string; filters: unknown[][]; payload?: unknown; rpc?: string; args?: unknown }
type Res = { data: unknown; error: { code?: string; message: string } | null; count?: number }

function fakeSb(handler: (call: Call) => Res): { sb: SupabaseClient; calls: Call[] } {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'gte', 'lte', 'like', 'not', 'order', 'limit', 'range', 'single', 'maybeSingle']) {
      b[m] = (...args: unknown[]) => {
        call.filters.push([m, ...args])
        return b
      }
    }
    for (const op of ['update', 'insert', 'upsert']) {
      b[op] = (payload: unknown, opts?: unknown) => {
        call.op = op
        call.payload = payload
        if (opts) call.filters.push([`${op}Opts`, opts])
        return b
      }
    }
    b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => {
      calls.push(call)
      return Promise.resolve(handler(call)).then(res, rej)
    }
    return b
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: '', op: 'rpc', filters: [], rpc: name, args }
    calls.push(call)
    return Promise.resolve(handler(call))
  }
  return { sb: { from, rpc } as unknown as SupabaseClient, calls }
}

const MISSING = { code: 'PGRST205', message: "Could not find the table 'public.gsc_page_daily' in the schema cache" }

describe('folding raw GSC rows into store rows', () => {
  it('folds URL spellings of one page into one row with impression-weighted position', () => {
    const rows = foldPageRows([
      { keys: ['2026-09-15', 'https://ryan-realty.com/communities/tetherow'], clicks: 1, impressions: 30, ctr: 0, position: 10 },
      { keys: ['2026-09-15', 'https://ryan-realty.com/communities/tetherow/?utm_source=x'], clicks: 0, impressions: 10, ctr: 0, position: 30 },
      { keys: ['2026-09-15', 'https://ryan-realty.com/'], clicks: 2, impressions: 5, ctr: 0, position: 4 },
    ])
    const tetherow = rows.find((r) => r.page === '/communities/tetherow')
    expect(tetherow).toMatchObject({
      date: '2026-09-15',
      page_class: 'community',
      market: 'central-oregon',
      clicks: 1,
      impressions: 40,
      position: 15, // (10*30 + 30*10) / 40
      url_variants: 2,
    })
    expect(rows.find((r) => r.page === '/')?.page_class).toBe('home')
    expect(rows).toHaveLength(2)
  })

  it('flags rank-tracker queries instead of dropping them', () => {
    const rows = foldQueryPageRows([
      { keys: ['2026-09-15', '"tetherow homes for sale"', 'https://ryan-realty.com/communities/tetherow'], clicks: 0, impressions: 3, ctr: 0, position: 22 },
      { keys: ['2026-09-15', 'Tetherow Homes For Sale', 'https://ryan-realty.com/communities/tetherow'], clicks: 1, impressions: 9, ctr: 0, position: 18 },
    ])
    expect(rows.map((r) => [r.query, r.trackable])).toEqual([
      ['"tetherow homes for sale"', false],
      ['tetherow homes for sale', true],
    ])
  })
})

describe('pullGscStoreRange', () => {
  it('asks for page x date and query x page x date per chunk', async () => {
    const seen: GscRequest[] = []
    const query = async (req: GscRequest) => {
      seen.push(req)
      return req.dimensions.length === 2
        ? [{ keys: [req.startDate, 'https://ryan-realty.com/cities/bend'], clicks: 1, impressions: 10, ctr: 0.1, position: 12 }]
        : [{ keys: [req.startDate, 'bend homes', 'https://ryan-realty.com/cities/bend'], clicks: 1, impressions: 4, ctr: 0.25, position: 9 }]
    }
    const pull = await pullGscStoreRange(query, { startDate: '2026-09-01', endDate: '2026-09-20', chunkDays: 14 })
    expect(seen.map((r) => `${r.startDate}..${r.endDate} ${r.dimensions.join('+')}`)).toEqual([
      '2026-09-01..2026-09-14 date+page',
      '2026-09-01..2026-09-14 date+query+page',
      '2026-09-15..2026-09-20 date+page',
      '2026-09-15..2026-09-20 date+query+page',
    ])
    expect(pull.pageRows).toHaveLength(2)
    expect(pull.queryPageRows).toHaveLength(2)
    expect(pull.requests).toBe(4)
  })
})

describe('store I/O degrades when the migration is not applied', () => {
  it('recognizes PostgREST and Postgres "not there" errors', () => {
    expect(isMissingRelationError(MISSING)).toBe(true)
    expect(isMissingRelationError({ code: '42P01', message: 'relation does not exist' })).toBe(true)
    expect(isMissingRelationError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true)
    expect(isMissingRelationError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingRelationError(null)).toBe(false)
  })

  it('writeGscStore reports missing, not error', async () => {
    const { sb } = fakeSb(() => ({ data: null, error: MISSING }))
    const res = await writeGscStore(sb, {
      pageRows: foldPageRows([{ keys: ['2026-09-15', '/'], clicks: 0, impressions: 1, ctr: 0, position: 1 }]),
      queryPageRows: [],
    })
    expect(res.status).toBe('missing')
  })

  it('writeGscStore upserts on the primary key, in chunks', async () => {
    const { sb, calls } = fakeSb(() => ({ data: null, error: null }))
    const pageRows = foldPageRows(
      Array.from({ length: 5 }, (_, i) => ({ keys: ['2026-09-15', `/blog/p${i}`], clicks: 0, impressions: 1, ctr: 0, position: 1 })),
    )
    const res = await writeGscStore(sb, { pageRows, queryPageRows: [] }, { chunk: 2 })
    expect(res).toEqual({ status: 'written', pages: 5, queryPages: 0 })
    const upserts = calls.filter((c) => c.op === 'upsert' && c.table === 'gsc_page_daily')
    expect(upserts).toHaveLength(3)
    expect(upserts[0]?.filters).toContainEqual(['upsertOpts', { onConflict: 'date,search_type,page' }])
  })

  it('coverage and rollup name the missing migration', async () => {
    const { sb } = fakeSb(() => ({ data: null, error: MISSING }))
    const cov = await readGscStoreCoverage(sb)
    expect(cov.status).toBe('missing')
    const roll = await readGscClassRollup(sb, '2026-08-24', '2026-09-20')
    expect(roll.missing).toBe(true)
    expect(roll.error).toMatch(/20260923150000/)
  })

  it('coverage reads the first and last stored day', async () => {
    const { sb } = fakeSb((call) => {
      const asc = call.filters.find((f) => f[0] === 'order')?.[2] as { ascending: boolean }
      return { data: [{ date: asc.ascending ? '2025-06-16' : '2026-09-20' }], error: null }
    })
    expect(await readGscStoreCoverage(sb)).toEqual({ status: 'ok', minDate: '2025-06-16', maxDate: '2026-09-20' })
  })
})
