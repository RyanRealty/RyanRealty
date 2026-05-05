import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_GBP_ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
const GOOGLE_GBP_LOCAL_POSTS_BASE = 'https://mybusiness.googleapis.com/v4'
const STATE_TTL_SECONDS = 600

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
