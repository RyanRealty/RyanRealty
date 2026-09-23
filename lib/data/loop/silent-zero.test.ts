import { describe, expect, it } from 'vitest'
import {
  classifyFeed,
  classifyWatchedSeries,
  formatSilentZeroReport,
  formatWatchReport,
  RETIRED_METRICS,
  WATCHED_SERIES,
  watchKey,
  type FeedWindow,
  type WatchedSeries,
} from './silent-zero'

// The generic fixture uses `reach`, a metric that is still LIVE. It used to use
// `impressions` — the original real case — but that name is now classified
// `retired`, because Meta removed it and its stored rows were never measured.
// Reusing it here would test the retired path while claiming to test the
// silent-zero path.
const w = (over: Partial<FeedWindow> = {}): FeedWindow => ({
  channel: 'instagram',
  metric: 'reach',
  rows: 90,
  total: 0,
  nonZeroRows: 0,
  latest: '2026-08-24',
  ...over,
})

describe('classifyFeed', () => {
  // The real case: Instagram impressions, 869 consecutive days of 0, landing on
  // time the whole way. Every freshness check passed.
  it('flags a feed that lands on schedule and reports only zeros', () => {
    const v = classifyFeed(w())
    expect(v.verdict).toBe('silent-zero')
    expect(v.note).toContain('every value 0')
  })

  it('does NOT flag a feed with real values mixed in', () => {
    expect(classifyFeed(w({ nonZeroRows: 12, total: 4745 })).verdict).toBe('healthy')
  })

  // A genuine zero day is ordinary. Only a long unbroken run is a defect.
  it('does not call a short window broken', () => {
    expect(classifyFeed(w({ rows: 3 })).verdict).toBe('sparse')
  })

  it('reports a feed that stopped landing entirely', () => {
    const v = classifyFeed(w({ rows: 0, latest: null }))
    expect(v.verdict).toBe('absent')
    expect(v.note).toContain('not landing')
  })

  it('a single real value in a long window is enough to clear it', () => {
    expect(classifyFeed(w({ nonZeroRows: 1 })).verdict).toBe('healthy')
  })
})

describe('formatSilentZeroReport', () => {
  it('says so plainly when everything is fine', () => {
    const out = formatSilentZeroReport([classifyFeed(w({ nonZeroRows: 5 }))])
    expect(out[0]).toContain('none reporting only zeros')
  })

  it('names each broken feed', () => {
    const out = formatSilentZeroReport([
      classifyFeed(w()),
      classifyFeed(w({ channel: 'meta_page', metric: 'post_impressions' })),
      classifyFeed(w({ channel: 'youtube', metric: 'impressions', rows: 0, latest: null })),
    ]).join('\n')
    expect(out).toContain('instagram.reach')
    expect(out).toContain('meta_page.post_impressions')
    expect(out).toContain('youtube.impressions')
    expect(out).toContain('ONLY ZEROS')
  })
})

describe('KNOWN_DORMANT — the guard\'s first false positive', () => {
  // It flagged every YouTube account metric as a silent zero. Probing the API
  // returned rows [[0,0]] and 2 views across 30 days: the channel is dormant and
  // the zeros are real. Reading stored data cannot tell a measured 0 from an
  // error written as 0 — they are the same byte — so a verified-real zero has to
  // be recorded, or the guard fires forever and gets ignored like the lead alarm.
  it('does not flag a feed whose zeros were verified real', () => {
    const v = classifyFeed(w({ channel: 'youtube', metric: 'views' }))
    expect(v.verdict).toBe('dormant')
    expect(v.note).toContain('zeros are real')
  })

  it('a wildcard covers every metric on that channel', () => {
    expect(classifyFeed(w({ channel: 'youtube', metric: 'likes' })).verdict).toBe('dormant')
    expect(classifyFeed(w({ channel: 'youtube', metric: 'anything' })).verdict).toBe('dormant')
  })

  it('still flags channels that are NOT on the list', () => {
    // `reach` is live on Instagram, so a run of zeros there is a real defect.
    // (`impressions` is no longer the example: it is now classified `retired`.)
    expect(classifyFeed(w({ channel: 'instagram', metric: 'reach' })).verdict).toBe('silent-zero')
  })

  it('dormant feeds do not appear in the report', () => {
    const out = formatSilentZeroReport([classifyFeed(w({ channel: 'youtube', metric: 'views' }))]).join('\n')
    expect(out).toContain('none reporting only zeros')
  })

  it('the silent-zero note asks the reader to verify, not to conclude', () => {
    const v = classifyFeed(w())
    expect(v.note).toContain('PROMPT, not a verdict')
    expect(v.note).toContain('Probe the API')
  })
})


