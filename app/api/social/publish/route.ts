import { NextRequest, NextResponse } from 'next/server'
import {
  publishImage,
  publishReel,
  publishFacebookPost,
  publishFacebookPhoto,
  publishFacebookReel,
} from '@/lib/meta-graph'
import { directPostVideo } from '@/lib/tiktok'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken } from '@/lib/tiktok'
import { getYouTubeAccessToken, uploadYouTubeVideoFromUrl } from '@/lib/youtube'
import {
  getLinkedInAccessToken,
  getLinkedInPersonId,
  publishLinkedInVideoFromUrl,
} from '@/lib/linkedin'
import { publishViaBuffer } from '@/lib/buffer'
import {
  getOrRefreshGoogleBusinessProfileAccessToken,
  publishGoogleBusinessLocalPost,
} from '@/lib/google-business-profile'

type NativePlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'google_business_profile'
type BufferPlatform = 'x' | 'pinterest' | 'threads'
type Platform = NativePlatform | BufferPlatform
type MediaType = 'image' | 'video' | 'reel'

interface PublishRequest {
  approved: boolean
  contentType?: string
  platforms: Platform[]
  mediaType: MediaType
  mediaUrl: string
  caption?: string
  captionDefault?: string
  captionPerPlatform?: Partial<Record<Platform, string>>
  hashtagsPerPlatform?: Partial<Record<Platform, string[]>>
  coverUrl?: string
  scheduledAt?: string
  gate?: {
    scorecardPath?: string
    citationsPath?: string
  }
  metadata?: {
    tiktok?: {
      title?: string
      privacyLevel?: string
    }
    youtube?: {
      title?: string
      description?: string
      tags?: string[]
      privacyStatus?: 'public' | 'private' | 'unlisted'
    }
    linkedin?: {
      visibility?: 'PUBLIC' | 'CONNECTIONS'
    }
    google_business_profile?: {
      summary?: string
      callToActionUrl?: string
    }
  }
}

interface PlatformResult {
  success: boolean
  status: 'published' | 'submitted' | 'failed'
  externalPostId?: string
  url?: string | null
  error?: string
}

interface AuthToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

const cronSecret = process.env.CRON_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function validateApiKey(key: string | null): boolean {
  if (!cronSecret) return false
  return key === cronSecret
}

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function resolveCaption(body: PublishRequest, platform: Platform): string {
  const perPlatform = body.captionPerPlatform?.[platform]
  const hashtags = body.hashtagsPerPlatform?.[platform] ?? []
  const base = perPlatform ?? body.captionDefault ?? body.caption ?? ''
  const hashtagSuffix = hashtags.length ? `\n\n${hashtags.join(' ')}` : ''
  return `${base}${hashtagSuffix}`.trim()
}

function hasGateArtifacts(body: PublishRequest): boolean {
  const scorecardPath = body.gate?.scorecardPath?.trim()
  if (!scorecardPath) return false
  return true
}

async function getTikTokAccessToken(): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('tiktok_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('TikTok token not found in database')
  }

  const authData = data as AuthToken
  const expiresAt = new Date(authData.expires_at)

  if (Date.now() >= expiresAt.getTime()) {
    const refreshed = await refreshAccessToken(authData.refresh_token)

    await supabase
      .from('tiktok_auth')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', 'default')

    return refreshed.access_token
  }

  return authData.access_token
}

async function publishToInstagram(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  coverUrl?: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID

  if (!accessToken || !igUserId) {
    return {
      success: false,
      status: 'failed',
      error: 'Meta Instagram credentials not configured',
    }
  }

  try {
    let mediaId: string

    if (mediaType === 'image') {
      mediaId = await publishImage(accessToken, igUserId, mediaUrl, caption)
    } else {
      // video and reel both go via publishReel
      mediaId = await publishReel(accessToken, igUserId, mediaUrl, caption, { coverUrl })
    }

    return { success: true, status: 'published', externalPostId: mediaId, url: null }
  } catch (error) {
    console.error('Instagram publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Instagram publish failed',
    }
  }
}

async function publishToFacebook(
  mediaType: MediaType,
  mediaUrl: string,
  message: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const pageId = process.env.META_FB_PAGE_ID

  if (!accessToken || !pageId) {
    return {
      success: false,
      status: 'failed',
      error: 'Meta Facebook credentials not configured',
    }
  }

  try {
    let postId: string

    if (mediaType === 'image') {
      postId = await publishFacebookPhoto(accessToken, pageId, mediaUrl, message)
    } else if (mediaType === 'reel') {
      postId = await publishFacebookReel(accessToken, pageId, mediaUrl, message)
    } else {
      // video — use feed post with link as fallback for URL-based videos
      postId = await publishFacebookPost(accessToken, pageId, message, mediaUrl)
    }

    return { success: true, status: 'published', externalPostId: postId, url: null }
  } catch (error) {
    console.error('Facebook publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Facebook publish failed',
    }
  }
}

async function publishToTikTok(
  mediaType: MediaType,
  mediaUrl: string,
  title: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'TikTok does not support image-only posts via this API',
    }
  }

  try {
    const accessToken = await getTikTokAccessToken()
    const result = await directPostVideo(accessToken, mediaUrl, {
      title,
      privacyLevel: 'PUBLIC_TO_EVERYONE',
    })
    return { success: true, status: 'submitted', externalPostId: result.publishId, url: null }
  } catch (error) {
    console.error('TikTok publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'TikTok publish failed',
    }
  }
}

