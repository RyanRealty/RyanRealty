import { NextRequest, NextResponse } from 'next/server'
import {
  publishImage,
  publishReel,
  publishStory,
  publishCarousel,
} from '@/lib/meta-graph'

interface CarouselChild {
  mediaUrl: string
  mediaType: 'image' | 'video'
}

interface PublishRequest {
  mediaType: 'image' | 'reel' | 'story' | 'carousel'
  mediaUrl: string
  caption?: string
  coverUrl?: string
  children?: CarouselChild[]
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
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID

  if (!accessToken || !igUserId) {
    return NextResponse.json(
      { error: 'Meta Instagram credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const body: PublishRequest = await request.json()
    const { mediaType, mediaUrl, caption = '', coverUrl, children } = body

    if (!mediaType || !mediaUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: mediaType, mediaUrl' },
        { status: 400 }
      )
    }

    let mediaId: string

    switch (mediaType) {
      case 'image': {
        mediaId = await publishImage(accessToken, igUserId, mediaUrl, caption)
        break
      }

      case 'reel': {
        mediaId = await publishReel(accessToken, igUserId, mediaUrl, caption, {
          coverUrl,
        })
        break
      }

      case 'story': {
        // Determine media type from URL extension; default to image
        const isVideo = /\.(mp4|mov|m4v|avi|webm)$/i.test(mediaUrl)
        mediaId = await publishStory(
          accessToken,
          igUserId,
          mediaUrl,
          isVideo ? 'video' : 'image'
        )
        break
      }

      case 'carousel': {
        if (!children || children.length < 2) {
          return NextResponse.json(
            { error: 'Carousel requires at least 2 children' },
            { status: 400 }
          )
        }
        mediaId = await publishCarousel(accessToken, igUserId, children, caption)
        break
      }

      default: {
        return NextResponse.json(
          { error: `Unsupported mediaType: ${mediaType as string}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true, mediaId })
  } catch (error) {
    console.error('Instagram publish error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish to Instagram',
      },
      { status: 500 }
    )
  }
}
