import { createClient } from '@supabase/supabase-js'

const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3/videos'
const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/youtube.upload'

interface YouTubeSnippet {
  title: string
  description: string
  tags?: string[]
  categoryId?: string
}

interface YouTubeStatus {
  privacyStatus?: 'public' | 'private' | 'unlisted'
  selfDeclaredMadeForKids?: boolean
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
          categoryId: options.snippet.categoryId ?? '37',
        },
        status: {
          privacyStatus: options.status?.privacyStatus ?? 'public',
          selfDeclaredMadeForKids: options.status?.selfDeclaredMadeForKids ?? false,
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

  const sourceResponse = await fetch(options.videoUrl)
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new Error(`Failed to fetch video source: ${sourceResponse.status} ${sourceResponse.statusText}`)
  }

  const contentType = sourceResponse.headers.get('content-type') ?? 'video/mp4'
  const bytes = await sourceResponse.arrayBuffer()

  const uploadResponse = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': `${bytes.byteLength}`,
    },
    body: bytes,
  })

  if (!uploadResponse.ok) {
    throw new Error(`YouTube upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const uploadJson = (await uploadResponse.json()) as YouTubeUploadResponse
  if (!uploadJson.id) {
    throw new Error(uploadJson.error?.message || 'YouTube upload succeeded but no video id returned')
  }

  return uploadJson.id
}
