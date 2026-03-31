/**
 * Core year sync logic. Runs in-process (background). Checks cancelRequested before each chunk.
 */

import { createClient } from '@supabase/supabase-js'
import {
  fetchSparkListingHistory,
  fetchSparkListingsPage,
  fetchSparkPriceHistory,
  sparkListingToSupabaseRow,
  type SparkListingHistoryItem,
} from '@/lib/spark'
import {
  countSupabaseListingsForYear,
  countFinalizedClosedForYear,
  getSparkListingsCountForYear,
} from './year-counts'

export type YearCacheRow = {
  sparkListings?: number
  supabaseListings?: number
  finalizedListings?: number
  lastSyncedAt?: string | null
  lastError?: string | null
  runStatus?: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  runPhase?: string | null
  runStartedAt?: string | null
  runUpdatedAt?: string | null
  processedListings?: number
  totalListings?: number
  listingsUpserted?: number
  historyInserted?: number
  listingsFinalized?: number
  cancelRequested?: boolean
}

export type YearCachePayload = {
  version: number
  rows: Record<string, YearCacheRow>
  sparkMinYear?: number
  sparkMaxYear?: number
  updatedAt: string
}

export function parseYearCache(raw: unknown): YearCachePayload {
  if (!raw || typeof raw !== 'object') {
    return { version: 2, rows: {}, updatedAt: new Date().toISOString() }
  }
  const obj = raw as Partial<YearCachePayload>
  if (typeof obj.version !== 'number' || !obj.rows || typeof obj.rows !== 'object') {
    return { version: 2, rows: {}, updatedAt: new Date().toISOString() }
  }
  return { version: obj.version, rows: obj.rows as Record<string, YearCacheRow>, updatedAt: obj.updatedAt ?? new Date().toISOString() }
}

function yearBounds(year: number) {
  const fromIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString()
  const toIsoExclusive = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString()
  return { fromIso, toIsoExclusive }
}

function inIsoRange(value: string | null | undefined, fromIso: string, toIsoExclusive: string): boolean {
  if (!value) return false
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return false
  return t >= new Date(fromIso).getTime() && t < new Date(toIsoExclusive).getTime()
}

function isTerminalStatus(status: string | null | undefined) {
  const value = String(status ?? '').toLowerCase()
  return value.includes('closed') || value.includes('expired') || value.includes('withdrawn') || value.includes('cancel')
}

function sparkHistoryItemToRow(listingKey: string, item: SparkListingHistoryItem) {
  const dateRaw = item.ModificationTimestamp ?? item.Date
  const eventDate = dateRaw && !Number.isNaN(new Date(String(dateRaw)).getTime()) ? String(dateRaw) : null
  const priceNum = typeof item.Price === 'number'
    ? item.Price
    : typeof item.PriceAtEvent === 'number'
      ? item.PriceAtEvent
      : null
  const priceVal = priceNum ?? (typeof item.PriceAtEvent === 'string' ? parseFloat(String(item.PriceAtEvent)) : null)
  return {
    listing_key: listingKey,
    event_date: eventDate,
    event: typeof item.Event === 'string' ? item.Event : null,
    description: typeof item.Description === 'string' ? item.Description : null,
    price: Number.isFinite(priceVal as number) ? Number(priceVal) : null,
    price_change: typeof item.PriceChange === 'number' ? item.PriceChange : null,
    raw: item as unknown as Record<string, unknown>,
  }
}

async function upsertListingsInChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Record<string, unknown>[]
) {
  const chunkSize = 250
  const retryChunkSize = 100
  let totalUpserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('listings').upsert(chunk as never[], { onConflict: 'ListNumber' })
    if (error && /statement timeout|timeout/i.test(error.message) && chunk.length > retryChunkSize) {
      for (let j = 0; j < chunk.length; j += retryChunkSize) {
        const sub = chunk.slice(j, j + retryChunkSize)
        const retry = await supabase.from('listings').upsert(sub as never[], { onConflict: 'ListNumber' })
        if (!retry.error) totalUpserted += sub.length
      }
    } else if (!error) {
      totalUpserted += chunk.length
    }
  }
  return totalUpserted
}

type YearListingRow = { ListingKey?: string | null; ListNumber?: string | null; StandardStatus?: string | null }

