import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { buildGscTrend, trendWindows, type GscTrend } from './gsc-trend'
import {
  formatMeasurerBrief,
  readLatestScoreboardSnapshot,
  SNAPSHOT_STALE_DAYS,
  writeScoreboardSnapshot,
  type ScoreboardSnapshot,
} from './scoreboard-snapshot'
import type { CompanyScoreboardSignals } from './signals'

// Visibility audit 2026-09-22 (PROCESS-1, TRACK-11): the brief's measurer block
// must say plainly when there is no snapshot, when the Monday run was missed,
// and which page classes moved most week over week.

const now = new Date('2026-09-28T15:00:00Z')

const row = (pageClass: string, impressions: number, clicks: number, position: number) => ({
  pageClass,
  market: 'central-oregon',
  pages: 10,
  clicks,
  impressions,
  position,
})

const anchor = '2026-09-25'
const liveTrend: GscTrend = buildGscTrend({
  anchor,
  windows: trendWindows(anchor),
  cur28: [row('community', 700, 3, 30.2), row('blog', 1000, 20, 8)],
  prev28: [row('community', 1200, 9, 22.1), row('blog', 1000, 20, 8)],
  cur7: [row('community', 150, 1, 31), row('city', 300, 2, 25), row('blog', 260, 5, 8), row('home', 90, 3, 20)],
  prev7: [row('community', 400, 2, 24), row('city', 250, 1, 26), row('blog', 250, 5, 8), row('home', 100, 3, 20)],
  note: 'store 2026-07-31..2026-09-25; anchor 2026-09-25',
})

const unreadable: GscTrend = {
  status: 'unreadable',
  note: 'gsc_page_daily missing: apply the migration',
  anchor: null,
  windows: null,
  classes28: [],
  degraded: [],
  wow: [],
  source: 'test',
}

function snapshot(takenAt: string, gsc: Partial<GscTrend> = {}): { status: 'ok'; row: ScoreboardSnapshot } {
  return {
    status: 'ok',
    row: {
      id: 'snap-1',
      takenAt,
      source: 'cron:loop-weekly-measure',
      gscStatus: gsc.status ?? 'ok',
      gsc,
      signals: { crm: { people: 23016 }, ledger: { openWindows: 1, expiredUnlearned: 0 } } as unknown as Partial<CompanyScoreboardSignals>,
      run: { store: { status: 'written', pages: 41360, queryPages: 15015, startDate: '2026-07-31', endDate: '2026-09-25' }, seed: { inserted: 2, versionGaps: ['SITE-193', 'SITE-194'] }, learn: { due: 0 } },
    },
  }
}

describe('formatMeasurerBrief', () => {
  it('says there is no snapshot and the trend is unreadable, naming why', () => {
    const lines = formatMeasurerBrief({ snapshot: { status: 'missing', reason: 'loop_scoreboard_snapshots missing' }, live: unreadable, now })
    expect(lines[0]).toBe('snapshot: none (loop_scoreboard_snapshots missing)')
    expect(lines.at(-1)).toBe('GSC week over week by page class: UNREADABLE (gsc_page_daily missing: apply the migration)')
  })

  it('prints the snapshot run and flags a missed Monday', () => {
    const fresh = formatMeasurerBrief({ snapshot: snapshot('2026-09-28T13:00:00Z'), live: liveTrend, now })
    expect(fresh[0]).toBe('snapshot: 2026-09-28T13:00:00Z (0d ago, cron:loop-weekly-measure)')
    expect(fresh[1]).toContain('people 23016 · ledger open 1 / stranded 0')
    expect(fresh[2]).toContain('store written 41360 page rows + 15015 query x page rows 2026-07-31..2026-09-25')
    expect(fresh[2]).toContain('seeded 2 (SITE-193, SITE-194)')
    const stale = formatMeasurerBrief({ snapshot: snapshot('2026-09-14T13:00:00Z'), live: liveTrend, now })
    expect(stale[0]).toContain(`STALE: older than ${SNAPSHOT_STALE_DAYS} days`)
  })

  it('lists the top three week-over-week class moves by impressions, then the degraded classes', () => {
    const lines = formatMeasurerBrief({ snapshot: snapshot('2026-09-28T13:00:00Z'), live: liveTrend, now })
    const i = lines.findIndex((l) => l.startsWith('GSC week over week by page class (live; 2026-09-19..2026-09-25 vs 2026-09-12..2026-09-18), top 3:'))
    expect(i).toBeGreaterThan(-1)
    expect(lines[i + 1]).toMatch(/^ {2}community \(central-oregon\): impr 400 -> 150 \(-250, -62.5%\)/)
    expect(lines[i + 2]).toMatch(/^ {2}city \(central-oregon\): impr 250 -> 300 \(\+50, \+20%\)/)
    expect(lines[i + 3]).toMatch(/^ {2}(blog|home) \(central-oregon\)/)
    expect(lines[i + 4]).toBe('DEGRADED money classes (28d to 2026-09-25 vs prior 28d): community/central-oregon')
  })

  it('falls back to the snapshot trend when the live read is unreadable', () => {
    const lines = formatMeasurerBrief({ snapshot: snapshot('2026-09-28T13:00:00Z', liveTrend), live: unreadable, now })
    expect(lines.some((l) => l.startsWith('GSC week over week by page class (snapshot;'))).toBe(true)
  })
})

describe('snapshot I/O before the migration', () => {
  const MISSING = { code: 'PGRST205', message: "Could not find the table 'public.loop_scoreboard_snapshots' in the schema cache" }
  const chain = (result: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['insert', 'select', 'order', 'limit', 'single']) b[m] = () => b
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(res(result))
    return b
  }

  it('write and read report "missing", not an error', async () => {
    const sb = { from: () => chain({ data: null, error: MISSING }) } as unknown as SupabaseClient
    const signals = { fetchedAt: now.toISOString(), gsc: { status: 'unreadable', trend: unreadable } } as unknown as CompanyScoreboardSignals
    expect((await writeScoreboardSnapshot(sb, { source: 'test', signals, run: {} })).status).toBe('missing')
    expect((await readLatestScoreboardSnapshot(sb)).status).toBe('missing')
  })

  it('an empty table reads as empty', async () => {
    const sb = { from: () => chain({ data: [], error: null }) } as unknown as SupabaseClient
    expect(await readLatestScoreboardSnapshot(sb)).toEqual({ status: 'empty', reason: 'no snapshot yet: the Monday measurer has not run' })
  })
})
