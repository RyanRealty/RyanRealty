/**
 * Sync pipeline writes.
 *
 * Owns every write against `listings`, `listing_history`, `price_history`,
 * `status_history`, `activity_events`, and `sync_state` from the Spark
 * delta-sync cron. Lives behind the DAL boundary so app/api/cron/sync-delta/
 * doesn't poke tables directly.
 *
 * Reads also fall here when the sync pipeline needs to detect deltas
 * against the existing row set (e.g. did price change, did status change).
 */

import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type ExistingListingRow = {
  ListNumber: string
  ListingKey: string | null
  StandardStatus: string | null
  ListPrice: number | null
  is_finalized: boolean | null
}

export type SyncState = {
  last_delta_sync_at: string | null
}

/** Read sync_state singleton row (always id = 'default'). */
export async function getSyncState(): Promise<SyncState | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('sync_state')
    .select('last_delta_sync_at')
    .eq('id', 'default')
    .maybeSingle()
  return (data ?? null) as SyncState | null
}

/** Read arbitrary fields from the sync_state singleton. */
export async function getSyncStateFields<T extends Record<string, unknown>>(
  columns: string
): Promise<T | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('sync_state')
    .select(columns)
    .eq('id', 'default')
    .maybeSingle()
  return (data ?? null) as T | null
}

