import { NextResponse } from 'next/server'
import { refreshPlaceContent } from '../../../actions/refresh-place-content'

/**
 * Cron endpoint: refresh about/attractions content for communities missing it.
 * Schedule (e.g. Vercel Cron): e.g. weekly. Secure with Authorization: Bearer CRON_SECRET.
 * Processes up to 20 subdivisions per run; increase via ?limit=50.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitCities = Math.min(Number(url.searchParams.get('cities')) || 3, 20)
  const limitNeighborhoods = Math.min(Number(url.searchParams.get('neighborhoods')) || 5, 30)
  const limitCommunities = Math.min(Number(url.searchParams.get('communities')) || 20, 50)

  try {
    const result = await refreshPlaceContent({
      limitCities,
      limitNeighborhoods,
      limitCommunities,
    })
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors.slice(0, 15),
      citiesProcessed: result.citiesProcessed,
      neighborhoodsProcessed: result.neighborhoodsProcessed,
      communitiesProcessed: result.communitiesProcessed,
    })
  } catch (e) {
    console.error('Refresh place content cron error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
