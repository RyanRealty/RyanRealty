'use server'

import { createClient } from '@supabase/supabase-js'
import {
  fetchSparkListingsPage,
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  fetchSparkHistoricalListings,
  sparkListingToSupabaseRow,
  type SparkListingHistoryItem,
} from '../../lib/spark'

export type SyncDeltaResult = {
  success: boolean
  message: string
  totalFetched?: number
  totalUpserted?: number
  eventsEmitted?: number
  pagesProcessed?: number
  error?: string
}

const SYNC_EXPAND = 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'
/** Upsert in small chunks to avoid Supabase statement timeout (large details JSON). */
const UPSERT_CHUNK_SIZE = 12
const UPSERT_CHUNK_SIZE_RETRY = 5

/** Activity event types from sync change detection (Priority 2). */
const ACTIVITY_NEW_LISTING = 'new_listing'
const ACTIVITY_PRICE_DROP = 'price_drop'
const ACTIVITY_STATUS_PENDING = 'status_pending'
const ACTIVITY_STATUS_CLOSED = 'status_closed'

/** Convert one Spark history item to a row for listing_history table. Uses Event, ModificationTimestamp/Date, PriceAtEvent/Price, etc. */
function sparkHistoryItemToRow(listingKey: string, item: SparkListingHistoryItem) {
  const dateRaw = item.ModificationTimestamp ?? item.Date
  let eventDate: string | null = null
  if (typeof dateRaw === 'string' && dateRaw.trim()) {
    const d = new Date(dateRaw.trim())
    if (!isNaN(d.getTime())) eventDate = d.toISOString()
  }
  const priceNum =
    typeof item.Price === 'number' ? item.Price
    : typeof item.PriceAtEvent === 'number' ? item.PriceAtEvent
    : typeof item.Price === 'string' ? parseFloat(String(item.Price)) : null
  const priceVal = priceNum ?? (typeof item.PriceAtEvent === 'string' ? parseFloat(String(item.PriceAtEvent)) : null)
  const description =
    typeof item.Description === 'string' ? item.Description
    : item.Field != null && item.PreviousValue != null && item.NewValue != null
      ? `${item.Field}: ${String(item.PreviousValue)} → ${String(item.NewValue)}`
      : null
  return {
    listing_key: listingKey,
    event_date: eventDate,
    event: typeof item.Event === 'string' ? item.Event : null,
    description: description ?? null,
    price: typeof priceVal === 'number' && !Number.isNaN(priceVal) ? priceVal : null,
    price_change: typeof item.PriceChange === 'number' ? item.PriceChange : typeof item.PriceChange === 'string' ? parseFloat(String(item.PriceChange)) : null,
    raw: item as Record<string, unknown>,
  }
}

export type SyncSparkResult = {
  success: boolean
  message: string
  totalFetched?: number
  totalUpserted?: number
  pagesProcessed?: number
  /** Total pages available from Spark (from first page's Pagination) */
  totalPagesFromSpark?: number
  /** Page we ended on (1-based); next chunk can start from nextPage */
  nextPage?: number
  error?: string
}

/**
 * Fetch all listing pages from Spark API and upsert into Supabase listings table.
 * Uses ListNumber (Spark ListingId) as the unique key for upserts.
 * Safe to run multiple times; will update existing rows.
 */
