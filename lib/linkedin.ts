import { createClient } from '@supabase/supabase-js'

const LINKEDIN_OAUTH_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_OAUTH_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_ASSET_REGISTER_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload'
const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'
const LINKEDIN_OAUTH_SCOPES = 'openid profile email w_member_social'

interface RegisterUploadResponse {
  value?: {
    asset?: string
    uploadMechanism?: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
        uploadUrl?: string
      }
    }
  }
  message?: string
}

interface LinkedInPostResponse {
  id?: string
  message?: string
}

interface LinkedInVideoPublishOptions {
  accessToken: string
  personId: string
  mediaUrl: string
  caption: string
  visibility?: 'PUBLIC' | 'CONNECTIONS'
}

interface StoredLinkedInToken {
  access_token: string
  refresh_token: string | null
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

export function getLinkedInOAuthEnv() {
  const clientId = requireEnv('LINKEDIN_CLIENT_ID')
  const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET')
  const redirectUri = requireEnv('LINKEDIN_REDIRECT_URI')
  return { clientId, clientSecret, redirectUri }
}

export function getLinkedInAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedInOAuthEnv()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: LINKEDIN_OAUTH_SCOPES,
    state,
  })

  return `${LINKEDIN_OAUTH_AUTH_URL}?${params.toString()}`
}

export async function exchangeLinkedInCode(code: string): Promise<StoredLinkedInToken> {
  const { clientId, clientSecret, redirectUri } = getLinkedInOAuthEnv()

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(LINKEDIN_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token) throw new Error('LinkedIn token exchange missing access_token')

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000).toISOString(),
  }
}

export async function upsertLinkedInToken(token: StoredLinkedInToken): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('linkedin_auth').upsert(
    {
      id: 'default',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) throw new Error(`Failed to store LinkedIn token: ${error.message}`)
}

async function refreshLinkedInToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getLinkedInOAuthEnv()

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(LINKEDIN_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`LinkedIn token refresh failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!data.access_token) {
    throw new Error('LinkedIn token refresh response missing access_token')
  }

  const supabase = getSupabase()
  await supabase
    .from('linkedin_auth')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      expires_at: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  return data.access_token
}

export async function getLinkedInAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('linkedin_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('LinkedIn not connected — visit /api/linkedin/authorize to connect')
  }

  const token = data as StoredLinkedInToken
  const expiresAtMs = new Date(token.expires_at).getTime()
  const refreshWindowMs = 5 * 60 * 1000

  if (Date.now() < expiresAtMs - refreshWindowMs) {
    return token.access_token
  }

  if (!token.refresh_token?.trim()) {
    throw new Error('LinkedIn access token expired and no refresh token available — reconnect via /api/linkedin/authorize')
  }

  return refreshLinkedInToken(token.refresh_token)
}

export function getLinkedInPersonId(): string {
  return requireEnv('LINKEDIN_PERSON_ID')
}

export async function publishLinkedInVideoFromUrl(
  options: LinkedInVideoPublishOptions
): Promise<string> {
  const authorUrn = `urn:li:person:${options.personId}`

  const registerResponse = await fetch(LINKEDIN_ASSET_REGISTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        owner: authorUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  })

  if (!registerResponse.ok) {
    throw new Error(
      `LinkedIn register upload failed: ${registerResponse.status} ${registerResponse.statusText}`
    )
  }

  const registerJson = (await registerResponse.json()) as RegisterUploadResponse
  const assetUrn = registerJson.value?.asset
  const uploadUrl =
    registerJson.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
      ?.uploadUrl

  if (!assetUrn || !uploadUrl) {
    throw new Error(registerJson.message || 'LinkedIn register upload response missing fields')
  }

  const sourceResponse = await fetch(options.mediaUrl)
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new Error(`Failed to fetch LinkedIn video source: ${sourceResponse.status}`)
  }

  const bytes = await sourceResponse.arrayBuffer()
  const contentType = sourceResponse.headers.get('content-type') ?? 'video/mp4'

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': `${bytes.byteLength}`,
    },
    body: bytes,
  })

  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn media upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const postResponse = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: options.caption },
          shareMediaCategory: 'VIDEO',
          media: [{ status: 'READY', media: assetUrn }],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': options.visibility ?? 'PUBLIC',
      },
    }),
  })

  if (!postResponse.ok) {
    throw new Error(`LinkedIn post create failed: ${postResponse.status} ${postResponse.statusText}`)
  }

  const postJson = (await postResponse.json()) as LinkedInPostResponse
  if (!postJson.id) {
    const locationHeader = postResponse.headers.get('x-restli-id')
    if (locationHeader?.trim()) {
      return locationHeader
    }
    throw new Error(postJson.message || 'LinkedIn post created but id missing')
  }

  return postJson.id
}
