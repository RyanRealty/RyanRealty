'use server'

import { createClient } from '@supabase/supabase-js'
import { syncSparkListings, syncListingHistory, runOnePageActivePendingSync, syncSparkListingsDelta } from './sync-spark'
import { recordSyncRun, refreshListingsBreakdown } from './sync-history'

const CURSOR_ID = 'default'
const LISTING_PAGES_PER_RUN = 5
const HISTORY_BATCH_LIMIT = 30

export type SyncCursor = {
  phase: 'listings' | 'history' | 'idle' | 'refresh_active_pending'
  nextListingPage: number
  totalListingPages: number | null
  nextHistoryOffset: number
  updatedAt: string | null
  /** When set, a sync run is in progress (manual or cron). UI can show duration and run_* counts. */
  runStartedAt: string | null
  runListingsUpserted: number
  runHistoryRows: number
  paused: boolean
  abortRequested: boolean
  /** When false, GET /api/cron/sync-full does nothing. Toggle on admin sync page. */
  cronEnabled: boolean
  error?: string
}

export type RunOneChunkResult = {
  ok: boolean
  phase: 'listings' | 'history'
  done: boolean
  message: string
  paused?: boolean
  nextListingPage?: number
  totalListingPages?: number
  nextHistoryOffset?: number
  totalListings?: number
  upserted?: number
  historyRowsUpserted?: number
  error?: string
}

/** Read current cron sync progress from sync_cursor table. */
export async function getSyncCursor(): Promise<SyncCursor | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return null

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('sync_cursor')
    .select('phase, next_listing_page, total_listing_pages, next_history_offset, updated_at, run_started_at, run_listings_upserted, run_history_rows, paused, abort_requested, cron_enabled, error')
    .eq('id', CURSOR_ID)
    .maybeSingle()

  if (error) return { phase: 'listings', nextListingPage: 1, totalListingPages: null, nextHistoryOffset: 0, updatedAt: null, runStartedAt: null, runListingsUpserted: 0, runHistoryRows: 0, paused: false, abortRequested: false, cronEnabled: false, error: error.message }
  const row = data as {
    phase?: string
    next_listing_page?: number
    total_listing_pages?: number | null
    next_history_offset?: number
    updated_at?: string
    run_started_at?: string | null
    run_listings_upserted?: number
    run_history_rows?: number
    paused?: boolean
    abort_requested?: boolean
    cron_enabled?: boolean
    error?: string | null
  } | null
  if (!row) return null

  const phase = (row.phase === 'history' || row.phase === 'idle' || row.phase === 'refresh_active_pending' ? row.phase : 'listings') as SyncCursor['phase']
  return {
    phase,
    nextListingPage: row.next_listing_page ?? 1,
    totalListingPages: row.total_listing_pages ?? null,
    nextHistoryOffset: row.next_history_offset ?? 0,
    updatedAt: row.updated_at ?? null,
    runStartedAt: row.run_started_at ?? null,
    runListingsUpserted: row.run_listings_upserted ?? 0,
    runHistoryRows: row.run_history_rows ?? 0,
    paused: row.paused ?? false,
    abortRequested: row.abort_requested ?? false,
    cronEnabled: row.cron_enabled ?? false,
    error: row.error ?? undefined,
  }
}

