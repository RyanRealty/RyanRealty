/**
 * GA4 daily snapshot → marketing_channel_daily rows.
 *
 * Moved out of app/api/cron/marketing-snapshot-ga4/route.ts (a route module may
 * export only its handlers) so the decomposition is testable. The row shapes
 * are unchanged; two things are added (visibility audit 2026-09-22):
 *
 *   1. TRACK-1 — mirror-shaped rows (sessions, users, new users, engagement,
 *      bounce, session duration, lead-event rate, source/medium) carry
 *      metadata.mirror_inflated=true on days the Measurement Protocol page-view
 *      mirror was on. See lib/analytics/ga4-mirror.ts.
 *   2. TRACK-2 — the browser-only events session_start and first_visit, and
 *      google/organic sessions, are written from an exact per-day count and
 *      ALWAYS written, zero included. Before this, session_start was only
 *      stored when it made the top-50 events list, so the day it hit zero the
 *      row simply vanished — and a missing row is invisible to a zero check.
 */
import type { GA4Summary } from '@/app/actions/ga4-report'
import { stampMirrorInflated } from '@/lib/analytics/ga4-mirror'
import { GOOGLE_ORGANIC_SESSIONS_METRIC } from '@/lib/analytics/ga4-tracking-health'
import type { MetricRow } from '@/lib/marketing-brain/snapshot'

export const GA4_SNAPSHOT_SOURCE = 'ga4_data_api'

/** Browser-only events (Measurement Protocol cannot send them) written exactly every day. */
export const BROWSER_ONLY_EVENTS = ['session_start', 'first_visit'] as const
export type BrowserOnlyEvent = (typeof BROWSER_ONLY_EVENTS)[number]

export type ExactDayCounts = {
  sessionStart: number
  firstVisit: number
  googleOrganicSessions: number
}

export function rowsForDay(date: string, d: GA4Summary): MetricRow[] {
  const base = { date, channel: 'ga4' as const, source: GA4_SNAPSHOT_SOURCE }
  const accountRows: MetricRow[] = [
    { ...base, scope: 'account', scope_id: '', metric: 'sessions', value: d.sessions },
    { ...base, scope: 'account', scope_id: '', metric: 'total_users', value: d.totalUsers },
    { ...base, scope: 'account', scope_id: '', metric: 'new_users', value: d.newUsers },
    {
      ...base,
      scope: 'account',
      scope_id: '',
      metric: 'avg_session_duration_seconds',
      value: d.averageSessionDurationSeconds,
    },
    { ...base, scope: 'account', scope_id: '', metric: 'engagement_rate', value: d.engagementRate },
    { ...base, scope: 'account', scope_id: '', metric: 'bounce_rate', value: d.bounceRate },
    { ...base, scope: 'account', scope_id: '', metric: 'total_lead_events', value: d.totalLeadEvents },
    { ...base, scope: 'account', scope_id: '', metric: 'lead_event_rate', value: d.leadEventRate },
  ]

  const sourceRows: MetricRow[] = d.topSources.flatMap((s) => [
    {
      ...base,
      scope: 'source',
      scope_id: s.sourceMedium,
      metric: 'sessions',
      value: s.sessions,
      metadata: { source_medium: s.sourceMedium },
    },
    {
      ...base,
      scope: 'source',
      scope_id: s.sourceMedium,
      metric: 'users',
      value: s.users,
      metadata: { source_medium: s.sourceMedium },
    },
    {
      ...base,
      scope: 'source',
      scope_id: s.sourceMedium,
      metric: 'engaged_sessions',
      value: s.engagedSessions,
      metadata: { source_medium: s.sourceMedium },
    },
  ])

  const pageRows: MetricRow[] = d.topPages.flatMap((p) => [
    {
      ...base,
      scope: 'page',
      scope_id: p.pagePath,
      metric: 'page_views',
      value: p.views,
      metadata: { page_title: p.pageTitle },
    },
    {
      ...base,
      scope: 'page',
      scope_id: p.pagePath,
      metric: 'page_users',
      value: p.users,
      metadata: { page_title: p.pageTitle },
    },
  ])

  const leadEventRows: MetricRow[] = d.topLeadEvents.flatMap((e) => [
    {
      ...base,
      scope: 'campaign',
      scope_id: `lead_event:${e.eventName}`,
      metric: 'event_count',
      value: e.eventCount,
      metadata: { event_name: e.eventName },
    },
  ])

  const leadSourceRows: MetricRow[] = d.leadSources.flatMap((s) => [
    {
      ...base,
      scope: 'source',
      scope_id: `lead_source:${s.sourceMedium}`,
      metric: 'lead_events',
      value: s.leadEvents,
      metadata: { source_medium: s.sourceMedium },
    },
  ])

  // Per-LP-variant funnel — scope `lp`, scope_id is the variant slug,
  // metric encodes the event ('view_landing_page_count', 'generate_lead_count', etc.)
  // The downstream brain dashboard joins on lp_variant + computes
  // conversion_pct = generate_lead_count / view_landing_page_count.
  const lpFunnelRows: MetricRow[] = d.lpFunnels.map((f) => ({
    ...base,
    scope: 'lp',
    scope_id: f.lpVariant,
    metric: `${f.eventName}_count`,
    value: f.eventCount,
    metadata: { lp_variant: f.lpVariant, event_name: f.eventName, users: f.users },
  }))

  // Per-event aggregates — scope `event`, scope_id is the event_name.
  // Captures the rich engagement-event taxonomy from lib/tracking.ts beyond
  // just the 9 LEAD_EVENT_NAMES. Used by audit-website's engagement signal.
  const eventRows: MetricRow[] = d.topEvents.map((e) => ({
    ...base,
    scope: 'event',
    scope_id: e.eventName,
    metric: 'event_count',
    value: e.eventCount,
    metadata: { event_name: e.eventName, users: e.users },
  }))

  const socialChannelRows: MetricRow[] = d.socialChannels.flatMap((c) => [
    {
      ...base,
      scope: 'channel',
      scope_id: `social:${c.channel}`,
      metric: 'sessions',
      value: c.sessions,
      metadata: { channel: c.channel },
    },
    {
      ...base,
      scope: 'channel',
      scope_id: `social:${c.channel}`,
      metric: 'users',
      value: c.users,
      metadata: { channel: c.channel },
    },
  ])

  // AI-assistant referral traffic — the forward-looking "traffic through AI"
  // signal. GA4's native AI Assistant channel (added 2026-05-13) covers only
  // ChatGPT/Gemini/Claude and has NO backfill, so we instrument our own daily
  // series now. d.aiReferrers (classified via lib/ai-referrers across the full
  // engine set) gives one entry per engine; write a daily account TOTAL (even 0,
  // so the metric never goes falsely stale) plus a per-engine breakdown so the
  // scoreboard can show which LLMs drive traffic over time.
  const aiTotalSessions = d.aiReferrers.reduce((sum, r) => sum + r.sessions, 0)
  const aiRows: MetricRow[] = [
    { ...base, scope: 'account', scope_id: '', metric: 'ai_assistant_sessions', value: aiTotalSessions },
    ...d.aiReferrers.map((r) => ({
      ...base,
      scope: 'source' as const,
      scope_id: r.engine,
      metric: 'ai_assistant_sessions',
      value: r.sessions,
      metadata: { engine: r.engine, users: r.users },
    })),
  ]

  return [
    ...accountRows,
    ...sourceRows,
    ...pageRows,
    ...leadEventRows,
    ...leadSourceRows,
    ...socialChannelRows,
    ...lpFunnelRows,
    ...eventRows,
    ...aiRows,
  ]
}

