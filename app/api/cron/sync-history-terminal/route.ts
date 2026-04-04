import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncListingHistory } from '@/app/actions/sync-spark'
const RUN_STALE_MS = 2 * 60 * 1000

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
 * GET /api/cron/sync-history-terminal
 * Run one terminal-history chunk (closed/expired/withdrawn/canceled only).
 * Supports worker sharding via query params:
 * - worker_count (default 1)
 * - worker_index (default 0)
 * - limit (default 200, max 200)
 * - from_year (optional, inclusive)
 * - to_year (optional, inclusive)
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workerCount = Math.max(1, Math.min(16, parseInt(searchParams.get('worker_count') ?? '1', 10) || 1))
  const workerIndex = Math.max(0, Math.min(workerCount - 1, parseInt(searchParams.get('worker_index') ?? '0', 10) || 0))
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') ?? '200', 10) || 200))
  const fromYearRaw = parseInt(searchParams.get('from_year') ?? '0', 10)
  const toYearRaw = parseInt(searchParams.get('to_year') ?? '0', 10)
  const fromYear = Number.isFinite(fromYearRaw) && fromYearRaw > 0 ? fromYearRaw : undefined
  const toYear = Number.isFinite(toYearRaw) && toYearRaw > 0 ? toYearRaw : undefined

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase =
    supabaseUrl?.trim() && serviceKey?.trim()
      ? createClient(supabaseUrl, serviceKey)
      : null
  const runStartedAt = new Date().toISOString()
  if (supabase) {
    const { data: existingCursor } = await supabase
      .from('sync_cursor')
      .select('run_started_at, run_listings_upserted, run_history_rows, updated_at')
      .eq('id', 'default')
      .maybeSingle()
    const existing = existingCursor as {
      run_started_at?: string | null
      run_listings_upserted?: number | null
      run_history_rows?: number | null
      updated_at?: string | null
    } | null
    const existingUpdatedAt = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0
    const hasRecentRun = Number.isFinite(existingUpdatedAt) && existingUpdatedAt > 0 && (Date.now() - existingUpdatedAt) <= RUN_STALE_MS
    const shouldStartFreshRun = !existing?.run_started_at || !hasRecentRun
    await supabase.from('sync_cursor').upsert(
      {
        id: 'default',
        phase: 'history',
        run_started_at: shouldStartFreshRun ? runStartedAt : (existing?.run_started_at ?? runStartedAt),
        run_listings_upserted: shouldStartFreshRun ? 0 : (existing?.run_listings_upserted ?? 0),
        run_history_rows: shouldStartFreshRun ? 0 : (existing?.run_history_rows ?? 0),
        paused: false,
        abort_requested: false,
        error: null,
        updated_at: runStartedAt,
      },
      { onConflict: 'id' }
    )
  }

  const result = await syncListingHistory({
    limit,
    offset: 0,
    activeAndPendingOnly: false,
    workerCount,
    workerIndex,
    terminalFromYear: fromYear,
    terminalToYear: toYear,
  })

  if (!result.success) {
    if (supabase) {
      const errorText = (result.error ?? result.message ?? '').trim() || 'Terminal history chunk failed'
      await supabase
        .from('sync_cursor')
        .update({ error: errorText, updated_at: new Date().toISOString() })
        .eq('id', 'default')
    }
    return NextResponse.json(result, { status: 500 })
  }
  if (supabase) {
    const { data: latestCursor } = await supabase
      .from('sync_cursor')
      .select('run_started_at, run_listings_upserted, run_history_rows')
      .eq('id', 'default')
      .maybeSingle()
    const latest = latestCursor as {
      run_started_at?: string | null
      run_listings_upserted?: number | null
      run_history_rows?: number | null
    } | null
    await supabase
      .from('sync_cursor')
      .update({
        phase: result.nextOffset == null ? 'idle' : 'history',
        run_started_at: result.nextOffset == null ? null : (latest?.run_started_at ?? runStartedAt),
        run_listings_upserted: latest?.run_listings_upserted ?? 0,
        run_history_rows: (latest?.run_history_rows ?? 0) + (result.historyRowsUpserted ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default')
  }
  return NextResponse.json(result)
}
