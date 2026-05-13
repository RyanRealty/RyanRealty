import { createClient } from '@supabase/supabase-js'

const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3/videos'
const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// youtube.upload: publish videos. youtube.readonly: read channel metadata
// (subscribers, video list). yt-analytics.readonly: pull the YouTube
// Analytics API v2 (views, retention, CTR, etc) for the marketing brain.
// youtube.force-ssl: write access for channels.update brandingSettings
// (channel description, title) — needed for social brand sync 2026-05-13.
const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ')

// ---------------------------------------------------------------------------
// YouTube Analytics API v2
// ---------------------------------------------------------------------------

const YOUTUBE_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2'
const YOUTUBE_DATA_BASE = 'https://www.googleapis.com/youtube/v3'

export interface YouTubeAnalyticsDayRow {
  date: string // YYYY-MM-DD
  // Account-level metrics (channel==MINE)
  views: number
  watchTimeMinutes: number
  subscribersGained: number
  subscribersLost: number
  averageViewDurationSeconds: number
  averageViewPercentage: number
  cardClickRate: number
  cardImpressions: number
  annotationClickThroughRate: number
  likes: number
  comments: number
  shares: number
}

export interface YouTubeVideoMetrics {
  videoId: string
  views: number
  watchTimeMinutes: number
  averageViewDurationSeconds: number
  averageViewPercentage: number
  subscribersGained: number
  impressions: number
  impressionsClickThroughRate: number
  metadata: {
    title: string
    publishedAt: string
    durationSeconds: number
  }
}

/**
 * Fetch account-level YouTube Analytics metrics for a single day.
 * Uses the YouTube Analytics API v2 (youtubeAnalytics.reports.query).
 * Requires a valid access token with the youtube.readonly scope.
 */
export async function getYouTubeAnalyticsDay(
  date: string,
  accessToken: string
): Promise<YouTubeAnalyticsDayRow> {
  const metrics = [
    'views',
    'estimatedMinutesWatched',
    'subscribersGained',
    'subscribersLost',
    'averageViewDuration',
    'averageViewPercentage',
    'cardClickRate',
    'cardImpressions',
    'annotationClickThroughRate',
    'likes',
    'comments',
    'shares',
  ].join(',')

  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: date,
    endDate: date,
    metrics,
  })

  const res = await fetch(`${YOUTUBE_ANALYTICS_BASE}/reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube Analytics account query failed ${res.status}: ${body}`)
  }

  const json = (await res.json()) as {
    columnHeaders?: { name: string }[]
    rows?: (number | string)[][]
  }

  // API returns rows only when there is data. A channel with zero activity
  // returns an empty rows array — treat as all-zeros rather than an error.
  const row = json.rows?.[0] ?? []

  const get = (name: string): number => {
    const idx = json.columnHeaders?.findIndex((h) => h.name === name) ?? -1
    if (idx === -1) return 0
    return Number(row[idx] ?? 0)
  }

  return {
    date,
    views: get('views'),
    watchTimeMinutes: get('estimatedMinutesWatched'),
    subscribersGained: get('subscribersGained'),
    subscribersLost: get('subscribersLost'),
    averageViewDurationSeconds: get('averageViewDuration'),
    averageViewPercentage: get('averageViewPercentage'),
    cardClickRate: get('cardClickRate'),
    cardImpressions: get('cardImpressions'),
    annotationClickThroughRate: get('annotationClickThroughRate'),
    likes: get('likes'),
    comments: get('comments'),
    shares: get('shares'),
  }
}

/**
 * Fetch per-video YouTube Analytics metrics for the top-N videos by views
 * in the 30-day window ending on `endDate`. Returns up to `limit` videos
 * (default 15) with analytics + Data API metadata (title, publishedAt, duration).
 */
