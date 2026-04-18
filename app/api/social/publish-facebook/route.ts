import { NextRequest, NextResponse } from 'next/server'
import {
  publishFacebookPost,
  publishFacebookPhoto,
  publishFacebookVideo,
  publishFacebookReel,
} from '@/lib/meta-graph'

interface PublishRequest {
  mediaType: 'post' | 'photo' | 'video' | 'reel'
  message: string
  mediaUrl?: string
  linkUrl?: string
}

const cronSecret = process.env.CRON_SECRET

function validateApiKey(key: string | null): boolean {
  if (!cronSecret) return false
  return key === cronSecret
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const pageId = process.env.META_FB_PAGE_ID

  if (!accessToken || !pageId) {
    return NextResponse.json(
      { error: 'Meta Facebook credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const body: PublishRequest = await request.json()
    const { mediaType, message, mediaUrl, linkUrl } = body

    if (!mediaType || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: mediaType, message' },
        { status: 400 }
      )
    }

    let postId: string

    switch (mediaType) {
      case 'post': {
        postId = await publishFacebookPost(accessToken, pageId, message, linkUrl)
        break
      }

      case 'photo': {
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'mediaUrl is required for photo posts' },
            { status: 400 }
          )
        }
        postId = await publishFacebookPhoto(accessToken, pageId, mediaUrl, message)
        break
      }

      case 'video': {
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'mediaUrl is required for video posts' },
            { status: 400 }
          )
        }
        postId = await publishFacebookVideo(
          accessToken,
          pageId,
          mediaUrl,
          message,
          message
        )
        break
      }

      case 'reel': {
        if (!mediaUrl) {
          return NextResponse.json(
            { error: 'mediaUrl is required for reel posts' },
            { status: 400 }
          )
        }
        postId = await publishFacebookReel(accessToken, pageId, mediaUrl, message)
        break
      }

      default: {
        return NextResponse.json(
          { error: `Unsupported mediaType: ${mediaType as string}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true, postId })
  } catch (error) {
    console.error('Facebook publish error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish to Facebook',
      },
      { status: 500 }
    )
  }
}