/** Run one chunk of full sync (listings or history). Used by cron and by "Run now" on admin page. */
export async function runOneFullSyncChunk(): Promise<RunOneChunkResult> {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, phase: 'listings', done: false, message: 'Supabase not configured.', error: 'Missing env' }
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: cursorRow } = await supabase
    .from('sync_cursor')
    .select('phase, next_listing_page, total_listing_pages, next_history_offset, run_started_at, run_listings_upserted, run_history_rows, paused, abort_requested, refresh_next_url')
    .eq('id', CURSOR_ID)
    .maybeSingle()

  const row = cursorRow as {
    phase?: string
    next_listing_page?: number
    total_listing_pages?: number | null
    next_history_offset?: number
    run_started_at?: string | null
    run_listings_upserted?: number
    run_history_rows?: number
    paused?: boolean
    abort_requested?: boolean
    refresh_next_url?: string | null
  } | null

  if (row?.abort_requested) {
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        phase: row.phase === 'refresh_active_pending' ? 'idle' : undefined,
        next_listing_page: row.phase === 'refresh_active_pending' ? 1 : undefined,
        total_listing_pages: row.phase === 'refresh_active_pending' ? null : undefined,
        run_started_at: null,
        run_listings_upserted: 0,
        run_history_rows: 0,
        abort_requested: false,
        refresh_next_url: row.phase === 'refresh_active_pending' ? null : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    return { ok: true, phase: 'listings', done: true, message: 'Stopped by user.' }
  }
  if (row?.paused) {
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        run_started_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    return { ok: true, phase: 'listings', done: true, paused: true, message: 'Paused.' }
  }

  // Refresh active & pending (chunked): one page per chunk, same Pause/Stop as full sync
  if (row?.phase === 'refresh_active_pending') {
    const refreshNextUrl = row.refresh_next_url ?? null
    const nextListingPage = row.next_listing_page ?? 1
    const runStartedAt = row.run_started_at ?? new Date().toISOString()
    let runListingsUpserted = row.run_listings_upserted ?? 0

    const result = await runOnePageActivePendingSync({
      refreshNextUrl: refreshNextUrl === 'v1' ? 'v1' : refreshNextUrl,
      nextListingPage,
    })

    runListingsUpserted += result.totalUpserted

    if (!result.success) {
      await supabase.from('sync_cursor').upsert(
        {
          id: CURSOR_ID,
          phase: 'idle',
          run_started_at: null,
          run_listings_upserted: 0,
          refresh_next_url: null,
          error: result.error ?? result.message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      return { ok: false, phase: 'listings', done: true, message: result.message, error: result.error }
    }

    if (!result.hasMore) {
      await supabase.from('sync_cursor').upsert(
        {
          id: CURSOR_ID,
          phase: 'idle',
          next_listing_page: 1,
          total_listing_pages: null,
          run_started_at: null,
          run_listings_upserted: 0,
          run_history_rows: 0,
          refresh_next_url: null,
          error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      return {
        ok: true,
        phase: 'listings',
        done: true,
        message: `Refresh active & pending complete. ${runListingsUpserted} listings upserted.`,
        upserted: result.totalUpserted,
      }
    }

    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        phase: 'refresh_active_pending',
        next_listing_page: result.nextListingPage,
        total_listing_pages: result.totalListingPages,
        run_started_at: runStartedAt,
        run_listings_upserted: runListingsUpserted,
        refresh_next_url: result.nextUrl,
        error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    return {
      ok: true,
      phase: 'listings',
      done: false,
      message: result.message ?? `Refreshing: ${runListingsUpserted} upserted so far.`,
      nextListingPage: result.nextListingPage,
      totalListingPages: result.totalListingPages ?? undefined,
      upserted: result.totalUpserted,
    }
  }

  let phase: 'listings' | 'history' = (row?.phase === 'history' ? 'history' : 'listings') as 'listings' | 'history'
  let nextListingPage = row?.next_listing_page ?? 1
  const totalListingPages = row?.total_listing_pages ?? null
  let nextHistoryOffset = row?.next_history_offset ?? 0
  const nowIso = new Date().toISOString()
  const runAlreadyStarted = !!row?.run_started_at
  let runStartedAt = runAlreadyStarted ? row!.run_started_at! : nowIso
  let runListingsUpserted = row?.run_listings_upserted ?? 0
  let runHistoryRows = row?.run_history_rows ?? 0

  if (row?.phase === 'idle') {
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
      maxPages: LISTING_PAGES_PER_RUN,
      pageSize: 100,
      insertOnly: false,
    })

    if (!result.success) {
      // Hard failure from Spark or Supabase during listings. Mark run as stopped and store error on cursor so UI and cron see it.
      await supabase.from('sync_cursor').upsert(
        {
          id: CURSOR_ID,
          phase: 'listings',
          next_listing_page: nextListingPage,
          total_listing_pages: totalListingPages,
          next_history_offset: nextHistoryOffset,
          updated_at: new Date().toISOString(),
          run_started_at: null,
          run_listings_upserted: runListingsUpserted,
          run_history_rows: runHistoryRows,
          paused: false,
          abort_requested: false,
          error: result.message ?? result.error ?? 'Listings sync failed',
        },
        { onConflict: 'id' }
      )
      return { ok: false, phase: 'listings', done: true, message: result.message, error: result.error }
    }

    const newNextPage = result.nextPage ?? nextListingPage + LISTING_PAGES_PER_RUN
    const totalFromSpark = result.totalPagesFromSpark ?? totalListingPages
    const listingsDone = totalFromSpark != null && newNextPage > totalFromSpark

    if (listingsDone) {
      runListingsUpserted += result.totalUpserted ?? 0
      await supabase.from('sync_cursor').upsert(
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
          error: null,
        },
        { onConflict: 'id' }
      )
      // Record only when full run completes (history phase done), not per phase
      return {
        ok: true,
        phase: 'listings',
        done: true,
        message: `Listings complete. ${result.totalUpserted ?? 0} upserted this run. History starts next run.`,
        upserted: result.totalUpserted,
      }
    }

    runListingsUpserted += result.totalUpserted ?? 0
    await supabase.from('sync_cursor').upsert(
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
        error: null,
      },
      { onConflict: 'id' }
    )
    // No recordSyncRun here — only record when full run completes (history done)
    return {
      ok: true,
      phase: 'listings',
      done: false,
      message: `Listings: page ${newNextPage} of ${totalFromSpark ?? '?'}. ${result.totalUpserted ?? 0} upserted.`,
      nextListingPage: newNextPage,
      totalListingPages: totalFromSpark ?? undefined,
      upserted: result.totalUpserted,
    }
  }

  const result = await syncListingHistory({
    offset: nextHistoryOffset,
    limit: HISTORY_BATCH_LIMIT,
    activeAndPendingOnly: true,
  })

  if (!result.success) {
    // Hard failure during history phase. Mark run as stopped and store error on cursor.
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        phase: 'history',
        next_listing_page: nextListingPage,
        total_listing_pages: totalListingPages,
        next_history_offset: nextHistoryOffset,
        updated_at: new Date().toISOString(),
        run_started_at: null,
        run_listings_upserted: runListingsUpserted,
        run_history_rows: runHistoryRows,
        paused: false,
        abort_requested: false,
        error: result.message ?? result.error ?? 'History sync failed',
      },
      { onConflict: 'id' }
    )
    return { ok: false, phase: 'history', done: true, message: result.message, error: result.error }
  }

  const historyDone = result.nextOffset == null
  const newOffset = result.nextOffset ?? nextHistoryOffset + HISTORY_BATCH_LIMIT

  if (historyDone) {
    runHistoryRows += result.historyRowsUpserted ?? 0
    await supabase.from('sync_cursor').upsert(
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
        error: null,
      },
      { onConflict: 'id' }
    )
    // One history row per full run (listings + history complete)
    await recordSyncRun({
      runType: 'full',
      startedAt,
      completedAt: Date.now(),
      listingsUpserted: runListingsUpserted,
      historyRowsUpserted: runHistoryRows,
    })
    // Full sync finished (listings + history). Recompute reporting cache so breakdown matches the current listings table.
    await refreshListingsBreakdown().catch(() => {
      // Cache refresh failures should not fail the sync run; the admin UI will surface breakdownError if RPC is unavailable.
    })
    return {
      ok: true,
      phase: 'history',
      done: true,
      message: `Full sync complete. History: ${result.historyRowsUpserted ?? 0} rows this run.`,
      historyRowsUpserted: result.historyRowsUpserted,
    }
  }

  runHistoryRows += result.historyRowsUpserted ?? 0
  // No recordSyncRun here — only when full run completes (historyDone)
  await supabase.from('sync_cursor').upsert(
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
      error: null,
    },
    { onConflict: 'id' }
  )

  return {
    ok: true,
    phase: 'history',
    done: false,
    message: `History: ${result.listingsProcessed ?? 0} listings, ${result.historyRowsUpserted ?? 0} rows.`,
    nextHistoryOffset: newOffset,
    totalListings: result.totalListings,
    historyRowsUpserted: result.historyRowsUpserted,
  }
}

