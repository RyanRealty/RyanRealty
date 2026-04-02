import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runYearSyncChunk } from '@/app/api/admin/sync/_shared/run-year-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STALE_LANE_MS = Math.max(5 * 60 * 1000, Math.min(60 * 60 * 1000, Number(process.env.SYNC_YEAR_STALE_LANE_MS ?? 20 * 60 * 1000)))

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
  const laneParam = url.searchParams.get('lane')
  let targetYear: number | undefined
  if (yearParam) {
    const parsed = Number(yearParam)
    const currentYear = new Date().getUTCFullYear()
    if (!Number.isFinite(parsed) || parsed < 1990 || parsed > currentYear) {
      return NextResponse.json({ ok: false, error: `Invalid year: ${yearParam}` }, { status: 400 })
    }
    targetYear = Math.floor(parsed)
  }

  const cursorId =
    laneParam === 'current-year'
      ? 'current-year'
      : 'default'

  const supabase = createClient(supabaseUrl, serviceKey)
  let staleLaneRecovered = false
  if (targetYear != null) {
    const { data: activeCursor } = await supabase
      .from('sync_year_cursor')
      .select('current_year, phase, updated_at')
      .eq('id', cursorId)
      .maybeSingle()

    const active = activeCursor as { current_year?: number | null; phase?: string | null; updated_at?: string | null } | null
    const activeYear = active?.current_year ?? null
    const activePhase = active?.phase ?? null
    const laneBusy = activeYear != null && activePhase != null && activePhase !== 'idle'
    const updatedAtMs = active?.updated_at ? new Date(active.updated_at).getTime() : Number.NaN
    const isStale = Number.isFinite(updatedAtMs) && (Date.now() - updatedAtMs) > STALE_LANE_MS
    if (laneBusy && activeYear !== targetYear && !isStale) {
      return NextResponse.json(
        {
          ok: false,
          error: `Lane ${cursorId} is already running year ${activeYear}.`,
          year: activeYear,
          phase: activePhase,
        },
        { status: 409 }
      )
    }
    if (laneBusy && isStale) {
      await supabase.from('sync_year_cursor').upsert(
        {
          id: cursorId,
          current_year: null,
          phase: 'idle',
          next_listing_page: 1,
          next_history_offset: 0,
          total_listings: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      staleLaneRecovered = true
    }
  }
  const result = await runYearSyncChunk({ supabase, token: accessToken, targetYear, cursorId })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? result.message, year: result.year, phase: result.phase },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    done: result.done,
    year: result.year,
    phase: result.phase,
    message: result.message,
    sparkListings: result.sparkListings,
    supabaseListings: result.supabaseListings,
    listingsUpserted: result.listingsUpserted,
    historyInserted: result.historyInserted,
    listingsFinalized: result.listingsFinalized,
    processedListings: result.processedListings,
    totalListings: result.totalListings,
    yielded: result.yielded ?? false,
    chunkDurationMs: result.chunkDurationMs,
    staleLaneRecovered,
  })
}
