import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runYearSyncChunk } from '@/app/api/admin/sync/_shared/run-year-sync'

const MAX_CHUNKS_PER_REQUEST = Math.max(
  1,
  Math.min(24, Number(process.env.SYNC_YEAR_MAX_CHUNKS_PER_REQUEST ?? 8))
)

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    const auth = request.headers.get('authorization')
    if (auth === `Bearer ${secret}`) return true
  }
  if (!secret?.trim()) return true
  return false
}

/**
 * GET /api/cron/sync-year-by-year?year=2024
 * Run one chunk of year-by-year sync. Same logic as YearSyncMatrix manual sync:
 * if listings match, skips to history. Chunked so it fits in serverless timeout.
 * Optional ?year=YYYY targets a specific year instead of picking the next uncompleted one.
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const accessToken = process.env.SPARK_API_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }
  if (!accessToken?.trim()) {
    return NextResponse.json({ ok: false, error: 'SPARK_API_KEY not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  let targetYear: number | undefined
  if (yearParam) {
    const parsed = Number(yearParam)
    const currentYear = new Date().getUTCFullYear()
    if (!Number.isFinite(parsed) || parsed < 1990 || parsed > currentYear) {
      return NextResponse.json({ ok: false, error: `Invalid year: ${yearParam}` }, { status: 400 })
    }
    targetYear = Math.floor(parsed)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  let chunksExecuted = 0
  let result = await runYearSyncChunk({ supabase, token: accessToken, targetYear })
  chunksExecuted += 1

  while (result.ok && !result.done && chunksExecuted < MAX_CHUNKS_PER_REQUEST) {
    result = await runYearSyncChunk({ supabase, token: accessToken, targetYear })
    chunksExecuted += 1
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? result.message,
        year: result.year,
        phase: result.phase,
        chunksExecuted,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    done: result.done,
    year: result.year,
    phase: result.phase,
    message: result.message,
    chunksExecuted,
    sparkListings: result.sparkListings,
    supabaseListings: result.supabaseListings,
    listingsUpserted: result.listingsUpserted,
    historyInserted: result.historyInserted,
    listingsFinalized: result.listingsFinalized,
    processedListings: result.processedListings,
    totalListings: result.totalListings,
  })
}
