import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const X_OAUTH_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const X_OAUTH_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const X_TWEETS_URL = 'https://api.twitter.com/2/tweets'
const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'
// media.write added 2026-05-10 to enable native video/image upload via v2/media/upload.
// Requires X dev app on Basic tier ($100/mo) or higher per X docs. If the OAuth grant
// fails after this change, the app needs to be upgraded at developer.x.com.
const X_OAUTH_SCOPES = 'tweet.write tweet.read users.read media.write offline.access'

interface StoredXToken {
  access_token: string
  refresh_token: string | null
  expires_at: string
}

interface XTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

interface MediaUploadInitResponse {
  media_id_string?: string
  expires_after_secs?: number
}

interface MediaUploadStatusResponse {
  media_id_string?: string
  processing_info?: {
    state: string
    progress_percent?: number
    check_after_secs?: number
    error?: { code: number; name: string; message: string }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) throw new Error(`${name} is not configured`)
  return value
}

function getSupabase() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis not configured')
  return new Redis({ url, token })
}

export function getXOAuthEnv() {
  const clientId = requireEnv('X_CLIENT_ID')
  const clientSecret = requireEnv('X_CLIENT_SECRET')
  const redirectUri = requireEnv('X_REDIRECT_URI')
  return { clientId, clientSecret, redirectUri }
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export async function getXAuthorizationUrl(state: string): Promise<string> {
  const { clientId, redirectUri } = getXOAuthEnv()
  const redis = getRedis()

  const { codeVerifier, codeChallenge } = generatePKCE()
  await redis.setex(`x:pkce:${state}`, 600, codeVerifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: X_OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${X_OAUTH_AUTH_URL}?${params.toString()}`
}

export async function getXCodeVerifier(state: string): Promise<string | null> {
  const redis = getRedis()
  const verifier = await redis.get<string>(`x:pkce:${state}`)
  if (verifier) {
    await redis.del(`x:pkce:${state}`)
  }
  return verifier
}

export async function exchangeXCode(code: string, codeVerifier: string): Promise<StoredXToken> {
  const { clientId, clientSecret, redirectUri } = getXOAuthEnv()

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(X_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`X token exchange failed: ${response.status} ${response.statusText} — ${text}`)
  }

  const json = (await response.json()) as XTokenResponse
  if (!json.access_token) throw new Error('X token exchange missing access_token')

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: new Date(Date.now() + (json.expires_in ?? 7200) * 1000).toISOString(),
  }
}

export async function upsertXToken(token: StoredXToken): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('x_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`Failed to store X token: ${error.message}`)
}

async function refreshXToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getXOAuthEnv()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(X_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`X token refresh failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as XTokenResponse
  if (!json.access_token) throw new Error('X token refresh missing access_token')

  const supabase = getSupabase()
  await supabase
    .from('x_auth')
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? refreshToken,
      expires_at: new Date(Date.now() + (json.expires_in ?? 7200) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  return json.access_token
}

export async function getXAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('x_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('X not connected — visit /api/x/authorize to connect')
  }

  const token = data as StoredXToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 60 * 1000

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return token.access_token
  }

  if (!token.refresh_token) {
    throw new Error('X access token expired and no refresh token — reconnect via /api/x/authorize')
  }

  return refreshXToken(token.refresh_token)
}

async function initMediaUpload(
  accessToken: string,
  totalBytes: number,
  mediaType: string
): Promise<string> {
  const params = new URLSearchParams({
    command: 'INIT',
    total_bytes: totalBytes.toString(),
    media_type: mediaType,
    media_category: 'tweet_video',
  })

  const response = await fetch(`${X_MEDIA_UPLOAD_URL}?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`X media INIT failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as MediaUploadInitResponse
  if (!json.media_id_string) throw new Error('X media INIT returned no media_id_string')
  return json.media_id_string
}

async function appendMediaChunk(
  accessToken: string,
  mediaId: string,
  chunk: ArrayBuffer,
  segmentIndex: number
): Promise<void> {
  const formData = new FormData()
  formData.append('command', 'APPEND')
  formData.append('media_id', mediaId)
  formData.append('segment_index', segmentIndex.toString())
  formData.append('media', new Blob([chunk]))

  const response = await fetch(X_MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`X media APPEND (segment ${segmentIndex}) failed: ${response.status}`)
  }
}

async function finalizeMediaUpload(accessToken: string, mediaId: string): Promise<void> {
  const params = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })

  const response = await fetch(X_MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: params,
  })

  if (!response.ok) {
    throw new Error(`X media FINALIZE failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as MediaUploadStatusResponse
  const processingInfo = json.processing_info

  if (!processingInfo || processingInfo.state === 'succeeded') return

  // Poll until processing is complete
  let waitSecs = processingInfo.check_after_secs ?? 5
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000))

    const statusParams = new URLSearchParams({ command: 'STATUS', media_id: mediaId })
    const statusResponse = await fetch(`${X_MEDIA_UPLOAD_URL}?${statusParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!statusResponse.ok) {
      throw new Error(`X media STATUS failed: ${statusResponse.status}`)
    }

    const statusJson = (await statusResponse.json()) as MediaUploadStatusResponse
    const info = statusJson.processing_info

    if (!info || info.state === 'succeeded') return
    if (info.state === 'failed') {
      throw new Error(`X media processing failed: ${info.error?.message ?? 'unknown error'}`)
    }

    waitSecs = info.check_after_secs ?? 5
  }

  throw new Error('X media processing timed out')
}

