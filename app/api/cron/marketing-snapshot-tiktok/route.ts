/**
 * TikTok daily snapshot ingestor.
 *
 * Fetches TikTok profile stats and per-video metrics via the TikTok Open Platform
 * API (v2) and writes them to marketing_channel_daily.
 *
 * ─── SCOPE COVERAGE ─────────────────────────────────────────────────────────
 * Available with current scopes (user.info.basic, user.info.profile,
 * user.info.stats, video.list):
 *
 *   ACCOUNT scope (scope='account', scope_id=''):
 *     followers_count      — current follower total (snapshot, not delta)
 *     following_count      — accounts this account follows
 *     likes_count          — cumulative profile likes received
 *     video_count          — total public videos published
 *
 *   VIDEO scope (scope='video', scope_id=<video_id>), last 30 days:
 *     views                — view_count from video.list fields
 *     likes                — like_count
 *     comments             — comment_count
 *     shares               — share_count
 *     Metadata: description (≤200 chars), created_at (epoch → ISO), duration_seconds,
 *               cover_image_url, title (≤150 chars)
 *
 * ─── TIER-GATED (require higher-tier Research/Business API access) ────────
 * The following metrics are gated behind TikTok Research API or Business
 * API tiers not covered by our current scopes. They are NOT ingested here.
 * Request upgrade if these become needed:
 *
 *   play_duration_seconds   — average watch time per video (Research API)
 *   completion_rate         — % viewers who finish the video (Research API)
 *   reach                   — unique accounts reached (Research API)
 *   profile_views           — daily profile visits (TikTok Analytics Dashboard / Research API)
 *   audience_demographics   — age, gender, location breakdown (Research API)
 *   hashtag_performance     — views attributable to specific hashtags (not exposed in API)
 *   video_impressions        — impressions distinct from views (Research API)
 *   traffic_source_breakdown — FYP vs followers vs search vs profile (Research API)
 *
 * The most important algorithmic signal — completion_rate — is not available
 * without a Research API upgrade. Monitor https://developers.tiktok.com for
 * scope changes.
 *
 * ─── DATA NOTES ─────────────────────────────────────────────────────────────
 * - All account metrics are current snapshots, not daily deltas.
 *   The daily cron captures a point-in-time value; delta is computed in the
 *   marketing brain by comparing consecutive rows.
 * - video.list returns up to 20 videos per page; this ingestor paginates to
 *   collect all videos published in the last 30 days (typical account: <30
 *   videos/month, well within the 100-item API limit per call).
 * - TikTok's v2 API does not support pulling video stats for a specific date
 *   range; stats reflect cumulative totals at the time of the API call.
 *   Backfill mode (startDate/endDate) still runs per day but will fetch the
 *   same cumulative video stats each time — useful for establishing a baseline
 *   row per video but NOT for historical daily deltas.
 * - Access token is read from public.tiktok_auth (upserted by the OAuth flow).
 *   Token refresh uses the stored refresh_token; on failure the ingestor
 *   returns an error so the token-heartbeat cron can alert.
 *
 * ─── AUTH ───────────────────────────────────────────────────────────────────
 * Requires Authorization: Bearer $CRON_SECRET.
 * Env vars: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, NEXT_PUBLIC_SUPABASE_URL,
 *           SUPABASE_SERVICE_ROLE_KEY.
 *
 * ─── CRON ───────────────────────────────────────────────────────────────────
 * Schedule: 30 6 * * * (06:30 UTC daily — matches GA4/GSC/Meta snapshot batch).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken } from '@/lib/tiktok'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'tiktok_business_api_v2'
const CHANNEL = 'tiktok' as const
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

// ---------------------------------------------------------------------------
// Supabase helper — fetch/refresh token from public.tiktok_auth
// ---------------------------------------------------------------------------

interface TikTokAuthRow {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  open_id: string | null
}

async function fetchOpenIdFromTikTok(accessToken: string): Promise<string> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    throw new Error(`TikTok /user/info failed: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { data?: { user?: { open_id?: string } } }
  const openId = json.data?.user?.open_id
  if (!openId) throw new Error('TikTok /user/info returned no open_id')
  return openId
}

async function getValidToken(): Promise<{ accessToken: string; openId: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('tiktok_auth')
    .select('access_token, refresh_token, expires_at, open_id')
    .eq('id', 'default')
    .single<TikTokAuthRow>()

  if (error || !data) {
    throw new Error(`No TikTok auth row found: ${error?.message ?? 'empty result'}`)
  }

  // Refresh if expired or within 5 minutes of expiry
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  let accessToken = data.access_token
  if (needsRefresh && data.refresh_token) {
    const refreshed = await refreshAccessToken(data.refresh_token)
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await supabase
      .from('tiktok_auth')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default')

    accessToken = refreshed.access_token
  }

  // open_id may be missing on rows created before the column was added.
  // Fetch it from TikTok and persist it back so next call is cheaper.
  let openId = data.open_id
  if (!openId) {
    openId = await fetchOpenIdFromTikTok(accessToken)
    await supabase
      .from('tiktok_auth')
      .update({ open_id: openId, updated_at: new Date().toISOString() })
      .eq('id', 'default')
  }

  return { accessToken, openId }
}

// ---------------------------------------------------------------------------
// TikTok API helpers
// ---------------------------------------------------------------------------

interface TikTokUserInfoStats {
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
}

interface TikTokUserStatsResponse {
  data?: {
    user?: TikTokUserInfoStats
  }
  error?: { code: string; message: string }
}

async function fetchUserStats(accessToken: string): Promise<TikTokUserInfoStats> {
  // user.info.stats scope exposes follower/following/likes/video counts
  const fields = 'follower_count,following_count,likes_count,video_count'
  const resp = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=${fields}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!resp.ok) {
    throw new Error(`TikTok user info failed: ${resp.status} ${resp.statusText}`)
  }

  const body = (await resp.json()) as TikTokUserStatsResponse
  if (body.error && body.error.code !== 'ok') {
    throw new Error(`TikTok user info API error: ${body.error.message}`)
  }
  return body.data?.user ?? {}
}

// ---------------------------------------------------------------------------

interface TikTokVideo {
  id: string
  title?: string
  video_description?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  duration?: number
  create_time?: number
  cover_image_url?: string
}

interface TikTokVideoListResponse {
  data?: {
    videos?: TikTokVideo[]
    cursor?: number
    has_more?: boolean
  }
  error?: { code: string; message: string }
}

/**
 * Fetch all videos published within the last 30 days.
 * Paginates through video.list until has_more is false or we hit a created_at
 * older than 30 days ago (videos are returned newest-first).
 */
