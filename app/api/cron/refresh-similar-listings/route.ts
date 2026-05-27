import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// CONCURRENTLY refresh of similar_listings_mv (~75K rows, ~7.6K anchors)
// is small enough to complete well under a minute. Generous 300s ceiling
// matches the other MV refresh routes.
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/refresh-similar-listings
 *
 * Refreshes `public.similar_listings_mv` — the precomputed nearest 12
 * similars per active anchor listing (Wave 1.6, migration
 * 20260527180000_similar_listings_mv.sql).
 *
 * Schedule: nightly at 04:30 UTC via vercel.json. Active-listing churn
 * is bounded — daily refresh is plenty for the "Similar homes" rail.
 * Separate cron from `/api/cron/refresh-mvs` (which is hourly) because
 * the similar matrix doesn't need that cadence.
 *
 * Refresh runs CONCURRENTLY so user reads keep working during the swap.
 * Advisory lock 7105 prevents overlapping runs.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 *
 * Returns: { ok, ran_at, duration_ms, rpc_duration_ms?, error? }
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const ranAt = new Date().toISOString()

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[refresh-similar-listings] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const rpcStart = Date.now()
  const { data, error } = await supabase.rpc('refresh_similar_listings_mv')
  const rpcMs = Date.now() - rpcStart

  const ok = !error && data?.ok !== false
  return NextResponse.json(
    {
      ok,
      ran_at: ranAt,
      duration_ms: Date.now() - startMs,
      rpc_duration_ms: data?.duration_ms ?? rpcMs,
      error: error?.message ?? data?.error ?? null,
    },
    { status: ok ? 200 : 500 },
  )
}
