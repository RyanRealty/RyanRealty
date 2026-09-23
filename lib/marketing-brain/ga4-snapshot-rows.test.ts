import { describe, expect, it } from 'vitest'
import type { GA4Summary } from '@/app/actions/ga4-report'
import { buildGa4DayRows, rowsForDay, withExactBrowserCounts } from './ga4-snapshot-rows'
import { foldHealthCounts, ga4DateToIso } from './ga4-health-counts'
import { parseDateRange } from './snapshot'

// Shaped like 2026-09-19: the mirror carries page_view, the browser stream is dead.
const SUMMARY: GA4Summary = {
  sessions: 699,
  totalUsers: 1204,
  newUsers: 0,
  averageSessionDurationSeconds: 0.4,
  engagementRate: 0,
  bounceRate: 1,
  topSources: [{ sourceMedium: '(not set)', sessions: 699, users: 1204, engagedSessions: 0, engagementRate: 0 }],
  topPages: [{ pagePath: '/contact', pageTitle: 'Contact', views: 300, users: 280, avgEngagementTimeSeconds: 0 }],
  totalLeadEvents: 8,
  leadEventRate: 8 / 699,
  topLeadEvents: [{ eventName: 'generate_lead', eventCount: 8, users: 8 }],
  leadSources: [{ sourceMedium: '(not set)', leadEvents: 8, users: 8 }],
  socialChannels: [],
  lpFunnels: [],
  topEvents: [
    { eventName: 'page_view', eventCount: 1631, users: 1204 },
    { eventName: 'generate_lead', eventCount: 8, users: 8 },
  ],
  aiReferrers: [],
}

const find = (rows: ReturnType<typeof rowsForDay>, scope: string, scopeId: string, metric: string) =>
  rows.find((r) => r.scope === scope && r.scope_id === scopeId && r.metric === metric)

describe('buildGa4DayRows', () => {
  const rows = buildGa4DayRows('2026-09-19', SUMMARY, {
    mirrorOn: true,
    exact: { sessionStart: 0, firstVisit: 0, googleOrganicSessions: 0 },
  })

  it('stamps the mirror-shaped rows (TRACK-1)', () => {
    for (const metric of ['sessions', 'total_users', 'new_users', 'bounce_rate', 'engagement_rate', 'avg_session_duration_seconds', 'lead_event_rate']) {
      expect(find(rows, 'account', '', metric)?.metadata?.mirror_inflated).toBe(true)
    }
    expect(find(rows, 'source', '(not set)', 'sessions')?.metadata).toMatchObject({ source_medium: '(not set)', mirror_inflated: true })
  })

  it('leaves real relayed counts unstamped', () => {
    expect(find(rows, 'event', 'page_view', 'event_count')?.metadata?.mirror_inflated).toBeUndefined()
    expect(find(rows, 'page', '/contact', 'page_views')?.metadata?.mirror_inflated).toBeUndefined()
    expect(find(rows, 'account', '', 'total_lead_events')?.metadata?.mirror_inflated).toBeUndefined()
    expect(find(rows, 'source', 'lead_source:(not set)', 'lead_events')?.metadata?.mirror_inflated).toBeUndefined()
  })

  // TRACK-2: session_start was absent from topEvents on 09-19, so no row was
  // written and a zero check had nothing to see.
  it('writes the browser-only events as explicit zeros', () => {
    expect(find(rows, 'event', 'session_start', 'event_count')?.value).toBe(0)
    expect(find(rows, 'event', 'first_visit', 'event_count')?.value).toBe(0)
    expect(find(rows, 'account', '', 'google_organic_sessions')?.value).toBe(0)
  })

  it('does not stamp a day before the mirror existed', () => {
    const old = buildGa4DayRows('2026-07-01', SUMMARY, { mirrorOn: false, exact: null })
    expect(old.some((r) => r.metadata?.mirror_inflated)).toBe(false)
  })
})

describe('withExactBrowserCounts', () => {
  it('replaces a top-50 session_start row with the exact count, once', () => {
    const base = rowsForDay('2026-09-16', {
      ...SUMMARY,
      topEvents: [...SUMMARY.topEvents, { eventName: 'session_start', eventCount: 80, users: 70 }],
    })
    const out = withExactBrowserCounts('2026-09-16', base, { sessionStart: 87, firstVisit: 74, googleOrganicSessions: 2 })
    const ss = out.filter((r) => r.scope === 'event' && r.scope_id === 'session_start')
    expect(ss).toHaveLength(1)
    expect(ss[0].value).toBe(87)
  })

  it('invents nothing when the exact query failed', () => {
    const base = rowsForDay('2026-09-19', SUMMARY)
    expect(withExactBrowserCounts('2026-09-19', base, null)).toBe(base)
  })
})

describe('foldHealthCounts', () => {
  it('gives every day in the window an entry and reads a missing GA4 row as 0', () => {
    const out = foldHealthCounts(
      '2026-09-16',
      '2026-09-19',
      [
        { dimensionValues: [{ value: '20260916' }, { value: 'session_start' }], metricValues: [{ value: '87' }] },
        { dimensionValues: [{ value: '20260916' }, { value: 'first_visit' }], metricValues: [{ value: '74' }] },
        { dimensionValues: [{ value: '20260918' }, { value: 'session_start' }], metricValues: [{ value: '1' }] },
      ],
      [{ dimensionValues: [{ value: '20260917' }], metricValues: [{ value: '1' }] }],
    )
    expect([...out.keys()]).toEqual(['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'])
    expect(out.get('2026-09-16')).toEqual({ sessionStart: 87, firstVisit: 74, googleOrganicSessions: 0 })
    expect(out.get('2026-09-17')).toEqual({ sessionStart: 0, firstVisit: 0, googleOrganicSessions: 1 })
    expect(out.get('2026-09-19')).toEqual({ sessionStart: 0, firstVisit: 0, googleOrganicSessions: 0 })
  })

  it('parses GA4 date values', () => {
    expect(ga4DateToIso('20260919')).toBe('2026-09-19')
    expect(ga4DateToIso('(other)')).toBeNull()
  })
})

describe('parseDateRange', () => {
  const now = new Date('2026-09-23T12:20:00Z')
  const req = (qs = '') => new Request(`https://x.test/api/cron/marketing-snapshot-ga4${qs}`)

  it('keeps the yesterday-only default for every other ingestor', () => {
    expect(parseDateRange(req(), undefined, now)).toEqual({ startDate: '2026-09-22', endDate: '2026-09-22' })
  })

  it('re-pulls the GA4 settle window today-3..today-1', () => {
    expect(parseDateRange(req(), { fromDaysAgo: 3, toDaysAgo: 1 }, now)).toEqual({ startDate: '2026-09-20', endDate: '2026-09-22' })
  })

  it('an explicit backfill range still wins', () => {
    expect(parseDateRange(req('?startDate=2026-09-01&endDate=2026-09-05'), { fromDaysAgo: 3, toDaysAgo: 1 }, now)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-05',
    })
  })
})