describe('retired metrics are named, not chased', () => {
  // The distinction that matters: a DORMANT feed's zeros are real measurements
  // of a quiet account. A RETIRED metric's zeros were never measured — the API
  // 400d on the name and a 0 was written. Calling the second one "dormant"
  // would assert the opposite of the truth.
  const win = (channel: string, metric: string): FeedWindow => ({
    channel, metric, rows: 30, total: 0, nonZeroRows: 0, latest: '2026-08-25',
  })

  it('classifies a retired metric as retired, never as a silent zero', () => {
    const v = classifyFeed(win('instagram', 'impressions'))
    expect(v.verdict).toBe('retired')
    expect(v.note).toContain('retired')
  })

  it('says the stored rows were never measured', () => {
    const v = classifyFeed(win('meta_page', 'post_impressions'))
    expect(v.note).toContain('never measured')
  })

  it('retired outranks dormant so a channel-wide dormant rule cannot mislabel it', () => {
    // If a retired metric ever sat on a KNOWN_DORMANT channel, "zeros are real"
    // would be exactly backwards. Retired is checked first, on purpose.
    const retiredKeys = Object.keys(RETIRED_METRICS)
    expect(retiredKeys.length).toBeGreaterThan(0)
    for (const key of retiredKeys) {
      const [channel, metric] = key.split(':')
      expect(classifyFeed(win(channel, metric)).verdict).toBe('retired')
    }
  })

  it('a live metric on the same channel is still judged on its own merits', () => {
    expect(classifyFeed(win('instagram', 'views')).verdict).toBe('silent-zero')
    expect(classifyFeed({ ...win('instagram', 'views'), nonZeroRows: 12 }).verdict).toBe('healthy')
  })

  it('the report separates retired from a defect to chase', () => {
    const lines = formatSilentZeroReport([
      classifyFeed(win('instagram', 'impressions')),
      classifyFeed(win('instagram', 'views')),
    ])
    const joined = lines.join('\n')
    expect(joined).toContain('RETIRED')
    expect(joined).toContain('ONLY ZEROS')
    // The retired one must NOT be counted among the feeds to chase.
    expect(joined).toContain('1 feed(s) landing on schedule and reporting ONLY ZEROS')
  })
})

describe('scope in the generic key', () => {
  it('labels a scoped feed channel.scope.metric and keeps the dormant lookup on channel:metric', () => {
    const v = classifyFeed({ channel: 'youtube', scope: 'account', metric: 'views', rows: 30, total: 0, nonZeroRows: 0, latest: '2026-09-21' })
    expect(v.verdict).toBe('dormant')
    const out = formatSilentZeroReport([classifyFeed({ ...w(), scope: 'post' })]).join('\n')
    expect(out).toContain('instagram.post.reach')
  })
})

