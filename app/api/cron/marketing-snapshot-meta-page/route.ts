// cron: invoked-by /api/cron/snapshot-channels (fan-out caller; deliberately not in vercel.json)
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
import { getMetaPageTokenTrimmed } from '@/lib/meta-env'
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
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { requireCronAuth } from '@/lib/auth/cron-auth'

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

/**
 * Turn candidate metrics into rows, DROPPING any the API could not give us.
 *
 * marketing_channel_daily.value is NOT NULL, so absence is the only honest way
 * to record "unmeasured". A dropped row reads correctly downstream ("no rows in
 * this window"); a 0 is indistinguishable from a real zero and had been filling
 * this table for months. A genuine 0 from the API still passes through.
 */
function dropUnread(
  base: Omit<MetricRow, 'metric' | 'value'>,
  candidates: Array<{ metric: string; value: number | null }>,
): MetricRow[] {
  return candidates
    .filter((c): c is { metric: string; value: number } => c.value != null)
    .map((c) => ({ ...base, metric: c.metric, value: c.value }))
}

export function fbAccountRows(
  date: string,
  pageInsights: Awaited<ReturnType<typeof getPageInsights>>
): MetricRow[] {
  const base = { date, channel: 'meta_page' as const, scope: 'account' as const, scope_id: '', source: SOURCE }
  // page_impressions, page_impressions_unique, page_engaged_users, page_fans and
  // page_fan_adds are retired with no replacement. page_views_total is profile
  // views — a different measurement, carried under its own name, never relabelled
  // as impressions. A metric we could not read is dropped, not written as 0.
  return dropUnread(base, [
    { metric: 'page_post_engagements', value: pageInsights.page_post_engagements },
    { metric: 'page_video_views', value: pageInsights.page_video_views },
    { metric: 'page_views_total', value: pageInsights.page_views_total },
    { metric: 'page_daily_follows', value: pageInsights.page_daily_follows },
    { metric: 'page_follows', value: pageInsights.page_follows },
  ])
}

export function fbPostRows(date: string, posts: PagePost[]): MetricRow[] {
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
    return dropUnread(base, [
      { metric: 'post_reactions_by_type_total', value: post.post_reactions_by_type_total },
      { metric: 'post_reactions_like_total', value: post.post_reactions_like_total },
      { metric: 'post_clicks', value: post.post_clicks },
      { metric: 'post_video_views', value: post.post_video_views },
    ])
  })
}

// ---------------------------------------------------------------------------
// Instagram — row builders
// ---------------------------------------------------------------------------

export function igAccountRows(
  date: string,
  igInsights: Awaited<ReturnType<typeof getIGAccountInsights>>
): MetricRow[] {
  const base = { date, channel: 'instagram' as const, scope: 'account' as const, scope_id: '', source: SOURCE }
  // `impressions` is gone for good — Meta retired the name at v22. `views` is
  // its replacement. A metric we could not read is DROPPED, not written as 0.
  return dropUnread(base, [
    { metric: 'views', value: igInsights.views },
    { metric: 'reach', value: igInsights.reach },
    { metric: 'profile_views', value: igInsights.profile_views },
    { metric: 'website_clicks', value: igInsights.website_clicks },
    { metric: 'accounts_engaged', value: igInsights.accounts_engaged },
    { metric: 'total_interactions', value: igInsights.total_interactions },
    { metric: 'likes', value: igInsights.likes },
    { metric: 'comments', value: igInsights.comments },
    { metric: 'shares', value: igInsights.shares },
    { metric: 'saves', value: igInsights.saves },
    { metric: 'new_followers', value: igInsights.new_followers },
    { metric: 'follower_count', value: igInsights.follower_count },
  ])
}

export function igMediaRows(date: string, media: IGMedia[]): MetricRow[] {
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
    // A metric we could not read is DROPPED, not written as 0. marketing_channel_daily.value
    // is NOT NULL, so the only honest way to say "unmeasured" is the absence of a row —
    // and a missing row reads correctly downstream ("no rows for impressions in this
    // window") while a 0 lies. `impressions` and `engagement` are gone: Meta retired
    // them for IG media at v22, and `views` / `total_interactions` replace them.
    const candidates: Array<{ metric: string; value: number | null }> = [
      { metric: 'views', value: m.views },
      { metric: 'reach', value: m.reach },
      { metric: 'total_interactions', value: m.total_interactions },
      { metric: 'saved', value: m.saved },
    ]
    return candidates
      .filter((c): c is { metric: string; value: number } => c.value != null)
      .map((c) => ({ ...base, metric: c.metric, value: c.value }))
  })
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const token = getMetaPageTokenTrimmed()
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