export async function getYouTubeTopVideoMetrics(
  endDate: string,
  accessToken: string,
  limit = 15
): Promise<YouTubeVideoMetrics[]> {
  // Step 1: Fetch top videos by views in the last 30 days.
  const startDate = new Date(`${endDate}T00:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() - 29)
  const startDateStr = startDate.toISOString().slice(0, 10)

  // impressions + impressionsClickThroughRate are only available at the
  // channel level in YouTube Analytics, not at the video dimension.
  // They live in the account-scope ingestor output. Including them here
  // returns 400 "Unknown identifier (impressions) given in field
  // parameters.metrics". Verified live 2026-05-13.
  const videoMetrics = [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'averageViewPercentage',
    'subscribersGained',
  ].join(',')

  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: startDateStr,
    endDate,
    metrics: videoMetrics,
    dimensions: 'video',
    sort: '-views',
    maxResults: String(limit),
  })

  const res = await fetch(`${YOUTUBE_ANALYTICS_BASE}/reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube Analytics video query failed ${res.status}: ${body}`)
  }

  const json = (await res.json()) as {
    columnHeaders?: { name: string }[]
    rows?: (number | string)[][]
  }

  const rows = json.rows ?? []
  if (rows.length === 0) return []

  const headers = json.columnHeaders ?? []
  const col = (name: string) => headers.findIndex((h) => h.name === name)

  // Column indices
  const idxVideo = col('video')
  const idxViews = col('views')
  const idxMinutes = col('estimatedMinutesWatched')
  const idxAvgDur = col('averageViewDuration')
  const idxAvgPct = col('averageViewPercentage')
  const idxSubGained = col('subscribersGained')
  // Video dimension does not return impressions / CTR — they're omitted
  // from videoMetrics above. Indices return -1 and the consumer reads 0.
  const idxImpressions = col('impressions')
  const idxCTR = col('impressionsClickThroughRate')

  // Step 2: Fetch Data API metadata for all video IDs in one call.
  const videoIds = rows.map((r) => String(r[idxVideo])).filter(Boolean)

  const dataParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoIds.join(','),
    fields: 'items(id,snippet(title,publishedAt),contentDetails(duration))',
  })

  const dataRes = await fetch(`${YOUTUBE_DATA_BASE}/videos?${dataParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!dataRes.ok) {
    const body = await dataRes.text()
    throw new Error(`YouTube Data API video metadata failed ${dataRes.status}: ${body}`)
  }

  const dataJson = (await dataRes.json()) as {
    items?: {
      id: string
      snippet?: { title?: string; publishedAt?: string }
      contentDetails?: { duration?: string }
    }[]
  }

  // Build metadata map by video ID.
  const metaMap = new Map<string, { title: string; publishedAt: string; durationSeconds: number }>()
  for (const item of dataJson.items ?? []) {
    metaMap.set(item.id, {
      title: item.snippet?.title ?? '',
      publishedAt: item.snippet?.publishedAt ?? '',
      durationSeconds: parseIsoDuration(item.contentDetails?.duration ?? 'PT0S'),
    })
  }

  return rows.map((r): YouTubeVideoMetrics => {
    const videoId = String(r[idxVideo])
    const meta = metaMap.get(videoId) ?? { title: '', publishedAt: '', durationSeconds: 0 }
    return {
      videoId,
      views: Number(r[idxViews] ?? 0),
      watchTimeMinutes: Number(r[idxMinutes] ?? 0),
      averageViewDurationSeconds: Number(r[idxAvgDur] ?? 0),
      averageViewPercentage: Number(r[idxAvgPct] ?? 0),
      subscribersGained: Number(r[idxSubGained] ?? 0),
      impressions: Number(r[idxImpressions] ?? 0),
      impressionsClickThroughRate: Number(r[idxCTR] ?? 0),
      metadata: meta,
    }
  })
}

/**
 * Parse an ISO 8601 duration string (e.g. "PT4M13S") into total seconds.
 * Handles hours, minutes, and seconds. Returns 0 for invalid input.
 */
function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (Number(match[1] ?? 0) * 3600) + (Number(match[2] ?? 0) * 60) + Number(match[3] ?? 0)
}

interface YouTubeSnippet {
  title: string
  description: string
  tags?: string[]
  /** YouTube category ID. Default '26' (Howto & Style) for real-estate content. '37' is Pets & Animals — never use. */
  categoryId?: string
}

