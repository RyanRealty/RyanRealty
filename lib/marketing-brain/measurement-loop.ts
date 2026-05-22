/**
 * marketing-brain: measurement-loop
 *
 * The brain's feedback layer. Pulls per-post performance metrics from each
 * platform at 24h / 7d / 30d intervals after an action row's executed_at
 * timestamp, writes one row per (action, measurement-window) to
 * public.content_performance.
 *
 * Once populated, downstream consumers can:
 *   - audit-findings-builder weighs existing_producers_validated by ER
 *   - generate-briefs prefers formats that historically converted
 *   - the dashboard surfaces top-performing topic x format combos
 *
 * Without this loop, the brain proposes but never measures. That's the
 * single biggest structural gap noted in the 2026-05-14 session.
 *
 * Producer contract:
 *   When a producer transitions an action_row to status='executed', it
 *   MUST write its published posts to executor_response.published_posts
 *   in this shape:
 *     {
 *       published_posts: [
 *         { platform: 'instagram', platform_post_id: '17890...', url: 'https://...', published_at: '2026-05-14T...' },
 *         { platform: 'facebook', platform_post_id: '12345_67890', url: '...', published_at: '...' }
 *       ]
 *     }
 *   The measurement loop reads from there. Producers that publish to
 *   multiple platforms (list-kit, listing_launch) write one entry per
 *   destination.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { refreshAccessToken as refreshTikTokAccessToken } from '@/lib/tiktok'
import { getYouTubeAccessToken } from '@/lib/youtube'
import { getLinkedInAccessToken } from '@/lib/linkedin'
import { getXAccessToken } from '@/lib/x'
import { getOrRefreshGoogleBusinessProfileAccessToken } from '@/lib/google-business-profile'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  _supabase = createClient(url, key)
  return _supabase
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'gbp' | 'blog'

export interface PublishedPost {
  platform: Platform
  platform_post_id: string
  url?: string
  published_at: string
}

export interface MeasurementMetrics {
  impressions: number | null
  reach: number | null
  views: number | null
  engagements: number | null
  clicks: number | null
  saves: number | null
  shares: number | null
  comments: number | null
  follows: number | null
  watch_time_seconds: number | null
  conversions: number | null
  attributed_leads: number | null
  metadata: Record<string, unknown>
}

const EMPTY_METRICS: MeasurementMetrics = {
  impressions: null,
  reach: null,
  views: null,
  engagements: null,
  clicks: null,
  saves: null,
  shares: null,
  comments: null,
  follows: null,
  watch_time_seconds: null,
  conversions: null,
  attributed_leads: null,
  metadata: {},
}

/** Hours-since-publish windows the loop measures at. */
export const MEASUREMENT_WINDOWS_HOURS = [24, 168, 720] // 1d, 7d, 30d
const WINDOW_TOLERANCE_HOURS = 24 // measure within this many hours of the target window

export interface MeasurementCandidate {
  action_id: string
  action_type: string
  topic: string | null
  published_post: PublishedPost
  hours_since_publish: number
  target_window_hours: number
}

export interface MeasurementLoopReport {
  scanned_actions: number
  candidates_found: number
  measurements_attempted: number
  measurements_succeeded: number
  measurements_skipped: number
  measurements_failed: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface RunMeasurementLoopOptions {
  /** Limit how many candidates to attempt in one run. Default 200. */
  maxCandidates?: number
  /** If true, returns the report without writing to content_performance. */
  dryRun?: boolean
}

export async function runMeasurementLoop(opts: RunMeasurementLoopOptions = {}): Promise<MeasurementLoopReport> {
  const maxCandidates = opts.maxCandidates ?? 200
  const report: MeasurementLoopReport = {
    scanned_actions: 0,
    candidates_found: 0,
    measurements_attempted: 0,
    measurements_succeeded: 0,
    measurements_skipped: 0,
    measurements_failed: 0,
    errors: [],
  }

  const candidates = await findUnmeasuredCandidates(maxCandidates)
  report.scanned_actions = candidates.scanned
  report.candidates_found = candidates.list.length

  for (const candidate of candidates.list) {
    report.measurements_attempted += 1
    try {
      const metrics = await measurePlatformPost(candidate.published_post.platform, candidate.published_post.platform_post_id)
      if (metrics === null) {
        report.measurements_skipped += 1
        continue
      }
      if (!opts.dryRun) {
        const inserted = await persistMeasurement(candidate, metrics)
        if (inserted) {
          report.measurements_succeeded += 1
        } else {
          report.measurements_failed += 1
        }
      } else {
        report.measurements_succeeded += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`action=${candidate.action_id} platform=${candidate.published_post.platform}: ${msg}`)
      report.measurements_failed += 1
    }
  }

  // After upserts, write a roll-up marketing_decisions row so generate-briefs
  // can use it as supplemental context and so Matt has an audit trail of each
  // measurement-loop run. Soft-fail: a write error here does not affect the
  // returned report or any measurement data already written.
  if (!opts.dryRun && report.measurements_succeeded > 0) {
    await persistLoopDigest(report).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('runMeasurementLoop: digest write failed (non-fatal):', msg)
    })
  }

  return report
}

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

