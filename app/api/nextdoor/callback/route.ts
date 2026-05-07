import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { exchangeNextdoorCode, upsertNextdoorToken } from '@/lib/nextdoor'

function redirectUrl(request: NextRequest, path: string): string {
  const origin = new URL(request.url).origin
  return `${origin}${path}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()
  const errorDescription = searchParams.get('error_description')?.trim()

  if (error) {
    const reason = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(redirectUrl(request, `/admin/social?nextdoor=error&reason=${reason}`))
  }

  if (!code || !state) {
    return NextResponse.redirect(
      redirectUrl(request, '/admin/social?nextdoor=error&reason=Missing+code+or+state')
    )
  }

  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!redisUrl || !redisToken) {
      throw new Error('Upstash Redis not configured')
    }

    const redis = new Redis({ url: redisUrl, token: redisToken })
    const stored = await redis.get(`nextdoor:state:${state}`)
    if (!stored) {
      return NextResponse.redirect(
        redirectUrl(request, '/admin/social?nextdoor=error&reason=Invalid+or+expired+state')
      )
    }
    await redis.del(`nextdoor:state:${state}`)

    const tokenData = await exchangeNextdoorCode(code)
    await upsertNextdoorToken(tokenData)

    return NextResponse.redirect(redirectUrl(request, '/admin/social?nextdoor=connected'))
  } catch (err) {
    console.error('Nextdoor callback error:', err)
    const reason = err instanceof Error ? encodeURIComponent(err.message) : 'Unknown+error'
    return NextResponse.redirect(redirectUrl(request, `/admin/social?nextdoor=error&reason=${reason}`))
  }
}
