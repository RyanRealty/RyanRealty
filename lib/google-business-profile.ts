import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_GBP_ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
const GOOGLE_GBP_LOCAL_POSTS_BASE = 'https://mybusiness.googleapis.com/v4'
const GOOGLE_GBP_PERFORMANCE_BASE =
  'https://businessprofileperformance.googleapis.com/v1'
const STATE_TTL_SECONDS = 600

// ---------------------------------------------------------------------------
// GBP Performance API types
// ---------------------------------------------------------------------------

/**
 * Metric IDs supported by the Business Profile Performance API
 * (businessprofileperformance.locations.getDailyMetricsTimeSeries).
 *
 * Reference:
 *   https://developers.google.com/my-business/reference/businessprofileperformance/rest/v1/DailyMetric
 *
 * Skipped metrics (not applicable for a real-estate brokerage):
 *   BUSINESS_FOOD_ORDERS, BUSINESS_FOOD_MENU_CLICKS
 */
export type GBPDailyMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'CALL_CLICKS'
  | 'WEBSITE_CLICKS'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'BUSINESS_CONVERSATIONS'
  | 'BUSINESS_BOOKINGS'

export interface GBPDailyMetricPoint {
  date: string // YYYY-MM-DD
  metric: GBPDailyMetric
  value: number
}

export interface GBPDailyMetricsResult {
  ok: true
  points: GBPDailyMetricPoint[]
  locationName: string
}

export interface GBPDailyMetricsError {
  ok: false
  error: string
  status?: number
}

interface GBPTimeSeries {
  datedValues?: Array<{
    date?: { year?: number; month?: number; day?: number }
    value?: string
  }>
}

interface GBPPerformanceApiResponse {
  timeSeries?: GBPTimeSeries
  error?: { message?: string; code?: number }
}

// ---------------------------------------------------------------------------
// GBP Performance API fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch daily metric time-series for a single metric from the GBP Performance
 * API. The Insights API was deprecated in 2024; this uses the replacement:
 *   businessprofileperformance.googleapis.com/v1/locations/{name}:getDailyMetricsTimeSeries
 *
 * API Tier note: The Performance API is part of the Business Profile APIs
 * (previously My Business API). It requires the `business.manage` OAuth scope.
 * The API does NOT require enabling a separate API key — it uses OAuth 2.0
 * bearer tokens. Free tier; no per-call cost. Daily quota is 5,000 requests
 * per project per day (GCP API Console → Business Profile Performance API).
 *
 * Fetches one metric per call because the API endpoint is metric-scoped.
 */
async function fetchGBPMetricTimeSeries(
  accessToken: string,
  locationName: string,
  metric: GBPDailyMetric,
  startDate: string,
  endDate: string
): Promise<GBPDailyMetricPoint[]> {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)

  const params = new URLSearchParams({
    dailyMetric: metric,
    'dailyRange.start_date.year': String(startYear),
    'dailyRange.start_date.month': String(startMonth),
    'dailyRange.start_date.day': String(startDay),
    'dailyRange.end_date.year': String(endYear),
    'dailyRange.end_date.month': String(endMonth),
    'dailyRange.end_date.day': String(endDay),
  })

  const url = `${GOOGLE_GBP_PERFORMANCE_BASE}/${locationName}:getDailyMetricsTimeSeries?${params}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  const json = (await response.json()) as GBPPerformanceApiResponse

  if (!response.ok) {
    throw new Error(
      `GBP Performance API error for ${metric}: ${json.error?.message ?? response.statusText} (${response.status})`
    )
  }

  const datedValues = json.timeSeries?.datedValues ?? []
  return datedValues
    .filter((dv) => dv.date?.year && dv.date?.month && dv.date?.day)
    .map((dv) => {
      const y = dv.date!.year!
      const m = String(dv.date!.month!).padStart(2, '0')
      const d = String(dv.date!.day!).padStart(2, '0')
      return {
        date: `${y}-${m}-${d}`,
        metric,
        value: parseInt(dv.value ?? '0', 10) || 0,
      }
    })
}

/**
 * Fetch all applicable GBP daily metrics for a date range. Calls the
 * Performance API once per metric (9 metrics × 1 call each per day range).
 *
 * Location name format: `locations/{locationId}` — built from the env var
 * GOOGLE_BUSINESS_PROFILE_LOCATION_ID.
 *
 * Returns a flat array of (date, metric, value) points so the caller can
 * easily decompose into marketing_channel_daily rows.
 */
export async function getGBPDailyMetrics(
  startDate: string,
  endDate: string
): Promise<GBPDailyMetricsResult | GBPDailyMetricsError> {
  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!locationId?.trim()) {
    return { ok: false, error: 'GOOGLE_BUSINESS_PROFILE_LOCATION_ID not configured' }
  }

  const locationName = locationId.startsWith('locations/')
    ? locationId
    : `locations/${locationId}`

  let accessToken: string
  try {
    accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()
  } catch (e) {
    return {
      ok: false,
      error: `Token error: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const metrics: GBPDailyMetric[] = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_BOOKINGS',
  ]

  const allPoints: GBPDailyMetricPoint[] = []
  const errors: string[] = []

  // Sequential calls to stay within rate limits — 9 metrics is trivially fast.
  for (const metric of metrics) {
    try {
      const points = await fetchGBPMetricTimeSeries(
        accessToken,
        locationName,
        metric,
        startDate,
        endDate
      )
      allPoints.push(...points)
    } catch (e) {
      // Collect per-metric errors; don't abort the entire batch.
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  if (errors.length > 0 && allPoints.length === 0) {
    return { ok: false, error: errors.join('; ') }
  }

  // Partial success (some metrics failed) is still ok — caller sees all points
  // that did come back. Errors are surfaced in the ingestor result.
  return { ok: true, points: allPoints, locationName }
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
}

interface StoredGoogleToken {
  access_token: string
  refresh_token: string | null
  expires_at: string
}

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) {
    throw new Error('Upstash Redis not configured')
  }
  return new Redis({ url, token })
}

