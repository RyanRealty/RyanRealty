import { createClient } from '@supabase/supabase-js'

/**
 * Nextdoor "Share using Business Account" API integration.
 *
 * Auth: OAuth 2.0 with PKCE (Authorization Code flow).
 * Endpoints:
 *  - Authorization: https://auth.nextdoor.com/v3/authorize
 *  - Token:         https://auth.nextdoor.com/v3/token
 *  - API:           https://api.nextdoor.com/v3/...
 *
 * Access is gated — apply at developer.nextdoor.com. Once approved,
 * set NEXTDOOR_CLIENT_ID, NEXTDOOR_CLIENT_SECRET, NEXTDOOR_REDIRECT_URI
 * in env. Then run /api/nextdoor/authorize to OAuth-connect the business
 * profile. Token row is stored in `nextdoor_auth` table (id='default').
 */

const NEXTDOOR_OAUTH_AUTH_URL = 'https://auth.nextdoor.com/v3/authorize'
const NEXTDOOR_OAUTH_TOKEN_URL = 'https://auth.nextdoor.com/v3/token'
const NEXTDOOR_API_BASE = 'https://api.nextdoor.com/v3'
const NEXTDOOR_OAUTH_SCOPES = 'openid profile post_create'

// ---------------------------------------------------------------------------
// Stored token shape
// ---------------------------------------------------------------------------

interface StoredNextdoorToken {
  access_token: string
  refresh_token: string | null
  expires_at: string
  business_profile_id: string | null
}

interface NextdoorTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

interface NextdoorBusinessProfileResponse {
  id?: string
  name?: string
  url?: string
}

interface NextdoorPostResponse {
  id?: string
  url?: string
  message?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`${name} is not configured — apply for Nextdoor API access at developer.nextdoor.com`)
  }
  return value
}

function getSupabase() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

export function getNextdoorOAuthEnv() {
  const clientId = requireEnv('NEXTDOOR_CLIENT_ID')
  const clientSecret = requireEnv('NEXTDOOR_CLIENT_SECRET')
  const redirectUri = requireEnv('NEXTDOOR_REDIRECT_URI')
  return { clientId, clientSecret, redirectUri }
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

export function getNextdoorAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getNextdoorOAuthEnv()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: NEXTDOOR_OAUTH_SCOPES,
    state,
  })

  return `${NEXTDOOR_OAUTH_AUTH_URL}?${params.toString()}`
}

export async function exchangeNextdoorCode(code: string): Promise<StoredNextdoorToken> {
  const { clientId, clientSecret, redirectUri } = getNextdoorOAuthEnv()

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(NEXTDOOR_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Nextdoor token exchange failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`
    )
  }

  const data = (await response.json()) as NextdoorTokenResponse
  if (!data.access_token) throw new Error('Nextdoor token exchange missing access_token')

  // Fetch business profile id immediately so we can persist it
  const businessProfileId = await fetchBusinessProfileId(data.access_token)

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    business_profile_id: businessProfileId,
  }
}

export async function upsertNextdoorToken(token: StoredNextdoorToken): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('nextdoor_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      business_profile_id: token.business_profile_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`Failed to store Nextdoor token: ${error.message}`)
}

async function refreshNextdoorToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getNextdoorOAuthEnv()

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(NEXTDOOR_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Nextdoor token refresh failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as NextdoorTokenResponse
  if (!data.access_token) {
    throw new Error('Nextdoor token refresh response missing access_token')
  }

  const supabase = getSupabase()
  await supabase
    .from('nextdoor_auth')
    .update({
      access_token: data.access_token,
      // Persist rotated refresh_token if returned (Nextdoor may rotate)
      refresh_token: data.refresh_token ?? refreshToken,
      expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  return data.access_token
}

export async function getNextdoorAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('nextdoor_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('Nextdoor not connected — visit /api/nextdoor/authorize to connect')
  }

  const token = data as StoredNextdoorToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 5 * 60 * 1000

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return token.access_token
  }

  if (!token.refresh_token?.trim()) {
    throw new Error(
      'Nextdoor access token expired and no refresh token available — reconnect via /api/nextdoor/authorize'
    )
  }

  return refreshNextdoorToken(token.refresh_token)
}

export async function getNextdoorBusinessProfileId(): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('nextdoor_auth')
    .select('business_profile_id')
    .eq('id', 'default')
    .maybeSingle()
  const id = (data as { business_profile_id?: string } | null)?.business_profile_id
  if (id?.trim()) return id

  // Fallback: refetch from Nextdoor API
  const accessToken = await getNextdoorAccessToken()
  const fetched = await fetchBusinessProfileId(accessToken)
  if (!fetched) throw new Error('Nextdoor business profile id not available')
  await supabase
    .from('nextdoor_auth')
    .update({ business_profile_id: fetched, updated_at: new Date().toISOString() })
    .eq('id', 'default')
  return fetched
}

async function fetchBusinessProfileId(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${NEXTDOOR_API_BASE}/profiles/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as NextdoorBusinessProfileResponse
    return data.id ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface NextdoorPublishOptions {
  body: string
  imageUrl?: string
  videoUrl?: string
  ctaText?: string
  ctaUrl?: string
}

/**
 * Publish a post to Nextdoor on behalf of the connected business profile.
 * Returns the Nextdoor post id.
 */
export async function publishNextdoorPost(
  options: NextdoorPublishOptions
): Promise<string> {
  const accessToken = await getNextdoorAccessToken()
  const profileId = await getNextdoorBusinessProfileId()

  const body: Record<string, unknown> = {
    body: options.body,
  }

  if (options.imageUrl) {
    body.image_url = options.imageUrl
    body.media_type = 'image'
  } else if (options.videoUrl) {
    body.video_url = options.videoUrl
    body.media_type = 'video'
  }

  if (options.ctaText && options.ctaUrl) {
    body.call_to_action = {
      text: options.ctaText,
      url: options.ctaUrl,
    }
  }

  const response = await fetch(`${NEXTDOOR_API_BASE}/profiles/${profileId}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Nextdoor post create failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`
    )
  }

  const data = (await response.json()) as NextdoorPostResponse
  if (!data.id) {
    throw new Error(data.message || 'Nextdoor post created but id missing')
  }
  return data.id
}
