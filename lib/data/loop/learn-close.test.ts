import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  closeLedgerRowWith,
  isWindowSettled,
  learnDueWindows,
  learnWindow,
  measureLedgerRow,
  surfacePaths,
  surfaceUrlVariants,
  verdictFor,
  type LearnLedgerRow,
} from './learn-close'

type Call = { table: string; op: string; filters: unknown[][]; payload?: unknown }
type Res = { data: unknown; error: { code?: string; message: string } | null }

function fakeSb(handler: (call: Call) => Res): { sb: SupabaseClient; calls: Call[] } {
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
    b.update = (payload: unknown) => {
      call.op = 'update'
      call.payload = payload
      return b
    }
    b.then = (res: (v: Res) => unknown) => {
      calls.push(call)
      return Promise.resolve(res(handler(call)))
    }
    return b
  }
  return { sb: { from, rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient, calls }
}

const MISSING = { code: 'PGRST205', message: "Could not find the table 'public.gsc_page_daily' in the schema cache" }
const filterVal = (call: Call, m: string, col: string) => call.filters.find((f) => f[0] === m && f[1] === col)?.[2]

/** 28 days of site_signal rows for one page, stored under its FULL URL, the way the GSC snapshot writes them. */
function fullUrlSeries(url: string, from: string, days: number, perDay: { clicks: number; impressions: number }) {
  const rows: Array<{ surface: string; metric: string; value: number; date: string }> = []
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)
    rows.push({ surface: url, metric: 'clicks', value: perDay.clicks, date })
    rows.push({ surface: url, metric: 'impressions', value: perDay.impressions, date })
  }
  return rows
}

const sunriver: LearnLedgerRow = {
  id: '4a9455a6-f25a-4cef-b6f7-5412606b1481',
  domain: 'seo-aeo',
  change_class: 'seo_title_rewrite',
  surface: '/blog/sunriver-year-round-living-vs-vacation',
  metric: 'gsc_ctr_pct_28d',
  baseline_value: 3.4,
  predicted_delta: 1,
  window_days: 28,
  shipped_at: '2026-06-10T03:23:16.95736+00:00',
  actual_delta: null,
  verdict: null,
  notes: 'shipped',
}

describe('learnWindow + settle', () => {
  it('reads exactly window_days days from the ship day', () => {
    expect(learnWindow(sunriver)).toEqual({ from: '2026-06-10', to: '2026-07-07' })
  })

  it('is not due until its last day is settled in GSC (3 days)', () => {
    const row = { shipped_at: '2026-08-26T10:00:00Z', window_days: 28 } // to = 2026-09-22
    expect(isWindowSettled(row, new Date('2026-09-24T12:00:00Z'))).toBe(false)
    expect(isWindowSettled(row, new Date('2026-09-25T12:00:00Z'))).toBe(true)
  })
})

describe('surfaces are normalized on both sides (gsc-trend-2)', () => {
  it('splits " + " lists and refuses an unenumerated set', () => {
    expect(surfacePaths('/about + /team/')).toEqual(['/about', '/team'])
    expect(surfacePaths('https://ryan-realty.com/Blog/X/')).toEqual(['/blog/x'])
    expect(surfacePaths('legacy market-report archive (51 urls)')).toBeNull()
  })

  it('looks the snapshot up under every URL spelling it stores', () => {
    expect(surfaceUrlVariants('/blog/x')).toEqual([
      '/blog/x',
      'https://ryan-realty.com/blog/x',
      'https://ryan-realty.com/blog/x/',
      'https://www.ryan-realty.com/blog/x',
      'https://www.ryan-realty.com/blog/x/',
    ])
  })
})

