import { NextResponse } from 'next/server'
import { executeRefreshVideoToursCache } from '@/lib/refresh-video-tours-cache'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Rebuilds video_tours_cache for home (12) and /videos hub (48). Runs on a schedule; service role bypasses RLS on write.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
