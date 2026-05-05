import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { exchangeLinkedInCode, upsertLinkedInToken } from '@/lib/linkedin'

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) throw new Error('Upstash Redis not configured')
  return new Redis({ url, token })
}

function redirectUrl(request: NextRequest, path: string): string {
  const origin = new URL(request.url).origin
  return `${origin}${path}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()

  if (error) {
    const reason = encodeURIComponent(searchParams.get('error_description') ?? error)
    return NextResponse.redirect(redirectUrl(request, `/admin/social?linkedin=error&reason=${reason}`))
  }

  if (!code || !state) {
    return NextResponse.redirect(redirectUrl(request, '/admin/social?linkedin=error&reason=Missing+code+or+state'))
  }

  try {
    const redis = getRedis()
    const stored = await redis.get(`linkedin:state:${state}`)
    if (!stored) {
      return NextResponse.redirect(redirectUrl(request, '/admin/social?linkedin=error&reason=Invalid+state'))
    }
    await redis.del(`linkedin:state:${state}`)

    const token = await exchangeLinkedInCode(code)
    await upsertLinkedInToken(token)

    return NextResponse.redirect(redirectUrl(request, '/admin/social?linkedin=connected'))
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    const reason = encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.redirect(redirectUrl(request, `/admin/social?linkedin=error&reason=${reason}`))
  }
}
