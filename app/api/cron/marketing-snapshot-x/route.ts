/**
 * X (Twitter) daily snapshot ingestor.
 *
 * Fetches organic account + tweet metrics from the X API v2 and decomposes
 * the response into marketing_channel_daily rows.
 *
 * Default: pulls yesterday (daily Vercel cron at 06:30 UTC).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * X API Tier Limits (2026):
 *   Free  — no timeline read, no analytics. Ingestor will fail at the
 *            /users/:id/tweets step.
 *   Basic ($100/mo) — timeline read ✓, public_metrics ✓,
 *            impression_count present but may be 0 (not reliably populated).
 *            Organic impressions/reach require Elevated.
 *   Elevated/Pro — full organic metrics including true impression_count.
 *
 * When a metric cannot be retrieved due to tier limits, the row is OMITTED
 * (not emitted as 0). The errors[] array in the response documents what was
 * skipped and why.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { getXAnalytics, getXAccessToken } from '@/lib/x'

export const maxDuration = 300

const SOURCE = 'x_api_v2'
const CHANNEL = 'x' as const

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

function rowsForDay(date: string, analytics: Awaited<ReturnType<typeof getXAnalytics>>): MetricRow[] {
  const rows: MetricRow[] = []
  const base = { date, channel: CHANNEL, source: SOURCE }
  const acc = analytics.account

  // -------------------------------------------------------------------------
  // Account-scope rows
  // -------------------------------------------------------------------------

  // followers_count — always available on Basic+
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'followers_count',
    value: acc.followersCount,
  })

  // following_count — always available on Basic+
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'following_count',
    value: acc.followingCount,
  })

  // tweet_count_today — derived from timeline, Basic+
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'tweet_count_today',
    value: acc.tweetCountToday,
    metadata: { derived: true, method: 'timeline_filter_by_date' },
  })

  // Daily engagement totals (summed from today's tweets via public_metrics)
  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'likes',
    value: acc.likes,
    metadata: { source_detail: 'sum_of_todays_tweets' },
  })

  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'replies',
    value: acc.replies,
    metadata: { source_detail: 'sum_of_todays_tweets' },
  })

  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'retweets',
    value: acc.retweets,
    metadata: { source_detail: 'sum_of_todays_tweets' },
  })

  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'quotes',
    value: acc.quotes,
    metadata: { source_detail: 'sum_of_todays_tweets' },
  })

  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'bookmarks',
    value: acc.bookmarks,
    metadata: { source_detail: 'sum_of_todays_tweets' },
  })

  rows.push({
    ...base,
    scope: 'account',
    scope_id: '',
    metric: 'engagements',
    value: acc.engagements,
    metadata: {
      source_detail: 'sum_likes_replies_retweets_quotes_bookmarks',
    },
  })

  // impressions — OMIT if tier-limited (value would be 0 = misleading).
  // Only emit if the API actually returned a non-zero value.
  if (!acc.tierLimited || acc.impressions > 0) {
    rows.push({
      ...base,
      scope: 'account',
      scope_id: '',
      metric: 'impressions',
      value: acc.impressions,
      metadata: { tier_limited: acc.tierLimited },
    })
  }
  // If impressions are tier-limited and zero, we do NOT emit the row.
  // This avoids a false "0 impressions" row that could mislead the brain.

  // -------------------------------------------------------------------------
  // Post-scope rows — top 10 tweets by impressions (last 30 days)
  // -------------------------------------------------------------------------
  for (const tweet of analytics.topTweets) {
    const postBase = {
      ...base,
      scope: 'post' as const,
      scope_id: tweet.tweetId,
      metadata: {
        text_snippet: tweet.textSnippet,
        created_at: tweet.createdAt,
        tweet_type: tweet.tweetType,
        tier_limited: tweet.tierLimited,
      },
    }

    // Always emit public engagement counts — these are available on Basic.
    rows.push({ ...postBase, metric: 'likes', value: tweet.likes })
    rows.push({ ...postBase, metric: 'replies', value: tweet.replies })
    rows.push({ ...postBase, metric: 'retweets', value: tweet.retweets })
    rows.push({ ...postBase, metric: 'quotes', value: tweet.quotes })
    rows.push({ ...postBase, metric: 'bookmarks', value: tweet.bookmarks })

    // impressions — same rule: only emit if non-zero or not tier-limited.
    if (!tweet.tierLimited || tweet.impressions > 0) {
      rows.push({ ...postBase, metric: 'impressions', value: tweet.impressions })
    }

    // link_clicks / profile_clicks / url_clicks: Elevated+ only.
    // Omit entirely on Basic — don't emit misleading zeros.
    // (tweet.linkClicks === 0 && tweet.tierLimited) => skip
  }

  return rows
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

  // Resolve access token once — shared across all days in the range.
  let accessToken: string
  try {
    accessToken = await getXAccessToken()
  } catch (e) {
    return NextResponse.json(
      { error: `X not connected: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  for (const day of dateIter(startDate, endDate)) {
    try {
      const analytics = await getXAnalytics(accessToken, day)

      // Propagate any per-day API errors into the result log.
      if (analytics.errors.length > 0) {
        errors.push(...analytics.errors.map((e) => `${day}: ${e}`))
      }

      const rows = rowsForDay(day, analytics)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: CHANNEL,
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
