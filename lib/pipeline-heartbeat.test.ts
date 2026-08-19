import { describe, it, expect } from 'vitest'
import {
  ageHours,
  evalAudienceSync,
  evalMacroSeries,
  evalSkySlopeMirror,
  evalExpired,
  evalFsbo,
  evalMarketStats,
  evalSavedSearch,
  evalSearchMv,
  evalSyncDelta,
  formatAge,
  probeFailed,
  summarizeHeartbeat,
} from './pipeline-heartbeat'

const NOW = new Date('2026-07-21T12:30:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

describe('ageHours / formatAge', () => {
  it('computes hours between iso and now', () => {
    expect(ageHours(hoursAgo(3), NOW)).toBeCloseTo(3)
  })
  it('returns null for null, undefined, and garbage', () => {
    expect(ageHours(null, NOW)).toBeNull()
    expect(ageHours(undefined, NOW)).toBeNull()
    expect(ageHours('not-a-date', NOW)).toBeNull()
  })
  it('formats never / hours / days', () => {
    expect(formatAge(null)).toBe('never')
    expect(formatAge(3.25)).toBe('3.3h')
    expect(formatAge(72)).toBe('3.0d')
  })
})

describe('evalSyncDelta (2h threshold on max(modified_at) in listing_tile_mv)', () => {
  it('green when modifications arrived within 2h', () => {
    const c = evalSyncDelta(hoursAgo(0.5), hoursAgo(0.2), NOW)
    expect(c.status).toBe('green')
    expect(c.name).toBe('pipeline:sync-delta')
  })
  it('red at exactly 2h and beyond', () => {
    expect(evalSyncDelta(hoursAgo(2), hoursAgo(0.2), NOW).status).toBe('red')
    expect(evalSyncDelta(hoursAgo(10), hoursAgo(0.2), NOW).status).toBe('red')
  })
  it('names the sync-delta ingest when the MV refresh is alive but modifications stopped', () => {
    const c = evalSyncDelta(hoursAgo(5), hoursAgo(0.5), NOW)
    expect(c.status).toBe('red')
    expect(c.note).toMatch(/sync-delta ingest/i)
  })
  it('names the MV refresh when refreshed_at is also stale (the 8-days-unnoticed mode)', () => {
    const c = evalSyncDelta(hoursAgo(5), hoursAgo(5), NOW)
    expect(c.status).toBe('red')
    expect(c.note).toMatch(/refresh itself is stale/i)
  })
  it('red with refresh-dead note when both signals are missing entirely', () => {
    const c = evalSyncDelta(null, null, NOW)
    expect(c.status).toBe('red')
    expect(c.value).toContain('never')
  })
})

describe('evalSearchMv (2h threshold on refreshed_at)', () => {
  it('green when refreshed within 2h', () => {
    expect(evalSearchMv(hoursAgo(1), NOW).status).toBe('green')
  })
  it('red when stale or never refreshed', () => {
    expect(evalSearchMv(hoursAgo(3), NOW).status).toBe('red')
    expect(evalSearchMv(null, NOW).status).toBe('red')
  })
})

describe('evalFsbo (3-day threshold, Apify-cap failure mode named)', () => {
  it('green within 3 days', () => {
    expect(evalFsbo(daysAgo(1), NOW).status).toBe('green')
    expect(evalFsbo(daysAgo(2.9), NOW).status).toBe('green')
  })
  it('red at 3 days and the note names the Apify usage cap', () => {
    const c = evalFsbo(daysAgo(3), NOW)
    expect(c.status).toBe('red')
    expect(c.note).toMatch(/Apify/)
    expect(c.note).toMatch(/usage cap/i)
  })
  it('red when the table has no rows at all', () => {
    expect(evalFsbo(null, NOW).status).toBe('red')
  })
})

describe('evalExpired (7-day soft WARN — never red)', () => {
  it('green within 7 days', () => {
    expect(evalExpired(daysAgo(2), NOW).status).toBe('green')
  })
  it('yellow (never red) beyond 7 days or with no rows', () => {
    expect(evalExpired(daysAgo(8), NOW).status).toBe('yellow')
    expect(evalExpired(null, NOW).status).toBe('yellow')
  })
})

describe('evalSavedSearch (26h on bookkeeping stamp OR sent alert event)', () => {
  it('green when the bookkeeping stamp is fresh even with no recent sends', () => {
    expect(evalSavedSearch(hoursAgo(2), null, 120, NOW).status).toBe('green')
  })
  it('green when only the email event is fresh', () => {
    expect(evalSavedSearch(hoursAgo(40), hoursAgo(3), 120, NOW).status).toBe('green')
  })
  it('red when both signals exceed 26h', () => {
    const c = evalSavedSearch(hoursAgo(30), hoursAgo(48), 120, NOW)
    expect(c.status).toBe('red')
    expect(c.note).toMatch(/saved-search/i)
  })
  it('red when neither signal ever fired but alerts exist', () => {
    expect(evalSavedSearch(null, null, 5, NOW).status).toBe('red')
  })
  it('green with zero active alert rows (nothing to scan is not a failure)', () => {
    const c = evalSavedSearch(null, null, 0, NOW)
    expect(c.status).toBe('green')
    expect(c.value).toContain('0 active')
  })
})

describe('evalMarketStats (8h threshold on max(computed_at))', () => {
  it('green at the healthy ~5.5h reading (07:00 recompute, 12:30 check)', () => {
    expect(evalMarketStats(hoursAgo(5.5), NOW).status).toBe('green')
  })
  it('red at 8h and when empty', () => {
    expect(evalMarketStats(hoursAgo(8), NOW).status).toBe('red')
    expect(evalMarketStats(null, NOW).status).toBe('red')
  })
})

describe('evalAudienceSync (36h threshold on max(meta_audience_log.ran_at))', () => {
  it('green when the daily cron logged within 36h', () => {
    expect(evalAudienceSync(hoursAgo(20), NOW).status).toBe('green')
    expect(evalAudienceSync(hoursAgo(1), NOW).status).toBe('green')
  })
  it('red at/after 36h and when it never ran, naming the dry-run-still-logs insight', () => {
    expect(evalAudienceSync(hoursAgo(36), NOW).status).toBe('red')
    const never = evalAudienceSync(null, NOW)
    expect(never.status).toBe('red')
    expect(never.note).toContain('META_AUDIENCE_PUSH_ENABLED')
  })
})

describe('probeFailed', () => {
  it('is red and carries the query error', () => {
    const c = probeFailed('pipeline:fsbo-scrape', 'relation missing')
    expect(c.status).toBe('red')
    expect(c.note).toBe('relation missing')
  })
})

describe('evalSkySlopeMirror (36h threshold on skyslope_transactions.synced_at)', () => {
  it('green when the inbound cron stamped within 36h', () => {
    expect(evalSkySlopeMirror(hoursAgo(12), NOW).status).toBe('green')
    expect(evalSkySlopeMirror(hoursAgo(35.9), NOW).status).toBe('green')
  })
  it('red at 36h, never, and the June 10 founding sample', () => {
    expect(evalSkySlopeMirror(hoursAgo(36), NOW).status).toBe('red')
    expect(evalSkySlopeMirror(null, NOW).status).toBe('red')
    const founding = evalSkySlopeMirror('2026-06-10T00:35:10.142Z', NOW)
    expect(founding.status).toBe('red')
    expect(founding.note).toMatch(/skyslope-mirror-refresh/i)
  })
})

describe('evalMacroSeries (192h threshold on market_history_weekly mortgage_rate_30yr)', () => {
  const moving = [6.67, 6.72, 6.58, 6.61, 6.55, 6.63]

  it('green the morning after Monday ingest and on the Monday just before it', () => {
    expect(
      evalMacroSeries(
        { latestCapturedAt: hoursAgo(23.5), latestWeekStart: '2026-07-20', recentValues: moving },
        NOW,
      ).status,
    ).toBe('green')
    // The oldest healthy reading: Monday 12:30 UTC, 30 minutes before the week's run.
    expect(
      evalMacroSeries(
        { latestCapturedAt: hoursAgo(167.5), latestWeekStart: '2026-07-13', recentValues: moving },
        NOW,
      ).status,
    ).toBe('green')
  })

  it('red at 192h, naming the cron and the drift it prevents', () => {
    const stale = evalMacroSeries(
      { latestCapturedAt: hoursAgo(192), latestWeekStart: '2026-07-07', recentValues: moving },
      NOW,
    )
    expect(stale.status).toBe('red')
    expect(stale.note).toMatch(/market-history-snapshot/)
    expect(stale.value).toContain('6.67%')
  })

  it('red when the series has never been captured, pointing at the fallback', () => {
    const never = evalMacroSeries({ latestCapturedAt: null, latestWeekStart: null, recentValues: [] }, NOW)
    expect(never.status).toBe('red')
    expect(never.note).toMatch(/has ever been captured/i)
    expect(never.note).toMatch(/hardcoded fallback/i)
  })

  it('yellow when fresh rows carry one unchanged value for four weeks', () => {
    const flat = evalMacroSeries(
      { latestCapturedAt: hoursAgo(20), latestWeekStart: '2026-07-20', recentValues: [6.5, 6.5, 6.5, 6.5, 6.4] },
      NOW,
    )
    expect(flat.status).toBe('yellow')
    expect(flat.value).toContain('unchanged 4 weeks')
  })

  it('stays green when only three weeks match — a flat run is not yet a frozen series', () => {
    expect(
      evalMacroSeries(
        { latestCapturedAt: hoursAgo(20), latestWeekStart: '2026-07-20', recentValues: [6.5, 6.5, 6.5, 6.4] },
        NOW,
      ).status,
    ).toBe('green')
  })

  it('a stale series is stale even when its values are moving — recency is judged first', () => {
    expect(
      evalMacroSeries(
        { latestCapturedAt: daysAgo(30), latestWeekStart: '2026-06-22', recentValues: moving },
        NOW,
      ).status,
    ).toBe('red')
  })
})

describe('summarizeHeartbeat', () => {
  it('healthy when nothing is red, even with warns', () => {
    const s = summarizeHeartbeat(
      [evalExpired(daysAgo(10), NOW), evalFsbo(daysAgo(1), NOW)],
      NOW,
    )
    expect(s.healthy).toBe(true)
    expect(s.stale).toHaveLength(0)
    expect(s.warn).toHaveLength(1)
    expect(s.subject).toBe('Pipeline heartbeat: 0 stale')
  })
  it('counts stale reds in the subject and lists every check in the body', () => {
    const checks = [
      evalSyncDelta(hoursAgo(5), hoursAgo(5), NOW),
      evalFsbo(daysAgo(4), NOW),
      evalExpired(daysAgo(1), NOW),
      evalMarketStats(hoursAgo(1), NOW),
    ]
    const s = summarizeHeartbeat(checks, NOW)
    expect(s.healthy).toBe(false)
    expect(s.stale).toHaveLength(2)
    expect(s.subject).toBe('Pipeline heartbeat: 2 stale')
    expect(s.text).toContain('STALE  pipeline:sync-delta')
    expect(s.text).toContain('STALE  pipeline:fsbo-scrape')
    expect(s.text).toContain('OK  pipeline:expired-detect')
    expect(s.text).toContain('OK  pipeline:market_stats_cache')
    expect(s.text).toContain('Apify')
  })
  it('marks warns as WARN lines in the body', () => {
    const s = summarizeHeartbeat([evalExpired(null, NOW)], NOW)
    expect(s.text).toContain('WARN  pipeline:expired-detect')
  })
})
