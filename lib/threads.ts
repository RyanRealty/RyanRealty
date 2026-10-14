// Removed as a platform (Matt 2026-10-14); not called by the publish door or the heartbeat.
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

// Note: Meta migrated threads.net → threads.com. The .net domain redirects to .com but DROPS
// query params, breaking OAuth ("error 4476002 — No app ID was sent"). Use .com directly.
const THREADS_OAUTH_AUTH_URL = 'https://www.threads.com/oauth/authorize'
const THREADS_OAUTH_TOKEN_URL = 'https://graph.threads.net/oauth/access_token'
const THREADS_LONG_LIVED_TOKEN_URL = 'https://graph.threads.net/access_token'
const THREADS_API_BASE = 'https://graph.threads.net/v1.0'
const THREADS_OAUTH_SCOPES = 'threads_basic,threads_content_publish'

interface StoredThreadsToken {
  access_token: string
  expires_at: string
  threads_user_id: string
}

interface ThreadsShortLivedTokenResponse {
  access_token?: string
  user_id?: number | string
}

interface ThreadsLongLivedTokenResponse {
  access_token?: string
  expires_in?: number
}

interface ThreadsMediaContainerResponse {
  id?: string
}

interface ThreadsPublishResponse {
  id?: string
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

export function getThreadsOAuthEnv() {
  const clientId = requireEnv('THREADS_CLIENT_ID')
  const clientSecret = requireEnv('THREADS_CLIENT_SECRET')
  const redirectUri = requireEnv('THREADS_REDIRECT_URI')
  return { clientId, clientSecret, redirectUri }
}

export async function getThreadsAuthorizationUrl(state: string): Promise<string> {
  const { clientId, redirectUri } = getThreadsOAuthEnv()
  const redis = getRedis()

  await redis.setex(`threads:state:${state}`, 600, '1')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: THREADS_OAUTH_SCOPES,
    response_type: 'code',
    state,
  })

  return `${THREADS_OAUTH_AUTH_URL}?${params.toString()}`
}

export async function validateThreadsState(state: string): Promise<boolean> {
  const redis = getRedis()
  const stored = await redis.get(`threads:state:${state}`)
  if (stored) {
    await redis.del(`threads:state:${state}`)
    return true
  }
  return false
}

export async function exchangeThreadsCode(code: string): Promise<StoredThreadsToken> {
  const { clientId, clientSecret, redirectUri } = getThreadsOAuthEnv()

  // Step 1: exchange code for short-lived token
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const shortLivedResponse = await fetch(THREADS_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!shortLivedResponse.ok) {
    const text = await shortLivedResponse.text()
    throw new Error(
      `Threads token exchange failed: ${shortLivedResponse.status} ${shortLivedResponse.statusText} — ${text}`
    )
  }

  const shortLivedJson =
    (await shortLivedResponse.json()) as ThreadsShortLivedTokenResponse
  if (!shortLivedJson.access_token) throw new Error('Threads token exchange missing access_token')
  if (!shortLivedJson.user_id) throw new Error('Threads token exchange missing user_id')

  const userId = String(shortLivedJson.user_id)

  // Step 2: exchange short-lived token for long-lived token (60 days)
  const longLivedParams = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedJson.access_token,
  })

  const longLivedResponse = await fetch(
    `${THREADS_LONG_LIVED_TOKEN_URL}?${longLivedParams.toString()}`
  )

  if (!longLivedResponse.ok) {
    const text = await longLivedResponse.text()
    throw new Error(
      `Threads long-lived token exchange failed: ${longLivedResponse.status} — ${text}`
    )
  }

  const longLivedJson = (await longLivedResponse.json()) as ThreadsLongLivedTokenResponse
  if (!longLivedJson.access_token) throw new Error('Threads long-lived token missing access_token')

  return {
    access_token: longLivedJson.access_token,
    expires_at: new Date(
      Date.now() + (longLivedJson.expires_in ?? 5184000) * 1000
    ).toISOString(),
    threads_user_id: userId,
  }
}

export async function upsertThreadsToken(token: StoredThreadsToken): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('threads_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      expires_at: token.expires_at,
      threads_user_id: token.threads_user_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`Failed to store Threads token: ${error.message}`)
}

async function refreshThreadsToken(accessToken: string): Promise<string> {
  const { clientSecret } = getThreadsOAuthEnv()

  const params = new URLSearchParams({
    grant_type: 'th_refresh_token',
    client_secret: clientSecret,
    access_token: accessToken,
  })

  const response = await fetch(`${THREADS_LONG_LIVED_TOKEN_URL}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Threads token refresh failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as ThreadsLongLivedTokenResponse
  if (!json.access_token) throw new Error('Threads token refresh missing access_token')

  const supabase = getSupabase()
  const { data } = await supabase
    .from('threads_auth')
    .select('threads_user_id')
    .eq('id', 'default')
    .maybeSingle()

  await supabase
    .from('threads_auth')
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  return json.access_token
}

export async function getThreadsAccessToken(): Promise<{ accessToken: string; userId: string }> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('threads_auth')
    .select('access_token, expires_at, threads_user_id')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('Threads not connected — visit /api/threads/authorize to connect')
  }

  const token = data as StoredThreadsToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 24 * 60 * 60 * 1000 // refresh if less than 1 day left

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return { accessToken: token.access_token, userId: token.threads_user_id }
  }

  const newAccessToken = await refreshThreadsToken(token.access_token)
  return { accessToken: newAccessToken, userId: token.threads_user_id }
}

export async function publishThreadsVideo(
  accessToken: string,
  userId: string,
  videoUrl: string,
  text: string
): Promise<string> {
  // Step 1: create media container
  const containerParams = new URLSearchParams({
    media_type: 'VIDEO',
    video_url: videoUrl,
    text,
    access_token: accessToken,
  })

  const containerResponse = await fetch(`${THREADS_API_BASE}/${userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: containerParams.toString(),
  })

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text()
    throw new Error(
      `Threads media container creation failed: ${containerResponse.status} — ${errorText}`
    )
  }

  const containerJson = (await containerResponse.json()) as ThreadsMediaContainerResponse
  if (!containerJson.id) throw new Error('Threads media container returned no id')
  const containerId = containerJson.id

  // Step 2: poll until container is ready
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const statusParams = new URLSearchParams({
      fields: 'status,error_message',
      access_token: accessToken,
    })

    const statusResponse = await fetch(
      `${THREADS_API_BASE}/${containerId}?${statusParams.toString()}`
    )

    if (statusResponse.ok) {
      const statusJson = (await statusResponse.json()) as { status?: string; error_message?: string }
      if (statusJson.status === 'FINISHED') break
      if (statusJson.status === 'ERROR') {
        throw new Error(
          `Threads media container processing failed: ${statusJson.error_message ?? 'unknown'}`
        )
      }
    }
  }

  // Step 3: publish container
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  })

  const publishResponse = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams.toString(),
  })

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text()
    throw new Error(`Threads publish failed: ${publishResponse.status} — ${errorText}`)
  }

  const publishJson = (await publishResponse.json()) as ThreadsPublishResponse
  if (!publishJson.id) throw new Error('Threads publish returned no id')
  return publishJson.id
}