export async function uploadVideoToX(accessToken: string, videoUrl: string): Promise<string> {
  const sourceResponse = await fetch(videoUrl)
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new Error(`Failed to fetch video for X upload: ${sourceResponse.status}`)
  }

  const bytes = await sourceResponse.arrayBuffer()
  const contentType = sourceResponse.headers.get('content-type') ?? 'video/mp4'
  const chunkSize = 5 * 1024 * 1024 // 5 MB

  const mediaId = await initMediaUpload(accessToken, bytes.byteLength, contentType)

  let segmentIndex = 0
  let offset = 0
  while (offset < bytes.byteLength) {
    const chunk = bytes.slice(offset, offset + chunkSize)
    await appendMediaChunk(accessToken, mediaId, chunk, segmentIndex)
    offset += chunkSize
    segmentIndex++
  }

  await finalizeMediaUpload(accessToken, mediaId)
  return mediaId
}

export async function postXTweet(
  accessToken: string,
  text: string,
  mediaId?: string
): Promise<string> {
  const body: { text: string; media?: { media_ids: string[] } } = { text }
  if (mediaId) {
    body.media = { media_ids: [mediaId] }
  }

  const response = await fetch(X_TWEETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`X tweet creation failed: ${response.status} ${response.statusText} — ${text}`)
  }

  const json = (await response.json()) as { data?: { id?: string } }
  if (!json.data?.id) throw new Error('X tweet created but no id returned')
  return json.data.id
}

// ---------------------------------------------------------------------------
// Analytics helpers — X API v2
//
// Tier limits (as of 2026):
//   Free ($0/mo)  — read/write 500 tweets/mo, NO tweet-level analytics, NO
//                   organic user metrics endpoint.
//   Basic ($100/mo)— read/write up to 10K tweets/mo; tweet metrics (public
//                   engagement counts) via GET /2/tweets?fields=public_metrics
//                   available. Impressions and organic reach require Elevated.
//   Elevated/Pro  — full organic metrics including impressions.
//
// What Basic CAN return:
//   public_metrics: like_count, retweet_count, reply_count, quote_count,
//                   bookmark_count, impression_count (zero on Basic — see note).
//   User metrics:   followers_count, following_count, tweet_count via
//                   GET /2/users/:id?user.fields=public_metrics.
//   Timeline:       GET /2/users/:id/tweets for tweet-count-today derivation.
//
// Impression_count in public_metrics is only populated for the authenticated
// user's own tweets on Basic+ but may return 0 on Basic. We emit the value
// we receive and flag tier_limited in metadata when it is zero.
// ---------------------------------------------------------------------------