describe('measureLedgerRow against a full-URL site_signal fixture', () => {
  const url = 'https://ryan-realty.com/blog/sunriver-year-round-living-vs-vacation'

  it('matches a path surface to full-URL rows, filtered to the GSC source, when every day is present', async () => {
    const { sb, calls } = fakeSb((call) => {
      if (call.table === 'gsc_page_daily') return { data: null, error: MISSING }
      if (call.table === 'site_signal') {
        const wanted = filterVal(call, 'in', 'surface') as string[]
        const rows = fullUrlSeries(url, '2026-06-10', 28, { clicks: 1, impressions: 50 })
        return { data: rows.filter((r) => wanted.includes(r.surface)), error: null }
      }
      return { data: [], error: null }
    })
    const m = await measureLedgerRow({ sb, gscPageTotals: null }, sunriver)
    expect(m.ok).toBe(true)
    if (m.ok) expect(m.after).toBeCloseTo(2, 6) // 28 clicks / 1,400 impressions
    const signalCall = calls.find((c) => c.table === 'site_signal')!
    expect(filterVal(signalCall, 'eq', 'source')).toBe('gsc_search_analytics_api')
    expect(filterVal(signalCall, 'in', 'surface')).toContain(url)
  })

  it('a top-25 sample missing days is unmeasurable, not zero', async () => {
    const { sb } = fakeSb((call) => {
      if (call.table === 'gsc_page_daily') return { data: null, error: MISSING }
      if (call.table === 'site_signal') return { data: fullUrlSeries(url, '2026-06-10', 20, { clicks: 1, impressions: 50 }), error: null }
      return { data: [], error: null }
    })
    const m = await measureLedgerRow({ sb, gscPageTotals: null }, sunriver)
    expect(m.ok).toBe(false)
    if (!m.ok) expect(m.gap).toMatch(/20 of 28 days/)
  })

  it('prefers a live GSC pull over the sample', async () => {
    const { sb } = fakeSb((call) => (call.table === 'gsc_page_daily' ? { data: null, error: MISSING } : { data: [], error: null }))
    const totals = new Map([['/blog/sunriver-year-round-living-vs-vacation', { clicks: 20, impressions: 1327 }]])
    const m = await measureLedgerRow({ sb, gscPageTotals: async () => totals }, sunriver)
    expect(m.ok).toBe(true)
    if (m.ok) {
      expect(m.after).toBeCloseTo(1.507, 3)
      expect(m.source).toMatch(/live pull/)
    }
  })

  it('an unenumerated surface or unmapped metric is unmeasurable', async () => {
    const { sb } = fakeSb(() => ({ data: [], error: null }))
    const archive = await measureLedgerRow({ sb }, { ...sunriver, surface: 'legacy market-report archive (51 urls)', metric: 'gsc_clicks_28d' })
    expect(archive.ok).toBe(false)
    const unmapped = await measureLedgerRow({ sb }, { ...sunriver, metric: 'non_seo_domains_in_ledger' })
    expect(unmapped.ok).toBe(false)
  })
})

describe('closing rows: no data is not zero', () => {
  it('refuses a win without a delta, and an unmeasurable row with one', async () => {
    const { sb } = fakeSb(() => ({ data: { id: 'x' }, error: null }))
    expect((await closeLedgerRowWith(sb, { id: 'x', actualDelta: null, verdict: 'win' })).error).toMatch(/needs a measured/)
    expect((await closeLedgerRowWith(sb, { id: 'x', actualDelta: 0, verdict: 'unmeasurable' })).error).toMatch(/no actualDelta/)
    expect((await closeLedgerRowWith(sb, { id: 'x', actualDelta: null, verdict: 'inconclusive' })).error).toBeNull()
  })

  it('learnDueWindows writes NULL + unmeasurable, and falls back to inconclusive before the migration', async () => {
    const updates: Array<Record<string, unknown>> = []
    const { sb } = fakeSb((call) => {
      if (call.table === 'site_improvement_ledger' && call.op === 'select') {
        return { data: [{ ...sunriver, metric: 'non_seo_domains_in_ledger' }], error: null }
      }
      if (call.table === 'site_improvement_ledger' && call.op === 'update') {
        const p = call.payload as Record<string, unknown>
        updates.push(p)
        if (p.verdict === 'unmeasurable') {
          return { data: null, error: { code: '23514', message: 'violates check constraint "site_improvement_ledger_verdict_check"' } }
        }
        return { data: { id: sunriver.id }, error: null }
      }
      return { data: [], error: null }
    })
    const res = await learnDueWindows({ sb, gscPageTotals: null }, { now: new Date('2026-09-23T00:00:00Z') })
    expect(res.due).toBe(1)
    expect(res.outcomes[0]).toMatchObject({ verdict: 'inconclusive', actualDelta: null, written: true })
    expect(updates.map((u) => [u.verdict, u.actual_delta])).toEqual([
      ['unmeasurable', null],
      ['inconclusive', null],
    ])
    expect(String(updates[1]?.notes)).toMatch(/^shipped\nLearn 2026-09-23: UNMEASURABLE/)
  })

  it('a measured row gets a delta and a verdict', async () => {
    expect(verdictFor(-1.9, 1)).toBe('loss')
    expect(verdictFor(0.6, 1)).toBe('win')
    expect(verdictFor(0.2, 1)).toBe('flat')
  })
})