interface YouTubeStatus {
  privacyStatus?: 'public' | 'private' | 'unlisted'
  selfDeclaredMadeForKids?: boolean
  /** Required by YouTube ToS when video contains AI-generated voiceover (e.g. ElevenLabs Victoria). */
  containsSyntheticMedia?: boolean
  /** ISO timestamp for scheduled publishing. Requires privacyStatus='private' until publishAt fires. */
  publishAt?: string
}

interface UploadFromUrlOptions {
  accessToken: string
  videoUrl: string
  snippet: YouTubeSnippet
  status?: YouTubeStatus
}

interface YouTubeUploadResponse {
  id?: string
  error?: {
    message?: string
  }
}

interface StoredYouTubeToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function getSupabase() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

export function getYouTubeOAuthEnv() {
  const clientId = requireEnv('YOUTUBE_CLIENT_ID')
  const clientSecret = requireEnv('YOUTUBE_CLIENT_SECRET')
  const redirectUri = requireEnv('YOUTUBE_REDIRECT_URI')
  return { clientId, clientSecret, redirectUri }
}

export function getYouTubeAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getYouTubeOAuthEnv()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
}

export async function exchangeYouTubeCode(code: string): Promise<StoredYouTubeToken> {
  const { clientId, clientSecret, redirectUri } = getYouTubeOAuthEnv()

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`YouTube token exchange failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!json.access_token) throw new Error('YouTube token exchange missing access_token')
  if (!json.refresh_token) throw new Error('YouTube token exchange missing refresh_token — ensure prompt=consent was used')

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  }
}

export async function upsertYouTubeToken(token: StoredYouTubeToken): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('youtube_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`Failed to store YouTube token: ${error.message}`)
}

async function refreshYouTubeToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getYouTubeOAuthEnv()

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`YouTube token refresh failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) {
    throw new Error('YouTube token refresh response missing access_token')
  }

  const supabase = getSupabase()
  await supabase
    .from('youtube_auth')
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  return json.access_token
}

export async function getYouTubeAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('youtube_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('YouTube not connected — visit /api/youtube/authorize to connect')
  }

  const token = data as StoredYouTubeToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 60 * 1000

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return token.access_token
  }

  return refreshYouTubeToken(token.refresh_token)
}

export async function uploadYouTubeVideoFromUrl(options: UploadFromUrlOptions): Promise<string> {
  const initResponse = await fetch(
    `${YOUTUBE_UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify({
        snippet: {
          title: options.snippet.title,
          description: options.snippet.description,
          tags: options.snippet.tags ?? [],
          categoryId: options.snippet.categoryId ?? '26',
        },
        status: {
          privacyStatus: options.status?.privacyStatus ?? 'public',
          selfDeclaredMadeForKids: options.status?.selfDeclaredMadeForKids ?? false,
          ...(options.status?.containsSyntheticMedia !== undefined && {
            containsSyntheticMedia: options.status.containsSyntheticMedia,
          }),
          ...(options.status?.publishAt && { publishAt: options.status.publishAt }),
        },
      }),
    }
  )

  if (!initResponse.ok) {
    throw new Error(`YouTube upload init failed: ${initResponse.status} ${initResponse.statusText}`)
  }

  const sessionUrl = initResponse.headers.get('location')
  if (!sessionUrl) {
    throw new Error('YouTube upload session URL missing')
  }

  // Stream the source video directly to YouTube instead of buffering in memory.
  // arrayBuffer() OOMs Vercel functions (256 MB limit) for videos >~50 MB.
  const sourceResponse = await fetch(options.videoUrl)
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new Error(`Failed to fetch video source: ${sourceResponse.status} ${sourceResponse.statusText}`)
  }

  const contentType = sourceResponse.headers.get('content-type') ?? 'video/mp4'
  const contentLength = sourceResponse.headers.get('content-length')

  const uploadHeaders: Record<string, string> = { 'Content-Type': contentType }
  if (contentLength) uploadHeaders['Content-Length'] = contentLength

  const uploadResponse = await fetch(sessionUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: sourceResponse.body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  if (!uploadResponse.ok) {
    throw new Error(`YouTube upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const uploadJson = (await uploadResponse.json()) as YouTubeUploadResponse
  if (!uploadJson.id) {
    throw new Error(uploadJson.error?.message || 'YouTube upload succeeded but no video id returned')
  }

  return uploadJson.id
}