describe('watched series — TRACK-2 would have been caught', () => {
  const series = (id: string): WatchedSeries => {
    const s = WATCHED_SERIES.find((x) => x.scopeId === id || x.metric === id)
    if (!s) throw new Error(`no watched series ${id}`)
    return s
  }
  // The real daily shape (marketing_channel_daily, ga4 event rows): session_start
  // 72 / 87 / 10 / 1 on 09-15..09-18, then NO ROW on 09-19..09-21 while the
  // channel kept landing page_view rows every day.
  const landed = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21']
  const sessionStart = [
    { date: '2026-09-15', value: 72 },
    { date: '2026-09-16', value: 87 },
    { date: '2026-09-17', value: 10 },
    { date: '2026-09-18', value: 1 },
  ]

  it('watches ga4 session_start and first_visit by scope_id, plus the daily health verdict', () => {
    const keys = WATCHED_SERIES.map((s) => `${s.channel}.${s.scope}.${s.scopeId}.${s.metric}`)
    expect(keys).toContain('ga4.event.session_start.event_count')
    expect(keys).toContain('ga4.event.first_visit.event_count')
    expect(keys).toContain('ga4.account..tracking_health_ok')
  })

  it('flags session_start the first landed day it reads no row', () => {
    const v = classifyWatchedSeries(series('session_start'), sessionStart, landed.slice(0, 5))
    expect(v.verdict).toBe('went-silent')
    expect(v.run).toBe(1)
    expect(v.lastGood).toBe('2026-09-18')
  })

  it('reports the full run on 2026-09-22 (three dead landed days)', () => {
    const v = classifyWatchedSeries(series('session_start'), sessionStart, landed)
    expect(v.verdict).toBe('went-silent')
    expect(v.run).toBe(3)
    expect(v.note).toContain('through 2026-09-21')
  })

  it('an explicit 0 row counts the same as a missing row', () => {
    const v = classifyWatchedSeries(series('session_start'), [...sessionStart, { date: '2026-09-19', value: 0 }], landed.slice(0, 5))
    expect(v.verdict).toBe('went-silent')
  })

  it('stays healthy while the latest landed day is non-zero', () => {
    const v = classifyWatchedSeries(series('session_start'), sessionStart, landed.slice(0, 4))
    expect(v.verdict).toBe('healthy')
  })

  it('first_visit needs two dead days (a healthy day can carry 3)', () => {
    const fv = [{ date: '2026-09-17', value: 1 }]
    expect(classifyWatchedSeries(series('first_visit'), fv, landed.slice(0, 4)).verdict).toBe('healthy')
    expect(classifyWatchedSeries(series('first_visit'), fv, landed.slice(0, 5)).verdict).toBe('went-silent')
  })

  it('the old channel x metric window pass could not see it', () => {
    // event_count summed across events stayed non-zero every day (page_view).
    const v = classifyFeed({ channel: 'ga4', metric: 'event_count', rows: 1200, total: 90_000, nonZeroRows: 1150, latest: '2026-09-21' })
    expect(v.verdict).toBe('healthy')
  })
})

describe('watched health verdict', () => {
  const health = WATCHED_SERIES.find((s) => s.metric === 'tracking_health_ok')!

  it('flags the latest failing day and counts the run', () => {
    const v = classifyWatchedSeries(
      health,
      [
        { date: '2026-09-18', value: 1 },
        { date: '2026-09-19', value: 0 },
        { date: '2026-09-20', value: 0 },
      ],
      [],
    )
    expect(v.verdict).toBe('unhealthy')
    expect(v.run).toBe(2)
    expect(v.lastGood).toBe('2026-09-18')
  })

  it('a guard that has not written yet is info, not an alarm', () => {
    const v = classifyWatchedSeries(health, [], ['2026-09-21'])
    expect(v.verdict).toBe('absent')
    const out = formatWatchReport([v]).join('\n')
    expect(out).toContain('none went quiet')
    expect(out).toContain('(info)')
  })

  it('prints the stored failure reasons under the alarm', () => {
    const v = classifyWatchedSeries(health, [{ date: '2026-09-20', value: 0 }], [])
    const out = formatWatchReport([v], new Map([[watchKey(health), ['browser session_start was 0']]])).join('\n')
    expect(out).toContain('WATCHED series FAILING')
    expect(out).toContain('- browser session_start was 0')
  })
})
