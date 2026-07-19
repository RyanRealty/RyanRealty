import { NextResponse } from 'next/server'
import { executeRefreshVideoToursCache } from '@/lib/refresh-video-tours-cache'
import { requireCronAuth } from '@/lib/auth/cron-auth'

/**
 * Rebuilds video_tours_cache for home (12) and /videos hub (48). Runs on a schedule; service role bypasses RLS on write.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const result = await executeRefreshVideoToursCache()
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error ?? 'refresh failed',
        homeCount: result.homeCount,
        hubCount: result.hubCount,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    homeCount: result.homeCount,
    hubCount: result.hubCount,
    updated_at: result.updated_at,
  })
}