const X_USERS_URL = 'https://api.twitter.com/2/users'

// Raw API response shapes -------------------------------------------------

interface XUserPublicMetrics {
  followers_count: number
  following_count: number
  tweet_count: number
  listed_count: number
}

interface XUserResponse {
  data?: {
    id: string
    name: string
    username: string
    public_metrics?: XUserPublicMetrics
  }
  errors?: Array<{ message: string }>
}

interface XTweetPublicMetrics {
  like_count: number
  retweet_count: number
  reply_count: number
  quote_count: number
  bookmark_count: number
  impression_count: number
}

interface XTweet {
  id: string
  text: string
  created_at: string
  public_metrics?: XTweetPublicMetrics
  attachments?: { media_keys?: string[] }
  entities?: { urls?: Array<{ expanded_url: string }> }
}

interface XTimelineResponse {
  data?: XTweet[]
  meta?: {
    newest_id?: string
    oldest_id?: string
    result_count?: number
    next_token?: string
  }
  errors?: Array<{ message: string }>
}

// Public-facing types ------------------------------------------------------

export interface XAccountMetrics {
  followersCount: number
  followingCount: number
  tweetCountToday: number
  // The metrics below are empty-zeroed with tierLimited=true on Free/Basic.
  // On Elevated/Pro they reflect actual organic reach.
  impressions: number
  engagements: number
  likes: number
  replies: number
  retweets: number
  quotes: number
  bookmarks: number
  tierLimited: boolean
}

export interface XTweetMetrics {
  tweetId: string
  textSnippet: string // first 200 chars
  createdAt: string
  tweetType: 'text' | 'photo' | 'video' | 'poll' | 'link'
  impressions: number
  likes: number
  replies: number
  retweets: number
  quotes: number
  bookmarks: number
  // link_clicks, profile_clicks, url_clicks are only available via the
  // Ads Analytics endpoint (POST /2/tweets/:id/timelines or organic-metrics
  // field on Elevated+). On Basic they are not populated; we return 0.
  linkClicks: number
  profileClicks: number
  urlClicks: number
  tierLimited: boolean
}

export interface XAnalytics {
  /** ISO-8601 date this data represents */
  date: string
  /** Authenticated user's numeric ID */
  userId: string
  account: XAccountMetrics
  /** Top tweets from the last 30 days, ranked by impressions (max 10) */
  topTweets: XTweetMetrics[]
  errors: string[]
}

/**
 * Resolve the authenticated user's numeric ID from the /users/me endpoint.
 * This is required for all timeline + metrics queries.
 */
export async function getXUserId(accessToken: string): Promise<string> {
  const url = `${X_USERS_URL}/me?user.fields=id`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) {
    throw new Error(`GET /2/users/me failed: ${resp.status} ${resp.statusText}`)
  }
  const json = (await resp.json()) as { data?: { id?: string }; errors?: Array<{ message: string }> }
  if (!json.data?.id) {
    throw new Error(
      `Could not resolve X user id: ${json.errors?.map((e) => e.message).join('; ') ?? 'no data'}`
    )
  }
  return json.data.id
}

/**
 * Fetch account-level public metrics for a given user.
 *
 * Tier note: public_metrics on /users/:id is available on Free and Basic.
 * Organic engagement totals (impressions, reach) are NOT available on Free
 * or Basic — they require Elevated access. We return zeros for those fields
 * and set tierLimited=true.
 */