/**
 * Replace the top-50 event_count rows for the browser-only events with exact
 * counts (zero written explicitly) and add the day's google/organic sessions.
 * `exact` null means the exact query failed: the top-50 rows stand and nothing
 * is invented.
 */
export function withExactBrowserCounts(date: string, rows: MetricRow[], exact: ExactDayCounts | null): MetricRow[] {
  if (!exact) return rows
  const replaced = new Set<string>(BROWSER_ONLY_EVENTS)
  const kept = rows.filter((r) => !(r.scope === 'event' && r.metric === 'event_count' && replaced.has(r.scope_id)))
  const base = { date, channel: 'ga4' as const, source: GA4_SNAPSHOT_SOURCE }
  const valueFor: Record<BrowserOnlyEvent, number> = {
    session_start: exact.sessionStart,
    first_visit: exact.firstVisit,
  }
  return [
    ...kept,
    ...BROWSER_ONLY_EVENTS.map((eventName) => ({
      ...base,
      scope: 'event' as const,
      scope_id: eventName,
      metric: 'event_count',
      value: valueFor[eventName],
      metadata: { event_name: eventName, exact_daily_count: true, browser_only: true },
    })),
    {
      ...base,
      scope: 'account' as const,
      scope_id: '',
      metric: GOOGLE_ORGANIC_SESSIONS_METRIC,
      value: exact.googleOrganicSessions,
      metadata: { source_medium: 'google / organic', exact_daily_count: true },
    },
  ]
}

/** Everything the cron writes for one GA4 day, before the health rows. */
export function buildGa4DayRows(
  date: string,
  summary: GA4Summary,
  opts: { mirrorOn: boolean; exact: ExactDayCounts | null },
): MetricRow[] {
  return stampMirrorInflated(withExactBrowserCounts(date, rowsForDay(date, summary), opts.exact), opts.mirrorOn)
}
