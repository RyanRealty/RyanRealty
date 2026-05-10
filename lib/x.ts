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