async function publishToYouTube(
  mediaType: MediaType,
  mediaUrl: string,
  title: string,
  description: string,
  tags?: string[],
  privacyStatus?: 'public' | 'private' | 'unlisted'
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'YouTube requires video media',
    }
  }

  try {
    const accessToken = await getYouTubeAccessToken()
    const videoId = await uploadYouTubeVideoFromUrl({
      accessToken,
      videoUrl: mediaUrl,
      snippet: {
        title,
        description,
        tags,
      },
      status: {
        privacyStatus,
      },
    })

    return {
      success: true,
      status: 'published',
      externalPostId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }
  } catch (error) {
    console.error('YouTube publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'YouTube publish failed',
    }
  }
}

async function publishToLinkedIn(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  visibility?: 'PUBLIC' | 'CONNECTIONS'
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'LinkedIn route currently supports video publish only',
    }
  }

  try {
    const accessToken = await getLinkedInAccessToken()
    const personId = getLinkedInPersonId()
    const postId = await publishLinkedInVideoFromUrl({
      accessToken,
      personId,
      mediaUrl,
      caption,
      visibility,
    })
    return {
      success: true,
      status: 'published',
      externalPostId: postId,
      url: null,
    }
  } catch (error) {
    console.error('LinkedIn publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'LinkedIn publish failed',
    }
  }
}

async function publishToBuffer(
  platform: BufferPlatform,
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  scheduledAt?: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'Buffer lane currently supports video publish only',
    }
  }

  try {
    const updateId = await publishViaBuffer({
      platform,
      text: caption,
      mediaUrl,
      scheduledAt,
    })
    return {
      success: true,
      status: scheduledAt ? 'submitted' : 'published',
      externalPostId: updateId,
      url: null,
    }
  } catch (error) {
    console.error(`Buffer publish error (${platform}):`, error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : `Buffer publish failed (${platform})`,
    }
  }
}

async function publishToGoogleBusinessProfile(
  caption: string,
  mediaUrl: string,
  summary?: string,
  callToActionUrl?: string
): Promise<PlatformResult> {
  try {
    const accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()
    const localPostName = await publishGoogleBusinessLocalPost({
      accessToken,
      summary: summary?.trim() || caption.slice(0, 1500),
      mediaUrl,
      callToActionUrl,
    })
    return {
      success: true,
      status: 'published',
      externalPostId: localPostName,
      url: null,
    }
  } catch (error) {
    console.error('Google Business Profile publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Google Business Profile publish failed',
    }
  }
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body: PublishRequest = await request.json()
    const {
      approved,
      platforms,
      mediaType,
      mediaUrl,
      coverUrl,
    } = body

    if (!approved) {
      return NextResponse.json(
        { error: 'Publish blocked: approved must be true' },
        { status: 400 }
      )
    }

    if (!hasGateArtifacts(body)) {
      return NextResponse.json(
        { error: 'Publish blocked: gate.scorecardPath is required' },
        { status: 400 }
      )
    }

    if (!platforms?.length || !mediaType || !mediaUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: platforms, mediaType, mediaUrl' },
        { status: 400 }
      )
    }

    const validPlatforms: Platform[] = [
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
      'linkedin',
      'google_business_profile',
      'x',
      'pinterest',
      'threads',
    ]
    const invalidPlatforms = platforms.filter((p) => !validPlatforms.includes(p))
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Invalid platforms: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      )
    }

    // Fan out to all requested platforms in parallel
    const publishTasks: Promise<[Platform, PlatformResult]>[] = platforms.map(
      async (platform) => {
        let result: PlatformResult
        const caption = resolveCaption(body, platform)

        switch (platform) {
          case 'instagram':
            result = await publishToInstagram(mediaType, mediaUrl, caption, coverUrl)
            break
          case 'facebook':
            result = await publishToFacebook(mediaType, mediaUrl, caption)
            break
          case 'tiktok':
            result = await publishToTikTok(
              mediaType,
              mediaUrl,
              body.metadata?.tiktok?.title ?? caption.slice(0, 100)
            )
            break
          case 'youtube':
            result = await publishToYouTube(
              mediaType,
              mediaUrl,
              body.metadata?.youtube?.title ?? caption.slice(0, 100),
              body.metadata?.youtube?.description ?? caption,
              body.metadata?.youtube?.tags,
              body.metadata?.youtube?.privacyStatus
            )
            break
          case 'linkedin':
            result = await publishToLinkedIn(
              mediaType,
              mediaUrl,
              caption,
              body.metadata?.linkedin?.visibility
            )
            break
          case 'google_business_profile':
            result = await publishToGoogleBusinessProfile(
              caption,
              mediaUrl,
              body.metadata?.google_business_profile?.summary,
              body.metadata?.google_business_profile?.callToActionUrl
            )
            break
          case 'x':
          case 'pinterest':
          case 'threads':
            result = await publishToBuffer(
              platform,
              mediaType,
              mediaUrl,
              caption,
              body.scheduledAt
            )
            break
          default:
            result = {
              success: false,
              status: 'failed',
              error: `Unknown platform: ${platform as string}`,
            }
        }

        return [platform, result] as [Platform, PlatformResult]
      }
    )

    const settled = await Promise.all(publishTasks)
    const results = Object.fromEntries(settled) as Record<Platform, PlatformResult>

    const allSucceeded = Object.values(results).every((r) => r.success)
    const anySucceeded = Object.values(results).some((r) => r.success)

    return NextResponse.json(
      {
        success: allSucceeded,
        partialSuccess: !allSucceeded && anySucceeded,
        results,
        summary: {
          publishedCount: Object.values(results).filter((r) => r.success).length,
          attemptedCount: platforms.length,
        },
      },
      { status: allSucceeded || anySucceeded ? 200 : 500 }
    )
  } catch (error) {
    console.error('Unified publish error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish content',
      },
      { status: 500 }
    )
  }
}