interface CandidateScanResult {
  scanned: number
  list: MeasurementCandidate[]
}

async function findUnmeasuredCandidates(maxCandidates: number): Promise<CandidateScanResult> {
  const supabase = getSupabase()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()

  // Pull executed action rows from last 90 days with non-null executor_response
  const { data: rows, error } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, topic, executed_at, executor_response')
    .eq('status', 'executed')
    .gte('executed_at', ninetyDaysAgo)
    .order('executed_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('findUnmeasuredCandidates: marketing_brain_actions query failed:', error.message)
    return { scanned: 0, list: [] }
  }

  const scanned = rows?.length ?? 0
  const candidates: MeasurementCandidate[] = []

  for (const row of (rows ?? []) as Array<{ id: string; action_type: string; topic: string | null; executed_at: string; executor_response: Record<string, unknown> | null }>) {
    if (!row.executor_response) continue
    const publishedPosts = (row.executor_response.published_posts as PublishedPost[] | undefined) ?? []
    if (publishedPosts.length === 0) continue

    for (const post of publishedPosts) {
      if (!post.platform || !post.platform_post_id || !post.published_at) continue

      const hoursSince = (Date.now() - Date.parse(post.published_at)) / 3_600_000
      // Pick the highest target window we have not yet measured for this post
      const targetWindow = pickTargetWindow(hoursSince)
      if (targetWindow === null) continue

      const alreadyMeasured = await isAlreadyMeasured(post.platform_post_id, targetWindow)
      if (alreadyMeasured) continue

      candidates.push({
        action_id: row.id,
        action_type: row.action_type,
        topic: row.topic,
        published_post: post,
        hours_since_publish: hoursSince,
        target_window_hours: targetWindow,
      })

      if (candidates.length >= maxCandidates) break
    }
    if (candidates.length >= maxCandidates) break
  }

  return { scanned, list: candidates }
}

/** Return the highest MEASUREMENT_WINDOWS_HOURS bucket that hoursSince is past. */
function pickTargetWindow(hoursSince: number): number | null {
  for (const w of [...MEASUREMENT_WINDOWS_HOURS].reverse()) {
    if (hoursSince >= w - WINDOW_TOLERANCE_HOURS && hoursSince <= w + WINDOW_TOLERANCE_HOURS * 30) {
      return w
    }
  }
  return null
}

