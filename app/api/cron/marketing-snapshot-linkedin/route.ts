/**
 * LinkedIn daily snapshot ingestor.
 *
 * Pulls organic metrics for the Ryan Realty Company Page (Organization) and
 * the Personal Profile of the principal broker from the LinkedIn Marketing API
 * (Community Management API, versioned REST endpoints).
 *
 * Two scopes are written per run:
 *   scope='account', scope_id=''           — company-page aggregate metrics
 *   scope='post',    scope_id=<postUrn>     — top-10 posts published in the
 *                                             last 30 days (lifetime totals)
 *
 * Default: pulls yesterday (daily Vercel cron at 06:30 UTC).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID            — OAuth app client ID
 *   LINKEDIN_CLIENT_SECRET        — OAuth app client secret
 *   LINKEDIN_REDIRECT_URI         — OAuth redirect URI
 *   LINKEDIN_PERSON_ID            — numeric LinkedIn member ID (legacy env)
 *   LINKEDIN_ORGANIZATION_ID      — numeric LinkedIn organization (company page) ID
 *                                   e.g. "12345678". Obtain from the Company Page
 *                                   admin URL or GET /v2/organizationAcls.
 *
 * Token: stored in public.linkedin_auth (id='default'). The token must carry
 *   the rw_organization_admin scope for company-page analytics. Re-OAuth at
 *   /api/linkedin/authorize if missing. The token in linkedin_auth was
 *   provisioned with openid + profile + email + w_member_social; the
 *   rw_organization_admin scope must be added to the app and re-authorized
 *   before company-page stats will return data.
 *
 * API endpoints used:
 *   GET /rest/organizationalEntityFollowerStatistics  — followers + gains
 *   GET /rest/organizationalEntityShareStatistics     — impressions, clicks,
 *                                                       reactions, comments,
 *                                                       shares, engagement
 *   GET /rest/posts?author=urn:li:organization:…     — recent posts list
 *   GET /rest/organizationalEntityShareStatistics
 *       ?ugcPosts=…                                  — per-post stats
 *
 * channel='linkedin', source='linkedin_marketing_api_v2'.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { getLinkedInAccessToken } from '@/lib/linkedin'

export const maxDuration = 300

const SOURCE = 'linkedin_marketing_api_v2'
const CHANNEL = 'linkedin' as const
const LI_VERSION = '202602'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} is not configured`)
  return v
}

function liHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  }
}

/** Convert a YYYY-MM-DD string to epoch-ms (UTC midnight). */
function toEpochMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getTime()
}

