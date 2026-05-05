import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getLinkedInAuthorizationUrl } from '@/lib/linkedin'

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
    await redis.setex(`linkedin:state:${state}`, 600, '1')

    const url = getLinkedInAuthorizationUrl(state)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('LinkedIn authorize error:', error)
    return NextResponse.json(
      { error: 'Failed to start LinkedIn authorization' },
      { status: 500 }
    )
  }
}
