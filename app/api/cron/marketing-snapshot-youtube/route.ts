/**
 * YouTube daily snapshot ingestor.
 *
 * Fetches YouTube Analytics (API v2) for the Ryan Realty channel and writes
 * rows to marketing_channel_daily in two scopes:
 *
 *   account — channel-level daily totals (views, watch time, subs, etc.)
 *   video   — per-video metrics for the top-15 videos by views in the last 30 days
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD processes one day at a
 * time. For the video scope, the 30-day window always looks back from the
 * requested date so per-video data is as fresh as possible for each day.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * Env vars required (OAuth credentials):
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REDIRECT_URI
 * Refresh token is read from public.youtube_auth (id='default') in Supabase.
 * getYouTubeAccessToken() handles token refresh automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getYouTubeAccessToken, getYouTubeAnalyticsDay, getYouTubeTopVideoMetrics } from '@/lib/youtube'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'youtube_analytics_api_v2'

// ---------------------------------------------------------------------------
// Date iteration helper (reused across all ingestors)
// ---------------------------------------------------------------------------

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

// ---------------------------------------------------------------------------
// Row builders — account scope
// ---------------------------------------------------------------------------

function accountRows(
  date: string,
  data: Awaited<ReturnType<typeof getYouTubeAnalyticsDay>>
): MetricRow[] {
  const base = {
    date,
    channel: 'youtube' as const,
    scope: 'account' as const,
    scope_id: '',
    source: SOURCE,
  }

  return [
    { ...base, metric: 'views', value: data.views },
    { ...base, metric: 'watch_time_minutes', value: data.watchTimeMinutes },
    { ...base, metric: 'subscribers_gained', value: data.subscribersGained },
    { ...base, metric: 'subscribers_lost', value: data.subscribersLost },
    { ...base, metric: 'average_view_duration_seconds', value: data.averageViewDurationSeconds },
    { ...base, metric: 'average_view_percentage', value: data.averageViewPercentage },
    { ...base, metric: 'card_click_rate', value: data.cardClickRate },
    { ...base, metric: 'card_impressions', value: data.cardImpressions },
    { ...base, metric: 'annotation_click_through_rate', value: data.annotationClickThroughRate },
    { ...base, metric: 'likes', value: data.likes },
    { ...base, metric: 'comments', value: data.comments },
    { ...base, metric: 'shares', value: data.shares },
  ]
}

// ---------------------------------------------------------------------------
// Row builders — video scope
// ---------------------------------------------------------------------------

function videoRows(
  date: string,
  videos: Awaited<ReturnType<typeof getYouTubeTopVideoMetrics>>
): MetricRow[] {
  return videos.flatMap((v): MetricRow[] => {
    const base = {
      date,
      channel: 'youtube' as const,
      scope: 'video' as const,
      scope_id: v.videoId,
      source: SOURCE,
      metadata: {
        title: v.metadata.title,
        published_at: v.metadata.publishedAt,
        duration_seconds: v.metadata.durationSeconds,
      },
    }

    return [
      { ...base, metric: 'views', value: v.views },
      { ...base, metric: 'watch_time_minutes', value: v.watchTimeMinutes },
      { ...base, metric: 'average_view_duration_seconds', value: v.averageViewDurationSeconds },
      {
        ...base,
        metric: 'average_view_percentage',
        value: v.averageViewPercentage,
        metadata: {
          ...base.metadata,
          note: 'audience retention — primary algorithm signal',
        },
      },
      { ...base, metric: 'subscribers_gained', value: v.subscribersGained },
      { ...base, metric: 'impressions', value: v.impressions },
      { ...base, metric: 'impressions_click_through_rate', value: v.impressionsClickThroughRate },
    ]
  })
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

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

  // Resolve the access token once for the entire run. getYouTubeAccessToken()
  // reads from public.youtube_auth and refreshes automatically if expired.
  let accessToken: string
  try {
    accessToken = await getYouTubeAccessToken()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'YouTube token unavailable' },
      { status: 500 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  for (const day of dateIter(startDate, endDate)) {
    // --- Account-level metrics ---
    try {
      const dayData = await getYouTubeAnalyticsDay(day, accessToken)
      const rows = accountRows(day, dayData)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(`account:${r.metric}`))
    } catch (e) {
      errors.push(`${day}:account: ${e instanceof Error ? e.message : String(e)}`)
    }

    // --- Per-video metrics (top 15 by views in trailing 30 days) ---
    try {
      const videos = await getYouTubeTopVideoMetrics(day, accessToken, 15)
      if (videos.length > 0) {
        const rows = videoRows(day, videos)
        const upserted = await upsertMetricRows(rows)
        totalRows += upserted
        rows.forEach((r) => metricsCovered.add(`video:${r.metric}`))
      }
    } catch (e) {
      errors.push(`${day}:video: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: 'youtube',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
