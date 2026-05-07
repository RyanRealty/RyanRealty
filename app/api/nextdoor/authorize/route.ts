import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getNextdoorAuthorizationUrl } from '@/lib/nextdoor'

/**
 * Start the Nextdoor OAuth flow.
 * Generates a CSRF state, persists it in Upstash Redis (10 min TTL),
 * redirects to Nextdoor's authorize URL.
 */
export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return NextResponse.json({ error: 'Upstash Redis not configured' }, { status: 500 })
  }

  try {
    const state = crypto.randomUUID()
    const redis = new Redis({ url, token })
    await redis.setex(`nextdoor:state:${state}`, 600, '1')

    const authorizeUrl = getNextdoorAuthorizationUrl(state)
    return NextResponse.redirect(authorizeUrl, { status: 307 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Nextdoor OAuth' },
      { status: 500 }
    )
  }
}
