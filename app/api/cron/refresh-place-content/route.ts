import { NextResponse } from 'next/server'
import { refreshPlaceContent } from '../../../actions/refresh-place-content'

/**
 * Cron endpoint: refresh about/attractions content for communities missing it.
 * Schedule (e.g. Vercel Cron): e.g. weekly. Secure with Authorization: Bearer CRON_SECRET.
 * Processes up to 20 subdivisions per run; increase via ?limit=50.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret?.trim() && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)

  try {
    const result = await refreshPlaceContent({ maxSubdivisions: limit })
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors.slice(0, 10),
    })
  } catch (e) {
    console.error('Refresh place content cron error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
