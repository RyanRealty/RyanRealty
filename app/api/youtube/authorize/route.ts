import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getYouTubeAuthorizationUrl } from '@/lib/youtube'

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) throw new Error('Upstash Redis not configured')
  return new Redis({ url, token })
}

export async function GET() {
  try {
    const state = Buffer.from(crypto.randomUUID()).toString('base64url')
    const redis = getRedis()
    await redis.setex(`youtube:state:${state}`, 600, '1')

    const url = getYouTubeAuthorizationUrl(state)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('YouTube authorize error:', error)
    return NextResponse.json(
      { error: 'Failed to start YouTube authorization' },
      { status: 500 }
    )
  }
}
