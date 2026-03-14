import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Upstash Redis-backed rate limiting.
 *
 * Requires env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * When env vars are missing (local dev, Vercel build), rate limiting is
 * effectively a no-op (always allows).
 */

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) return null
  redis = new Redis({ url, token })
  return redis
}

// ── Limiters with different tiers ────────────────────────────────────

/** General API: 60 requests per 60 seconds per IP */
let generalLimiter: Ratelimit | null = null
export function getGeneralLimiter(): Ratelimit | null {
  if (generalLimiter) return generalLimiter
  const r = getRedis()
  if (!r) return null
  generalLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'rl:general',
    analytics: true,
  })
  return generalLimiter
}

/** Strict: AI + PDF endpoints: 10 requests per 60 seconds per IP */
let strictLimiter: Ratelimit | null = null
export function getStrictLimiter(): Ratelimit | null {
  if (strictLimiter) return strictLimiter
  const r = getRedis()
  if (!r) return null
  strictLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'rl:strict',
    analytics: true,
  })
  return strictLimiter
}

/** Auth / form submission: 5 requests per 60 seconds per IP */
let authLimiter: Ratelimit | null = null
export function getAuthLimiter(): Ratelimit | null {
  if (authLimiter) return authLimiter
  const r = getRedis()
  if (!r) return null
  authLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix: 'rl:auth',
    analytics: true,
  })
  return authLimiter
}

// ── Helper to apply rate limiting in API routes ──────────────────────

import { NextResponse } from 'next/server'

export type RateLimitResult =
  | { limited: false }
  | { limited: true; response: NextResponse }

/**
 * Check rate limit for an API route handler.
 *
 * Usage:
 *   const rl = await checkRateLimit(request, 'strict')
 *   if (rl.limited) return rl.response
 */
export async function checkRateLimit(
  request: Request,
  tier: 'general' | 'strict' | 'auth' = 'general',
): Promise<RateLimitResult> {
  const limiterFn = tier === 'strict' ? getStrictLimiter : tier === 'auth' ? getAuthLimiter : getGeneralLimiter
  const limiter = limiterFn()

  // No limiter = Upstash not configured → allow (dev / build)
  if (!limiter) return { limited: false }

  const ip = getClientIp(request)
  const { success, limit, remaining, reset } = await limiter.limit(ip)

  if (!success) {
    return {
      limited: true,
      response: NextResponse.json(
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
      ),
    }
  }

  return { limited: false }
}

function getClientIp(request: Request): string {
  const headers = new Headers(request.headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    '127.0.0.1'
  )
}
