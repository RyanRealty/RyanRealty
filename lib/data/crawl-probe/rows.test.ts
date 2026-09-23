import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatCrawlProbeLine,
  readCrawlProbeBaseline,
  readCrawlProbeStatus,
  upsertCrawlProbeRows,
  type CrawlProbeStatus,
} from './rows'

type Call = { method: string; args: unknown[] }

/** A PostgREST builder stand-in: records the chain, resolves to `result`. */
function fakeSb(result: { data?: unknown; error?: { message: string } | null } | ((calls: Call[]) => unknown)) {
  const log: Call[][] = []
  const client = {
    from(table: string) {
      const calls: Call[] = [{ method: 'from', args: [table] }]
      log.push(calls)
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'lt', 'gte', 'order', 'limit', 'upsert']) {
        builder[m] = (...args: unknown[]) => {
          calls.push({ method: m, args })
          return builder
        }
      }
      builder.then = (resolve: (v: unknown) => void) =>
        resolve(typeof result === 'function' ? result(calls) : { data: result.data ?? null, error: result.error ?? null })
      return builder
    },
  }
  return { sb: client as unknown as SupabaseClient, log }
}

describe('upsertCrawlProbeRows', () => {
  it('writes channel/scope/source crawl_probe, keyed on the table primary key, last write wins', async () => {
    const { sb, log } = fakeSb({ data: null })
    const at = new Date('2026-09-23T11:56:00Z')
    const res = await upsertCrawlProbeRows(
      sb,
      [
        { date: '2026-09-23', surface: '/sitemaps/geo.xml', metric: 'sitemap_child', value: 0, metadata: { a: 1 } },
        { date: '2026-09-23', surface: '/sitemaps/geo.xml', metric: 'sitemap_child', value: 1, metadata: { a: 2 } },
        { date: '2026-09-23', surface: '', metric: 'run', value: 1, metadata: {} },
      ],
      at,
    )
    expect(res).toEqual({ written: 2, error: null })
    const upsert = log[0].find((c) => c.method === 'upsert')!
    expect(log[0][0].args).toEqual(['marketing_channel_daily'])
    expect(upsert.args[1]).toEqual({ onConflict: 'date,channel,scope,scope_id,metric' })
    expect(upsert.args[0]).toEqual([
      {
        date: '2026-09-23',
        channel: 'crawl_probe',
        scope: 'crawl_probe',
        scope_id: '/sitemaps/geo.xml',
        metric: 'sitemap_child',
        value: 1,
        metadata: { a: 2 },
        source: 'crawl_probe',
        fetched_at: '2026-09-23T11:56:00.000Z',
      },
      {
        date: '2026-09-23',
        channel: 'crawl_probe',
        scope: 'crawl_probe',
        scope_id: '',
        metric: 'run',
        value: 1,
        metadata: {},
        source: 'crawl_probe',
        fetched_at: '2026-09-23T11:56:00.000Z',
      },
    ])
  })

  it('reports a write error instead of throwing', async () => {
    const { sb } = fakeSb({ error: { message: 'permission denied' } })
    const res = await upsertCrawlProbeRows(sb, [{ date: '2026-09-23', surface: '', metric: 'run', value: 0, metadata: {} }])
    expect(res.written).toBe(0)
    expect(res.error).toMatch(/permission denied/)
  })
})

describe('readCrawlProbeBaseline', () => {
  it('takes the newest answered count per child inside the lookback, skipping failed days', async () => {
    const { sb, log } = fakeSb({
      data: [
        { date: '2026-09-22', scope_id: '/sitemaps/geo.xml', metadata: { httpStatus: 504 } },
        { date: '2026-09-22', scope_id: '/sitemaps/core.xml', metadata: { httpStatus: 200, urlCount: 175 } },
        { date: '2026-09-21', scope_id: '/sitemaps/geo.xml', metadata: { httpStatus: 200, urlCount: 4712 } },
        { date: '2026-09-20', scope_id: '/sitemaps/core.xml', metadata: { httpStatus: 200, urlCount: 205 } },
      ],
    })
    const b = await readCrawlProbeBaseline(sb, '2026-09-23')
    expect(b.error).toBeNull()
    expect(Object.fromEntries(b.counts)).toEqual({
      '/sitemaps/core.xml': { count: 175, date: '2026-09-22' },
      '/sitemaps/geo.xml': { count: 4712, date: '2026-09-21' },
    })
    const calls = log[0]
    expect(calls).toContainEqual({ method: 'eq', args: ['metric', 'sitemap_child'] })
    expect(calls).toContainEqual({ method: 'lt', args: ['date', '2026-09-23'] })
    expect(calls).toContainEqual({ method: 'gte', args: ['date', '2026-09-16'] })
  })
})

describe('readCrawlProbeStatus + formatCrawlProbeLine', () => {
  const now = new Date('2026-09-23T14:00:00Z')

  it('reads the latest run row', async () => {
    const { sb } = fakeSb({
      data: [
        {
          date: '2026-09-23',
          value: 0,
          fetched_at: '2026-09-23T11:57:00Z',
          metadata: { checks: 312, failed: 7, failures: ['sitemap_child /sitemaps/core.xml: 30 duplicate URL(s)', 'page_fetch /x: HTTP 500'] },
        },
      ],
    })
    const s = await readCrawlProbeStatus(sb, now)
    expect(s).toMatchObject({ status: 'ok', lastRunDate: '2026-09-23', ageHours: 2.1, stale: false, passed: false, checks: 312, failed: 7 })
    expect(formatCrawlProbeLine(s)).toBe(
      'FAIL 7 of 312 checks on 2026-09-23, 2.1h ago: sitemap_child /sitemaps/core.xml: 30 duplicate URL(s); page_fetch /x: HTTP 500',
    )
  })

  it('says never ran, stale, and unreadable plainly', async () => {
    const never = await readCrawlProbeStatus(fakeSb({ data: [] }).sb, now)
    expect(formatCrawlProbeLine(never)).toBe('never ran (/api/cron/crawl-probe, daily 11:55 UTC)')

    const old: CrawlProbeStatus = { ...never, lastRunDate: '2026-09-20', lastRunAt: '2026-09-20T11:57:00Z', ageHours: 74, stale: true, passed: true, checks: 300 }
    expect(formatCrawlProbeLine(old)).toBe('STALE, last run over 36h ago. PASS 300 checks on 2026-09-20, 74h ago')

    const bad = await readCrawlProbeStatus(fakeSb({ error: { message: 'timeout' } }).sb, now)
    expect(bad.status).toBe('unreadable')
    expect(formatCrawlProbeLine(bad)).toMatch(/^UNREADABLE \(.*read failed: timeout\)\)$/)
  })
})