async function fetchSupabaseYearListings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  year: number
): Promise<YearListingRow[]> {
  const { fromIso, toIsoExclusive } = yearBounds(year)
  const batchSize = 2000
  const allRows: YearListingRow[] = []

  let offset = 0
  let keepGoing = true
  while (keepGoing) {
    const { data, error } = await supabase
      .from('listings')
      .select('ListingKey, ListNumber, StandardStatus')
      .gte('OnMarketDate', fromIso)
      .lt('OnMarketDate', toIsoExclusive)
      .order('ListNumber', { ascending: true, nullsFirst: false })
      .range(offset, offset + batchSize - 1)
    if (error) break
    const rows = (data ?? []) as YearListingRow[]
    allRows.push(...rows)
    if (rows.length < batchSize) keepGoing = false
    else offset += batchSize
  }

  const seen = new Set<string>()
  const deduped: YearListingRow[] = []
  for (const row of allRows) {
    const key = String(row.ListNumber ?? row.ListingKey ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }
  return deduped
}

/** Fetch a slice of year listings for chunked history sync. */
async function fetchSupabaseYearListingsBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  year: number,
  offset: number,
  limit: number
): Promise<YearListingRow[]> {
  const { fromIso, toIsoExclusive } = yearBounds(year)
  const { data, error } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, StandardStatus')
    .gte('OnMarketDate', fromIso)
    .lt('OnMarketDate', toIsoExclusive)
    .order('ListNumber', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (error) return []
  const rows = (data ?? []) as YearListingRow[]
  const seen = new Set<string>()
  const deduped: YearListingRow[] = []
  for (const row of rows) {
    const key = String(row.ListNumber ?? row.ListingKey ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }
  return deduped
}

async function checkCancelRequested(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  year: number
): Promise<boolean> {
  const { data } = await supabase
    .from('sync_state')
    .select('year_sync_matrix_cache')
    .eq('id', 'default')
    .maybeSingle()
  const cache = parseYearCache((data as { year_sync_matrix_cache?: unknown } | null)?.year_sync_matrix_cache)
  return cache.rows[String(year)]?.cancelRequested === true
}

export type RunYearSyncResult = {
  ok: boolean
  error?: string
  cancelled?: boolean
  sparkListings?: number
  listingsUpserted?: number
  supabaseListings?: number
  finalizedListings?: number
}

/**
 * Wraps runYearSync and persists failures to cache. Use for in-process background runs (dev).
 */
export async function runYearSyncWithPersistence(
  year: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: { supabase: any; token: string }
): Promise<RunYearSyncResult> {
  const { supabase } = options
  try {
    return await runYearSync(year, options)
  } catch (err) {
    const { data } = await supabase.from('sync_state').select('year_sync_matrix_cache').eq('id', 'default').maybeSingle()
    const cache = parseYearCache((data as { year_sync_matrix_cache?: unknown } | null)?.year_sync_matrix_cache)
    const yearKey = String(year)
    const existing = cache.rows[yearKey] ?? {}
    cache.rows[yearKey] = {
      ...existing,
      runStatus: 'failed',
      runPhase: null,
      lastError: err instanceof Error ? err.message : String(err),
      runUpdatedAt: new Date().toISOString(),
    }
    cache.updatedAt = new Date().toISOString()
    await supabase
      .from('sync_state')
      .upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: cache.updatedAt }, { onConflict: 'id' })
    throw err
  }
}

