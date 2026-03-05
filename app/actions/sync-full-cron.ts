'use server'

import { createClient } from '@supabase/supabase-js'
import { syncSparkListings, syncListingHistory } from './sync-spark'
import { recordSyncRun } from './sync-history'

const CURSOR_ID = 'default'
const LISTING_PAGES_PER_RUN = 5
const HISTORY_BATCH_LIMIT = 30

export type SyncCursor = {
  phase: 'listings' | 'history' | 'idle'
  nextListingPage: number
  totalListingPages: number | null
  nextHistoryOffset: number
  updatedAt: string | null
  error?: string
}

export type RunOneChunkResult = {
  ok: boolean
  phase: 'listings' | 'history'
  done: boolean
  message: string
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
    .select('phase, next_listing_page, total_listing_pages, next_history_offset, updated_at')
    .eq('id', CURSOR_ID)
    .maybeSingle()

  if (error) return { phase: 'listings', nextListingPage: 1, totalListingPages: null, nextHistoryOffset: 0, updatedAt: null, error: error.message }
  const row = data as { phase?: string; next_listing_page?: number; total_listing_pages?: number | null; next_history_offset?: number; updated_at?: string } | null
  if (!row) return null

  const phase = (row.phase === 'history' || row.phase === 'idle' ? row.phase : 'listings') as SyncCursor['phase']
  return {
    phase,
    nextListingPage: row.next_listing_page ?? 1,
    totalListingPages: row.total_listing_pages ?? null,
    nextHistoryOffset: row.next_history_offset ?? 0,
    updatedAt: row.updated_at ?? null,
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
    .select('phase, next_listing_page, total_listing_pages, next_history_offset')
    .eq('id', CURSOR_ID)
    .maybeSingle()

  const row = cursorRow as { phase?: string; next_listing_page?: number; total_listing_pages?: number | null; next_history_offset?: number } | null
  let phase: 'listings' | 'history' = (row?.phase === 'history' ? 'history' : 'listings') as 'listings' | 'history'
  let nextListingPage = row?.next_listing_page ?? 1
  const totalListingPages = row?.total_listing_pages ?? null
  let nextHistoryOffset = row?.next_history_offset ?? 0

  if (row?.phase === 'idle') {
    phase = 'listings'
    nextListingPage = 1
    nextHistoryOffset = 0
  }

  if (phase === 'listings') {
    const result = await syncSparkListings({
      startPage: nextListingPage,
      maxPages: LISTING_PAGES_PER_RUN,
      pageSize: 100,
      insertOnly: false,
    })

    if (!result.success) {
      return { ok: false, phase: 'listings', done: false, message: result.message, error: result.error }
    }

    const newNextPage = result.nextPage ?? nextListingPage + LISTING_PAGES_PER_RUN
    const totalFromSpark = result.totalPagesFromSpark ?? totalListingPages
    const listingsDone = totalFromSpark != null && newNextPage > totalFromSpark

    if (listingsDone) {
      await supabase.from('sync_cursor').upsert(
        {
          id: CURSOR_ID,
          phase: 'history',
          next_listing_page: 1,
          total_listing_pages: totalFromSpark,
          next_history_offset: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      await recordSyncRun({
        runType: 'full',
        startedAt,
        completedAt: Date.now(),
        listingsUpserted: result.totalUpserted ?? 0,
      })
      return {
        ok: true,
        phase: 'listings',
        done: true,
        message: `Listings complete. ${result.totalUpserted ?? 0} upserted this run. History starts next run.`,
        upserted: result.totalUpserted,
      }
    }

    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        phase: 'listings',
        next_listing_page: newNextPage,
        total_listing_pages: totalFromSpark ?? totalListingPages,
        next_history_offset: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    await recordSyncRun({
      runType: 'full',
      startedAt,
      completedAt: Date.now(),
      listingsUpserted: result.totalUpserted ?? 0,
    })
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

  const result = await syncListingHistory({ offset: nextHistoryOffset, limit: HISTORY_BATCH_LIMIT })

  if (!result.success) {
    return { ok: false, phase: 'history', done: false, message: result.message, error: result.error }
  }

  const historyDone = result.nextOffset == null
  const newOffset = result.nextOffset ?? nextHistoryOffset + HISTORY_BATCH_LIMIT

  if (historyDone) {
    await supabase.from('sync_cursor').upsert(
      {
        id: CURSOR_ID,
        phase: 'idle',
        next_listing_page: 1,
        total_listing_pages: null,
        next_history_offset: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    await recordSyncRun({
      runType: 'full',
      startedAt,
      completedAt: Date.now(),
      historyRowsUpserted: result.historyRowsUpserted ?? 0,
    })
    return {
      ok: true,
      phase: 'history',
      done: true,
      message: `Full sync complete. History: ${result.historyRowsUpserted ?? 0} rows this run.`,
      historyRowsUpserted: result.historyRowsUpserted,
    }
  }

  await recordSyncRun({
    runType: 'full',
    startedAt,
    completedAt: Date.now(),
    historyRowsUpserted: result.historyRowsUpserted ?? 0,
  })
  await supabase.from('sync_cursor').upsert(
    {
      id: CURSOR_ID,
      phase: 'history',
      next_listing_page: 1,
      total_listing_pages: totalListingPages,
      next_history_offset: newOffset,
      updated_at: new Date().toISOString(),
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
    },
    { onConflict: 'id' }
  )
}