/** Upsert sync_state with the new last_delta_sync_at. */
export async function updateSyncStateLastDelta(
  ts: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('sync_state')
    .upsert({ id: 'default', last_delta_sync_at: ts }, { onConflict: 'id' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Fetch existing listing rows by ListNumber set. Used by delta-sync change detection. */
export async function getExistingListingsByListNumbers(
  listNumbers: string[]
): Promise<ExistingListingRow[]> {
  const sb = client()
  if (!sb || listNumbers.length === 0) return []
  const { data } = await sb
    .from('listings')
    .select('ListNumber, ListingKey, StandardStatus, ListPrice, is_finalized')
    .in('ListNumber', listNumbers.slice(0, 5000))
  return (data ?? []) as ExistingListingRow[]
}

/** Replace listing_history rows for a key: delete-all-then-insert. */
export async function replaceListingHistoryForKey(
  listingKey: string,
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, inserted: 0, error: 'Supabase not configured' }
  const { error: delError } = await sb
    .from('listing_history')
    .delete()
    .eq('listing_key', listingKey)
  if (delError) return { ok: false, inserted: 0, error: delError.message }
  if (rows.length === 0) return { ok: true, inserted: 0 }
  const { error } = await sb.from('listing_history').insert(rows)
  if (error) return { ok: false, inserted: 0, error: error.message }
  return { ok: true, inserted: rows.length }
}

/** Bulk upsert listings rows (chunk by ListNumber). */
export async function upsertListingRows(
  rows: Array<Record<string, unknown>>,
  options: { ignoreDuplicates?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb
    .from('listings')
    .upsert(rows, { onConflict: 'ListNumber', ignoreDuplicates: options.ignoreDuplicates === true })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert price_history events from the delta sync diff. */
export async function insertPriceHistoryRows(
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('price_history').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert status_history events from the delta sync diff. */
export async function insertStatusHistoryRows(
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('status_history').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert activity_events rows. */
export async function insertActivityEventRows(
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('activity_events').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Read a listing's PhotoURL by key. Used by the photo-backfill loop. */
export async function getListingPhotoUrl(listingKey: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select('PhotoURL')
    .eq('ListingKey', listingKey)
    .maybeSingle()
  return (data as { PhotoURL?: string | null } | null)?.PhotoURL ?? null
}

/** Patch the PhotoURL on a listing row. */
export async function updateListingPhotoUrl(
  listingKey: string,
  photoUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('listings')
    .update({ PhotoURL: photoUrl })
    .eq('ListingKey', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// === listing-processor (Spark → relational write pipeline) helpers ===

/** Upsert one expired/withdrawn listing row from a Spark feed. */
export async function upsertExpiredListingRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('expired_listings')
    .upsert(row, { onConflict: 'listing_key', ignoreDuplicates: false })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Find a community by name (exact); returns null when missing. */
export async function findCommunityIdByName(name: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb.from('communities').select('id').eq('name', name).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Find a community by slug; returns null when missing. */
export async function findCommunityIdBySlug(slug: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb.from('communities').select('id').eq('slug', slug).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Insert a community row, return the new id. */
export async function insertCommunityRowReturnId(name: string, slug: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('communities')
    .insert({ name, slug })
    .select('id')
    .single()
  if (error || !data) return null
  return (data as { id?: string } | null)?.id ?? null
}

/** Property: find by unparsed_address. */
export async function findPropertyIdByAddress(unparsed: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('properties')
    .select('id')
    .eq('unparsed_address', unparsed)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Property: insert a minimal-fields row, return id. */
export async function insertPropertyAddressOnly(unparsed: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('properties')
    .insert({ unparsed_address: unparsed })
    .select('id')
    .single()
  if (error || !data) return null
  return (data as { id?: string } | null)?.id ?? null
}

/** Property: insert a wide row, return id. */
export async function insertPropertyFullRow(row: Record<string, unknown>): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb.from('properties').insert(row).select('id').single()
  if (error || !data) return null
  return (data as { id?: string } | null)?.id ?? null
}

/** Property: patch by id. */
export async function updatePropertyById(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('properties').update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Find listing by snake_case listing_key (sync pipeline shape — different from RETS PascalCase). */
export async function findListingBySnakeKey(
  listingKey: string
): Promise<{ id: string; standard_status: string | null; list_price: number | null } | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select('id, standard_status, list_price')
    .eq('listing_key', listingKey)
    .maybeSingle()
  return (data ?? null) as {
    id: string
    standard_status: string | null
    list_price: number | null
  } | null
}

/** Upsert a snake_case listings row (sync pipeline shape). */
export async function upsertListingSnakeRow(row: Record<string, unknown>): Promise<{ id: string | null; error?: string }> {
  const sb = client()
  if (!sb) return { id: null, error: 'Supabase not configured' }
  const { data, error } = await sb
    .from('listings')
    .upsert(row, { onConflict: 'listing_key', ignoreDuplicates: false })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id?: string } | null)?.id ?? null }
}

/** Insert one status_history event. */
export async function insertStatusHistoryRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('status_history').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert one price_history event. */
export async function insertPriceHistoryRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('price_history').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Replace listing_photos for a key (delete-all then insert). */
export async function replaceListingPhotosForKey(
  listingKey: string,
  photos: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error: delErr } = await sb.from('listing_photos').delete().eq('listing_key', listingKey)
  if (delErr) return { ok: false, error: delErr.message }
  if (photos.length === 0) return { ok: true }
  const { error } = await sb.from('listing_photos').insert(photos)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Delete all listing_agents rows for a key (precursor to fresh insert). */
export async function deleteListingAgentsForKey(
  listingKey: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('listing_agents').delete().eq('listing_key', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert a single listing_agents row. */
export async function insertListingAgentRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('listing_agents').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// === sync-spark.ts helpers ===

/** Replace listing_videos rows for a key (delete then bulk insert). */
export async function replaceListingVideosForKey(
  listingKey: string,
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error: delErr } = await sb.from('listing_videos').delete().eq('listing_key', listingKey)
  if (delErr) return { ok: false, error: delErr.message }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('listing_videos').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Upsert sync_state with arbitrary fields (last_delta_sync_at, last_full_sync_at, updated_at, etc.). */
export async function upsertSyncState(
  patch: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('sync_state')
    .upsert({ id: 'default', ...patch }, { onConflict: 'id' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert one activity_events row. */
export async function insertActivityEventRow(
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('activity_events').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Patch listings row by ListNumber. */
export async function updateListingByListNumber(
  listNumber: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('listings').update(updates).eq('ListNumber', listNumber)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Patch listings row by ListingKey. */
export async function updateListingByListingKey(
  listingKey: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('listings').update(updates).eq('ListingKey', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert listing_history rows for a key (no delete first). */
export async function insertListingHistoryRows(
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('listing_history').insert(rows)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Delete all listing_history rows for a key. */
export async function deleteListingHistoryForKey(
  listingKey: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('listing_history')
    .delete()
    .eq('listing_key', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Generic select on listings by ListingKey, returns one row with the requested columns. */
export async function getListingFieldsByListingKey<T extends Record<string, unknown>>(
  listingKey: string,
  columns: string
): Promise<T | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select(columns)
    .eq('ListingKey', listingKey)
    .maybeSingle()
  return (data ?? null) as T | null
}

/** Generic select on listings by ListNumber. */
export async function getListingFieldsByListNumber<T extends Record<string, unknown>>(
  listNumber: string,
  columns: string
): Promise<T | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select(columns)
    .eq('ListNumber', listNumber)
    .maybeSingle()
  return (data ?? null) as T | null
}

/**
 * Sync-pipeline candidate query: listings rows where `history_finalized = false`,
 * with a free-form `or` clause for status scoping, sorted/ranged as the caller
 * needs. Returns rows + error. Used by history-sync admin tooling.
 */
export async function selectHistorySyncCandidates<T extends Record<string, unknown>>(options: {
  columns: string
  statusOr: string
  offset?: number
  limit?: number
  orderBy?: { column: string; ascending: boolean; nullsFirst?: boolean }
}): Promise<{ rows: T[] | null; error: string | null }> {
  const sb = client()
  if (!sb) return { rows: null, error: 'Supabase not configured' }
  let q = sb.from('listings').select(options.columns).eq('history_finalized', false).or(options.statusOr)
  if (options.orderBy) {
    q = q.order(options.orderBy.column, {
      ascending: options.orderBy.ascending,
      nullsFirst: options.orderBy.nullsFirst ?? !options.orderBy.ascending ? false : true,
    })
  }
  if (typeof options.offset === 'number' && typeof options.limit === 'number') {
    q = q.range(options.offset, options.offset + options.limit - 1)
  } else if (typeof options.limit === 'number') {
    q = q.limit(options.limit)
  }
  const { data, error } = await q
  return { rows: (data ?? []) as unknown as T[], error: error?.message ?? null }
}

/** Insert one strict_verify_runs telemetry row. */
export async function insertStrictVerifyRun(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('strict_verify_runs').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Candidates for strict verify: history_finalized = true + history_verified_full = false
 * + terminal status OR + optional OnMarketDate window. Sorted by OnMarketDate DESC.
 */
export async function selectStrictVerifyCandidates<T extends Record<string, unknown>>(options: {
  columns: string
  terminalStatusOr: string
  limit: number
  onMarketFromIso?: string | null
  onMarketToIsoExclusive?: string | null
}): Promise<{ rows: T[]; error: string | null }> {
  const sb = client()
  if (!sb) return { rows: [], error: 'Supabase not configured' }
  let q = sb
    .from('listings')
    .select(options.columns)
    .eq('history_finalized', true)
    .eq('history_verified_full', false)
    .or(options.terminalStatusOr)
    .order('OnMarketDate', { ascending: false, nullsFirst: false })
    .limit(options.limit)
  if (options.onMarketFromIso) q = q.gte('OnMarketDate', options.onMarketFromIso)
  if (options.onMarketToIsoExclusive) q = q.lt('OnMarketDate', options.onMarketToIsoExclusive)
  const { data, error } = await q
  return { rows: (data ?? []) as unknown as T[], error: error?.message ?? null }
}

/** Read owner_lookup_attempts counter from expired_listings (admin). */
export async function getExpiredListingLookupAttempts(
  listingKey: string
): Promise<number> {
  const sb = client()
  if (!sb) return 0
  const { data } = await sb
    .from('expired_listings')
    .select('owner_lookup_attempts')
    .eq('listing_key', listingKey)
    .maybeSingle()
  return Number((data as { owner_lookup_attempts?: number } | null)?.owner_lookup_attempts ?? 0)
}

/** Update an expired_listings row by listing_key (admin enrichment). */
export async function updateExpiredListingByKey(
  listingKey: string,
  update: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('expired_listings').update(update).eq('listing_key', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Read sync_cursor singleton (admin health checks). */
export async function getSyncCursor(): Promise<{
  last_completed_at?: string | null
  cron_enabled?: boolean | null
} | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('sync_cursor')
    .select('last_completed_at, cron_enabled')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as {
    last_completed_at?: string | null
    cron_enabled?: boolean | null
  } | null
}

/** Count rows in `listings` matching a flexible OR + null-check (admin health). */
export async function countListingsByOr(
  statusOr: string,
  photoColumnIsNull?: string
): Promise<number> {
  const sb = client()
  if (!sb) return 0
  let q = sb.from('listings').select('listing_key', { count: 'exact', head: true }).or(statusOr)
  if (photoColumnIsNull) q = q.is(photoColumnIsNull, null)
  const { count } = await q
  return count ?? 0
}

/** Count all listings (admin health). */
export async function countAllListingsByListingKey(): Promise<number> {
  const sb = client()
  if (!sb) return 0
  const { count } = await sb
    .from('listings')
    .select('listing_key', { count: 'exact', head: true })
  return count ?? 0
}

/** Most-recent market_pulse_live updated_at. */
export async function getLatestMarketPulseUpdatedAt(): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('market_pulse_live')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { updated_at?: string | null } | null)?.updated_at ?? null
}

/** Count listing_inquiries rows since an ISO timestamp. */
export async function countListingInquiriesSince(sinceIso: string): Promise<number> {
  const sb = client()
  if (!sb) return 0
  const { count } = await sb
    .from('listing_inquiries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  return count ?? 0
}

/** Count saved_searches rows since an ISO timestamp. */
export async function countSavedSearchesSince(sinceIso: string): Promise<number> {
  const sb = client()
  if (!sb) return 0
  const { count } = await sb
    .from('saved_searches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  return count ?? 0
}

/** Insert an optimization_runs telemetry row. */
export async function insertOptimizationRun(
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('optimization_runs').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Get any one ListingKey/ListNumber from the listings table — used by sync test harnesses. */
export async function getAnyListingKey(): Promise<{ ListingKey: string | null; ListNumber: string | null } | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select('ListingKey, ListNumber')
    .order('ListNumber', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as { ListingKey: string | null; ListNumber: string | null } | null
}

/** Does at least one listing_history row exist for any of these keys? */
export async function listingHistoryExistsForAnyKey(keys: string[]): Promise<boolean> {
  const sb = client()
  if (!sb || keys.length === 0) return false
  const { data } = await sb
    .from('listing_history')
    .select('listing_key')
    .in('listing_key', keys.slice(0, 5000))
    .limit(1)
  return Array.isArray(data) && data.length > 0
}

/** Count of history-needing candidates (history_finalized = false + status OR). */
export async function countHistorySyncCandidates(statusOr: string): Promise<{ count: number; error: string | null }> {
  const sb = client()
  if (!sb) return { count: 0, error: 'Supabase not configured' }
  const { count, error } = await sb
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('history_finalized', false)
    .or(statusOr)
  return { count: count ?? 0, error: error?.message ?? null }
}