export async function runYearSync(
  year: number,
  options: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any
    token: string
  }
): Promise<RunYearSyncResult> {
  const { supabase, token } = options
  const currentYear = new Date().getUTCFullYear()
  const { fromIso, toIsoExclusive } = yearBounds(year)
  const filter = `OnMarketDate Ge ${fromIso} And OnMarketDate Lt ${toIsoExclusive}`
  const yearKey = String(year)

  const { data: stateRow } = await supabase
    .from('sync_state')
    .select('year_sync_matrix_cache')
    .eq('id', 'default')
    .maybeSingle()
  const cache = parseYearCache((stateRow as { year_sync_matrix_cache?: unknown } | null)?.year_sync_matrix_cache)

  const runStartedAt = new Date().toISOString()

  async function persistRow(patch: Partial<YearCacheRow>) {
    const nowIso = new Date().toISOString()
    const existing = cache.rows[yearKey] ?? {}
    cache.rows[yearKey] = { ...existing, ...patch, runUpdatedAt: nowIso }
    cache.updatedAt = nowIso
    await supabase
      .from('sync_state')
      .upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
  }

  await persistRow({
    runStatus: 'running',
    runPhase: 'Checking counts',
    runStartedAt,
    processedListings: 0,
    totalListings: 0,
    listingsUpserted: 0,
    historyInserted: 0,
    listingsFinalized: 0,
    lastError: null,
  })

  if (await checkCancelRequested(supabase, year)) {
    await persistRow({ runStatus: 'cancelled', runPhase: null, lastError: 'Cancelled by user' })
    return { ok: false, error: 'Cancelled by user', cancelled: true }
  }

  const [sparkCountCheck, supabaseCountCheck] = await Promise.all([
    getSparkListingsCountForYear(token, year),
    countSupabaseListingsForYear(supabase, year),
  ])

  if (sparkCountCheck === 0) {
    await persistRow({ runStatus: 'failed', runPhase: null, lastError: 'Year has no listings in Spark; vacant year.' })
    return { ok: false, error: 'Year has no listings in Spark; vacant year.' }
  }

  const listingsAlreadyMatch = sparkCountCheck === supabaseCountCheck && supabaseCountCheck > 0
  let sparkListings = sparkCountCheck
  let listingsUpserted = 0

  if (!listingsAlreadyMatch) {
    await persistRow({ runPhase: 'Syncing listings' })
    let currentPage = 1
    let totalPages = 1
    while (currentPage <= totalPages) {
      if (await checkCancelRequested(supabase, year)) {
        await persistRow({ runStatus: 'cancelled', runPhase: null, lastError: 'Cancelled by user' })
        return { ok: false, error: 'Cancelled by user', cancelled: true }
      }
      const response = await fetchSparkListingsPage(token, {
        page: currentPage,
        limit: 500,
        filter,
        orderby: '+OnMarketDate',
      })
      if (!response.D?.Success) break
      const results = response.D?.Results ?? []
      if (results.length === 0 && currentPage === 1) break
      totalPages = Number(response.D?.Pagination?.TotalPages ?? totalPages)
      sparkListings = Number(response.D?.Pagination?.TotalRows ?? sparkListings)
      const rows = results.map((item) => sparkListingToSupabaseRow(item))
      listingsUpserted += await upsertListingsInChunks(supabase, rows)
      await persistRow({
        runStatus: 'running',
        runPhase: 'Syncing listings',
        totalListings: sparkListings,
        sparkListings,
        listingsUpserted,
      })
      currentPage += 1
      if (results.length === 0) break
    }
  }

  const yearListings = await fetchSupabaseYearListings(supabase, year)
  await persistRow({
    runStatus: 'running',
    runPhase: 'Syncing history',
    totalListings: yearListings.length,
    sparkListings,
    listingsUpserted,
    processedListings: 0,
    historyInserted: 0,
    listingsFinalized: 0,
  })

  const historyConcurrency = Math.max(1, Math.min(8, Number(process.env.SYNC_HISTORY_CONCURRENCY ?? 3)))
  let sparkHistoryRows = 0
  let processedListings = 0
  let listingsFinalized = 0

  async function processListing(row: { ListingKey?: string | null; ListNumber?: string | null; StandardStatus?: string | null }) {
    const key1 = String(row.ListingKey ?? '').trim()
    const key2 = String(row.ListNumber ?? '').trim()
    const keys = [...new Set([key1, key2].filter(Boolean))]
    if (keys.length === 0) return
    let items: SparkListingHistoryItem[] = []
    let hadSuccessfulFetch = false
    for (const key of keys) {
      const response = await fetchSparkListingHistory(token, key)
      if (response.ok) hadSuccessfulFetch = true
      if (response.ok && response.items.length > 0) {
        items = response.items
        break
      }
    }
    if (items.length === 0) {
      for (const key of keys) {
        const response = await fetchSparkPriceHistory(token, key)
        if (response.ok) hadSuccessfulFetch = true
        if (response.ok && response.items.length > 0) {
          items = response.items
          break
        }
      }
    }
    const listingKey = keys[0]!
    await supabase
      .from('listing_history')
      .delete()
      .eq('listing_key', listingKey)
      .gte('event_date', fromIso)
      .lt('event_date', toIsoExclusive)
    if (items.length > 0) {
      const rows = items
        .map((item) => sparkHistoryItemToRow(listingKey, item))
        .filter((historyRow) => inIsoRange(historyRow.event_date, fromIso, toIsoExclusive))
      if (rows.length > 0) {
        const { error } = await supabase.from('listing_history').insert(rows)
        if (!error) sparkHistoryRows += rows.length
      }
    }
    const isPastYear = year < currentYear
    const shouldFinalize = row.ListNumber && (isPastYear || (hadSuccessfulFetch && isTerminalStatus(row.StandardStatus)))
    if (shouldFinalize) {
      await supabase
        .from('listings')
        .update({ history_finalized: true, is_finalized: true })
        .eq('ListNumber', row.ListNumber)
      listingsFinalized += 1
    }
  }

  for (let i = 0; i < yearListings.length; i += historyConcurrency) {
    if (await checkCancelRequested(supabase, year)) {
      await persistRow({ runStatus: 'cancelled', runPhase: null, lastError: 'Cancelled by user' })
      return { ok: false, error: 'Cancelled by user', cancelled: true }
    }
    const chunk = yearListings.slice(i, i + historyConcurrency)
    await Promise.all(chunk.map((row) => processListing(row)))
    processedListings += chunk.length
    await persistRow({
      runStatus: 'running',
      runPhase: 'Syncing history',
      totalListings: yearListings.length,
      sparkListings,
      processedListings,
      listingsUpserted,
      historyInserted: sparkHistoryRows,
      listingsFinalized,
    })
  }

  const [supabaseListings, finalizedListings] = await Promise.all([
    countSupabaseListingsForYear(supabase, year),
    countFinalizedClosedForYear(supabase, year),
  ])

  const nowIso = new Date().toISOString()
  const isCurrentYear = year === currentYear
  const existingRow = cache.rows[String(year)] ?? {}
  cache.rows[String(year)] = {
    sparkListings:
      isCurrentYear || typeof existingRow.sparkListings !== 'number' ? sparkListings : existingRow.sparkListings,
    lastSyncedAt: nowIso,
    lastError: null,
    runStatus: 'completed',
    runPhase: null,
    runStartedAt: runStartedAt ?? existingRow.runStartedAt ?? null,
    runUpdatedAt: nowIso,
    processedListings,
    totalListings: yearListings.length,
    listingsUpserted,
    historyInserted: sparkHistoryRows,
    supabaseListings,
    finalizedListings,
    cancelRequested: undefined,
  }
  const allYears = Object.keys(cache.rows).map((k) => Number(k)).filter(Number.isFinite)
  if (allYears.length > 0) {
    cache.sparkMinYear = Math.min(1990, ...allYears)
    cache.sparkMaxYear = Math.max(currentYear, ...allYears)
  }
  cache.updatedAt = nowIso
  await supabase
    .from('sync_state')
    .upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })

  return {
    ok: true,
    sparkListings,
    listingsUpserted,
    supabaseListings,
    finalizedListings,
  }
}