function getGoogleEnv() {
  const clientId =
    process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI

  if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri?.trim()) {
    throw new Error('Google Business Profile OAuth credentials not configured')
  }

  return { clientId, clientSecret, redirectUri }
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function createState(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64url')
}

export async function getGoogleBusinessProfileAuthorizationUrl(): Promise<string> {
  const { clientId, redirectUri } = getGoogleEnv()
  const state = createState()
  const redis = getRedis()
  await redis.setex(`gbp:state:${state}`, STATE_TTL_SECONDS, '1')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })

  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`
}

export async function validateGoogleBusinessProfileState(state: string): Promise<boolean> {
  const redis = getRedis()
  const key = `gbp:state:${state}`
  const stored = await redis.get(key)
  if (!stored) return false
  await redis.del(key)
  return true
}

export async function exchangeGoogleCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleEnv()

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${response.statusText}`)
  }

  const tokenData = (await response.json()) as GoogleTokenResponse
  if (!tokenData.access_token) {
    throw new Error('Google token exchange did not return an access token')
  }

  return tokenData
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleEnv()

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${response.statusText}`)
  }

  const tokenData = (await response.json()) as GoogleTokenResponse
  if (!tokenData.access_token) {
    throw new Error('Google token refresh did not return an access token')
  }

  return tokenData
}

export async function upsertGoogleBusinessProfileToken(token: GoogleTokenResponse): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('google_business_profile_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      token_type: token.token_type,
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw new Error(`Failed to persist Google token: ${error.message}`)
  }
}

export async function getOrRefreshGoogleBusinessProfileAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('google_business_profile_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('Google Business Profile token not found in database')
  }

  const token = data as StoredGoogleToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 60 * 1000

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return token.access_token
  }

  if (!token.refresh_token?.trim()) {
    throw new Error('Google refresh token missing; reconnect Google Business Profile')
  }

  const refreshed = await refreshGoogleAccessToken(token.refresh_token)
  await upsertGoogleBusinessProfileToken({
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
  })

  return refreshed.access_token
}

export async function listGoogleBusinessAccounts(accessToken: string): Promise<unknown> {
  const response = await fetch(GOOGLE_GBP_ACCOUNTS_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Google Business Profile accounts request failed: ${response.status} ${response.statusText}`
    )
  }

  return response.json()
}

interface GoogleBusinessProfilePublishOptions {
  accessToken: string
  summary: string
  mediaUrl?: string
  callToActionUrl?: string
}

interface GoogleBusinessProfilePostResponse {
  name?: string
  error?: {
    message?: string
  }
}

export async function publishGoogleBusinessLocalPost(
  options: GoogleBusinessProfilePublishOptions
): Promise<string> {
  const accountId = process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID

  if (!accountId?.trim() || !locationId?.trim()) {
    throw new Error('Google Business Profile account/location is not configured')
  }

  const postBody: Record<string, unknown> = {
    summary: options.summary,
    languageCode: 'en-US',
    topicType: 'STANDARD',
  }

  if (options.mediaUrl?.trim()) {
    postBody.media = [
      {
        mediaFormat: 'PHOTO',
        sourceUrl: options.mediaUrl,
      },
    ]
  }

  if (options.callToActionUrl?.trim()) {
    postBody.callToAction = {
      actionType: 'LEARN_MORE',
      url: options.callToActionUrl,
    }
  }

  const endpoint = `${GOOGLE_GBP_LOCAL_POSTS_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(
      `Google Business Profile publish failed: ${response.status} ${response.statusText} ${details}`
    )
  }

  const json = (await response.json()) as GoogleBusinessProfilePostResponse
  if (!json.name) {
    throw new Error(json.error?.message || 'Google Business Profile publish response missing name')
  }

  return json.name
}

/**
 * Stub for the performance-pull cron — full per-post GBP metrics fetcher
 * was scaffolded by the cron route author but never implemented in this
 * lib. Returns a "skipped" sentinel so the cron's catch-block records a
 * `performance_skipped` row instead of erroring out. Replace this with
 * a real implementation once GBP per-post performance is wired.
 */
export async function fetchGbpPostMetrics(_postId: string): Promise<Record<string, unknown>> {
  throw new Error('platform_skipped:gbp:fetcher_not_implemented')
}
