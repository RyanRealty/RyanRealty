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

type Platform = 'instagram' | 'facebook' | 'tiktok'

interface PublishRequest {
  platforms: Platform[]
  mediaType: 'image' | 'video' | 'reel'
  mediaUrl: string
  caption: string
  tiktokTitle?: string
  facebookMessage?: string
  coverUrl?: string
}

interface PlatformResult {
  success: boolean
  id?: string
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
  mediaType: 'image' | 'video' | 'reel',
  mediaUrl: string,
  caption: string,
  coverUrl?: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID

  if (!accessToken || !igUserId) {
    return { success: false, error: 'Meta Instagram credentials not configured' }
  }

  try {
    let mediaId: string

    if (mediaType === 'image') {
      mediaId = await publishImage(accessToken, igUserId, mediaUrl, caption)
    } else {
      // video and reel both go via publishReel
      mediaId = await publishReel(accessToken, igUserId, mediaUrl, caption, { coverUrl })
    }

    return { success: true, id: mediaId }
  } catch (error) {
    console.error('Instagram publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Instagram publish failed',
    }
  }
}

async function publishToFacebook(
  mediaType: 'image' | 'video' | 'reel',
  mediaUrl: string,
  message: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const pageId = process.env.META_FB_PAGE_ID

  if (!accessToken || !pageId) {
    return { success: false, error: 'Meta Facebook credentials not configured' }
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

    return { success: true, id: postId }
  } catch (error) {
    console.error('Facebook publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Facebook publish failed',
    }
  }
}

async function publishToTikTok(
  mediaType: 'image' | 'video' | 'reel',
  mediaUrl: string,
  title: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return { success: false, error: 'TikTok does not support image-only posts via this API' }
  }

  try {
    const accessToken = await getTikTokAccessToken()
    const result = await directPostVideo(accessToken, mediaUrl, {
      title,
      privacyLevel: 'PUBLIC_TO_EVERYONE',
    })
    return { success: true, id: result.publishId }
  } catch (error) {
    console.error('TikTok publish error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'TikTok publish failed',
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
      platforms,
      mediaType,
      mediaUrl,
      caption,
      tiktokTitle,
      facebookMessage,
      coverUrl,
    } = body

    if (!platforms?.length || !mediaType || !mediaUrl || !caption) {
      return NextResponse.json(
        { error: 'Missing required fields: platforms, mediaType, mediaUrl, caption' },
        { status: 400 }
      )
    }

    const validPlatforms: Platform[] = ['instagram', 'facebook', 'tiktok']
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

        switch (platform) {
          case 'instagram':
            result = await publishToInstagram(mediaType, mediaUrl, caption, coverUrl)
            break
          case 'facebook':
            result = await publishToFacebook(
              mediaType,
              mediaUrl,
              facebookMessage ?? caption
            )
            break
          case 'tiktok':
            result = await publishToTikTok(
              mediaType,
              mediaUrl,
              tiktokTitle ?? caption.slice(0, 100)
            )
            break
          default:
            result = { success: false, error: `Unknown platform: ${platform as string}` }
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
