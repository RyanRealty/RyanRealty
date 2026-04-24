import { Redis } from '@upstash/redis'

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2/'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

interface UserInfoResponse {
  data?: {
    user?: {
      open_id: string
      union_id: string
      avatar_url: string
      avatar_large_url: string
      display_name: string
    }
    user_error?: string
  }
  error?: {
    code: string
    message: string
  }
}

interface VideoUploadInitResponse {
  data?: {
    publish_id: string
    upload_url: string
  }
  error?: {
    code: string
    message: string
  }
}

interface VideoPublishResponse {
  data?: {
    publish_id: string
  }
  error?: {
    code: string
    message: string
  }
}

interface VideoStatusResponse {
  data?: {
    status: string
    video_id?: string
    error_code?: number
    error_message?: string
  }
  error?: {
    code: string
    message: string
  }
}

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis not configured')
  return new Redis({ url, token })
}

function getEnv() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri = process.env.TIKTOK_REDIRECT_URI
  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error('TikTok credentials not configured')
  }
  return { clientKey, clientSecret, redirectUri }
}

export async function getAuthorizationUrl(): Promise<{ url: string; state: string }> {
  const { clientKey, redirectUri } = getEnv()
  const redis = getRedis()

  const state = Buffer.from(Math.random().toString()).toString('base64').slice(0, 32)
  await redis.setex(`tiktok:state:${state}`, 600, '1')

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'user.info.basic,user.info.profile,user.info.stats,video.list,video.upload,video.publish',
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })

  return {
    url: `${TIKTOK_AUTH_BASE}?${params.toString()}`,
    state,
  }
}

export async function exchangeCodeForToken(code: string, codeVerifier?: string): Promise<TokenResponse> {
  const { clientKey, clientSecret } = getEnv()

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  })

  if (codeVerifier) {
    body.append('code_verifier', codeVerifier)
  }

  const response = await fetch(`${TIKTOK_API_BASE}oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`TikTok token exchange failed: ${response.statusText}`)
  }

  const data = (await response.json()) as TokenResponse
  if (!data.access_token) {
    throw new Error('No access token in response')
  }

  return data
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientKey, clientSecret } = getEnv()

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(`${TIKTOK_API_BASE}oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`TikTok token refresh failed: ${response.statusText}`)
  }

  const data = (await response.json()) as TokenResponse
  if (!data.access_token) {
    throw new Error('No access token in refresh response')
  }

  return data
}

export async function getUserInfo(accessToken: string): Promise<UserInfoResponse['data']> {
  const response = await fetch(`${TIKTOK_API_BASE}user/info/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Get user info failed: ${response.statusText}`)
  }

  const data = (await response.json()) as UserInfoResponse
  if (data.error) {
    throw new Error(`TikTok API error: ${data.error.message}`)
  }

  return data.data || {}
}

interface VideoUploadOptions {
  chunkSize?: number
  videoSize: number
}

export async function initVideoUpload(
  accessToken: string,
  options: VideoUploadOptions
): Promise<{ publishId: string; uploadUrl: string }> {
  const { videoSize } = options
  const chunkSize = options.chunkSize || 5242880

  const response = await fetch(`${TIKTOK_API_BASE}post/publish/action/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: Math.ceil(videoSize / chunkSize),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Video upload init failed: ${response.statusText}`)
  }

  const data = (await response.json()) as VideoUploadInitResponse
  if (data.error) {
    throw new Error(`TikTok upload init error: ${data.error.message}`)
  }

  if (!data.data?.publish_id || !data.data?.upload_url) {
    throw new Error('No publish_id or upload_url in response')
  }

  return {
    publishId: data.data.publish_id,
    uploadUrl: data.data.upload_url,
  }
}

export async function uploadVideoChunk(
  uploadUrl: string,
  chunk: Buffer | Uint8Array,
  offset: number,
  totalSize: number
): Promise<void> {
  const chunkLength = chunk.length
  const arrayBuffer = chunk instanceof Buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk.buffer

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': chunkLength.toString(),
      'Content-Range': `bytes ${offset}-${offset + chunkLength - 1}/${totalSize}`,
    },
    body: arrayBuffer,
  })

  if (!response.ok) {
    throw new Error(`Chunk upload failed: ${response.statusText}`)
  }
}

interface PublishOptions {
  title: string
  privacyLevel: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
}

export async function publishVideo(
  accessToken: string,
  publishId: string,
  options: PublishOptions
): Promise<{ publishId: string; status: string }> {
  const response = await fetch(`${TIKTOK_API_BASE}post/publish/action/publish/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publish_id: publishId,
      post_info: {
        title: options.title,
        privacy_level: options.privacyLevel,
        disable_comment: options.disableComment ?? false,
        disable_duet: options.disableDuet ?? false,
        disable_stitch: options.disableStitch ?? false,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Video publish failed: ${response.statusText}`)
  }

  const data = (await response.json()) as VideoPublishResponse
  if (data.error) {
    throw new Error(`TikTok publish error: ${data.error.message}`)
  }

  if (!data.data?.publish_id) {
    throw new Error('No publish_id in response')
  }

  return {
    publishId: data.data.publish_id,
    status: 'submitted',
  }
}

export async function getVideoStatus(accessToken: string, publishId: string): Promise<string> {
  const response = await fetch(`${TIKTOK_API_BASE}post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: publishId }),
  })

  if (!response.ok) {
    throw new Error(`Get video status failed: ${response.statusText}`)
  }

  const data = (await response.json()) as VideoStatusResponse
  if (data.error) {
    throw new Error(`TikTok status error: ${data.error.message}`)
  }

  if (!data.data?.status) {
    throw new Error('No status in response')
  }

  return data.data.status
}

interface DirectPostOptions {
  title: string
  privacyLevel: string
}

export async function directPostVideo(
  accessToken: string,
  videoUrl: string,
  options: DirectPostOptions
): Promise<{ publishId: string }> {
  const response = await fetch(`${TIKTOK_API_BASE}post/publish/action/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
      post_info: {
        title: options.title,
        privacy_level: options.privacyLevel,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Direct post failed: ${response.statusText}`)
  }

  const data = (await response.json()) as VideoUploadInitResponse
  if (data.error) {
    throw new Error(`TikTok direct post error: ${data.error.message}`)
  }

  if (!data.data?.publish_id) {
    throw new Error('No publish_id in response')
  }

  return {
    publishId: data.data.publish_id,
  }
}

export async function validateStateFromRedis(state: string): Promise<boolean> {
  const redis = getRedis()
  const stored = await redis.get(`tiktok:state:${state}`)
  if (stored) {
    await redis.del(`tiktok:state:${state}`)
    return true
  }
  return false
}
