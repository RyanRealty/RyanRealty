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
import { fetchListings, SPARK_SELECT_FIELDS } from '@/lib/spark-odata'
import type { SparkListing } from '@/lib/spark-odata'
import { processSparkListing } from '@/lib/listing-processor'
import * as Sentry from '@sentry/nextjs'

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

function isLikelyVideoUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.webm') || u.includes('video')
}

async function syncListingVideosForRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const sb = supabase
  for (const row of rows) {
    const listingKey = String(row.ListingKey ?? '').trim()
    if (!listingKey) continue
    const details = (row.details ?? null) as { Videos?: unknown } | null
    const videos = Array.isArray(details?.Videos) ? details.Videos : []
    await sb.from('listing_videos').delete().eq('listing_key', listingKey)
    if (videos.length === 0) continue
    const videoRows = videos
      .map((item, index) => {
        const record = item as { Uri?: string; URL?: string; Url?: string; Order?: number } | null
        if (!record) return null
        const videoUrl = (record.Uri ?? record.URL ?? record.Url ?? '').trim()
        if (!videoUrl || !isLikelyVideoUrl(videoUrl)) return null
        return {
          listing_key: listingKey,
          video_url: videoUrl,
          sort_order: Number.isFinite(record.Order) ? Number(record.Order) : index,
          source: 'spark',
        }
      })
      .filter((video): video is { listing_key: string; video_url: string; sort_order: number; source: string } => video != null)
    if (videoRows.length > 0) {
      await sb.from('listing_videos').insert(videoRows)
    }
  }
}

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
        const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
        const { error } = await supabase.from('listings').upsert(chunk, {
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
            if (!r.error) {
              totalUpserted += sub.length
              await syncListingVideosForRows(supabase, sub as Array<Record<string, unknown>>)
            }
            else console.error('Supabase upsert error (sub-chunk):', r.error.message)
          }
        } else if (!error) {
          totalUpserted += chunk.length
          await syncListingVideosForRows(supabase, chunk as Array<Record<string, unknown>>)
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

/** OData filter: Active, Pending, Active Under Contract only (RESO StandardStatus). */
const ACTIVE_PENDING_ODATA_FILTER =
  "(StandardStatus eq 'Active' or StandardStatus eq 'Pending' or StandardStatus eq 'ActiveUnderContract')"

const REFRESH_ACTIVE_PENDING_PAGE_SIZE = 500
const ACTIVE_PENDING_LISTING_CONCURRENCY = Math.max(
  1,
  Math.min(32, Number(process.env.SYNC_ACTIVE_PENDING_CONCURRENCY ?? 16))
)

export type SyncActivePendingResult = {
  success: boolean
  message: string
  totalFetched?: number
  totalUpserted?: number
  error?: string
}

/** Result of running one page of active/pending refresh (for chunked, abortable UI). */
export type RunOnePageActivePendingResult = {
  success: boolean
  totalFetched: number
  totalUpserted: number
  /** Next state: null = done, URL = OData next, 'v1' = v1 mode (use nextListingPage). */
  nextUrl: string | null
  /** For v1 mode: next page number to fetch (1-based). */
  nextListingPage: number
  /** For v1 mode: total pages. */
  totalListingPages: number | null
  hasMore: boolean
  message: string
  error?: string
}

async function processActivePendingRecords(
  records: SparkListing[],
  listingConcurrency: number
): Promise<number> {
  if (records.length === 0) return 0
  const workerCount = Math.max(1, Math.min(listingConcurrency, records.length))
  let cursor = 0
  let upserted = 0

  const worker = async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= records.length) break
      const record = records[index]
      if (!record) continue
      try {
        await processSparkListing(record)
        upserted += 1
      } catch (e) {
        Sentry.captureException(e, { extra: { listingKey: record.ListingKey } })
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return upserted
}

/**
 * Run one page of active/pending refresh. Used by sync cursor for chunked, abortable runs.
 * State: refreshNextUrl (null | URL | 'v1'), nextListingPage (v1 page when in v1 mode).
 */
export async function runOnePageActivePendingSync(state: {
  refreshNextUrl: string | null
  nextListingPage: number
}): Promise<RunOnePageActivePendingResult> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return {
      success: false,
      totalFetched: 0,
      totalUpserted: 0,
      nextUrl: null,
      nextListingPage: 1,
      totalListingPages: null,
      hasMore: false,
      message: 'SPARK_API_KEY is not set.',
      error: 'Missing SPARK_API_KEY',
    }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return {
      success: false,
      totalFetched: 0,
      totalUpserted: 0,
      nextUrl: null,
      nextListingPage: 1,
      totalListingPages: null,
      hasMore: false,
      message: 'Supabase not configured.',
      error: 'Missing Supabase env vars',
    }
  }

  let totalFetched = 0
  let totalUpserted = 0
  const { refreshNextUrl, nextListingPage: v1Page } = state

  try {
    // First page: try OData
    if (refreshNextUrl === null || refreshNextUrl === '') {
      const result = await fetchListings({
        top: REFRESH_ACTIVE_PENDING_PAGE_SIZE,
        filter: ACTIVE_PENDING_ODATA_FILTER,
        select: SPARK_SELECT_FIELDS,
        expand: 'Media',
        orderby: 'ModificationTimestamp asc',
      })
      const records = result.records
      totalFetched = records.length
      totalUpserted += await processActivePendingRecords(records, ACTIVE_PENDING_LISTING_CONCURRENCY)
      const next = result.nextUrl
      if (next) {
        return {
          success: true,
          totalFetched,
          totalUpserted,
          nextUrl: next,
          nextListingPage: 1,
          totalListingPages: null,
          hasMore: true,
          message: `OData: ${totalUpserted} upserted this page.`,
        }
      }
      if (totalFetched > 0) {
        return {
          success: true,
          totalFetched,
          totalUpserted,
          nextUrl: null,
          nextListingPage: 1,
          totalListingPages: null,
          hasMore: false,
          message: `Done. ${totalUpserted} listings upserted (${totalFetched} fetched).`,
        }
      }
      // OData returned 0: try v1 first page
      const response = await fetchSparkListingsPage(accessToken, {
        page: 1,
        limit: Math.min(REFRESH_ACTIVE_PENDING_PAGE_SIZE, 100),
        filter: ACTIVE_PENDING_ODATA_FILTER,
        orderby: 'ModificationTimestamp',
      })
      const D = response.D
      const results = D?.Results ?? []
      const pagination = D?.Pagination
      totalFetched = results.length
      const mapped = results
        .map((item) => {
          const sf = item.StandardFields
          const listingKey = sf?.ListingKey ?? item.Id
          if (!listingKey) return null
          return { ...sf, ListingKey: listingKey } as SparkListing
        })
        .filter((item): item is SparkListing => item != null)
      totalUpserted += await processActivePendingRecords(mapped, ACTIVE_PENDING_LISTING_CONCURRENCY)
      const totalPages = pagination?.TotalPages ?? 0
      const hasMore = totalPages > 1
      return {
        success: true,
        totalFetched,
        totalUpserted,
        nextUrl: hasMore ? 'v1' : null,
        nextListingPage: 2,
        totalListingPages: totalPages || null,
        hasMore,
        message: `V1: ${totalUpserted} upserted this page${hasMore ? ` (page 1 of ${totalPages})` : ''}.`,
      }
    }

    // OData next page
    if (refreshNextUrl !== 'v1') {
      const result = await fetchListings({ nextUrl: refreshNextUrl })
      const records = result.records
      totalFetched = records.length
      totalUpserted += await processActivePendingRecords(records, ACTIVE_PENDING_LISTING_CONCURRENCY)
      const next = result.nextUrl
      return {
        success: true,
        totalFetched,
        totalUpserted,
        nextUrl: next,
        nextListingPage: 1,
        totalListingPages: null,
        hasMore: !!next,
        message: `OData: ${totalUpserted} upserted this page.`,
      }
    }

    // V1 next page
    const response = await fetchSparkListingsPage(accessToken, {
      page: v1Page,
      limit: Math.min(REFRESH_ACTIVE_PENDING_PAGE_SIZE, 100),
      filter: ACTIVE_PENDING_ODATA_FILTER,
      orderby: 'ModificationTimestamp',
    })
    const D = response.D
    const results = D?.Results ?? []
    const pagination = D?.Pagination
    totalFetched = results.length
    const mapped = results
      .map((item) => {
        const sf = item.StandardFields
        const listingKey = sf?.ListingKey ?? item.Id
        if (!listingKey) return null
        return { ...sf, ListingKey: listingKey } as SparkListing
      })
      .filter((item): item is SparkListing => item != null)
    totalUpserted += await processActivePendingRecords(mapped, ACTIVE_PENDING_LISTING_CONCURRENCY)
    const totalPages = pagination?.TotalPages ?? 0
    const hasMore = v1Page < totalPages
    return {
      success: true,
      totalFetched,
      totalUpserted,
      nextUrl: hasMore ? 'v1' : null,
      nextListingPage: v1Page + 1,
      totalListingPages: totalPages || null,
      hasMore,
      message: `V1: ${totalUpserted} upserted (page ${v1Page} of ${totalPages}).`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      totalFetched: 0,
      totalUpserted: 0,
      nextUrl: null,
      nextListingPage: 1,
      totalListingPages: null,
      hasMore: false,
      message: `Refresh failed: ${message}`,
      error: message,
    }
  }
}