async function fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]> {
  const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000
  const cutoffEpoch = Math.floor(cutoffMs / 1000)

  // Fields available under video.list scope — note play_duration and
  // completion_rate require Research API tier and are intentionally excluded.
  const fields = [
    'id',
    'title',
    'video_description',
    'view_count',
    'like_count',
    'comment_count',
    'share_count',
    'duration',
    'create_time',
    'cover_image_url',
  ].join(',')

  const collected: TikTokVideo[] = []
  let cursor: number | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const body: Record<string, unknown> = {
      max_count: 20,
      fields,
    }
    if (cursor !== undefined) {
      body.cursor = cursor
    }

    const resp = await fetch(`${TIKTOK_API_BASE}/video/list/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      throw new Error(`TikTok video.list failed: ${resp.status} ${resp.statusText}`)
    }

    const data = (await resp.json()) as TikTokVideoListResponse
    if (data.error && data.error.code !== 'ok') {
      throw new Error(`TikTok video.list API error: ${data.error.message}`)
    }

    const videos = data.data?.videos ?? []
    hasMore = data.data?.has_more ?? false
    cursor = data.data?.cursor

    for (const v of videos) {
      // Videos are newest-first; stop paginating once we hit older than 30 days
      if (v.create_time !== undefined && v.create_time < cutoffEpoch) {
        hasMore = false
        break
      }
      collected.push(v)
    }

    // Safety: don't paginate indefinitely
    if (collected.length >= 200) break
  }

  return collected
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function accountRows(date: string, stats: TikTokUserInfoStats): MetricRow[] {
  const base = { date, channel: CHANNEL, scope: 'account' as const, scope_id: '', source: SOURCE }
  const rows: MetricRow[] = []

  if (stats.follower_count !== undefined) {
    rows.push({ ...base, metric: 'followers_count', value: stats.follower_count })
  }
  if (stats.following_count !== undefined) {
    rows.push({ ...base, metric: 'following_count', value: stats.following_count })
  }
  if (stats.likes_count !== undefined) {
    rows.push({ ...base, metric: 'likes_count', value: stats.likes_count })
  }
  if (stats.video_count !== undefined) {
    rows.push({ ...base, metric: 'video_count', value: stats.video_count })
  }

  return rows
}

function videoRows(date: string, video: TikTokVideo): MetricRow[] {
  const base = {
    date,
    channel: CHANNEL,
    scope: 'video' as const,
    scope_id: video.id,
    source: SOURCE,
  }

  // Build metadata for the video — stored once on every upsert, cheap
  const metadata: Record<string, unknown> = {
    description: (video.video_description ?? video.title ?? '').slice(0, 200),
    title: (video.title ?? '').slice(0, 150),
    created_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
    duration_seconds: video.duration ?? null,
    cover_image_url: video.cover_image_url ?? null,
  }

  const rows: MetricRow[] = []

  if (video.view_count !== undefined) {
    rows.push({ ...base, metric: 'views', value: video.view_count, metadata })
  }
  if (video.like_count !== undefined) {
    rows.push({ ...base, metric: 'likes', value: video.like_count, metadata })
  }
  if (video.comment_count !== undefined) {
    rows.push({ ...base, metric: 'comments', value: video.comment_count, metadata })
  }
  if (video.share_count !== undefined) {
    rows.push({ ...base, metric: 'shares', value: video.share_count, metadata })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Generator — yield one ISO date string per day in [startDate, endDate]
// ---------------------------------------------------------------------------

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

// ---------------------------------------------------------------------------
// Route handler
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

  // Fetch token once — valid for all days in the range
  let accessToken: string
  try {
    ;({ accessToken } = await getValidToken())
  } catch (e) {
    return NextResponse.json(
      { error: `token error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }

  // Fetch API data once — TikTok returns cumulative stats (not per-day deltas),
  // so we call the API once and stamp the rows with each date in the range.
  // For the daily cron this is a single date (yesterday), so the cost is one
  // API round-trip. For backfill it's still a single round-trip with repeated
  // rows — see DATA NOTES in the file header.
  let statsData: TikTokUserInfoStats
  let videos: TikTokVideo[]

  try {
    ;[statsData, videos] = await Promise.all([
      fetchUserStats(accessToken),
      fetchRecentVideos(accessToken),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: `TikTok API fetch failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  for (const day of dateIter(startDate, endDate)) {
    try {
      const rows: MetricRow[] = [
        ...accountRows(day, statsData),
        ...videos.flatMap((v) => videoRows(day, v)),
      ]

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
