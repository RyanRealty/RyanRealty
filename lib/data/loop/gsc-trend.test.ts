import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import type { GscClassRollupRow } from './gsc-store'
import {
  buildGscTrend,
  diffRollups,
  formatClassDelta,
  isDegradedClass,
  readGscTrend,
  topMovers,
  trendWindows,
} from './gsc-trend'

const r = (pageClass: string, market: string, impressions: number, position: number | null, clicks = 0, pages = 1): GscClassRollupRow => ({
  pageClass,
  market,
  impressions,
  position,
  clicks,
  pages,
})

describe('trendWindows', () => {
  it('anchors 28d + prior 28d and 7d + prior 7d on the newest stored day', () => {
    expect(trendWindows('2026-09-20')).toEqual({
      cur28: { start: '2026-08-24', end: '2026-09-20' },
      prev28: { start: '2026-07-27', end: '2026-08-23' },
      cur7: { start: '2026-09-14', end: '2026-09-20' },
      prev7: { start: '2026-09-07', end: '2026-09-13' },
    })
  })
})

describe('degraded rule (gsc-trend-1): money class, >= 15% impressions or >= 3 positions', () => {
  const degraded = (cur: GscClassRollupRow, prev: GscClassRollupRow) => isDegradedClass(diffRollups([cur], [prev])[0]!)

  it('flags a 15% impression loss and a 3-position slip', () => {
    expect(degraded(r('community', 'central-oregon', 850, 20), r('community', 'central-oregon', 1000, 20))).toBe(true)
    expect(degraded(r('city', 'central-oregon', 1000, 24.5), r('city', 'central-oregon', 1000, 21.5))).toBe(true)
  })

  it('does not flag 14.9% or a 2.9-position move', () => {
    expect(degraded(r('community', 'central-oregon', 852, 20), r('community', 'central-oregon', 1000, 20))).toBe(false)
    expect(degraded(r('city', 'central-oregon', 1000, 24.4), r('city', 'central-oregon', 1000, 21.5))).toBe(false)
  })

  it('ignores intended pruning (out of market), non-money classes and tiny classes', () => {
    expect(degraded(r('city', 'out-of-market', 100, 30), r('city', 'out-of-market', 1000, 20))).toBe(false)
    expect(degraded(r('listing', 'central-oregon', 100, 30), r('listing', 'central-oregon', 1000, 20))).toBe(false)
    expect(degraded(r('subdivision', 'unknown', 10, 40), r('subdivision', 'unknown', 99, 20))).toBe(false)
  })

  it('an improving position (smaller number) is not a slip', () => {
    expect(degraded(r('community', 'central-oregon', 1000, 11), r('community', 'central-oregon', 1000, 20))).toBe(false)
  })

  it('a class that vanished compares against zero', () => {
    const d = diffRollups([], [r('homes-for-sale-city', 'central-oregon', 500, 30)])[0]!
    expect(d.cur.impressions).toBe(0)
    expect(d.impressionsPct).toBe(-100)
    expect(isDegradedClass(d)).toBe(true)
  })
})

describe('buildGscTrend + topMovers', () => {
  it('status degraded when any money class is, and top three week-over-week movers by impressions', () => {
    const t = buildGscTrend({
      anchor: '2026-09-20',
      windows: trendWindows('2026-09-20'),
      cur28: [r('community', 'central-oregon', 700, 30), r('blog', 'central-oregon', 4000, 8)],
      prev28: [r('community', 'central-oregon', 1200, 22), r('blog', 'central-oregon', 4100, 8)],
      cur7: [r('community', 'central-oregon', 383, 30), r('listing', 'central-oregon', 2544, 12), r('blog', 'central-oregon', 1002, 8), r('home', 'central-oregon', 90, 20)],
      prev7: [r('community', 'central-oregon', 723, 25), r('listing', 'central-oregon', 4296, 12), r('blog', 'central-oregon', 1035, 8), r('home', 'central-oregon', 95, 20)],
      note: 'test',
    })
    expect(t.status).toBe('degraded')
    expect(t.degraded.map((d) => d.pageClass)).toEqual(['community'])
    expect(t.wow.map((d) => d.pageClass)).toEqual(['listing', 'community', 'blog'])
    expect(formatClassDelta(t.wow[0]!)).toBe(
      'listing (central-oregon): impr 4,296 -> 2,544 (-1,752, -40.8%) · clicks 0 -> 0 (0) · pos 12 -> 12 (0)',
    )
  })

  it('topMovers skips classes that did not move', () => {
    expect(topMovers(diffRollups([r('blog', 'central-oregon', 10, 5)], [r('blog', 'central-oregon', 10, 5)]))).toEqual([])
  })
})

describe('readGscTrend never reports ok without data', () => {
  function sb(opts: { coverage: [string, string] | 'missing' | 'empty'; rollup?: GscClassRollupRow[] }): SupabaseClient {
    const from = () => {
      let asc = true
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'limit']) b[m] = () => b
      b.order = (_c: string, o: { ascending: boolean }) => {
        asc = o.ascending
        return b
      }
      b.then = (res: (v: unknown) => unknown) => {
        if (opts.coverage === 'missing') return Promise.resolve(res({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }))
        if (opts.coverage === 'empty') return Promise.resolve(res({ data: [], error: null }))
        return Promise.resolve(res({ data: [{ date: asc ? opts.coverage[0] : opts.coverage[1] }], error: null }))
      }
      return b
    }
    const rpc = async () => ({
      data: (opts.rollup ?? []).map((x) => ({ page_class: x.pageClass, market: x.market, pages: x.pages, clicks: x.clicks, impressions: x.impressions, position: x.position })),
      error: null,
    })
    return { from, rpc } as unknown as SupabaseClient
  }
  const now = new Date('2026-09-23T12:00:00Z')

  it('unreadable when the table is missing, empty, stale or too short', async () => {
    expect((await readGscTrend(sb({ coverage: 'missing' }), now)).status).toBe('unreadable')
    expect((await readGscTrend(sb({ coverage: 'empty' }), now)).status).toBe('unreadable')
    const stale = await readGscTrend(sb({ coverage: ['2025-06-16', '2026-09-01'] }), now)
    expect(stale.status).toBe('unreadable')
    expect(stale.note).toMatch(/stopped/)
    const short = await readGscTrend(sb({ coverage: ['2026-09-01', '2026-09-20'] }), now)
    expect(short.status).toBe('unreadable')
    expect(short.note).toMatch(/backfill/)
  })

  it('ok when the store spans both windows and nothing slipped', async () => {
    const t = await readGscTrend(sb({ coverage: ['2025-06-16', '2026-09-20'], rollup: [r('community', 'central-oregon', 1000, 20)] }), now)
    expect(t.status).toBe('ok')
    expect(t.anchor).toBe('2026-09-20')
  })
})