/**
 * Refresh only active and pending (and under contract) listings from Spark.
 * Fetches all such listings via OData filter and upserts via processSparkListing (same as delta ingest).
 * Use when you want the most current active/pending set without running a full sync.
 * After this, run "Run all active listing histories" (section 4) to get history for status/date (active, pending, withdrawn, etc.).
 */
export async function syncSparkListingsActiveAndPending(): Promise<SyncActivePendingResult> {
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

  let totalFetched = 0
  let totalUpserted = 0
  let nextUrl: string | null = null

  try {
    let result = await fetchListings({
      top: REFRESH_ACTIVE_PENDING_PAGE_SIZE,
      filter: ACTIVE_PENDING_ODATA_FILTER,
      select: SPARK_SELECT_FIELDS,
      expand: 'Media',
      orderby: 'ModificationTimestamp asc',
    })

    for (;;) {
      const records = result.records
      totalFetched += records.length
      totalUpserted += await processActivePendingRecords(records, ACTIVE_PENDING_LISTING_CONCURRENCY)

      nextUrl = result.nextUrl
      if (!nextUrl) break

      result = await fetchListings({ nextUrl })
    }

    // If OData returned nothing (e.g. SPARK_API_BASE_URL points at v1/replication), try v1 API.
    if (totalFetched === 0) {
      const v1PageSize = Math.min(REFRESH_ACTIVE_PENDING_PAGE_SIZE, 100)
      let page = 1
      let hasMore = true
      while (hasMore) {
        const response = await fetchSparkListingsPage(accessToken, {
          page,
          limit: v1PageSize,
          filter: ACTIVE_PENDING_ODATA_FILTER,
          orderby: 'ModificationTimestamp',
        })
        const D = response.D
        const results = D?.Results ?? []
        const pagination = D?.Pagination

        totalFetched += results.length
        const mapped = results
          .map((item) => {
            const sf = item.StandardFields
            const listingKey = sf?.ListingKey ?? item.Id
            if (!listingKey) return null
            return { ...sf, ListingKey: listingKey } as SparkListing
          })
          .filter((item): item is SparkListing => item != null)
        totalUpserted += await processActivePendingRecords(mapped, ACTIVE_PENDING_LISTING_CONCURRENCY)

        if (!pagination || pagination.CurrentPage >= pagination.TotalPages || results.length === 0) {
          hasMore = false
        } else {
          page += 1
        }
      }
    }

    const message =
      totalFetched === 0
        ? 'No listings returned from Spark. Your Spark key may use the v1 API only — the OData Property endpoint (SPARK_API_BASE_URL) may need to point to the OData base (e.g. https://sparkapi.com/Reso/OData). Or run a full sync instead.'
        : `Refreshed active & pending: ${totalUpserted} listings upserted (${totalFetched} fetched).`
    return {
      success: true,
      message,
      totalFetched,
      totalUpserted,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `Refresh active & pending failed: ${message}`,
      totalFetched,
      totalUpserted,
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
  /** If set, sync only listings modified after this ISO date. Otherwise use last_delta_sync_at from sync_state (or 24h ago). */
  sinceOverride?: string
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
  if (options?.sinceOverride) {
    sinceIso = options.sinceOverride
  } else {
    const { data: stateRow } = await supabase.from('sync_state').select('last_delta_sync_at').eq('id', 'default').maybeSingle()
    const lastAt = (stateRow as { last_delta_sync_at?: string | null } | null)?.last_delta_sync_at
    if (lastAt) {
      sinceIso = lastAt
    } else {
      const t = new Date(Date.now() - 24 * 60 * 60 * 1000)
      sinceIso = t.toISOString()
    }
  }
  // SparkQL: datetime literals must be unquoted (per Spark API docs; quotes cause 1040 syntax error)
  const filter = `ModificationTimestamp Gt ${sinceIso.trim()}`

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

function stableShardForKey(key: string, shardCount: number): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const v = (h >>> 0)
  return v % shardCount
}

/** Supabase .or() for active + pending only (excludes closed/expired/withdrawn/canceled). Use when syncing history only for active/pending. */
const ACTIVE_OR_PENDING_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%'

/** Terminal statuses: we do not re-fetch listing data from Spark, but we can backfill history. Used when activeAndPendingOnly is false. */
const TERMINAL_STATUS_OR =
  'StandardStatus.ilike.%Closed%,StandardStatus.ilike.%Expired%,StandardStatus.ilike.%Withdrawn%,StandardStatus.ilike.%Cancel%'

function buildTerminalScopedStatusOr(params: {
  fromIso?: string | null
  toIsoExclusive?: string | null
  cutoffIso?: string | null
}): string {
  const { fromIso, toIsoExclusive, cutoffIso } = params
  const modRangeOps = (() => {
    if (fromIso && toIsoExclusive) return `gte.${fromIso},ModificationTimestamp.lt.${toIsoExclusive}`
    if (cutoffIso) return `gte.${cutoffIso}`
    return ''
  })()
  const listRangeOps = (() => {
    if (fromIso && toIsoExclusive) return `gte.${fromIso},ListDate.lt.${toIsoExclusive}`
    if (cutoffIso) return `gte.${cutoffIso}`
    return ''
  })()
  const onMarketRangeOps = (() => {
    if (fromIso && toIsoExclusive) return `gte.${fromIso},OnMarketDate.lt.${toIsoExclusive}`
    if (cutoffIso) return `gte.${cutoffIso}`
    return ''
  })()
  const closeRangeOps = (() => {
    if (fromIso && toIsoExclusive) return `gte.${fromIso},CloseDate.lt.${toIsoExclusive}`
    if (cutoffIso) return `gte.${cutoffIso}`
    return ''
  })()
  if (!modRangeOps && !closeRangeOps && !listRangeOps && !onMarketRangeOps) return TERMINAL_STATUS_OR
  const nonClosedTerms = (status: 'Expired' | 'Withdrawn' | 'Cancel') => [
    `and(StandardStatus.ilike.%${status}%,ListDate.${listRangeOps})`,
    `and(StandardStatus.ilike.%${status}%,ListDate.is.null,OnMarketDate.${onMarketRangeOps})`,
    `and(StandardStatus.ilike.%${status}%,ListDate.is.null,OnMarketDate.is.null,ModificationTimestamp.${modRangeOps})`,
  ]
  return [
    `and(StandardStatus.ilike.%Closed%,CloseDate.${closeRangeOps})`,
    `and(StandardStatus.ilike.%Closed%,CloseDate.is.null,ModificationTimestamp.${modRangeOps})`,
    ...nonClosedTerms('Expired'),
    ...nonClosedTerms('Withdrawn'),
    ...nonClosedTerms('Cancel'),
  ].join(',')
}

function isTerminalStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').toLowerCase()
  return /closed/.test(t) || /expired/.test(t) || /withdrawn/.test(t) || /cancel/.test(t)
}

function inIsoRange(raw: string | null | undefined, fromIso?: string | null, toIsoExclusive?: string | null): boolean {
  if (!raw) return false
  if (fromIso && raw < fromIso) return false
  if (toIsoExclusive && raw >= toIsoExclusive) return false
  return true
}

function isTerminalRowInScope(
  row: {
    StandardStatus?: string | null
    CloseDate?: string | null
    ListDate?: string | null
    OnMarketDate?: string | null
    ModificationTimestamp?: string | null
  },
  params: { fromIso?: string | null; toIsoExclusive?: string | null; cutoffIso?: string | null }
): boolean {
  const status = String(row.StandardStatus ?? '').toLowerCase()
  const { fromIso, toIsoExclusive, cutoffIso } = params
  if (!isTerminalStatus(status)) return false
  if (!fromIso && !toIsoExclusive && !cutoffIso) return true

  const closedDate = row.CloseDate ?? row.ModificationTimestamp ?? null
  const nonClosedDate = row.ListDate ?? row.OnMarketDate ?? row.ModificationTimestamp ?? null
  const targetDate = status.includes('closed') ? closedDate : nonClosedDate
  if (!targetDate) return false

  if (fromIso || toIsoExclusive) {
    return inIsoRange(targetDate, fromIso, toIsoExclusive)
  }
  if (cutoffIso) return targetDate >= cutoffIso
  return true
}

function formatDbError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '')
  const e = error as { message?: string; details?: string; hint?: string; code?: string }
  const text = [e.message, e.details, e.hint, e.code].filter(Boolean).join(' | ').trim()
  return text || 'Unknown database error'
}

