import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { syncListingHistory } from '@/app/actions/sync-spark'
import { fetchSparkListingHistory, fetchSparkPriceHistory, type SparkListingHistoryItem } from '@/lib/spark'
import { sparkHistoryItemToRow, type SparkHistoryItem } from '@/lib/listing-mapper'

const RUN_STALE_MS = 2 * 60 * 1000

/** PostgREST OR filter for terminal statuses (closed/expired/withdrawn/canceled). */
const TERMINAL_STATUS_OR_FILTER =
  'StandardStatus.ilike.%closed%,StandardStatus.ilike.%expired%,StandardStatus.ilike.%withdrawn%,StandardStatus.ilike.%cancel%'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    const auth = request.headers.get('authorization')
    if (auth === `Bearer ${secret}`) return true
  }
  if (!secret?.trim()) return true
  return false
}

// ---------------------------------------------------------------------------
// Verification pass helpers
// ---------------------------------------------------------------------------

type VerifyListingRow = {
  ListingKey?: string | null
  ListNumber?: string | null
  StandardStatus?: string | null
}

type VerifyOneResult = {
  processed: number
  markedVerified: number
  historyRowsInserted: number
  fetchFailures: number
}

async function verifyOneListing(
  supabase: SupabaseClient,
  token: string,
  row: VerifyListingRow
): Promise<VerifyOneResult> {
  const key1 = String(row.ListingKey ?? '').trim()
  const key2 = String(row.ListNumber ?? '').trim()
  const keys = [...new Set([key1, key2].filter(Boolean))]
  if (keys.length === 0 || !row.ListNumber) {
    return { processed: 0, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 0 }
  }
  const listingKey = keys[0]!

  let items: SparkListingHistoryItem[] = []
  let hadStrictSuccess = false

  try {
    for (const key of keys) {
      const h = await fetchSparkListingHistory(token, key)
      if (h.ok && h.partial !== true) hadStrictSuccess = true
      if (h.ok && h.partial !== true && h.items.length > 0) {
        items = h.items
        break
      }
    }

    if (items.length === 0) {
      for (const key of keys) {
        const p = await fetchSparkPriceHistory(token, key)
        if (p.ok && p.partial !== true) hadStrictSuccess = true
        if (p.ok && p.partial !== true && p.items.length > 0) {
          items = p.items
          break
        }
      }
    }

    if (!hadStrictSuccess) {
      return { processed: 1, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 1 }
    }

    let historyRowsInserted = 0
    if (items.length > 0) {
      await supabase.from('listing_history').delete().eq('listing_key', listingKey)
      const historyRows = items.map((item) =>
        sparkHistoryItemToRow(listingKey, item as SparkHistoryItem)
      )
      const { error: insertError } = await supabase.from('listing_history').insert(historyRows as never[])
      if (!insertError) historyRowsInserted = historyRows.length
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({ history_verified_full: true, is_finalized: true } as never)
      .eq('ListNumber', row.ListNumber)

    return {
      processed: 1,
      markedVerified: updateError ? 0 : 1,
      historyRowsInserted,
      fetchFailures: 0,
    }
  } catch {
    return { processed: 1, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 1 }
  }
}

function emptyVerifySum(): VerifyOneResult {
  return { processed: 0, markedVerified: 0, historyRowsInserted: 0, fetchFailures: 0 }
}

function addVerifySum(a: VerifyOneResult, b: VerifyOneResult): VerifyOneResult {
  return {
    processed: a.processed + b.processed,
    markedVerified: a.markedVerified + b.markedVerified,
    historyRowsInserted: a.historyRowsInserted + b.historyRowsInserted,
    fetchFailures: a.fetchFailures + b.fetchFailures,
  }
}

async function runVerificationPass(
  supabase: SupabaseClient,
  token: string,
  limit = 30
): Promise<VerifyOneResult> {
  const { data, error } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, StandardStatus')
    .eq('history_finalized', true)
    .eq('history_verified_full', false)
    .or(TERMINAL_STATUS_OR_FILTER)
    .order('OnMarketDate', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('[sync-history-terminal] verification query failed', error.message)
    return emptyVerifySum()
  }

  const rows = (data ?? []) as VerifyListingRow[]
  let total = emptyVerifySum()
  for (const row of rows) {
    const result = await verifyOneListing(supabase, token, row)
    total = addVerifySum(total, result)
  }
  return total
}

/**
 * GET /api/cron/sync-history-terminal
 * Run one terminal-history chunk (closed/expired/withdrawn/canceled only).
 * After the main sync, runs a verification pass on up to 30 already-finalized
 * terminal listings that have not yet been verified (history_verified_full = false).
 *
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

  // ---------------------------------------------------------------------------
  // Verification pass: re-fetch and stamp history_verified_full on already-
  // finalized terminal listings that haven't been verified yet.
  // ---------------------------------------------------------------------------
  let verifyResult: VerifyOneResult = emptyVerifySum()
  const sparkToken = process.env.SPARK_API_KEY
  if (supabase && sparkToken?.trim()) {
    verifyResult = await runVerificationPass(supabase, sparkToken, 30)
  }

  return NextResponse.json({
    ...result,
    verify: {
      processed: verifyResult.processed,
      markedVerified: verifyResult.markedVerified,
      historyRowsInserted: verifyResult.historyRowsInserted,
      fetchFailures: verifyResult.fetchFailures,
    },
  })
}