/** Update sync_cursor after "Sync all listings" completes so Cron sync status shows correct phase. */
export async function updateSyncCursorAfterListingsComplete(totalListingPages: number): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return
  const supabase = createClient(supabaseUrl, serviceKey)
  await supabase.from('sync_cursor').upsert(
    {
      id: CURSOR_ID,
      phase: 'history',
      next_listing_page: 1,
      total_listing_pages: totalListingPages,
      next_history_offset: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
}

/** Set sync_cursor to idle (e.g. after "Sync all history" completes). */
export async function updateSyncCursorToIdle(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return
  const supabase = createClient(supabaseUrl, serviceKey)
  await supabase.from('sync_cursor').upsert(
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
}

export type SyncStatus = {
  cursor: SyncCursor | null
  lastSync: { completedAt: string; runType: string; durationSeconds: number; listingsUpserted: number; historyRowsUpserted: number; error: string | null } | null
  /** Last time Inngest delta sync (2-min) completed. Null if never run. */
  lastDeltaSyncCompletedAt: string | null
}

/** Last completed delta sync (Inngest, every 2 min). Used for "Listing information current as of" on active listings. */
export async function getLastDeltaSyncCompletedAt(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return null
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data } = await supabase
    .from('sync_checkpoints')
    .select('completed_at')
    .eq('sync_type', 'delta')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { completed_at?: string | null } | null
  return (row?.completed_at?.trim() && row.completed_at) ? row.completed_at : null
}

export type DeltaCheckpointRow = {
  id: string
  completed_at: string
  total_count: number
  processed_count: number
  metadata: { listingsCreated?: string[]; listingsUpdated?: string[]; listingsClosed?: string[] } | null
}

/** Recent delta sync runs (Inngest 2-min) for the sync run log. */
export async function getDeltaSyncLog(limit = 50): Promise<DeltaCheckpointRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return []
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('sync_checkpoints')
    .select('id, completed_at, total_count, processed_count, metadata')
    .eq('sync_type', 'delta')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as DeltaCheckpointRow[]
}