/** Next-day epoch-ms (exclusive end for LinkedIn time ranges). */
function nextDayMs(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.getTime()
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface LiFollowerStatElement {
  timeRange?: { start: number; end: number }
  followerGains?: {
    organicFollowerGain: number
    paidFollowerGain: number
  }
  organizationalEntity?: string
}

interface LiFollowerStatResponse {
  elements?: LiFollowerStatElement[]
}

interface LiShareStatData {
  impressionCount?: number
  uniqueImpressionsCount?: number
  clickCount?: number
  likeCount?: number
  commentCount?: number
  shareCount?: number
  engagement?: number
}

interface LiShareStatElement {
  timeRange?: { start: number; end: number }
  totalShareStatistics?: LiShareStatData
  organizationalEntity?: string
  ugcPost?: string
  share?: string
}

interface LiShareStatResponse {
  elements?: LiShareStatElement[]
}

interface LiPost {
  id: string
  author?: string
  commentary?: string
  publishedAt?: number
  lifecycleState?: string
  content?: {
    media?: { id?: string }
    article?: { source?: string }
    multiImage?: { images?: unknown[] }
  }
  mediaType?: string
}

interface LiPostsResponse {
  elements?: LiPost[]
  paging?: { count: number; start: number; total?: number }
}

// ---------------------------------------------------------------------------
// Fetch: organization follower count (snapshot via networkSizes)
// ---------------------------------------------------------------------------

async function fetchFollowerCount(
  accessToken: string,
  orgUrn: string
): Promise<number> {
  const encoded = encodeURIComponent(orgUrn)
  const url = `https://api.linkedin.com/rest/networkSizes/${encoded}?edgeType=CompanyFollowedByMember`
  const resp = await fetch(url, { headers: liHeaders(accessToken) })
  if (!resp.ok) {
    throw new Error(
      `LinkedIn networkSizes failed: ${resp.status} ${resp.statusText}`
    )
  }
  const data = (await resp.json()) as { firstDegreeSize?: number }
  return data.firstDegreeSize ?? 0
}

// ---------------------------------------------------------------------------
// Fetch: time-bound follower gains for a single day
// ---------------------------------------------------------------------------

async function fetchFollowerGains(
  accessToken: string,
  orgUrn: string,
  date: string
): Promise<number> {
  const start = toEpochMs(date)
  const end = nextDayMs(date)
  const params = new URLSearchParams({
    q: 'organizationalEntity',
    organizationalEntity: orgUrn,
    'timeIntervals.timeGranularityType': 'DAY',
    'timeIntervals.timeRange.start': String(start),
    'timeIntervals.timeRange.end': String(end),
  })
  const url = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?${params}`
  const resp = await fetch(url, { headers: liHeaders(accessToken) })
  if (!resp.ok) {
    throw new Error(
      `LinkedIn followerStats failed: ${resp.status} ${resp.statusText}`
    )
  }
  const data = (await resp.json()) as LiFollowerStatResponse
  const el = data.elements?.[0]
  if (!el?.followerGains) return 0
  return (
    (el.followerGains.organicFollowerGain ?? 0) +
    (el.followerGains.paidFollowerGain ?? 0)
  )
}

// ---------------------------------------------------------------------------
// Fetch: time-bound share statistics for a single day (account level)
// ---------------------------------------------------------------------------

async function fetchAccountShareStats(
  accessToken: string,
  orgUrn: string,
  date: string
): Promise<LiShareStatData> {
  const start = toEpochMs(date)
  const end = nextDayMs(date)
  const params = new URLSearchParams({
    q: 'organizationalEntity',
    organizationalEntity: orgUrn,
    'timeIntervals.timeGranularityType': 'DAY',
    'timeIntervals.timeRange.start': String(start),
    'timeIntervals.timeRange.end': String(end),
  })
  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?${params}`
  const resp = await fetch(url, { headers: liHeaders(accessToken) })
  if (!resp.ok) {
    throw new Error(
      `LinkedIn shareStats failed: ${resp.status} ${resp.statusText}`
    )
  }
  const data = (await resp.json()) as LiShareStatResponse
  return data.elements?.[0]?.totalShareStatistics ?? {}
}

// ---------------------------------------------------------------------------
// Fetch: top-10 posts from the last 30 days
// ---------------------------------------------------------------------------

async function fetchRecentPosts(
  accessToken: string,
  orgUrn: string
): Promise<LiPost[]> {
  const params = new URLSearchParams({
    author: orgUrn,
    q: 'author',
    count: '10',
    start: '0',
    sortBy: 'LAST_MODIFIED',
  })
  const url = `https://api.linkedin.com/rest/posts?${params}`
  const resp = await fetch(url, { headers: liHeaders(accessToken) })
  if (!resp.ok) {
    throw new Error(
      `LinkedIn posts list failed: ${resp.status} ${resp.statusText}`
    )
  }
  const data = (await resp.json()) as LiPostsResponse
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  return (data.elements ?? []).filter(
    (p) => (p.publishedAt ?? 0) >= thirtyDaysAgo
  )
}

// ---------------------------------------------------------------------------
// Fetch: per-post share statistics (lifetime, queried via ugcPosts param)
// ---------------------------------------------------------------------------

async function fetchPostShareStats(
  accessToken: string,
  orgUrn: string,
  posts: LiPost[]
): Promise<Map<string, LiShareStatData>> {
  const result = new Map<string, LiShareStatData>()
  if (posts.length === 0) return result

  // The API accepts ugcPosts[0]=…&ugcPosts[1]=… for multi-post queries.
  // Use the post id (which is a urn:li:ugcPost or urn:li:share URN).
  const params = new URLSearchParams({
    q: 'organizationalEntity',
    organizationalEntity: orgUrn,
  })
  posts.forEach((p, i) => params.append(`ugcPosts[${i}]`, p.id))

  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?${params}`
  const resp = await fetch(url, { headers: liHeaders(accessToken) })
  if (!resp.ok) {
    throw new Error(
      `LinkedIn postShareStats failed: ${resp.status} ${resp.statusText}`
    )
  }
  const data = (await resp.json()) as LiShareStatResponse
  for (const el of data.elements ?? []) {
    const key = el.ugcPost ?? el.share ?? ''
    if (key && el.totalShareStatistics) {
      result.set(key, el.totalShareStatistics)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function accountRows(
  date: string,
  followersCount: number,
  followerGains: number,
  shareStats: LiShareStatData
): MetricRow[] {
  const base = {
    date,
    channel: CHANNEL,
    scope: 'account' as const,
    scope_id: '',
    source: SOURCE,
  }
  return [
    { ...base, metric: 'followers_count', value: followersCount },
    { ...base, metric: 'follower_gains', value: followerGains },
    { ...base, metric: 'impressions', value: shareStats.impressionCount ?? 0 },
    {
      ...base,
      metric: 'unique_impressions',
      value: shareStats.uniqueImpressionsCount ?? 0,
    },
    { ...base, metric: 'clicks', value: shareStats.clickCount ?? 0 },
    { ...base, metric: 'reactions', value: shareStats.likeCount ?? 0 },
    { ...base, metric: 'comments', value: shareStats.commentCount ?? 0 },
    { ...base, metric: 'shares', value: shareStats.shareCount ?? 0 },
    {
      ...base,
      metric: 'engagement_rate',
      value: shareStats.engagement ?? 0,
    },
  ]
}

function postRows(
  date: string,
  posts: LiPost[],
  statsMap: Map<string, LiShareStatData>
): MetricRow[] {
  return posts.flatMap((post): MetricRow[] => {
    const stats = statsMap.get(post.id) ?? {}
    const base = {
      date,
      channel: CHANNEL,
      scope: 'post' as const,
      scope_id: post.id,
      source: SOURCE,
      metadata: {
        post_type: derivePostType(post),
        published_at: post.publishedAt
          ? new Date(post.publishedAt).toISOString()
          : null,
        text_snippet: (post.commentary ?? '').slice(0, 200),
      },
    }
    return [
      { ...base, metric: 'impressions', value: stats.impressionCount ?? 0 },
      {
        ...base,
        metric: 'unique_impressions',
        value: stats.uniqueImpressionsCount ?? 0,
      },
      { ...base, metric: 'clicks', value: stats.clickCount ?? 0 },
      { ...base, metric: 'reactions_total', value: stats.likeCount ?? 0 },
      { ...base, metric: 'comments', value: stats.commentCount ?? 0 },
      { ...base, metric: 'shares', value: stats.shareCount ?? 0 },
      { ...base, metric: 'engagement_rate', value: stats.engagement ?? 0 },
    ]
  })
}

/** Derive a human-readable post type from the /rest/posts content shape. */
function derivePostType(post: LiPost): string {
  if (post.content?.media?.id) return 'video'
  if (post.content?.article?.source) return 'article'
  if (post.content?.multiImage) return 'image'
  // mediaType field present on some responses
  if (post.mediaType) return post.mediaType.toLowerCase()
  return 'text'
}

// ---------------------------------------------------------------------------
// Date iterator
// ---------------------------------------------------------------------------

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Validate required env vars up front
  let orgId: string
  try {
    orgId = requireEnv('LINKEDIN_ORGANIZATION_ID')
  } catch (e) {
    return NextResponse.json(
      {
        error:
          'LINKEDIN_ORGANIZATION_ID is not set. Obtain the numeric org ID from the LinkedIn Company Page admin URL and add it to env vars.',
      },
      { status: 500 }
    )
  }

  const orgUrn = `urn:li:organization:${orgId}`

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

  let accessToken: string
  try {
    accessToken = await getLinkedInAccessToken()
  } catch (e) {
    return NextResponse.json(
      {
        error: `LinkedIn not connected: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  // Post-level stats are fetched once (lifetime totals) and written for every
  // day in the range — same pattern as the Meta Page ingestor.
  let recentPosts: LiPost[] = []
  let postStatsMap = new Map<string, LiShareStatData>()

  try {
    recentPosts = await fetchRecentPosts(accessToken, orgUrn)
  } catch (e) {
    errors.push(`posts_fetch: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (recentPosts.length > 0) {
    try {
      postStatsMap = await fetchPostShareStats(accessToken, orgUrn, recentPosts)
    } catch (e) {
      errors.push(
        `post_stats_fetch: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  // Follower count is a snapshot (not per-day), so we fetch it once and
  // write the same value for every day in the range. It changes slowly
  // enough that daily cron produces a useful trend series.
  let followersCount = 0
  try {
    followersCount = await fetchFollowerCount(accessToken, orgUrn)
  } catch (e) {
    errors.push(
      `follower_count_fetch: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  for (const day of dateIter(startDate, endDate)) {
    // Account-level share stats (per day)
    let shareStats: LiShareStatData = {}
    try {
      shareStats = await fetchAccountShareStats(accessToken, orgUrn, day)
    } catch (e) {
      errors.push(
        `${day}:account_share_stats: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    // Follower gains (per day)
    let followerGains = 0
    try {
      followerGains = await fetchFollowerGains(accessToken, orgUrn, day)
    } catch (e) {
      errors.push(
        `${day}:follower_gains: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    // Account rows
    try {
      const rows = accountRows(day, followersCount, followerGains, shareStats)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(`account:${r.metric}`))
    } catch (e) {
      errors.push(
        `${day}:account_upsert: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    // Post rows (lifetime totals written per day — same approach as Meta)
    if (recentPosts.length > 0) {
      try {
        const rows = postRows(day, recentPosts, postStatsMap)
        const upserted = await upsertMetricRows(rows)
        totalRows += upserted
        rows.forEach((r) => metricsCovered.add(`post:${r.metric}`))
      } catch (e) {
        errors.push(
          `${day}:post_upsert: ${e instanceof Error ? e.message : String(e)}`
        )
      }
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
