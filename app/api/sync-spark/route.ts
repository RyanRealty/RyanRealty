import { syncSparkListings } from '../../actions/sync-spark'
import { NextResponse } from 'next/server'

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret?.length) {
    const auth = request.headers.get('authorization')
    if (auth === `Bearer ${cronSecret}`) return true
  }
  const syncSecret = process.env.SYNC_SECRET
  if (syncSecret?.length) {
    if (request.headers.get('x-sync-secret') === syncSecret) return true
  }
  // If no secrets configured (e.g. local dev), allow. In production set CRON_SECRET.
  if (!cronSecret?.length && !syncSecret?.length) return true
  return false
}

async function runSync(request: Request) {
  const url = new URL(request.url)
  const maxPages = url.searchParams.get('maxPages')
  const pageSize = url.searchParams.get('pageSize')

  const result = await syncSparkListings({
    maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }
  return NextResponse.json(result)
}

/**
 * GET /api/sync-spark – called by Vercel Cron every 15 min.
 * Vercel sends Authorization: Bearer <CRON_SECRET>. Set CRON_SECRET in Vercel env.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync(request)
}

/**
 * POST /api/sync-spark – manual trigger.
 * Optional: header x-sync-secret = SYNC_SECRET, or same Bearer token as CRON_SECRET.
 * Query: ?maxPages=5&pageSize=100 for a limited run.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync(request)
}