/** For the sync page: cursor (with run-in-progress) and last completed sync. */
export async function getSyncStatus(): Promise<SyncStatus> {
  const [cursor, history, lastDeltaAt] = await Promise.all([
    getSyncCursor(),
    import('./sync-history').then((m) => m.getSyncHistory(1)),
    getLastDeltaSyncCompletedAt(),
  ])
  const last = history[0]
  return {
    cursor,
    lastSync: last
      ? {
          completedAt: last.completed_at,
          runType: last.run_type,
          durationSeconds: last.duration_seconds,
          listingsUpserted: last.listings_upserted,
          historyRowsUpserted: last.history_rows_upserted,
          error: last.error,
        }
      : null,
    lastDeltaSyncCompletedAt: lastDeltaAt ?? null,
  }
}

/** Run a single sync chunk. Used by the admin UI so it can show live progress and respect Pause/Stop between chunks. */
export async function runOneSyncChunk(): Promise<RunOneChunkResult> {
  return runOneFullSyncChunk()
}

/** Run full sync from current cursor (resume or start fresh) until phase is idle. Long-running; used by cron/API. UI uses runOneSyncChunk in a loop for live progress. */
export async function runSmartSync(): Promise<{ ok: boolean; message: string; error?: string }> {
  let chunkCount = 0
  const maxChunks = 5000
  while (chunkCount < maxChunks) {
    const result = await runOneFullSyncChunk()
    chunkCount++
    if (!result.ok) {
      return { ok: false, message: result.message ?? 'Sync failed', error: result.error }
    }
    if (result.done) {
      return { ok: true, message: result.message ?? (result.paused ? 'Paused.' : 'Sync complete.') }
    }
  }
  return { ok: true, message: `Stopped after ${maxChunks} chunks. Check sync status.` }
}

/** Start refresh active & pending (chunked). Sets phase to refresh_active_pending; UI then runs runOneSyncChunk in a loop until done. Same Stop/Pause as full sync. */
export async function startRefreshActivePending(): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Supabase not configured' }
  const supabase = createClient(supabaseUrl, serviceKey)
  const now = new Date().toISOString()
  const { error } = await supabase.from('sync_cursor').upsert(
    {
      id: CURSOR_ID,
      phase: 'refresh_active_pending',
      next_listing_page: 1,
      total_listing_pages: null,
      run_started_at: now,
      run_listings_upserted: 0,
      run_history_rows: 0,
      refresh_next_url: null,
      paused: false,
      abort_requested: false,
      error: null,
      updated_at: now,
    },
    { onConflict: 'id' }
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Set sync pause flag. When true, cron and Smart Sync will not run chunks until resumed. */
export async function setSyncPaused(paused: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Supabase not configured' }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('sync_cursor').update({
    paused,
    updated_at: new Date().toISOString(),
  }).eq('id', CURSOR_ID)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Request sync to stop. The next chunk (Smart Sync or cron) will exit without running and clear run progress. */
export async function setSyncAbortRequested(): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Supabase not configured' }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('sync_cursor').update({
    abort_requested: true,
    updated_at: new Date().toISOString(),
  }).eq('id', CURSOR_ID)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Run delta sync (listings changed since a given date). Faster than full sync when you only need updates since that date. */
export async function runDeltaSyncSince(sinceIso: string): Promise<{ ok: boolean; message: string; error?: string }> {
  if (!sinceIso?.trim()) return { ok: false, message: 'Date required.', error: 'sinceIso required' }
  const result = await syncSparkListingsDelta({ sinceOverride: sinceIso, maxPages: 200 })
  if (!result.success) {
    return { ok: false, message: result.message ?? 'Delta sync failed', error: result.error }
  }
  return { ok: true, message: result.message ?? 'Done.' }
}

/** Enable or disable the sync cron job. When disabled, GET /api/cron/sync-full returns without running. */
export async function setCronEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return { ok: false, error: 'Supabase not configured' }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('sync_cursor').update({
    cron_enabled: enabled,
    updated_at: new Date().toISOString(),
  }).eq('id', CURSOR_ID)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