/**
 * Backfill listing_history from Spark API. Fetches history for each listing and upserts into Supabase.
 * Run after listing sync so CMAs and reports can use list date, price changes, last sale without calling the API.
 * Uses batches to avoid timeouts; pass offset to continue.
 *
 * When activeAndPendingOnly is true (default), only listings that are active or pending are included.
 * When false (Backfill closed), only listings that are closed, expired, withdrawn, or canceled are included.
 * We do not re-fetch listing data for those terminal statuses; we only backfill their history.
 *
 * A terminal listing is marked history_finalized when history fetch succeeds for that listing,
 * even when Spark returns zero events, so it is not retried forever.
 */
export async function syncListingHistory(options?: {
  /** Max listings to process in this run (default 50) */
  limit?: number
  /** Start at this listing offset (0-based). Use nextOffset from previous run to continue. */
  offset?: number
  /** When true (default), only sync history for active and pending listings; skip closed. Set false to include closed. */
  activeAndPendingOnly?: boolean
  /** Optional worker sharding for terminal backfills. Use with activeAndPendingOnly=false. */
  workerCount?: number
  workerIndex?: number
  /** Terminal-only lookback window in years. 0 = no lookback limit. */
  terminalLookbackYears?: number
  /** Terminal-only from year (inclusive). Overrides lookback when provided. */
  terminalFromYear?: number
  /** Terminal-only to year (inclusive). Overrides lookback when provided. */
  terminalToYear?: number
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
  const activeAndPendingOnly = options?.activeAndPendingOnly !== false
  const workerCount = Math.max(1, Math.min(16, Number(options?.workerCount ?? 1)))
  const workerIndex = Math.max(0, Math.min(workerCount - 1, Number(options?.workerIndex ?? 0)))
  const useWorkerShard = !activeAndPendingOnly && workerCount > 1
  const configuredLookbackYears = Number(
    options?.terminalLookbackYears ??
    process.env.SYNC_TERMINAL_LOOKBACK_YEARS ??
    5
  )
  let configuredFromYear = Number(options?.terminalFromYear ?? process.env.SYNC_TERMINAL_FROM_YEAR ?? 0)
  let configuredToYear = Number(options?.terminalToYear ?? process.env.SYNC_TERMINAL_TO_YEAR ?? 0)
  const hasExplicitOptionRange = options?.terminalFromYear != null || options?.terminalToYear != null
  if (!activeAndPendingOnly && !hasExplicitOptionRange) {
    const { data: syncStateScope } = await supabase
      .from('sync_state')
      .select('terminal_from_year, terminal_to_year')
      .eq('id', 'default')
      .maybeSingle()
    const scoped = syncStateScope as { terminal_from_year?: number | null; terminal_to_year?: number | null } | null
    if (scoped?.terminal_from_year != null) configuredFromYear = Number(scoped.terminal_from_year)
    if (scoped?.terminal_to_year != null) configuredToYear = Number(scoped.terminal_to_year)
  }
  const terminalLookbackYears = !activeAndPendingOnly
    ? Math.max(0, Math.min(20, Number.isFinite(configuredLookbackYears) ? configuredLookbackYears : 5))
    : 0
  const currentYear = new Date().getUTCFullYear()
  let terminalFromYear = 0
  let terminalToYear = 0
  if (!activeAndPendingOnly && Number.isFinite(configuredFromYear) && configuredFromYear > 0) {
    terminalFromYear = Math.max(1990, Math.min(currentYear, Math.floor(configuredFromYear)))
  }
  if (!activeAndPendingOnly && Number.isFinite(configuredToYear) && configuredToYear > 0) {
    terminalToYear = Math.max(1990, Math.min(currentYear, Math.floor(configuredToYear)))
  }
  if (terminalFromYear > 0 && terminalToYear > 0 && terminalFromYear > terminalToYear) {
    const tmp = terminalFromYear
    terminalFromYear = terminalToYear
    terminalToYear = tmp
  }
  const hasExplicitYearRange = terminalFromYear > 0 || terminalToYear > 0
  const terminalYearFrom = hasExplicitYearRange
    ? (terminalFromYear > 0 ? terminalFromYear : 1990)
    : 0
  const terminalYearTo = hasExplicitYearRange
    ? (terminalToYear > 0 ? terminalToYear : currentYear)
    : 0
  const terminalExplicitFromIso = hasExplicitYearRange
    ? new Date(Date.UTC(terminalYearFrom, 0, 1, 0, 0, 0, 0)).toISOString()
    : null
  const terminalExplicitToExclusiveIso = hasExplicitYearRange
    ? new Date(Date.UTC(terminalYearTo + 1, 0, 1, 0, 0, 0, 0)).toISOString()
    : null
  const terminalLookbackCutoffIso = !hasExplicitYearRange && terminalLookbackYears > 0
    ? new Date(Date.now() - terminalLookbackYears * 365 * 24 * 60 * 60 * 1000).toISOString()
    : null
  // Parallelize listing-level history fetches/inserts to speed up terminal backfills.
  const listingConcurrency = Math.max(1, Math.min(12, Number(process.env.SYNC_HISTORY_CONCURRENCY ?? 2)))
  // In shard mode, read a wider candidate window so each shard can still get a full limit-sized batch.
  const shardCandidateMultiplier = Math.max(2, Math.min(8, Number(process.env.SYNC_HISTORY_SHARD_CANDIDATE_MULTIPLIER ?? 4)))

  try {
    // Base query: listings that don't have history finalized yet. Optionally restrict to active/pending only.
    // For terminal backfill mode, always process from the "top" (offset 0) each chunk to avoid skipping
    // rows as we mark listings finalized and they fall out of the filtered set.
    const effectiveOffset = activeAndPendingOnly ? offset : 0
    const rangeLimit = useWorkerShard
      ? Math.min(2000, limit * workerCount * shardCandidateMultiplier)
      : limit
    let dataQuery = supabase
      .from('listings')
      .select('ListingKey, ListNumber, StandardStatus, CloseDate, ListDate, OnMarketDate, ModificationTimestamp')
      .eq('history_finalized', false)
      .range(effectiveOffset, effectiveOffset + rangeLimit - 1)
    if (activeAndPendingOnly) {
      dataQuery = dataQuery.order('ListNumber', { ascending: true, nullsFirst: false })
      dataQuery = dataQuery.or(ACTIVE_OR_PENDING_STATUS_OR)
    } else {
      const terminalScopedOr = buildTerminalScopedStatusOr({
        fromIso: terminalExplicitFromIso,
        toIsoExclusive: terminalExplicitToExclusiveIso,
        cutoffIso: terminalLookbackCutoffIso,
      })
      dataQuery = dataQuery.or(terminalScopedOr)
    }
    let totalListings = 0
    if (activeAndPendingOnly) {
      const countQuery = supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('history_finalized', false)
        .or(ACTIVE_OR_PENDING_STATUS_OR)
      const { count: needSyncCount, error: countError } = await countQuery
      if (countError) {
        const errText = formatDbError(countError)
        return {
          success: false,
          message: `History sync failed while counting candidates: ${errText}`,
          error: errText,
        }
      }
      totalListings = needSyncCount ?? 0
    }
    let rows: {
      ListingKey?: string | null
      ListNumber?: string | null
      StandardStatus?: string | null
      CloseDate?: string | null
      ListDate?: string | null
      OnMarketDate?: string | null
      ModificationTimestamp?: string | null
    }[] = []
    let usedTerminalFallback = false
    const { data: primaryRows, error: rowsError } = await dataQuery
    if (rowsError) {
      const errText = formatDbError(rowsError)
      const timeoutLike = /statement timeout|canceling statement|timeout|57014/i.test(errText)
      if (activeAndPendingOnly || !timeoutLike) {
        return {
          success: false,
          message: `History sync failed while loading candidate rows: ${errText}`,
          error: errText,
        }
      }

      usedTerminalFallback = true
      const fallbackLimit = Math.max(rangeLimit * 5, 300)
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from('listings')
        .select('ListingKey, ListNumber, StandardStatus, CloseDate, ListDate, OnMarketDate, ModificationTimestamp')
        .eq('history_finalized', false)
        .or(TERMINAL_STATUS_OR)
        .limit(fallbackLimit)
      if (fallbackError) {
        const fallbackErrText = formatDbError(fallbackError)
        return {
          success: false,
          message: `History sync failed while loading candidate rows: ${fallbackErrText}`,
          error: fallbackErrText,
        }
      }
      rows = ((fallbackRows ?? []) as typeof rows).filter((row) =>
        isTerminalRowInScope(row, {
          fromIso: terminalExplicitFromIso,
          toIsoExclusive: terminalExplicitToExclusiveIso,
          cutoffIso: terminalLookbackCutoffIso,
        })
      )
    } else {
      rows = (primaryRows ?? []) as typeof rows
    }
    const rawListingRows = (rows ?? []) as {
      ListingKey?: string | null
      ListNumber?: string | null
      StandardStatus?: string | null
    }[]
    const shardedRows = useWorkerShard
      ? rawListingRows.filter((row) => {
          const shardKey = ((row.ListNumber ?? row.ListingKey ?? '') as string).toString().trim()
          if (!shardKey) return workerIndex === 0
          return stableShardForKey(shardKey, workerCount) === workerIndex
        })
      : rawListingRows
    const listingRows = useWorkerShard ? shardedRows.slice(0, limit) : shardedRows
    if (!activeAndPendingOnly && totalListings === 0) totalListings = rawListingRows.length
    if (listingRows.length === 0) {
      const globalDone = rawListingRows.length === 0
      return {
        success: true,
        message: globalDone
          ? 'No listings to sync history for.'
          : `No rows assigned for this worker shard (worker ${workerIndex + 1}/${workerCount}).`,
        listingsProcessed: 0,
        historyRowsUpserted: 0,
        nextOffset: globalDone ? undefined : effectiveOffset,
        totalListings,
      }
    }

    let historyRowsUpserted = 0
    let listingsWithHistory = 0
    let firstInsertError: string | undefined
    type ListingWorkResult = {
      historyRowsUpserted: number
      listingsWithHistory: number
      insertError?: string
    }
    const processOneListing = async (row: { ListingKey?: string | null; ListNumber?: string | null; StandardStatus?: string | null }): Promise<ListingWorkResult> => {
      const key1 = (row.ListingKey ?? '').toString().trim()
      const key2 = (row.ListNumber ?? '').toString().trim()
      const keysToTry = [...new Set([key1, key2].filter((k) => k.length > 0))]
      if (keysToTry.length === 0) return { historyRowsUpserted: 0, listingsWithHistory: 0 }

      let items: Awaited<ReturnType<typeof fetchSparkListingHistory>>['items'] = []
      let hadSuccessfulHistoryFetch = false
      for (const key of keysToTry) {
        const result = await fetchSparkListingHistory(accessToken, key)
        if (result.ok) hadSuccessfulHistoryFetch = true
        if (result.ok && result.items.length > 0) {
          items = result.items
          break
        }
        if (result.ok) items = result.items
      }
      if (items.length === 0) {
        for (const key of keysToTry) {
          const result = await fetchSparkPriceHistory(accessToken, key)
          if (result.ok) hadSuccessfulHistoryFetch = true
          if (result.ok && result.items.length > 0) {
            items = result.items
            break
          }
          if (result.ok) items = result.items
        }
      }

      const listingKey = keysToTry[0]!
      let shouldFinalizeTerminal = false
      let localRowsUpserted = 0
      let localListingsWithHistory = 0
      let localInsertError: string | undefined
      if (items.length > 0) {
        await supabase.from('listing_history').delete().eq('listing_key', listingKey)
        localListingsWithHistory += 1
        const historyRows = items.map((item) => sparkHistoryItemToRow(listingKey, item))
        const { error } = await supabase.from('listing_history').insert(historyRows)
        if (!error) {
          localRowsUpserted += historyRows.length
          shouldFinalizeTerminal = true
        } else {
          localInsertError = error.message
        }
      }
      if (items.length === 0 && hadSuccessfulHistoryFetch) {
        shouldFinalizeTerminal = true
      }
      if (shouldFinalizeTerminal && isTerminalStatus(row.StandardStatus) && row.ListNumber) {
        await supabase
          .from('listings')
          .update({ history_finalized: true, is_finalized: true })
          .eq('ListNumber', row.ListNumber)
      }
      return {
        historyRowsUpserted: localRowsUpserted,
        listingsWithHistory: localListingsWithHistory,
        insertError: localInsertError,
      }
    }

    for (let i = 0; i < listingRows.length; i += listingConcurrency) {
      const chunk = listingRows.slice(i, i + listingConcurrency)
      const chunkResults = await Promise.all(chunk.map((row) => processOneListing(row)))
      for (const r of chunkResults) {
        historyRowsUpserted += r.historyRowsUpserted
        listingsWithHistory += r.listingsWithHistory
        if (!firstInsertError && r.insertError) firstInsertError = r.insertError
      }
    }

    let nextOffset: number | undefined
    let done: boolean
    if (activeAndPendingOnly) {
      nextOffset = offset + listingRows.length
      done = nextOffset >= totalListings
      if (done) nextOffset = undefined
    } else {
      // Terminal mode: keep consuming from offset 0 until no rows remain.
      const remainingQuery = supabase
        .from('listings')
        .select('ListingKey, ListNumber, StandardStatus, CloseDate, ListDate, OnMarketDate, ModificationTimestamp')
        .eq('history_finalized', false)
        .limit(1)
      const terminalScopedOr = buildTerminalScopedStatusOr({
        fromIso: terminalExplicitFromIso,
        toIsoExclusive: terminalExplicitToExclusiveIso,
        cutoffIso: terminalLookbackCutoffIso,
      })
      const { data: remainingRowsScoped, error: remainingErrorScoped } = await remainingQuery.or(terminalScopedOr)
      if (remainingErrorScoped) {
        const errText = formatDbError(remainingErrorScoped)
        const timeoutLike = /statement timeout|canceling statement|timeout|57014/i.test(errText)
        if (!timeoutLike) {
          return {
            success: false,
            message: `History sync failed while checking remaining listings: ${errText}`,
            error: errText,
          }
        }
        const { data: remainingRowsFallback, error: remainingErrorFallback } = await supabase
          .from('listings')
          .select('ListingKey, ListNumber, StandardStatus, CloseDate, ListDate, OnMarketDate, ModificationTimestamp')
          .eq('history_finalized', false)
          .or(TERMINAL_STATUS_OR)
          .limit(300)
        if (remainingErrorFallback) {
          const fallbackErrText = formatDbError(remainingErrorFallback)
          return {
            success: false,
            message: `History sync failed while checking remaining listings: ${fallbackErrText}`,
            error: fallbackErrText,
          }
        }
        const scopedRemaining = (remainingRowsFallback ?? []).filter((row) =>
          isTerminalRowInScope(row, {
            fromIso: terminalExplicitFromIso,
            toIsoExclusive: terminalExplicitToExclusiveIso,
            cutoffIso: terminalLookbackCutoffIso,
          })
        )
        done = scopedRemaining.length === 0
      } else {
        done = (remainingRowsScoped ?? []).length === 0
      }
      nextOffset = done ? undefined : 0
    }
    let sparkHint: string | undefined
    if (listingsWithHistory === 0 && listingRows.length > 0) {
      sparkHint =
        'Spark returned no history for any listing in this batch (we tried both /history and /historical/pricehistory). Your API key role may be IDX/VOW/Portal (condensed only); Private role sees full history. Or the MLS may not expose history for these listings. Use "Test listing history API" below to verify.'
    }
    return {
      success: true,
      message: done
        ? `History sync complete. ${listingRows.length} listings processed, ${listingsWithHistory} with history, ${historyRowsUpserted} rows stored.`
        : `Batch done${useWorkerShard ? ` (worker ${workerIndex + 1}/${workerCount})` : ''}${!activeAndPendingOnly && hasExplicitYearRange ? ` (years ${terminalYearFrom}-${terminalYearTo})` : !activeAndPendingOnly && terminalLookbackYears > 0 ? ` (lookback ${terminalLookbackYears}y)` : ''}${usedTerminalFallback ? ' (timeout-safe fallback mode)' : ''}. ${listingRows.length} processed, ${listingsWithHistory} with history, ${historyRowsUpserted} rows. Offset ${nextOffset ?? 0} next.`,
      listingsProcessed: listingRows.length,
      historyRowsUpserted,
      listingsWithHistory,
      nextOffset,
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