async function fetchXUserMetrics(
  accessToken: string,
  userId: string
): Promise<{ metrics: Omit<XAccountMetrics, 'tweetCountToday' | 'tierLimited'>; tierLimited: boolean }> {
  const url = `${X_USERS_URL}/${userId}?user.fields=public_metrics`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resp.ok) {
    throw new Error(`GET /2/users/${userId} failed: ${resp.status} ${resp.statusText}`)
  }

  const json = (await resp.json()) as XUserResponse
  if (!json.data?.public_metrics) {
    throw new Error(
      `No public_metrics in user response: ${json.errors?.map((e) => e.message).join('; ') ?? 'unknown'}`
    )
  }

  const pm = json.data.public_metrics
  // Organic engagement totals are not returned at Basic — they come back via
  // the separate organic metrics field which requires Elevated scope.
  return {
    metrics: {
      followersCount: pm.followers_count,
      followingCount: pm.following_count,
      impressions: 0,
      engagements: 0,
      likes: 0,
      replies: 0,
      retweets: 0,
      quotes: 0,
      bookmarks: 0,
    },
    // Mark tier-limited: impressions and engagement totals are unavailable.
    tierLimited: true,
  }
}

/**
 * Fetch recent tweets for a user and count how many were posted on `date`.
 * Also collects engagement totals from public_metrics to populate account-level
 * like/reply/retweet/quote/bookmark sums for that day.
 *
 * The timeline API returns up to 100 tweets per page. For daily ingestion we
 * fetch enough to cover the last 24 h. Pagination is capped at 2 pages
 * (200 tweets) — more than enough for daily posting volume.
 *
 * Tier: GET /2/users/:id/tweets with public_metrics is available on Basic+.
 * Impression_count inside public_metrics is returned on Basic but its value
 * is often 0 — the field exists; the data may not be populated in real time.
 */