const HISTORY_CHUNK_SIZE = Math.max(20, Math.min(80, Number(process.env.SYNC_YEAR_HISTORY_CHUNK ?? 40)))
const LISTINGS_PAGE_SIZE = 500

export type RunYearSyncChunkResult = {
  ok: boolean
  done: boolean
  year?: number
  phase?: 'listings' | 'history' | 'idle'
  message: string
  listingsUpserted?: number
  historyInserted?: number
  listingsFinalized?: number
  processedListings?: number
  totalListings?: number
  sparkListings?: number
  supabaseListings?: number
  error?: string
}

/**
 * Run one chunk of year sync. Used by cron. Fits in serverless timeout.
 * If listings match, skips to history. Same logic as runYearSync.
 */
export async function runYearSyncChunk(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  token: string
  targetYear?: number
}): Promise<RunYearSyncChunkResult> {
  const { supabase, token, targetYear } = options
  const currentYear = new Date().getUTCFullYear()
  const nowIso = new Date().toISOString()

  const cursorId = 'default'

  const { data: cursorRow } = await supabase
    .from('sync_year_cursor')
    .select('current_year, phase, next_listing_page, next_history_offset, total_listings')
    .eq('id', cursorId)
    .maybeSingle()

  const cursor = cursorRow as {
    current_year?: number | null
    phase?: string | null
    next_listing_page?: number
    next_history_offset?: number
    total_listings?: number | null
  } | null

  let phase = (cursor?.phase === 'listings' || cursor?.phase === 'history' ? cursor.phase : 'idle') as 'listings' | 'history' | 'idle'
  let currentYearVal = cursor?.current_year ?? null
  let nextListingPage = cursor?.next_listing_page ?? 1
  let nextHistoryOffset = cursor?.next_history_offset ?? 0
  let totalListings = cursor?.total_listings ?? null

  if (targetYear != null && currentYearVal !== targetYear) {
    const cachedRow = parseYearCache(
      (await supabase.from('sync_state').select('year_sync_matrix_cache').eq('id', 'default').maybeSingle())
        .data?.year_sync_matrix_cache
    ).rows[String(targetYear)]
    const hadProgress = (cachedRow?.processedListings ?? 0) > 0 && cachedRow?.runStatus === 'running'
    if (hadProgress) {
      phase = 'history'
      currentYearVal = targetYear
      nextHistoryOffset = cachedRow.processedListings ?? 0
      totalListings = cachedRow.totalListings ?? null
      await supabase.from('sync_year_cursor').upsert(
        { id: cursorId, current_year: targetYear, phase: 'history', next_listing_page: 1, next_history_offset: nextHistoryOffset, total_listings: totalListings, updated_at: nowIso },
        { onConflict: 'id' }
      )
    } else {
      phase = 'idle'
      currentYearVal = null
      nextListingPage = 1
      nextHistoryOffset = 0
      totalListings = null
      await supabase.from('sync_year_cursor').upsert(
        { id: cursorId, current_year: null, phase: 'idle', next_listing_page: 1, next_history_offset: 0, total_listings: null, updated_at: nowIso },
        { onConflict: 'id' }
      )
    }
  }

  const { data: stateRow } = await supabase
    .from('sync_state')
    .select('year_sync_matrix_cache')
    .eq('id', 'default')
    .maybeSingle()
  const cache = parseYearCache((stateRow as { year_sync_matrix_cache?: unknown } | null)?.year_sync_matrix_cache)

  async function updateCursor(patch: {
    current_year?: number | null
    phase?: string
    next_listing_page?: number
    next_history_offset?: number
    total_listings?: number | null
  }) {
    await supabase
      .from('sync_year_cursor')
      .upsert(
        {
          id: cursorId,
          ...patch,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      )
  }

  if (phase === 'idle') {
    let pickedYear: number | null = null

    if (targetYear != null) {
      pickedYear = targetYear
      const row = cache.rows[String(targetYear)]
      if (row?.runStatus === 'completed') {
        cache.rows[String(targetYear)] = { ...row, runStatus: 'idle' }
        cache.updatedAt = nowIso
        await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
      }
    } else {
      const sparkMin = typeof cache.sparkMinYear === 'number' ? cache.sparkMinYear : 1990
      const sparkMax = typeof cache.sparkMaxYear === 'number' ? cache.sparkMaxYear : currentYear
      const minYear = Math.max(sparkMin, 1990)
      const maxYear = Math.min(sparkMax, currentYear)
      const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)

      for (const y of years) {
        const row = cache.rows[String(y)]
        if (row?.runStatus === 'completed') continue
        pickedYear = y
        break
      }
    }

    if (pickedYear == null) {
      return {
        ok: true,
        done: true,
        phase: 'idle',
        message: 'All years synced. Nothing to do.',
      }
    }

    currentYearVal = pickedYear
    const yearKey = String(pickedYear)
    const [sparkCountCheck, supabaseCountCheck] = await Promise.all([
      getSparkListingsCountForYear(token, pickedYear),
      countSupabaseListingsForYear(supabase, pickedYear),
    ])

    if (sparkCountCheck === 0) {
      await supabase.from('year_sync_log').insert({
        year: pickedYear,
        status: 'skipped',
        listings_upserted: 0,
        history_inserted: 0,
        listings_finalized: 0,
        completed_at: nowIso,
        error: 'Year has no listings in Spark.',
      })
      cache.rows[yearKey] = { ...(cache.rows[yearKey] ?? {}), runStatus: 'completed', lastError: null }
      cache.updatedAt = nowIso
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
      await updateCursor({ phase: 'idle', current_year: null })
      return { ok: true, done: false, year: pickedYear, phase: 'idle', message: `Year ${pickedYear} skipped (vacant).` }
    }

    for (const k of Object.keys(cache.rows)) {
      if (k !== yearKey && cache.rows[k]?.runStatus === 'running') {
        cache.rows[k] = { ...cache.rows[k], runStatus: 'idle' as const }
      }
    }

    const listingsAlreadyMatch =
      supabaseCountCheck > 0 &&
      (supabaseCountCheck >= sparkCountCheck || Math.abs(supabaseCountCheck - sparkCountCheck) <= Math.max(1, Math.floor(sparkCountCheck * 0.01)))
    if (listingsAlreadyMatch) {
      totalListings = await countSupabaseListingsForYear(supabase, pickedYear)
      phase = 'history'
      nextHistoryOffset = 0
      await updateCursor({
        current_year: pickedYear,
        phase: 'history',
        next_listing_page: 1,
        next_history_offset: 0,
        total_listings: totalListings,
      })
      cache.rows[yearKey] = {
        ...(cache.rows[yearKey] ?? {}),
        runStatus: 'running',
        runPhase: 'Syncing history',
        sparkListings: sparkCountCheck,
        supabaseListings: supabaseCountCheck,
        totalListings,
        processedListings: 0,
        historyInserted: 0,
        listingsFinalized: 0,
        runUpdatedAt: nowIso,
      }
      cache.updatedAt = nowIso
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
    } else {
      phase = 'listings'
      nextListingPage = 1
      await updateCursor({
        current_year: pickedYear,
        phase: 'listings',
        next_listing_page: 1,
        next_history_offset: 0,
        total_listings: null,
      })
      cache.rows[yearKey] = {
        ...(cache.rows[yearKey] ?? {}),
        runStatus: 'running',
        runPhase: 'Syncing listings',
        sparkListings: sparkCountCheck,
        totalListings: sparkCountCheck,
        processedListings: 0,
        listingsUpserted: 0,
        historyInserted: 0,
        listingsFinalized: 0,
        runUpdatedAt: nowIso,
      }
      cache.updatedAt = nowIso
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
    }
  }

  if (phase === 'listings' && currentYearVal != null) {
    const year = currentYearVal
    const yearKey = String(year)

    const [sparkCountCheck, supabaseCountCheck] = await Promise.all([
      getSparkListingsCountForYear(token, year),
      countSupabaseListingsForYear(supabase, year),
    ])
    const listingsAlreadyMatch =
      supabaseCountCheck > 0 &&
      (supabaseCountCheck >= sparkCountCheck || Math.abs(supabaseCountCheck - sparkCountCheck) <= Math.max(1, Math.floor(sparkCountCheck * 0.01)))
    if (listingsAlreadyMatch) {
      totalListings = supabaseCountCheck
      await updateCursor({
        phase: 'history',
        next_listing_page: 1,
        next_history_offset: 0,
        total_listings: totalListings,
      })
      const existing = cache.rows[yearKey] ?? {}
      cache.rows[yearKey] = {
        ...existing,
        runStatus: 'running',
        runPhase: 'Syncing history',
        sparkListings: sparkCountCheck,
        supabaseListings: supabaseCountCheck,
        totalListings,
        processedListings: 0,
        historyInserted: existing.historyInserted ?? 0,
        listingsFinalized: existing.listingsFinalized ?? 0,
        runUpdatedAt: nowIso,
      }
      cache.updatedAt = nowIso
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
      return {
        ok: true,
        done: false,
        year,
        phase: 'history',
        message: `Year ${year} listings already match (${supabaseCountCheck}). Skipping to history.`,
        sparkListings: sparkCountCheck,
        supabaseListings: supabaseCountCheck,
      }
    }

    const { fromIso, toIsoExclusive } = yearBounds(year)
    const filter = `OnMarketDate Ge ${fromIso} And OnMarketDate Lt ${toIsoExclusive}`
    const response = await fetchSparkListingsPage(token, {
      page: nextListingPage,
      limit: LISTINGS_PAGE_SIZE,
      filter,
      orderby: '+OnMarketDate',
    })
    if (!response.D?.Success) {
      await supabase.from('year_sync_log').insert({
        year,
        status: 'failed',
        listings_upserted: 0,
        history_inserted: 0,
        listings_finalized: 0,
        completed_at: nowIso,
        error: 'Spark API failed',
      })
      await updateCursor({ phase: 'idle', current_year: null })
      return { ok: false, done: true, year, phase: 'listings', message: 'Spark API failed', error: 'Spark API failed' }
    }
    const results = response.D?.Results ?? []
    const totalPages = Number(response.D?.Pagination?.TotalPages ?? 1)
    const sparkListings = Number(response.D?.Pagination?.TotalRows ?? 0)
    const rows = results.map((item) => sparkListingToSupabaseRow(item))
    const listingsUpserted = await upsertListingsInChunks(supabase, rows)
    const existing = cache.rows[yearKey] ?? {}
    const prevUpserted = existing.listingsUpserted ?? 0
    cache.rows[yearKey] = {
      ...existing,
      runStatus: 'running',
      runPhase: 'Syncing listings',
      sparkListings,
      totalListings: sparkListings,
      listingsUpserted: prevUpserted + listingsUpserted,
      runUpdatedAt: nowIso,
    }
    cache.updatedAt = nowIso
    await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })

    const listingsDone = nextListingPage >= totalPages || results.length === 0
    if (listingsDone) {
      const [supabaseListings, finalizedListings] = await Promise.all([
        countSupabaseListingsForYear(supabase, year),
        countFinalizedClosedForYear(supabase, year),
      ])
      totalListings = supabaseListings
      await updateCursor({
        phase: 'history',
        next_listing_page: 1,
        next_history_offset: 0,
        total_listings: totalListings,
      })
      cache.rows[yearKey] = {
        ...existing,
        runStatus: 'running',
        runPhase: 'Syncing history',
        sparkListings,
        supabaseListings,
        finalizedListings,
        totalListings,
        listingsUpserted: prevUpserted + listingsUpserted,
        processedListings: 0,
        historyInserted: 0,
        listingsFinalized: 0,
        runUpdatedAt: nowIso,
      }
      cache.updatedAt = nowIso
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
      return {
        ok: true,
        done: false,
        year,
        phase: 'history',
        message: `Year ${year} listings done. History starts next chunk.`,
        listingsUpserted,
        totalListings,
      }
    }
    await updateCursor({
      phase: 'listings',
      next_listing_page: nextListingPage + 1,
      next_history_offset: 0,
      total_listings: sparkListings,
    })
    return {
      ok: true,
      done: false,
      year,
      phase: 'listings',
      message: `Year ${year} listings page ${nextListingPage}/${totalPages}. ${listingsUpserted} upserted this chunk.`,
      listingsUpserted,
      totalListings: sparkListings,
    }
  }

  if (phase === 'history' && currentYearVal != null) {
    const year = currentYearVal
    const { fromIso, toIsoExclusive } = yearBounds(year)

    if (totalListings == null) {
      totalListings = await countSupabaseListingsForYear(supabase, year)
      await updateCursor({ total_listings: totalListings })
    }

    const batch = await fetchSupabaseYearListingsBatch(supabase, year, nextHistoryOffset, HISTORY_CHUNK_SIZE)
    const historyConcurrency = Math.max(1, Math.min(8, Number(process.env.SYNC_HISTORY_CONCURRENCY ?? 3)))
    let sparkHistoryRows = 0
    let listingsFinalized = 0

    async function processListing(row: YearListingRow) {
      const key1 = String(row.ListingKey ?? '').trim()
      const key2 = String(row.ListNumber ?? '').trim()
      const keys = [...new Set([key1, key2].filter(Boolean))]
      if (keys.length === 0) return
      let items: SparkListingHistoryItem[] = []
      let hadSuccessfulFetch = false
      for (const key of keys) {
        const response = await fetchSparkListingHistory(token, key)
        if (response.ok) hadSuccessfulFetch = true
        if (response.ok && response.items.length > 0) {
          items = response.items
          break
        }
      }
      if (items.length === 0) {
        for (const key of keys) {
          const response = await fetchSparkPriceHistory(token, key)
          if (response.ok) hadSuccessfulFetch = true
          if (response.ok && response.items.length > 0) {
            items = response.items
            break
          }
        }
      }
      const listingKey = keys[0]!
      await supabase
        .from('listing_history')
        .delete()
        .eq('listing_key', listingKey)
        .gte('event_date', fromIso)
        .lt('event_date', toIsoExclusive)
      if (items.length > 0) {
        const rows = items
          .map((item) => sparkHistoryItemToRow(listingKey, item))
          .filter((historyRow) => inIsoRange(historyRow.event_date, fromIso, toIsoExclusive))
        if (rows.length > 0) {
          const { error } = await supabase.from('listing_history').insert(rows)
          if (!error) sparkHistoryRows += rows.length
        }
      }
      const isPastYear = year < currentYear
      const shouldFinalize = row.ListNumber && (isPastYear || (hadSuccessfulFetch && isTerminalStatus(row.StandardStatus)))
      if (shouldFinalize) {
        await supabase
          .from('listings')
          .update({ history_finalized: true, is_finalized: true })
          .eq('ListNumber', row.ListNumber)
        listingsFinalized += 1
      }
    }

    const chunked = []
    for (let i = 0; i < batch.length; i += historyConcurrency) {
      chunked.push(batch.slice(i, i + historyConcurrency))
    }
    for (const chunk of chunked) {
      await Promise.all(chunk.map((row) => processListing(row)))
    }

    const yearKey = String(year)
    const existing = cache.rows[yearKey] ?? {}
    const prevProcessed = existing.processedListings ?? 0
    const prevHistory = existing.historyInserted ?? 0
    const prevFinalized = existing.listingsFinalized ?? 0
    const newProcessed = prevProcessed + batch.length
    const newHistory = prevHistory + sparkHistoryRows
    const newFinalized = prevFinalized + listingsFinalized

    cache.rows[yearKey] = {
      ...existing,
      runStatus: 'running',
      runPhase: 'Syncing history',
      processedListings: newProcessed,
      historyInserted: newHistory,
      listingsFinalized: newFinalized,
      finalizedListings: newFinalized,
      runUpdatedAt: nowIso,
    }
    cache.updatedAt = nowIso
    await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })

    const effectiveTotal = totalListings ?? 0
    const historyDone =
      effectiveTotal > 0 &&
      newProcessed > 0 &&
      (batch.length < HISTORY_CHUNK_SIZE || newProcessed >= effectiveTotal)
    if (historyDone) {
      const [supabaseListings, finalizedListings] = await Promise.all([
        countSupabaseListingsForYear(supabase, year),
        countFinalizedClosedForYear(supabase, year),
      ])
      cache.rows[yearKey] = {
        ...existing,
        runStatus: 'completed',
        runPhase: null,
        sparkListings: existing.sparkListings ?? 0,
        supabaseListings,
        finalizedListings,
        lastSyncedAt: nowIso,
        lastError: null,
        processedListings: newProcessed,
        historyInserted: newHistory,
        listingsFinalized: newFinalized,
        runUpdatedAt: nowIso,
      }
      cache.updatedAt = nowIso
      const allYears = Object.keys(cache.rows).map((k) => Number(k)).filter(Number.isFinite)
      if (allYears.length > 0) {
        cache.sparkMinYear = Math.min(1990, ...allYears)
        cache.sparkMaxYear = Math.max(currentYear, ...allYears)
      }
      await supabase.from('sync_state').upsert({ id: 'default', year_sync_matrix_cache: cache, updated_at: nowIso }, { onConflict: 'id' })
      await supabase.from('year_sync_log').insert({
        year,
        status: 'completed',
        listings_upserted: existing.listingsUpserted ?? 0,
        history_inserted: newHistory,
        listings_finalized: newFinalized,
        completed_at: nowIso,
      })
      await updateCursor({ phase: 'idle', current_year: null, next_listing_page: 1, next_history_offset: 0, total_listings: null })
      return {
        ok: true,
        done: true,
        year,
        phase: 'idle',
        message: `Year ${year} complete. ${newHistory} history rows, ${newFinalized} finalized.`,
        historyInserted: sparkHistoryRows,
        listingsFinalized,
        processedListings: newProcessed,
        totalListings: totalListings ?? newProcessed,
      }
    }

    await updateCursor({
      phase: 'history',
      next_history_offset: nextHistoryOffset + batch.length,
      total_listings: totalListings,
    })
    return {
      ok: true,
      done: false,
      year,
      phase: 'history',
      message: `Year ${year} history: ${newProcessed}/${totalListings ?? '?'} processed. ${sparkHistoryRows} rows, ${listingsFinalized} finalized this chunk.`,
      historyInserted: sparkHistoryRows,
      listingsFinalized,
      processedListings: newProcessed,
      totalListings: totalListings ?? 0,
    }
  }

  return { ok: true, done: true, phase: 'idle', message: 'No work to do.' }
}
