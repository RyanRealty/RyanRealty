import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Next.js Edge Middleware.
 *
 * Three jobs:
 *
 *   1. Host-based rewrites for the seller/buyer landing-page subdomains
 *      (e.g. seller.ryan-realty.com/ → /lp/seller-home-value). Keeps the
 *      URL the visitor sees clean while serving the underlying LP route.
 *
 *   2. Sets x-pathname on the request so server components (notably the
 *      root layout) can branch on the current path — used to strip global
 *      chrome on /lp/* routes so dedicated landing pages render without
 *      site nav, footer, chat widget, or exit-intent popup.
 *
 *   3. IP-based rate limiting on /api/* routes. When Upstash env vars are
 *      missing (local dev), the limiter is a no-op pass-through.
 *
 * Tiers:
 *   /api/ai/*        → strict (10 req/min)  — AI generation costs money
 *   /api/pdf/*        → strict (10 req/min)  — CPU-intensive PDF rendering
 *   /api/cma/*        → strict (10 req/min)  — compute-heavy valuations
 *   /api/auth/*       → auth   (5 req/min)   — brute-force protection
 *   /api/open-houses/* → auth  (5 req/min)   — form spam protection
 *   /api/admin/sync/* → admin   (300 req/min) — high-frequency admin polling
 *   /api/*            → general (60 req/min)  — catch-all API protection
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
const admin = buildLimiter('admin', 300, '60 s')
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
  if (pathname.startsWith('/api/admin/sync/')) return admin ?? general
  if (pathname.startsWith('/api/')) return general
  return null
}

/**
 * Map of landing-page subdomains to the underlying LP path they serve at the
 * root. Add buyer/recruit/etc. here as we ship them.
 */
const HOST_LP_ROOT_REWRITES: Record<string, string> = {
  'seller.ryan-realty.com': '/lp/seller-home-value',
  // Future:
  // 'buyer.ryan-realty.com': '/lp/buyer-listing-alerts',
}

function buildNextResponse(pathname: string, request: NextRequest): NextResponse {
  // Always set x-pathname on the forwarded request headers so server
  // components can read it via headers().get('x-pathname').
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl
  const pathname = url.pathname
  const host = (request.headers.get('host') ?? '').toLowerCase()

  // ─── (1) Host-based rewrite for LP subdomains ──────────────────────────
  // seller.ryan-realty.com/ → /lp/seller-home-value (transparent rewrite —
  // browser still shows seller.ryan-realty.com/). Only rewrites the root path
  // so the subdomain can also serve /lp/west-bend-value etc. later.
  const subdomainLpRoot = HOST_LP_ROOT_REWRITES[host]
  if (subdomainLpRoot && (pathname === '/' || pathname === '')) {
    const rewriteUrl = url.clone()
    rewriteUrl.pathname = subdomainLpRoot
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', subdomainLpRoot)
    return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
  }

  // ─── (2) Rate limiting for /api/* ──────────────────────────────────────
  const limiter = pickLimiter(pathname)
  if (limiter) {
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

    const response = buildNextResponse(pathname, request)
    response.headers.set('X-RateLimit-Limit', String(limit))
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('X-RateLimit-Reset', String(reset))
    return response
  }

  // ─── (3) Default: forward x-pathname so server components can branch ───
  return buildNextResponse(pathname, request)
}

// Run on everything that isn't a Next.js internal or static asset.
// (Static files with extensions skip middleware — significant perf win.)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*).*)',
  ],
}
