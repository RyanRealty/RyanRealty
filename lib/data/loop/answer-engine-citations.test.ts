/**
 * readAnswerEngineCitations reads the newest run a page at a time (G48), and
 * reports UNKNOWN, never a zero, when it cannot read.
 */
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAnswerEngineCitations } from './answer-engine-citations'

type Row = { date: string; surface: string | null; metric: string; value: number; scope: string }

/** A chainable stand-in for sb.from('site_signal') that honors eq/gte/limit/range. */
function fakeClient(rows: Row[], opts: { failOn?: 'head' | 'page' } = {}) {
  const ranges: Array<[number, number]> = []
  const client = {
    from() {
      const filters: Array<(r: Row) => boolean> = []
      let limit: number | null = null
      let range: [number, number] | null = null
      let cols = ''
      const q = {
        select(c: string) {
          cols = c
          return q
        },
        eq(col: keyof Row | 'source', v: unknown) {
          if (col !== 'source') filters.push((r) => r[col as keyof Row] === v)
          return q
        },
        gte(col: keyof Row, v: string) {
          filters.push((r) => String(r[col]) >= v)
          return q
        },
        order() {
          return q
        },
        limit(n: number) {
          limit = n
          return q
        },
        range(a: number, b: number) {
          range = [a, b]
          ranges.push(range)
          return q
        },
        then(resolve: (v: { data: unknown; error: unknown }) => void) {
          const isHead = cols === 'date'
          if ((isHead && opts.failOn === 'head') || (!isHead && opts.failOn === 'page')) {
            return resolve({ data: null, error: { message: 'boom' } })
          }
          let out = rows.filter((r) => filters.every((f) => f(r)))
          out = [...out].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
          if (range) out = out.slice(range[0], range[1] + 1)
          if (limit != null) out = out.slice(0, limit)
          return resolve({ data: out, error: null })
        },
      }
      return q
    },
  }
  return { sb: client as unknown as SupabaseClient, ranges }
}

const NOW = new Date('2026-09-23T12:00:00Z')

function run(date: string, cited: number, extraCampaignRows = 0): Row[] {
  const rows: Row[] = [
    { date, surface: null, metric: 'queries_run', value: 20, scope: 'account' },
    { date, surface: null, metric: 'queries_answered', value: 18, scope: 'account' },
    { date, surface: null, metric: 'queries_cited', value: cited, scope: 'account' },
    { date, surface: 'query:bend homes for sale', metric: 'cited', value: 1, scope: 'campaign' },
    { date, surface: 'zillow.com', metric: 'competitor_citations', value: 9, scope: 'source' },
  ]
  for (let i = 0; i < extraCampaignRows; i++) {
    rows.push({ date, surface: `query:filler ${i}`, metric: 'cited', value: 0, scope: 'campaign' })
  }
  return rows
}

describe('readAnswerEngineCitations', () => {
  it('summarizes only the newest run', async () => {
    const { sb } = fakeClient([...run('2026-08-01', 1), ...run('2026-09-01', 3)])
    const r = await readAnswerEngineCitations(sb, NOW)
    expect(r.status).toBe('ok')
    expect(r.runDate).toBe('2026-09-01')
    expect(r.queriesCited).toBe(3)
    expect(r.citedQueries).toEqual(['bend homes for sale'])
    expect(r.topCompetitors).toEqual([{ domain: 'zillow.com', queries: 9 }])
  })

  it('pages past the 1,000-row cap instead of dropping rows', async () => {
    const { sb, ranges } = fakeClient(run('2026-09-01', 3, 1200))
    const r = await readAnswerEngineCitations(sb, NOW)
    expect(r.status).toBe('ok')
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(r.queriesRun).toBe(20)
  })

  it('reports unread, not zero, when no run landed in the window', async () => {
    const { sb } = fakeClient(run('2026-06-01', 3))
    const r = await readAnswerEngineCitations(sb, NOW)
    expect(r.status).toBe('unread')
    expect(r.runDate).toBeNull()
  })

  it('reports unreadable when either read errors', async () => {
    for (const failOn of ['head', 'page'] as const) {
      const { sb } = fakeClient(run('2026-09-01', 3), { failOn })
      const r = await readAnswerEngineCitations(sb, NOW)
      expect(r.status).toBe('unreadable')
    }
  })
})
