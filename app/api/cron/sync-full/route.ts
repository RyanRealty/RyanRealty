import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncSparkListings, syncListingHistory } from '../../../actions/sync-spark'
import { recordSyncRun } from '../../../actions/sync-history'

const CURSOR_ID = 'default'
/** Default pages per run (cron); use ?pages= for local/long runs. */
const DEFAULT_LISTING_PAGES_PER_RUN = 5
/** Default history batch size; use ?history_limit= for local. */
const DEFAULT_HISTORY_BATCH_LIMIT = 30

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    const auth = request.headers.get('authorization')
    if (auth === `Bearer ${secret}`) return true
  }
  if (!secret?.trim()) return true
  return false
}

type CursorRow = {
  id: string
  phase: string
  next_listing_page: number
  total_listing_pages: number | null
  next_history_offset: number
  updated_at: string
  run_started_at?: string | null
  run_listings_upserted?: number
  run_history_rows?: number
  paused?: boolean
  abort_requested?: boolean
  cron_enabled?: boolean
}

/**
 * GET /api/cron/sync-full
 * Run one chunk of full sync: either N pages of listings or one batch of history.
 * Cursor is stored in sync_cursor table. Call every 10–15 min via Vercel Cron.
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const startedAt = Date.now()
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'
  const listingPagesPerRun = Math.min(50, Math.max(1, parseInt(searchParams.get('pages') ?? String(DEFAULT_LISTING_PAGES_PER_RUN), 10) || DEFAULT_LISTING_PAGES_PER_RUN))
  const historyBatchLimit = Math.min(200, Math.max(1, parseInt(searchParams.get('history_limit') ?? String(DEFAULT_HISTORY_BATCH_LIMIT), 10) || DEFAULT_HISTORY_BATCH_LIMIT))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return NextResponse.json(
      { error: 'Supabase not configured', phase: null },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let cursorRow: CursorRow | null = null
  const { data, error: cursorError } = await supabase
    .from('sync_cursor')
    .select('phase, next_listing_page, total_listing_pages, next_history_offset, run_started_at, run_listings_upserted, run_history_rows, paused, abort_requested, cron_enabled')
    .eq('id', CURSOR_ID)
    .maybeSingle()

  if (cursorError) {
    return NextResponse.json(
      {
        error: 'sync_cursor table missing or inaccessible. Run migration: supabase/migrations/20250303230000_sync_cursor.sql',
        detail: cursorError.message,
      },
      { status: 503 }
    )
  }
  cursorRow = data as CursorRow | null

  if (cursorRow?.cron_enabled === false && !force) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'Sync cron is disabled. Enable it on the admin sync page when ready.',
    })
  }

  if (cursorRow?.abort_requested) {
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        run_started_at: null,
        run_listings_upserted: 0,
        run_history_rows: 0,
        abort_requested: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    return NextResponse.json({ ok: true, paused: false, stopped: true, message: 'Stopped by user.' })
  }
  if (cursorRow?.paused) {
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        run_started_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    return NextResponse.json({ ok: true, paused: true, message: 'Sync is paused.' })
  }

  let phase = cursorRow?.phase ?? 'listings'
  let nextListingPage = cursorRow?.next_listing_page ?? 1
  const totalListingPages = cursorRow?.total_listing_pages ?? null
  let nextHistoryOffset = cursorRow?.next_history_offset ?? 0
  const nowIso = new Date().toISOString()
  const runAlreadyStarted = !!cursorRow?.run_started_at
  let runStartedAt = runAlreadyStarted ? cursorRow!.run_started_at! : nowIso
  let runListingsUpserted = cursorRow?.run_listings_upserted ?? 0
  let runHistoryRows = cursorRow?.run_history_rows ?? 0

  if (phase === 'idle') {
    phase = 'listings'
    nextListingPage = 1
    nextHistoryOffset = 0
    runStartedAt = nowIso
    runListingsUpserted = 0
    runHistoryRows = 0
  }

  if (phase === 'listings') {
    const result = await syncSparkListings({
      startPage: nextListingPage,
      maxPages: listingPagesPerRun,
      pageSize: 100,
      insertOnly: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? result.message, phase: 'listings' },
        { status: 500 }
      )
    }

    const newNextPage = result.nextPage ?? nextListingPage + listingPagesPerRun
    const totalFromSpark = result.totalPagesFromSpark ?? totalListingPages
    const listingsDone = totalFromSpark != null && newNextPage > totalFromSpark

    if (listingsDone) {
      runListingsUpserted += result.totalUpserted ?? 0
      await supabase
        .from('sync_cursor')
        .upsert(
          {
            id: CURSOR_ID,
            phase: 'history',
            next_listing_page: 1,
            total_listing_pages: totalFromSpark,
            next_history_offset: 0,
            updated_at: new Date().toISOString(),
            run_started_at: runStartedAt,
            run_listings_upserted: runListingsUpserted,
            run_history_rows: runHistoryRows,
          },
          { onConflict: 'id' }
        )
      await recordSyncRun({
        runType: 'full',
        startedAt,
        completedAt: Date.now(),
        listingsUpserted: result.totalUpserted ?? 0,
      })
      return NextResponse.json({
        ok: true,
        phase: 'listings',
        done: true,
        message: `Listings complete. ${result.totalUpserted ?? 0} upserted this run. History starts next run.`,
      })
    }

    runListingsUpserted += result.totalUpserted ?? 0
    await supabase
      .from('sync_cursor')
      .upsert(
        {
          id: CURSOR_ID,
          phase: 'listings',
          next_listing_page: newNextPage,
          total_listing_pages: totalFromSpark ?? totalListingPages,
          next_history_offset: 0,
          updated_at: new Date().toISOString(),
          run_started_at: runStartedAt,
          run_listings_upserted: runListingsUpserted,
          run_history_rows: runHistoryRows,
        },
        { onConflict: 'id' }
      )

    await recordSyncRun({
      runType: 'full',
      startedAt,
      completedAt: Date.now(),
      listingsUpserted: result.totalUpserted ?? 0,
    })
    return NextResponse.json({
      ok: true,
      phase: 'listings',
      done: false,
      nextListingPage: newNextPage,
      totalListingPages: totalFromSpark ?? totalListingPages,
      upserted: result.totalUpserted ?? 0,
    })
  }

  const result = await syncListingHistory({
    offset: nextHistoryOffset,
    limit: historyBatchLimit,
    activeAndPendingOnly: true,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? result.message, phase: 'history' },
      { status: 500 }
    )
  }

  const historyDone = result.nextOffset == null
  const newOffset = result.nextOffset ?? nextHistoryOffset + historyBatchLimit

  if (historyDone) {
    runHistoryRows += result.historyRowsUpserted ?? 0
    await supabase
      .from('sync_cursor')
      .upsert(
        {
          id: CURSOR_ID,
          phase: 'idle',
          next_listing_page: 1,
          total_listing_pages: null,
          next_history_offset: 0,
          updated_at: new Date().toISOString(),
          run_started_at: null,
          run_listings_upserted: 0,
          run_history_rows: 0,
        },
        { onConflict: 'id' }
      )
    await recordSyncRun({
      runType: 'full',
      startedAt,
      completedAt: Date.now(),
      historyRowsUpserted: result.historyRowsUpserted ?? 0,
    })
    return NextResponse.json({
      ok: true,
      phase: 'history',
      done: true,
      message: `Full sync complete. History: ${result.historyRowsUpserted ?? 0} rows this run.`,
    })
  }

  runHistoryRows += result.historyRowsUpserted ?? 0
  await recordSyncRun({
    runType: 'full',
    startedAt,
    completedAt: Date.now(),
    historyRowsUpserted: result.historyRowsUpserted ?? 0,
  })
  await supabase
    .from('sync_cursor')
    .upsert(
      {
        id: CURSOR_ID,
        phase: 'history',
        next_listing_page: 1,
        total_listing_pages: totalListingPages,
        next_history_offset: newOffset,
        updated_at: new Date().toISOString(),
        run_started_at: runStartedAt,
        run_listings_upserted: runListingsUpserted,
        run_history_rows: runHistoryRows,
      },
      { onConflict: 'id' }
    )

  return NextResponse.json({
    ok: true,
    phase: 'history',
    done: false,
    nextHistoryOffset: newOffset,
    totalListings: result.totalListings,
    historyRowsUpserted: result.historyRowsUpserted ?? 0,
  })
}
