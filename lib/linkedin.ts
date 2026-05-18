import { createClient } from '@supabase/supabase-js'

const LINKEDIN_OAUTH_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_OAUTH_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_ASSET_REGISTER_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload'
const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const LINKEDIN_REST_POSTS_URL = 'https://api.linkedin.com/rest/posts'
const LINKEDIN_REST_VERSION = '202602'
// w_member_social = post on behalf of member; openid+profile+email = OpenID Connect
// (provisioned 2026-05-09, required so /v2/userinfo returns the canonical person sub
// and the modern /rest/posts API will accept urn:li:person:{sub} as author).
// openid+profile+email: get user identity for the OAuth flow.
// w_member_social: publish posts as the authenticated person.
// rw_organization_admin: read + manage Company Page admin (Ryan Realty LLC).
// r_organization_social: read posts on the Company Page (analytics).
// Note: rw_organization_admin and r_organization_social require the
// "Community Management API" product to be enabled on the LinkedIn
// Developer App at developer.linkedin.com → app → Products.
const LINKEDIN_OAUTH_SCOPES = 'openid profile email w_member_social rw_organization_admin r_organization_social'

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

/**
 * Fetch the OpenID Connect userinfo for the current token. Returns the
 * canonical 'sub' (LinkedIn person sub identifier) which is what the modern
 * /rest/posts API expects for author=urn:li:person:{sub}. Requires the
 * 'openid' scope on the token.
 */
export async function getLinkedInUserInfo(accessToken: string): Promise<{
  sub: string
  name?: string
  given_name?: string
  family_name?: string
  email?: string
}> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `LinkedIn userinfo failed: ${response.status} ${response.statusText} (token may be missing the openid scope — re-OAuth via /api/linkedin/authorize)`
    )
  }
  return response.json()
}

export async function publishLinkedInVideoFromUrl(
  options: LinkedInVideoPublishOptions
): Promise<string> {
  // Modern /rest/posts requires the OpenID `sub` (e.g. "G0tXRDZK2X") as the
  // member identifier, not the legacy numeric personId from the env var.
  // Fetch sub from /v2/userinfo and fall back to options.personId if it fails
  // (so the call still works in test/dev contexts where the token might be
  // a legacy w_member_social-only one).
  let memberSub: string
  try {
    const info = await getLinkedInUserInfo(options.accessToken)
    memberSub = info.sub
  } catch {
    memberSub = options.personId
  }
  const authorUrn = `urn:li:person:${memberSub}`

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

  // Stream the source video directly to LinkedIn instead of buffering in memory.
  // arrayBuffer() OOMs Vercel functions (256 MB limit) for videos >~50 MB.
  const sourceResponse = await fetch(options.mediaUrl)
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new Error(`Failed to fetch LinkedIn video source: ${sourceResponse.status}`)
  }

  const contentType = sourceResponse.headers.get('content-type') ?? 'video/mp4'
  const contentLength = sourceResponse.headers.get('content-length')

  const uploadHeaders: Record<string, string> = { 'Content-Type': contentType }
  if (contentLength) uploadHeaders['Content-Length'] = contentLength

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: sourceResponse.body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn media upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  // Modern /rest/posts API. The legacy /v2/ugcPosts now rejects
  // urn:li:person: authors with 422 ("does not match urn:li:company|member"),
  // so we swap to /rest/posts which accepts urn:li:person:{sub} for personal
  // posts when the token carries the openid scope.
  const postResponse = await fetch(LINKEDIN_REST_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_REST_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: options.caption,
      visibility: options.visibility ?? 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: { id: assetUrn },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })

  if (!postResponse.ok) {
    const body = await postResponse.text()
    throw new Error(
      `LinkedIn post create failed: ${postResponse.status} ${postResponse.statusText} - ${body.slice(0, 300)}`
    )
  }

  // Modern /rest/posts returns the URN in x-restli-id header
  const postUrn = postResponse.headers.get('x-restli-id')
  if (postUrn?.trim()) return postUrn

  const postJson = (await postResponse.json().catch(() => ({}))) as LinkedInPostResponse
  if (!postJson.id) {
    throw new Error(postJson.message || 'LinkedIn post created but id missing')
  }

  return postJson.id
}

/**
 * Stub for the performance-pull cron — see meta-graph stub for context.
 */
export async function fetchLinkedInPostMetrics(_postId: string): Promise<Record<string, unknown>> {
  throw new Error('platform_skipped:linkedin:fetcher_not_implemented')
}
