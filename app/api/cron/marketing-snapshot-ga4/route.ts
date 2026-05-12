/**
 * GA4 daily snapshot ingestor.
 *
 * Fetches website analytics from GA4 via getGA4Summary() and decomposes
 * the response into marketing_channel_daily rows.
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one row per
 * day in that range, calling GA4 once per day to keep per-day attribution
 * accurate.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getGA4Summary } from '@/app/actions/ga4-report'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'ga4_data_api'

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

function rowsForDay(date: string, summary: Awaited<ReturnType<typeof getGA4Summary>>): MetricRow[] {
  if (!summary.ok) return []
  const d = summary.data
  const base = { date, channel: 'ga4' as const, source: SOURCE }
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

  return [
    ...accountRows,
    ...sourceRows,
    ...pageRows,
    ...leadEventRows,
    ...leadSourceRows,
    ...socialChannelRows,
  ]
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let startDate: string
  let endDate: string
  try {
    ;({ startDate, endDate } = parseDateRange(request))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'invalid date range' },
      { status: 400 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  for (const day of dateIter(startDate, endDate)) {
    try {
      const summary = await getGA4Summary(day, day)
      if (!summary.ok) {
        errors.push(`${day}: ${summary.error}`)
        continue
      }
      const rows = rowsForDay(day, summary)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: 'ga4',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