export async function syncSparkListings(options?: {
  maxPages?: number
  pageSize?: number
  /** Start from this page (1-based). Enables chunked sync with progress. */
  startPage?: number
  /** If true, only insert new rows (skip updating existing). Faster for "top up" runs. */
  insertOnly?: boolean
}): Promise<SyncSparkResult> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { success: false, message: 'SPARK_API_KEY is not set.', error: 'Missing SPARK_API_KEY' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !supabaseServiceKey?.trim()) {
    return {
      success: false,
      message: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
      error: 'Missing Supabase env vars',
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const maxPages = options?.maxPages ?? 999
  const pageSize = options?.pageSize ?? 100
  let currentPage = Math.max(1, options?.startPage ?? 1)
  let totalPages = currentPage
  let totalFetched = 0
  let totalUpserted = 0
  let pagesProcessed = 0

  try {
    while (currentPage <= totalPages && pagesProcessed < maxPages) {
      const response = await fetchSparkListingsPage(accessToken, {
        page: currentPage,
        limit: pageSize,
        expand: SYNC_EXPAND,
        // Use OnMarketDate so Spark returns full historical data (pre-2024); ModificationTimestamp can restrict range.
        orderby: '+OnMarketDate',
      })

      const D = response.D
      if (!D?.Success || !D.Results?.length) {
        if (pagesProcessed === 0) {
          return {
            success: true,
            message: 'No listings returned from Spark.',
            totalFetched: 0,
            totalUpserted: 0,
            pagesProcessed: 0,
            totalPagesFromSpark: totalPages,
            nextPage: currentPage,
          }
        }
        break
      }

      const pagination = D.Pagination
      if (pagination) {
        totalPages = pagination.TotalPages
      }

      const rows = D.Results.map(sparkListingToSupabaseRow)
      totalFetched += rows.length

      for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
        let chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
        let { error } = await supabase.from('listings').upsert(chunk, {
          onConflict: 'ListNumber',
          ignoreDuplicates: options?.insertOnly === true,
        })
        if (error && /statement timeout|timeout/i.test(error.message) && chunk.length > UPSERT_CHUNK_SIZE_RETRY) {
          for (let j = 0; j < chunk.length; j += UPSERT_CHUNK_SIZE_RETRY) {
            const sub = chunk.slice(j, j + UPSERT_CHUNK_SIZE_RETRY)
            const r = await supabase.from('listings').upsert(sub, {
              onConflict: 'ListNumber',
              ignoreDuplicates: options?.insertOnly === true,
            })
            if (!r.error) totalUpserted += sub.length
            else console.error('Supabase upsert error (sub-chunk):', r.error.message)
          }
        } else if (!error) {
          totalUpserted += chunk.length
        } else {
          console.error('Supabase upsert error:', error.message)
        }
      }

      pagesProcessed += 1
      currentPage += 1
    }

    const done = currentPage > totalPages || pagesProcessed >= maxPages
    if (done && totalUpserted > 0) {
      await supabase.from('sync_state').upsert(
        { id: 'default', last_full_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    }
    return {
      success: true,
      message: done
        ? `Sync complete. ${totalUpserted} listings upserted (${totalFetched} fetched, ${pagesProcessed} pages).`
        : `Chunk done. ${totalUpserted} upserted this run (${totalFetched} fetched, ${pagesProcessed} pages).`,
      totalFetched,
      totalUpserted,
      pagesProcessed,
      totalPagesFromSpark: totalPages,
      nextPage: currentPage,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Sync failed: ${message}`,
      totalFetched,
      totalUpserted,
      pagesProcessed,
      totalPagesFromSpark: totalPages,
      nextPage: currentPage,
      error: message,
    }
  }
}

/**
 * Delta sync: fetch only listings changed since last_delta_sync_at. Emits activity_events for status/price changes.
 * Run on a 15–30 min cron. On first run (no last_delta_sync_at) uses 24h ago. Updates sync_state only on success.
 */
export async function syncSparkListingsDelta(options?: {
  maxPages?: number
  pageSize?: number
}): Promise<SyncDeltaResult> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { success: false, message: 'SPARK_API_KEY is not set.', error: 'Missing SPARK_API_KEY' }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return {
      success: false,
      message: 'Supabase not configured.',
      error: 'Missing Supabase env vars',
    }
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const maxPages = options?.maxPages ?? 50
  const pageSize = options?.pageSize ?? 100

  let sinceIso: string
  const { data: stateRow } = await supabase.from('sync_state').select('last_delta_sync_at').eq('id', 'default').maybeSingle()
  const lastAt = (stateRow as { last_delta_sync_at?: string | null } | null)?.last_delta_sync_at
  if (lastAt) {
    sinceIso = lastAt
  } else {
    const t = new Date(Date.now() - 24 * 60 * 60 * 1000)
    sinceIso = t.toISOString()
  }
  const filter = `ModificationTimestamp gt '${sinceIso.replace(/'/g, "''")}'`

  let totalFetched = 0
  let totalUpserted = 0
  let eventsEmitted = 0
  let pagesProcessed = 0
  let currentPage = 1
  let totalPages = 1

  try {
    while (currentPage <= totalPages && pagesProcessed < maxPages) {
      const response = await fetchSparkListingsPage(accessToken, {
        page: currentPage,
        limit: pageSize,
        filter,
        orderby: '+ModificationTimestamp',
        expand: SYNC_EXPAND,
      })
      const D = response.D
      if (!D?.Success || !D.Results?.length) {
        if (pagesProcessed === 0) {
          await supabase.from('sync_state').upsert(
            { id: 'default', last_delta_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          )
          return {
            success: true,
            message: 'Delta sync: no changes since last run.',
            totalFetched: 0,
            totalUpserted: 0,
            eventsEmitted: 0,
            pagesProcessed: 0,
          }
        }
        break
      }
      if (D.Pagination) totalPages = D.Pagination.TotalPages
      const rows = D.Results.map(sparkListingToSupabaseRow) as Array<{
        ListNumber?: string
        ListingKey?: string
        StandardStatus?: string | null
        ListPrice?: number | null
        [k: string]: unknown
      }>
      const listNumbers = rows.map((r) => r.ListNumber).filter(Boolean) as string[]
      const { data: existingRows } = await supabase
        .from('listings')
        .select('ListNumber, StandardStatus, ListPrice')
        .in('ListNumber', listNumbers)
      const existingByNum = new Map<string, { StandardStatus?: string | null; ListPrice?: number | null }>()
      for (const r of existingRows ?? []) {
        const row = r as { ListNumber?: string; StandardStatus?: string | null; ListPrice?: number | null }
        if (row.ListNumber) existingByNum.set(row.ListNumber, { StandardStatus: row.StandardStatus, ListPrice: row.ListPrice })
      }

      for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
        const { error } = await supabase.from('listings').upsert(chunk, { onConflict: 'ListNumber' })
        if (!error) totalUpserted += chunk.length
      }

      const nowIso = new Date().toISOString()
      for (const row of rows) {
        const listNumber = (row.ListNumber ?? '').toString()
        const listingKey = (row.ListingKey ?? row.ListNumber ?? '').toString()
        if (!listNumber) continue
        const existing = existingByNum.get(listNumber)
        const status = (row.StandardStatus ?? '').toString().toLowerCase()
        const isPending = /pending/i.test(status)
        const isClosed = /closed/i.test(status)
        const newPrice = typeof row.ListPrice === 'number' && !Number.isNaN(row.ListPrice) ? row.ListPrice : null

        if (!existing) {
          const { error: evErr } = await supabase.from('activity_events').insert({
            listing_key: listingKey,
            event_type: ACTIVITY_NEW_LISTING,
            event_at: nowIso,
            payload: { ListNumber: listNumber, City: row.City, SubdivisionName: row.SubdivisionName },
          })
          if (!evErr) eventsEmitted++
        } else {
          const oldStatus = (existing.StandardStatus ?? '').toString().toLowerCase()
          const oldPending = /pending/i.test(oldStatus)
          const oldClosed = /closed/i.test(oldStatus)
          const oldPrice = existing.ListPrice != null && !Number.isNaN(Number(existing.ListPrice)) ? Number(existing.ListPrice) : null
          if (!oldPending && isPending) {
            const { error: evErr } = await supabase.from('activity_events').insert({
              listing_key: listingKey,
              event_type: ACTIVITY_STATUS_PENDING,
              event_at: nowIso,
              payload: { ListNumber: listNumber },
            })
            if (!evErr) eventsEmitted++
          }
          if (!oldClosed && isClosed) {
            const { error: evErr } = await supabase.from('activity_events').insert({
              listing_key: listingKey,
              event_type: ACTIVITY_STATUS_CLOSED,
              event_at: nowIso,
              payload: { ListNumber: listNumber, ListPrice: newPrice },
            })
            if (!evErr) eventsEmitted++
            await supabase.from('listings').update({ media_finalized: true }).eq('ListNumber', listNumber)
          }
          if (newPrice != null && oldPrice != null && newPrice < oldPrice) {
            const { error: evErr } = await supabase.from('activity_events').insert({
              listing_key: listingKey,
              event_type: ACTIVITY_PRICE_DROP,
              event_at: nowIso,
              payload: { ListNumber: listNumber, previous_price: oldPrice, new_price: newPrice },
            })
            if (!evErr) eventsEmitted++
          }
        }
      }

      totalFetched += rows.length
      pagesProcessed += 1
      currentPage += 1
    }

    await supabase.from('sync_state').upsert(
      { id: 'default', last_delta_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    return {
      success: true,
      message: `Delta sync done. ${totalUpserted} updated, ${eventsEmitted} events.`,
      totalFetched,
      totalUpserted,
      eventsEmitted,
      pagesProcessed,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Delta sync failed: ${message}`,
      totalFetched,
      totalUpserted,
      eventsEmitted,
      pagesProcessed,
      error: message,
    }
  }
}

export type SyncPhotosResult = {
  success: boolean
  message: string
  /** Listings fetched from Spark in this run */
  totalFetched?: number
  /** Listings updated (PhotoURL/details) in Supabase */
  totalUpdated?: number
  pagesProcessed?: number
  totalPagesFromSpark?: number
  nextPage?: number
  error?: string
}

/**
 * Sync only photos (and full details including Photos) from Spark into existing Supabase listings.
 * Fetches listing pages from Spark with Photos expand, then updates only PhotoURL and details for each ListNumber.
 * Use this to refresh photos or backfill higher-res URLs without re-syncing all listing data.
 */
export async function syncPhotosOnly(options?: {
  maxPages?: number
  pageSize?: number
  startPage?: number
}): Promise<SyncPhotosResult> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { success: false, message: 'SPARK_API_KEY is not set.', error: 'Missing SPARK_API_KEY' }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return {
      success: false,
      message: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
      error: 'Missing Supabase env vars',
    }
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const maxPages = options?.maxPages ?? 999
  const pageSize = options?.pageSize ?? 100
  let currentPage = Math.max(1, options?.startPage ?? 1)
  let totalPages = currentPage
  let totalFetched = 0
  let totalUpdated = 0
  let pagesProcessed = 0

  try {
    while (currentPage <= totalPages && pagesProcessed < maxPages) {
      const response = await fetchSparkListingsPage(accessToken, {
        page: currentPage,
        limit: pageSize,
        expand: SYNC_EXPAND,
        orderby: '+OnMarketDate',
      })

      const D = response.D
      if (!D?.Success || !D.Results?.length) {
        if (pagesProcessed === 0) {
          return {
            success: true,
            message: 'No listings returned from Spark.',
            totalFetched: 0,
            totalUpdated: 0,
            pagesProcessed: 0,
            totalPagesFromSpark: totalPages,
            nextPage: currentPage,
          }
        }
        break
      }

      const pagination = D.Pagination
      if (pagination) totalPages = pagination.TotalPages

      const results = D.Results as Parameters<typeof sparkListingToSupabaseRow>[0][]
      totalFetched += results.length

      const updateResults = await Promise.all(
        results.map(async (result) => {
          const row = sparkListingToSupabaseRow(result) as Record<string, unknown>
          const listNumber = row.ListNumber
          if (listNumber == null || listNumber === '') return false
          const { error } = await supabase
            .from('listings')
            .update({
              PhotoURL: row.PhotoURL ?? null,
              details: row.details ?? null,
            })
            .eq('ListNumber', listNumber)
          return !error
        })
      )
      totalUpdated += updateResults.filter(Boolean).length

      pagesProcessed += 1
      currentPage += 1
    }

    const done = currentPage > totalPages || pagesProcessed >= maxPages
    return {
      success: true,
      message: done
        ? `Photos sync complete. ${totalUpdated} listings updated (${totalFetched} fetched, ${pagesProcessed} pages).`
        : `Chunk done. ${totalUpdated} updated this run (${totalFetched} fetched, ${pagesProcessed} pages).`,
      totalFetched,
      totalUpdated,
      pagesProcessed,
      totalPagesFromSpark: totalPages,
      nextPage: currentPage,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Photos sync failed: ${message}`,
      totalFetched,
      totalUpdated,
      pagesProcessed,
      totalPagesFromSpark: totalPages,
      nextPage: currentPage,
      error: message,
    }
  }
}

export type SyncHistoryResult = {
  success: boolean
  message: string
  /** Number of listings we fetched history for */
  listingsProcessed?: number
  /** Total history rows upserted */
  historyRowsUpserted?: number
  /** How many of those listings had at least one history item from Spark */
  listingsWithHistory?: number
  /** Next offset to continue (if batch limit reached) */
  nextOffset?: number
  /** Total listing count in DB (for progress) */
  totalListings?: number
  error?: string
  /** Hint when Spark returns no history (e.g. MLS may not support history API) */
  sparkHint?: string
  /** First insert error message if any */
  insertError?: string
}

/**
 * Backfill listing_history from Spark API. Fetches history for each listing and upserts into Supabase.
 * Run after listing sync so CMAs and reports can use list date, price changes, last sale without calling the API.
 * Uses batches to avoid timeouts; pass offset to continue.
 *
 * Smart retry: we include every listing with history_finalized = false. So even if we have the listing
 * but no history yet (e.g. API key lacked history access), we keep attempting to sync history on every run.
 * A listing is only marked history_finalized when we successfully store at least one history row (and it's
 * closed); until then it stays in the pool so you can get history later when access is granted.
 */
export async function syncListingHistory(options?: {
  /** Max listings to process in this run (default 50) */
  limit?: number
  /** Start at this listing offset (0-based). Use nextOffset from previous run to continue. */
  offset?: number
}): Promise<SyncHistoryResult> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { success: false, message: 'SPARK_API_KEY is not set.', error: 'Missing SPARK_API_KEY' }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return {
      success: false,
      message: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      error: 'Missing Supabase env vars',
    }
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const limit = Math.min(options?.limit ?? 50, 200)
  const offset = Math.max(0, options?.offset ?? 0)

  try {
    // Include every listing that doesn't have history finalized yet — we keep retrying until we get history (e.g. when you get access later).
    const { count: needSyncCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('history_finalized', false)
    const totalListings = needSyncCount ?? 0
    const { data: rows } = await supabase
      .from('listings')
      .select('ListingKey, ListNumber, StandardStatus')
      .eq('history_finalized', false)
      .order('ListNumber', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)
    const listingRows = (rows ?? []) as {
      ListingKey?: string | null
      ListNumber?: string | null
      StandardStatus?: string | null
    }[]
    if (listingRows.length === 0) {
      return {
        success: true,
        message: offset === 0 ? 'No listings to sync history for.' : `No more listings at offset ${offset}.`,
        listingsProcessed: 0,
        historyRowsUpserted: 0,
        nextOffset: offset,
        totalListings,
      }
    }

    let historyRowsUpserted = 0
    let listingsWithHistory = 0
    let firstInsertError: string | undefined
    for (const row of listingRows) {
      const key1 = (row.ListingKey ?? '').toString().trim()
      const key2 = (row.ListNumber ?? '').toString().trim()
      const keysToTry = [...new Set([key1, key2].filter((k) => k.length > 0))]
      if (keysToTry.length === 0) continue

      let items: Awaited<ReturnType<typeof fetchSparkListingHistory>>['items'] = []
      for (const key of keysToTry) {
        const result = await fetchSparkListingHistory(accessToken, key)
        if (result.ok && result.items.length > 0) {
          items = result.items
          break
        }
        if (result.ok) items = result.items
      }
      if (items.length === 0) {
        for (const key of keysToTry) {
          const result = await fetchSparkPriceHistory(accessToken, key)
          if (result.ok && result.items.length > 0) {
            items = result.items
            break
          }
          if (result.ok) items = result.items
        }
      }

      const listingKey = keysToTry[0]!
      await supabase.from('listing_history').delete().eq('listing_key', listingKey)
      if (items.length > 0) {
        listingsWithHistory += 1
        const historyRows = items.map((item) => sparkHistoryItemToRow(listingKey, item))
        const { error } = await supabase.from('listing_history').insert(historyRows)
        if (!error) {
          historyRowsUpserted += historyRows.length
          // Only mark history_finalized when we actually stored history. Never finalize when we got no history —
          // so we keep retrying when you get history access later (e.g. Private role).
          const status = (row.StandardStatus ?? '').toString().toLowerCase()
          if (status.includes('closed') && row.ListNumber) {
            await supabase
              .from('listings')
              .update({ history_finalized: true, is_finalized: true })
              .eq('ListNumber', row.ListNumber)
          }
        } else if (!firstInsertError) {
          firstInsertError = error.message
        }
      }
      // When items.length === 0 we do not set history_finalized — listing stays in the pool for the next run.
    }

    const nextOffset = offset + listingRows.length
    const done = nextOffset >= totalListings
    let sparkHint: string | undefined
    if (listingsWithHistory === 0 && listingRows.length > 0) {
      sparkHint =
        'Spark returned no history for any listing in this batch (we tried both /history and /historical/pricehistory). Your API key role may be IDX/VOW/Portal (condensed only); Private role sees full history. Or the MLS may not expose history for these listings. Use "Test listing history API" below to verify.'
    }
    return {
      success: true,
      message: done
        ? `History sync complete. ${listingRows.length} listings processed, ${listingsWithHistory} with history, ${historyRowsUpserted} rows stored.`
        : `Batch done. ${listingRows.length} processed, ${listingsWithHistory} with history, ${historyRowsUpserted} rows. Offset ${nextOffset} next.`,
      listingsProcessed: listingRows.length,
      historyRowsUpserted,
      listingsWithHistory,
      nextOffset: done ? undefined : nextOffset,
      totalListings,
      sparkHint,
      insertError: firstInsertError,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `History sync failed: ${message}`,
      error: message,
    }
  }
}

export type TestListingHistoryResult = {
  ok: boolean
  listingKey: string | null
  /** GET /listings/{id}/history — status/event changes on this listing */
  history: { items: number; ok: boolean; status?: number; sampleEvent?: Record<string, unknown>; errorBody?: string }
  /** GET /listings/{id}/historical/pricehistory — price timeline */
  priceHistory: { items: number; ok: boolean; status?: number; sampleEvent?: Record<string, unknown>; errorBody?: string }
  /** GET /listings/{id}/historical — off-market listings for same property */
  historical: { count: number; ok: boolean; status?: number; errorBody?: string }
  message: string
}

/**
 * Test Spark history APIs for one listing. Use to verify endpoints and API role (Private vs IDX/VOW).
 * If listingKey is omitted, uses the first listing from Supabase (by ListNumber).
 */
export async function testListingHistory(listingKey?: string | null): Promise<TestListingHistoryResult> {
  const accessToken = process.env.SPARK_API_KEY
  const emptyHistorical = { count: 0, ok: false as const }
  if (!accessToken?.trim()) {
    return {
      ok: false,
      listingKey: null,
      history: { items: 0, ok: false },
      priceHistory: { items: 0, ok: false },
      historical: emptyHistorical,
      message: 'SPARK_API_KEY is not set.',
    }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let keyToUse = (listingKey ?? '').trim()
  if (!keyToUse && supabaseUrl?.trim() && serviceKey?.trim()) {
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase
      .from('listings')
      .select('ListingKey, ListNumber')
      .order('ListNumber', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    const row = data as { ListingKey?: string; ListNumber?: string } | null
    keyToUse = (row?.ListingKey ?? row?.ListNumber ?? '').toString().trim()
  }
  if (!keyToUse) {
    return {
      ok: false,
      listingKey: null,
      history: { items: 0, ok: false },
      priceHistory: { items: 0, ok: false },
      historical: emptyHistorical,
      message: 'No listing key provided and no listings in DB. Run a listing sync first or pass a ListingKey/ListNumber.',
    }
  }

  const [historyRes, priceHistoryRes, historicalRes] = await Promise.all([
    fetchSparkListingHistory(accessToken, keyToUse),
    fetchSparkPriceHistory(accessToken, keyToUse),
    fetchSparkHistoricalListings(accessToken, keyToUse),
  ])

  const historySample = historyRes.items[0] as Record<string, unknown> | undefined
  const priceHistorySample = priceHistoryRes.items[0] as Record<string, unknown> | undefined

  const SPARK_HISTORY_DOC = 'https://sparkplatform.com/docs/api_services/listings/history'
  const SPARK_HISTORICAL_DOC = 'https://sparkplatform.com/docs/api_services/listings/historical'
  let message = `Listing: ${keyToUse}. `
  const parts: string[] = []
  if (historyRes.ok) parts.push(`History: ${historyRes.items.length} events`)
  else parts.push(`/history → ${historyRes.status ?? 'error'}`)
  if (priceHistoryRes.ok) parts.push(`Price history: ${priceHistoryRes.items.length} events`)
  else parts.push(`/pricehistory → ${priceHistoryRes.status ?? 'error'}`)
  if (historicalRes.ok) parts.push(`Historical: ${historicalRes.listings.length} off-market`)
  else parts.push(`/historical → ${historicalRes.status ?? 'error'}`)
  message += parts.join('. ')
  if (historyRes.items.length === 0 && priceHistoryRes.items.length === 0 && !historicalRes.ok) {
    message += ` See ${SPARK_HISTORY_DOC} and ${SPARK_HISTORICAL_DOC}.`
  }

  return {
    ok: historyRes.ok && priceHistoryRes.ok && historicalRes.ok,
    listingKey: keyToUse,
    history: {
      items: historyRes.items.length,
      ok: historyRes.ok,
      status: historyRes.status,
      sampleEvent: historySample,
      errorBody: historyRes.errorBody,
    },
    priceHistory: {
      items: priceHistoryRes.items.length,
      ok: priceHistoryRes.ok,
      status: priceHistoryRes.status,
      sampleEvent: priceHistorySample,
      errorBody: priceHistoryRes.errorBody,
    },
    historical: {
      count: historicalRes.listings.length,
      ok: historicalRes.ok,
      status: historicalRes.status,
      errorBody: historicalRes.errorBody,
    },
    message,
  }
}