async function isAlreadyMeasured(platformPostId: string, targetWindowHours: number): Promise<boolean> {
  const supabase = getSupabase()
  const lowerBound = targetWindowHours - WINDOW_TOLERANCE_HOURS
  const upperBound = targetWindowHours + WINDOW_TOLERANCE_HOURS
  const { count } = await supabase
    .from('content_performance')
    .select('id', { count: 'planned', head: true })
    .eq('platform_post_id', platformPostId)
    .gte('hours_since_publish', lowerBound)
    .lte('hours_since_publish', upperBound)
  return (count ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Per-platform measurement
// ---------------------------------------------------------------------------

/**
 * Pull metrics for a single platform post. Returns null when the platform
 * integration is not authenticated; the loop logs and skips. Returns a
 * MeasurementMetrics-shaped object on success.
 */
async function measurePlatformPost(platform: Platform, platformPostId: string): Promise<MeasurementMetrics | null> {
  switch (platform) {
    case 'instagram':
    case 'facebook':
      return measureMetaPost(platform, platformPostId)
    case 'tiktok':
      return measureTikTokPost(platformPostId)
    case 'youtube':
      return measureYouTubePost(platformPostId)
    case 'linkedin':
      return measureLinkedInPost(platformPostId)
    case 'x':
      return measureXPost(platformPostId)
    case 'gbp':
      return measureGBPPost(platformPostId)
    case 'blog':
      // Blog posts go through GA4 attribution — not a platform push; skip.
      return null
    default:
      return null
  }
}

/**
 * Meta Graph metric fetch for an IG media or FB post id.
 * Reuses the long-lived page access token per CLAUDE.md
 * "Marketing Brain Architecture" -> Meta Graph tool skill.
 */
async function measureMetaPost(platform: 'instagram' | 'facebook', postId: string): Promise<MeasurementMetrics | null> {
  const token = process.env.NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN
  if (!token) {
    return null
  }

  const fields = platform === 'instagram'
    ? 'reach,impressions,saved,likes,comments,shares,plays,total_interactions'
    : 'post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total'

  const url = `https://graph.facebook.com/v25.0/${postId}/insights?metric=${fields}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meta Graph ${platform} insights ${res.status}: ${text.slice(0, 200)}`)
  }
  const raw = (await res.json()) as { data?: Array<{ name: string; values?: Array<{ value: unknown }> }> }
  const map = new Map<string, number>()
  for (const item of raw.data ?? []) {
    const v = item.values?.[0]?.value
    const n = typeof v === 'number' ? v : 0
    map.set(item.name, n)
  }

  if (platform === 'instagram') {
    return {
      ...EMPTY_METRICS,
      impressions: map.get('impressions') ?? null,
      reach: map.get('reach') ?? null,
      views: map.get('plays') ?? null,
      saves: map.get('saved') ?? null,
      shares: map.get('shares') ?? null,
      comments: map.get('comments') ?? null,
      engagements: map.get('total_interactions') ?? null,
      metadata: { raw: Object.fromEntries(map) },
    }
  }
  // facebook
  return {
    ...EMPTY_METRICS,
    impressions: map.get('post_impressions') ?? null,
    reach: map.get('post_engaged_users') ?? null,
    clicks: map.get('post_clicks') ?? null,
    engagements: (map.get('post_reactions_by_type_total') ?? 0) + (map.get('post_clicks') ?? 0),
    metadata: { raw: Object.fromEntries(map) },
  }
}

// ---------------------------------------------------------------------------
// TikTok: per-video metrics via video/query/ endpoint
// ---------------------------------------------------------------------------

/**
 * TikTok does not expose a named getAccessToken helper in lib/tiktok.ts.
 * The token is stored in public.tiktok_auth, exactly as the snapshot cron
 * manages it.  We read + optionally refresh inline.
 */
async function getTikTokToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tiktok_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('TikTok not connected — visit /api/tiktok/authorize to connect')
  }

  interface TikTokAuthRow {
    access_token: string
    refresh_token: string | null
    expires_at: string | null
  }
  const row = data as TikTokAuthRow
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return row.access_token

  if (!row.refresh_token) {
    throw new Error('TikTok access token expired and no refresh token — reconnect via /api/tiktok/authorize')
  }

  const refreshed = await refreshTikTokAccessToken(row.refresh_token)
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

  return refreshed.access_token
}

interface TikTokVideoQueryResponse {
  data?: {
    videos?: Array<{
      id?: string
      view_count?: number
      like_count?: number
      comment_count?: number
      share_count?: number
    }>
  }
  error?: { code: string; message: string }
}