async function fetchXTimeline(
  accessToken: string,
  userId: string,
  date: string
): Promise<{
  tweetCountToday: number
  dailyLikes: number
  dailyReplies: number
  dailyRetweets: number
  dailyQuotes: number
  dailyBookmarks: number
  tweets: XTweet[]
}> {
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  // Fetch last 30 days to get top-tweet data alongside today's count.
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const startTime = thirtyDaysAgo.toISOString()

  const allTweets: XTweet[] = []
  let nextToken: string | undefined
  let pages = 0
  const MAX_PAGES = 2

  do {
    const params = new URLSearchParams({
      max_results: '100',
      'tweet.fields': 'created_at,public_metrics,attachments,entities',
      start_time: startTime,
    })
    if (nextToken) params.set('pagination_token', nextToken)

    const url = `${X_USERS_URL}/${userId}/tweets?${params.toString()}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!resp.ok) {
      throw new Error(`GET /2/users/${userId}/tweets failed: ${resp.status} ${resp.statusText}`)
    }

    const json = (await resp.json()) as XTimelineResponse
    if (json.data) allTweets.push(...json.data)
    nextToken = json.meta?.next_token
    pages++
  } while (nextToken && pages < MAX_PAGES)

  // Today's tweets
  const todayTweets = allTweets.filter((t) => {
    if (!t.created_at) return false
    return t.created_at >= dayStart && t.created_at <= dayEnd
  })

  // Aggregate daily engagement from today's tweets
  let dailyLikes = 0
  let dailyReplies = 0
  let dailyRetweets = 0
  let dailyQuotes = 0
  let dailyBookmarks = 0

  for (const t of todayTweets) {
    const pm = t.public_metrics
    if (!pm) continue
    dailyLikes += pm.like_count
    dailyReplies += pm.reply_count
    dailyRetweets += pm.retweet_count
    dailyQuotes += pm.quote_count
    dailyBookmarks += pm.bookmark_count
  }

  return {
    tweetCountToday: todayTweets.length,
    dailyLikes,
    dailyReplies,
    dailyRetweets,
    dailyQuotes,
    dailyBookmarks,
    tweets: allTweets,
  }
}

/**
 * Classify a tweet type from its fields.
 */
function classifyTweetType(tweet: XTweet): XTweetMetrics['tweetType'] {
  if (tweet.attachments?.media_keys?.length) {
    // We can't distinguish photo vs video without media.fields — call it photo
    // as the safer default for Basic tier (no media.fields expansion here).
    return 'photo'
  }
  if (tweet.entities?.urls?.length) return 'link'
  return 'text'
}

/**
 * Main analytics entry point. Returns a structured XAnalytics object for the
 * given date. On tier-limited plans, some metrics will be 0 with tierLimited=true.
 *
 * Requires: tweet.read + users.read OAuth scopes (already in X_OAUTH_SCOPES).
 */
export async function getXAnalytics(accessToken: string, date: string): Promise<XAnalytics> {
  const errors: string[] = []

  // Step 1: resolve user ID
  let userId: string
  try {
    userId = await getXUserId(accessToken)
  } catch (e) {
    throw new Error(`getXAnalytics: could not get user ID: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Step 2: user-level public metrics (followers, following)
  let userMetrics: Omit<XAccountMetrics, 'tweetCountToday' | 'tierLimited'>
  let tierLimited = true
  try {
    const result = await fetchXUserMetrics(accessToken, userId)
    userMetrics = result.metrics
    tierLimited = result.tierLimited
  } catch (e) {
    errors.push(`user_metrics: ${e instanceof Error ? e.message : String(e)}`)
    userMetrics = {
      followersCount: 0,
      followingCount: 0,
      impressions: 0,
      engagements: 0,
      likes: 0,
      replies: 0,
      retweets: 0,
      quotes: 0,
      bookmarks: 0,
    }
  }

  // Step 3: timeline for tweet-count-today + daily engagement sums + top tweets
  let tweetCountToday = 0
  let dailyLikes = 0
  let dailyReplies = 0
  let dailyRetweets = 0
  let dailyQuotes = 0
  let dailyBookmarks = 0
  let allTweets: XTweet[] = []

  try {
    const timeline = await fetchXTimeline(accessToken, userId, date)
    tweetCountToday = timeline.tweetCountToday
    dailyLikes = timeline.dailyLikes
    dailyReplies = timeline.dailyReplies
    dailyRetweets = timeline.dailyRetweets
    dailyQuotes = timeline.dailyQuotes
    dailyBookmarks = timeline.dailyBookmarks
    allTweets = timeline.tweets
  } catch (e) {
    errors.push(`timeline: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Step 4: top 10 tweets by impression_count over last 30 days
  const sorted = [...allTweets].sort((a, b) => {
    const aImp = a.public_metrics?.impression_count ?? 0
    const bImp = b.public_metrics?.impression_count ?? 0
    return bImp - aImp
  })

  const topTweets: XTweetMetrics[] = sorted.slice(0, 10).map((t) => {
    const pm = t.public_metrics
    const impressions = pm?.impression_count ?? 0
    return {
      tweetId: t.id,
      textSnippet: t.text.slice(0, 200),
      createdAt: t.created_at ?? '',
      tweetType: classifyTweetType(t),
      impressions,
      likes: pm?.like_count ?? 0,
      replies: pm?.reply_count ?? 0,
      retweets: pm?.retweet_count ?? 0,
      quotes: pm?.quote_count ?? 0,
      bookmarks: pm?.bookmark_count ?? 0,
      // Non-public organic metrics require Elevated access.
      linkClicks: 0,
      profileClicks: 0,
      urlClicks: 0,
      // tierLimited if no real impressions data
      tierLimited: impressions === 0,
    }
  })

  const account: XAccountMetrics = {
    ...userMetrics,
    tweetCountToday,
    // Daily engagement comes from today's tweets on the timeline.
    // We update the zeros from fetchXUserMetrics with actual daily counts.
    likes: dailyLikes,
    replies: dailyReplies,
    retweets: dailyRetweets,
    quotes: dailyQuotes,
    bookmarks: dailyBookmarks,
    // Engagements = sum of all public engagement signals for the day.
    engagements: dailyLikes + dailyReplies + dailyRetweets + dailyQuotes + dailyBookmarks,
    // impressions: 0 on Basic — set by fetchXUserMetrics, kept as 0.
    tierLimited,
  }

  return { date, userId, account, topTweets, errors }
}
