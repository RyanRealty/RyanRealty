import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Next.js Edge Middleware — global rate limiting.
 *
 * Applies IP-based rate limiting to API routes. When Upstash env vars
 * are missing (local dev), middleware is a no-op pass-through.
 *
 * Tiers:
 *   /api/ai/*        → strict (10 req/min)  — AI generation costs money
 *   /api/pdf/*        → strict (10 req/min)  — CPU-intensive PDF rendering
 *   /api/cma/*        → strict (10 req/min)  — compute-heavy valuations
 *   /api/auth/*       → auth   (5 req/min)   — brute-force protection
 *   /api/open-houses/* → auth  (5 req/min)   — form spam protection
 *   /api/*            → general (60 req/min) — catch-all API protection
 */

// Build limiters at module scope (Edge runtime caches across invocations)
function buildLimiter(prefix: string, tokens: number, window: string): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) return null
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(tokens, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    prefix: `rl:mw:${prefix}`,
    analytics: true,
  })
}

const strict = buildLimiter('strict', 10, '60 s')
const auth = buildLimiter('auth', 5, '60 s')
const general = buildLimiter('general', 60, '60 s')

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1'
  )
}

function pickLimiter(pathname: string): Ratelimit | null {
  if (pathname.startsWith('/api/ai/')) return strict
  if (pathname.startsWith('/api/pdf/')) return strict
  if (pathname.startsWith('/api/cma/')) return strict
  if (pathname.startsWith('/api/auth/')) return auth
  if (pathname.startsWith('/api/open-houses/')) return auth
  if (pathname.startsWith('/api/')) return general
  return null
}

export async function middleware(request: NextRequest) {
  const limiter = pickLimiter(request.nextUrl.pathname)
  if (!limiter) return NextResponse.next()

  const ip = getIp(request)
  const { success, limit, remaining, reset } = await limiter.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      },
    )
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', String(reset))
  return response
}

// Only run middleware on API routes (skip static assets, pages, etc.)
export const config = {
  matcher: ['/api/:path*'],
}