async function measureTikTokPost(videoId: string): Promise<MeasurementMetrics | null> {
  let accessToken: string
  try {
    accessToken = await getTikTokToken()
  } catch (err) {
    console.warn('measureTikTokPost: auth unavailable —', err instanceof Error ? err.message : String(err))
    return null
  }

  const fields = 'id,view_count,like_count,comment_count,share_count'
  // video/query/ accepts a JSON body with `filters.video_ids` and query params for fields.
  const url = `https://open.tiktokapis.com/v2/video/query/?fields=${encodeURIComponent(fields)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`TikTok video/query/ ${res.status}: ${text.slice(0, 200)}`)
  }

  let raw: TikTokVideoQueryResponse
  try {
    raw = (await res.json()) as TikTokVideoQueryResponse
  } catch {
    throw new Error('TikTok video/query/ returned non-JSON response')
  }

  if (raw.error && raw.error.code !== 'ok') {
    throw new Error(`TikTok video/query/ API error: ${raw.error.message}`)
  }

  const video = raw.data?.videos?.[0]
  if (!video) {
    // Video may be private, deleted, or not associated with the authed user.
    return { ...EMPTY_METRICS, metadata: { raw, note: 'video not returned by api' } }
  }

  const likesCount = video.like_count ?? 0
  const commentsCount = video.comment_count ?? 0
  const sharesCount = video.share_count ?? 0

  return {
    ...EMPTY_METRICS,
    views: video.view_count ?? null,
    impressions: video.view_count ?? null, // TikTok equates views to impressions at this scope
    comments: commentsCount,
    shares: sharesCount,
    engagements: likesCount + commentsCount + sharesCount,
    metadata: { raw: video },
  }
}

// ---------------------------------------------------------------------------
// YouTube: per-video statistics via YouTube Data API v3
// ---------------------------------------------------------------------------

interface YouTubeVideoStatisticsResponse {
  items?: Array<{
    id?: string
    statistics?: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
      favoriteCount?: string
    }
  }>
  error?: { message?: string; code?: number }
}

async function measureYouTubePost(videoId: string): Promise<MeasurementMetrics | null> {
  let accessToken: string
  try {
    accessToken = await getYouTubeAccessToken()
  } catch (err) {
    console.warn('measureYouTubePost: auth unavailable —', err instanceof Error ? err.message : String(err))
    return null
  }

  const params = new URLSearchParams({
    part: 'statistics',
    id: videoId,
    fields: 'items(id,statistics)',
  })
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`YouTube Data API videos ${res.status}: ${text.slice(0, 200)}`)
  }

  let raw: YouTubeVideoStatisticsResponse
  try {
    raw = (await res.json()) as YouTubeVideoStatisticsResponse
  } catch {
    throw new Error('YouTube Data API returned non-JSON response')
  }

  if (raw.error) {
    throw new Error(`YouTube Data API error ${raw.error.code ?? ''}: ${raw.error.message ?? 'unknown'}`)
  }

  const item = raw.items?.[0]
  if (!item?.statistics) {
    // Video may be private, deleted, or outside the authed channel.
    return { ...EMPTY_METRICS, metadata: { raw, note: 'video statistics not returned' } }
  }

  const stats = item.statistics
  const views = stats.viewCount !== undefined ? parseInt(stats.viewCount, 10) : null
  const likesCount = stats.likeCount !== undefined ? parseInt(stats.likeCount, 10) : 0
  const commentsCount = stats.commentCount !== undefined ? parseInt(stats.commentCount, 10) : 0
  const saves = stats.favoriteCount !== undefined ? parseInt(stats.favoriteCount, 10) : null

  return {
    ...EMPTY_METRICS,
    impressions: views, // YouTube Data API v3 viewCount is the closest to impressions at video scope
    views: views,
    comments: commentsCount,
    saves: saves,
    engagements: likesCount + commentsCount,
    // watch_time_seconds requires YouTube Analytics API v2 (yt-analytics.readonly scope,
    // separate endpoint). Left null here; document the gap for future work.
    watch_time_seconds: null,
    metadata: {
      raw: stats,
      note: 'watch_time_seconds unavailable — requires YouTube Analytics API; viewCount used as impressions proxy',
    },
  }
}

// ---------------------------------------------------------------------------
// LinkedIn: per-post share statistics via organizationalEntityShareStatistics
// ---------------------------------------------------------------------------

interface LinkedInShareStatData {
  impressionCount?: number
  uniqueImpressionsCount?: number
  clickCount?: number
  likeCount?: number
  commentCount?: number
  shareCount?: number
  engagement?: number
}

interface LinkedInShareStatElement {
  totalShareStatistics?: LinkedInShareStatData
  ugcPost?: string
  share?: string
}

interface LinkedInShareStatResponse {
  elements?: LinkedInShareStatElement[]
}

async function measureLinkedInPost(postUrn: string): Promise<MeasurementMetrics | null> {
  let accessToken: string
  try {
    accessToken = await getLinkedInAccessToken()
  } catch (err) {
    console.warn('measureLinkedInPost: auth unavailable —', err instanceof Error ? err.message : String(err))
    return null
  }

  const orgId = process.env.LINKEDIN_ORGANIZATION_ID?.trim()
  if (!orgId) {
    console.warn('measureLinkedInPost: LINKEDIN_ORGANIZATION_ID not configured — cannot query per-post stats')
    return null
  }

  // The organizationalEntityShareStatistics endpoint requires both the
  // organizationalEntity URN and the ugcPost/share URN.
  // postUrn is expected to be urn:li:ugcPost:<id> or urn:li:share:<id>.
  const orgUrn = orgId.startsWith('urn:') ? orgId : `urn:li:organization:${orgId}`
  const params = new URLSearchParams({
    q: 'organizationalEntity',
    organizationalEntity: orgUrn,
    'ugcPosts[0]': postUrn,
  })

  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202602',
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LinkedIn organizationalEntityShareStatistics ${res.status}: ${text.slice(0, 200)}`)
  }

  let raw: LinkedInShareStatResponse
  try {
    raw = (await res.json()) as LinkedInShareStatResponse
  } catch {
    throw new Error('LinkedIn organizationalEntityShareStatistics returned non-JSON response')
  }

  const el = raw.elements?.[0]
  if (!el?.totalShareStatistics) {
    return { ...EMPTY_METRICS, metadata: { raw, note: 'no share statistics returned for this post urn' } }
  }

  const stats = el.totalShareStatistics
  const likesCount = stats.likeCount ?? 0
  const commentsCount = stats.commentCount ?? 0
  const sharesCount = stats.shareCount ?? 0
  const clicks = stats.clickCount ?? null

  return {
    ...EMPTY_METRICS,
    impressions: stats.impressionCount ?? null,
    reach: stats.uniqueImpressionsCount ?? null,
    comments: commentsCount,
    shares: sharesCount,
    clicks: clicks,
    engagements: likesCount + commentsCount + sharesCount + (clicks ?? 0),
    metadata: { raw: stats },
  }
}

