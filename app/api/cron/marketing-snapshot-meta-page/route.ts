/**
 * Meta Page + Instagram organic daily snapshot ingestor.
 *
 * Fetches Facebook Page and Instagram Business account-level and post-level
 * organic metrics via the Meta Graph API and writes them to marketing_channel_daily.
 *
 * Both channels share the same Meta Page access token, so they are handled in
 * a single route. Facebook rows use channel='meta_page'; Instagram rows use
 * channel='instagram'.
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one day at a time.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * Env vars required:
 *   META_PAGE_ACCESS_TOKEN     — long-lived Page access token
 *   META_FB_PAGE_ID            — Facebook Page ID
 *   META_IG_BUSINESS_ACCOUNT_ID — Instagram Business Account ID
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  getPageInsights,
  getPagePostsWithInsights,
  getIGAccountInsights,
  getIGMediaWithInsights,
  PagePost,
  IGMedia,
} from '@/lib/meta-graph'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'meta_graph_v25'

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

// ---------------------------------------------------------------------------
// Facebook Page — row builders
// ---------------------------------------------------------------------------

function fbAccountRows(
  date: string,
  pageInsights: Awaited<ReturnType<typeof getPageInsights>>
): MetricRow[] {
  const base = { date, channel: 'meta_page' as const, scope: 'account' as const, scope_id: '', source: SOURCE }
  return [
    { ...base, metric: 'page_impressions', value: pageInsights.page_impressions },
    { ...base, metric: 'page_impressions_unique', value: pageInsights.page_impressions_unique },
    { ...base, metric: 'page_engaged_users', value: pageInsights.page_engaged_users },
    { ...base, metric: 'page_post_engagements', value: pageInsights.page_post_engagements },
    { ...base, metric: 'page_fans', value: pageInsights.page_fans },
    { ...base, metric: 'page_fan_adds', value: pageInsights.page_fan_adds },
    { ...base, metric: 'page_video_views', value: pageInsights.page_video_views },
  ]
}

function fbPostRows(date: string, posts: PagePost[]): MetricRow[] {
  return posts.flatMap((post): MetricRow[] => {
    const base = {
      date,
      channel: 'meta_page' as const,
      scope: 'post' as const,
      scope_id: post.id,
      source: SOURCE,
      metadata: {
        created_time: post.created_time,
        permalink_url: post.permalink_url,
        message: post.message,
      },
    }
    return [
      { ...base, metric: 'post_impressions', value: post.post_impressions },
      { ...base, metric: 'post_engaged_users', value: post.post_engaged_users },
      { ...base, metric: 'post_reactions_by_type_total', value: post.post_reactions_by_type_total },
      { ...base, metric: 'post_clicks', value: post.post_clicks },
    ]
  })
}

// ---------------------------------------------------------------------------
// Instagram — row builders
// ---------------------------------------------------------------------------

function igAccountRows(
  date: string,
  igInsights: Awaited<ReturnType<typeof getIGAccountInsights>>
): MetricRow[] {
  const base = { date, channel: 'instagram' as const, scope: 'account' as const, scope_id: '', source: SOURCE }
  return [
    { ...base, metric: 'impressions', value: igInsights.impressions },
    { ...base, metric: 'reach', value: igInsights.reach },
    { ...base, metric: 'profile_views', value: igInsights.profile_views },
    { ...base, metric: 'follower_count', value: igInsights.follower_count },
    { ...base, metric: 'website_clicks', value: igInsights.website_clicks },
  ]
}

function igMediaRows(date: string, media: IGMedia[]): MetricRow[] {
  return media.flatMap((m): MetricRow[] => {
    const base = {
      date,
      channel: 'instagram' as const,
      scope: 'post' as const,
      scope_id: m.id,
      source: SOURCE,
      metadata: {
        media_type: m.media_type,
        media_url: m.media_url,
        permalink: m.permalink,
        caption: m.caption,
        timestamp: m.timestamp,
      },
    }
    return [
      { ...base, metric: 'impressions', value: m.impressions },
      { ...base, metric: 'reach', value: m.reach },
      { ...base, metric: 'engagement', value: m.engagement },
      { ...base, metric: 'saved', value: m.saved },
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

  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim()
  const pageId = process.env.META_FB_PAGE_ID?.trim()
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID?.trim()

  if (!token || !pageId || !igUserId) {
    return NextResponse.json(
      {
        error: 'Missing required env vars: META_PAGE_ACCESS_TOKEN, META_FB_PAGE_ID, META_IG_BUSINESS_ACCOUNT_ID',
      },
      { status: 500 }
    )
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

  // Post-scope metrics are fetched once for the full range (they reflect
  // lifetime totals, not per-day deltas) and written for each day in the
  // requested range. We fetch them outside the day loop to avoid N identical
  // Graph calls when backfilling.
  let fbPosts: PagePost[] = []
  let igMedia: IGMedia[] = []

  try {
    fbPosts = await getPagePostsWithInsights(token, pageId)
  } catch (e) {
    errors.push(`fb_posts_fetch: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    igMedia = await getIGMediaWithInsights(token, igUserId)
  } catch (e) {
    errors.push(`ig_media_fetch: ${e instanceof Error ? e.message : String(e)}`)
  }

  for (const day of dateIter(startDate, endDate)) {
    // Facebook Page account-level
    try {
      const pageInsights = await getPageInsights(token, pageId, day)
      const rows = fbAccountRows(day, pageInsights)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(`meta_page:${r.metric}`))
    } catch (e) {
      errors.push(`${day}:fb_account: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Facebook Page post-level (lifetime totals written per day)
    if (fbPosts.length > 0) {
      try {
        const rows = fbPostRows(day, fbPosts)
        const upserted = await upsertMetricRows(rows)
        totalRows += upserted
        rows.forEach((r) => metricsCovered.add(`meta_page:post:${r.metric}`))
      } catch (e) {
        errors.push(`${day}:fb_posts: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Instagram account-level
    try {
      const igInsights = await getIGAccountInsights(token, igUserId, day)
      const rows = igAccountRows(day, igInsights)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(`instagram:${r.metric}`))
    } catch (e) {
      errors.push(`${day}:ig_account: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Instagram media post-level (lifetime totals written per day)
    if (igMedia.length > 0) {
      try {
        const rows = igMediaRows(day, igMedia)
        const upserted = await upsertMetricRows(rows)
        totalRows += upserted
        rows.forEach((r) => metricsCovered.add(`instagram:post:${r.metric}`))
      } catch (e) {
        errors.push(`${day}:ig_media: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  // IngestorResult.channel is a single Channel — use 'meta_page' as the primary
  // since this route covers both. The channel field per row distinguishes them.
  const result: IngestorResult = {
    channel: 'meta_page',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