// ---------------------------------------------------------------------------
// X (Twitter): per-tweet public metrics via API v2
// ---------------------------------------------------------------------------

interface XTweetPublicMetrics {
  impression_count: number
  like_count: number
  retweet_count: number
  reply_count: number
  quote_count: number
  bookmark_count: number
}

interface XTweetResponse {
  data?: {
    id: string
    public_metrics?: XTweetPublicMetrics
  }
  errors?: Array<{ message: string }>
}

async function measureXPost(tweetId: string): Promise<MeasurementMetrics | null> {
  let accessToken: string
  try {
    accessToken = await getXAccessToken()
  } catch (err) {
    console.warn('measureXPost: auth unavailable —', err instanceof Error ? err.message : String(err))
    return null
  }

  const params = new URLSearchParams({ 'tweet.fields': 'public_metrics' })
  const url = `https://api.twitter.com/2/tweets/${tweetId}?${params.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`X API GET /2/tweets/${tweetId} ${res.status}: ${text.slice(0, 200)}`)
  }

  let raw: XTweetResponse
  try {
    raw = (await res.json()) as XTweetResponse
  } catch {
    throw new Error('X API returned non-JSON response')
  }

  if (!raw.data?.public_metrics) {
    // Tweet deleted, private, or Basic-tier plan returning no metrics.
    return {
      ...EMPTY_METRICS,
      metadata: {
        raw,
        note: 'public_metrics missing — tweet may be deleted, or plan tier restricts access',
      },
    }
  }

  const pm = raw.data.public_metrics
  const likesCount = pm.like_count
  const commentsCount = pm.reply_count
  const sharesCount = pm.retweet_count + pm.quote_count
  const savesCount = pm.bookmark_count

  return {
    ...EMPTY_METRICS,
    // impression_count is returned on Basic+ but may be 0 on Free tier.
    impressions: pm.impression_count > 0 ? pm.impression_count : null,
    comments: commentsCount,
    shares: sharesCount,
    saves: savesCount,
    engagements: likesCount + commentsCount + sharesCount + savesCount,
    metadata: {
      raw: pm,
      tier_note: pm.impression_count === 0
        ? 'impression_count=0: Basic tier may not populate this field in real time'
        : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// GBP: no per-post analytics API — return EMPTY_METRICS with a metadata note
// ---------------------------------------------------------------------------

async function measureGBPPost(postId: string): Promise<MeasurementMetrics | null> {
  // Validate the token is available so we surface auth failures early.
  try {
    await getOrRefreshGoogleBusinessProfileAccessToken()
  } catch (err) {
    console.warn('measureGBPPost: auth unavailable —', err instanceof Error ? err.message : String(err))
    return null
  }

  // The Google Business Profile Performance API exposes only account-level
  // daily metric time-series (impressions, call clicks, direction requests,
  // website clicks, etc.).  There is no per-post performance endpoint.
  // Return EMPTY_METRICS with a metadata note; the loop writes a row so
  // future callers know the measurement was attempted.
  return {
    ...EMPTY_METRICS,
    metadata: {
      platform_post_id: postId,
      note: 'gbp_post-level metrics unavailable — Google Business Profile Performance API exposes account-level daily metrics only; refer to getGBPDailyMetrics for aggregate data',
    },
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Write a single roll-up row to marketing_decisions after a successful loop
 * run. decision_type='performance_loop_completed'. data_observed includes:
 *   - top_3_winners: the three candidates with the highest north_star_attributed_seller_leads
 *   - bottom_3_losers: the three with the lowest
 *   - loop stats from the report
 *
 * generate-briefs reads this for additional context in the next cycle, and
 * the dashboard surfaces it in the digest view.
 */
async function persistLoopDigest(report: MeasurementLoopReport): Promise<void> {
  const supabase = getSupabase()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()

  // Pull the top and bottom performers by north_star_attributed_seller_leads
  // from the last 90 days of content_performance where metrics_7d is populated.
  const { data: perfRows } = await supabase
    .from('content_performance')
    .select('action_id, platform, north_star_attributed_seller_leads, metrics_7d, posted_at')
    .gte('posted_at', ninetyDaysAgo)
    .not('metrics_7d', 'is', null)
    .order('north_star_attributed_seller_leads', { ascending: false })
    .limit(50)

  const rows = (perfRows ?? []) as Array<{
    action_id: string
    platform: string
    north_star_attributed_seller_leads: number | null
    metrics_7d: Record<string, unknown> | null
    posted_at: string
  }>

  const sorted = [...rows].sort(
    (a, b) =>
      (b.north_star_attributed_seller_leads ?? 0) - (a.north_star_attributed_seller_leads ?? 0)
  )

  const top3 = sorted.slice(0, 3).map((r) => ({
    action_id: r.action_id,
    platform: r.platform,
    north_star_attributed_seller_leads: r.north_star_attributed_seller_leads ?? 0,
    posted_at: r.posted_at,
  }))

  const bottom3 = sorted.slice(-3).map((r) => ({
    action_id: r.action_id,
    platform: r.platform,
    north_star_attributed_seller_leads: r.north_star_attributed_seller_leads ?? 0,
    posted_at: r.posted_at,
  }))

  await supabase.from('marketing_decisions').insert({
    decision_type: 'performance_loop_completed',
    decision_summary: `Measurement loop: ${report.measurements_succeeded} new snapshots across ${report.candidates_found} candidates.`,
    data_observed: {
      loop_stats: {
        scanned_actions: report.scanned_actions,
        candidates_found: report.candidates_found,
        measurements_succeeded: report.measurements_succeeded,
        measurements_skipped: report.measurements_skipped,
        measurements_failed: report.measurements_failed,
        error_count: report.errors.length,
      },
      top_3_winners: top3,
      bottom_3_losers: bottom3,
      completed_at: new Date().toISOString(),
    },
    rules_cited: ['measurement-loop: 24h/7d/30d platform metrics ingestion'],
    predicted_outcome: {},
    actual_outcome: {},
    reviewer: 'marketing_brain:measurement-loop',
    final_decision: 'recorded',
  })
}

async function persistMeasurement(candidate: MeasurementCandidate, metrics: MeasurementMetrics): Promise<boolean> {
  const supabase = getSupabase()
  const { error } = await supabase.from('content_performance').insert({
    brief_id: candidate.action_id,
    platform: candidate.published_post.platform,
    platform_post_id: candidate.published_post.platform_post_id,
    published_at: candidate.published_post.published_at,
    hours_since_publish: candidate.hours_since_publish,
    impressions: metrics.impressions,
    reach: metrics.reach,
    views: metrics.views,
    engagements: metrics.engagements,
    clicks: metrics.clicks,
    saves: metrics.saves,
    shares: metrics.shares,
    comments: metrics.comments,
    follows: metrics.follows,
    watch_time_seconds: metrics.watch_time_seconds,
    conversions: metrics.conversions,
    attributed_leads: metrics.attributed_leads,
    metadata: { ...metrics.metadata, target_window_hours: candidate.target_window_hours, action_type: candidate.action_type, topic: candidate.topic },
    source: 'measurement-loop',
  })
  if (error) {
    console.error('persistMeasurement:', error.message)
    return false
  }
  return true
}
