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

/** Read activity_events rows, optionally filtered by event_type, paginated newest-first. */
export async function getActivityEvents(options: {
  eventTypes?: string[]
  offset: number
  limit: number
}): Promise<Array<{ id: string; listing_key: string; event_type: string; event_at: string; payload?: Record<string, unknown> }>> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('activity_events')
    .select('id, listing_key, event_type, event_at, payload')
    .order('event_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1)
  if (options.eventTypes && options.eventTypes.length > 0) {
    q = q.in('event_type', options.eventTypes)
  }
  const { data } = await q
  return (data ?? []) as Array<{ id: string; listing_key: string; event_type: string; event_at: string; payload?: Record<string, unknown> }>
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

/** Read one open_house row by id + listing_key (RSVP path; must be future). */
export async function getOpenHouseByIdAndListing(
  openHouseId: string,
  listingId: string
): Promise<{ id: string; listing_key: string; event_date: string; start_time?: string | null; end_time?: string | null; rsvp_count?: number } | null> {
  const sb = client()
  if (!sb) return null
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await sb
    .from('open_houses')
    .select('id, listing_key, event_date, start_time, end_time, rsvp_count')
    .eq('id', openHouseId)
    .eq('listing_key', listingId)
    .gte('event_date', today)
    .maybeSingle()
  return (data ?? null) as { id: string; listing_key: string; event_date: string; start_time?: string | null; end_time?: string | null; rsvp_count?: number } | null
}

/** Insert one open_house_rsvps row. Returns dedup status when 23505 hit. */
export async function insertOpenHouseRsvp(row: { open_house_id: string; user_id: string }): Promise<{ ok: boolean; alreadyRsvped?: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('open_house_rsvps').insert(row)
  if (error) {
    if (error.code === '23505') return { ok: true, alreadyRsvped: true }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Bump an open_house's rsvp_count by 1. */
export async function bumpOpenHouseRsvpCount(
  openHouseId: string,
  currentCount: number
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('open_houses')
    .update({ rsvp_count: currentCount + 1, updated_at: new Date().toISOString() })
    .eq('id', openHouseId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert a notification_queue row. */
export async function insertNotificationQueueRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('notification_queue').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
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

/** Find properties matching a city + optional state + optional postal_code filter. */
export async function findPropertiesByAddressFilter(params: {
  city: string
  state?: string | null
  postalCode?: string | null
  limit?: number
}): Promise<Array<{ id: string; unparsed_address?: string | null; city?: string | null; state?: string | null; postal_code?: string | null }>> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('properties')
    .select('id, unparsed_address, city, state, postal_code')
    .ilike('city', params.city)
  if (params.state?.trim()) q = q.ilike('state', params.state.trim())
  if (params.postalCode?.trim()) q = q.eq('postal_code', params.postalCode.trim().slice(0, 20))
  const { data } = await q.limit(Math.min(Math.max(params.limit ?? 20, 1), 100))
  return (data ?? []) as Array<{ id: string; unparsed_address?: string | null; city?: string | null; state?: string | null; postal_code?: string | null }>
}

/** Look up a property row by id (admin/CMA flows). */
export async function getPropertyById(id: string): Promise<{ unparsed_address?: string | null; street_number?: string | null; city?: string | null; postal_code?: string | null } | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('properties')
    .select('unparsed_address, street_number, city, postal_code')
    .eq('id', id)
    .single()
  return (data ?? null) as { unparsed_address?: string | null; street_number?: string | null; city?: string | null; postal_code?: string | null } | null
}

/** Fetch newly expired/canceled/withdrawn listings in our service area for the expired-listing pipeline. */
export async function selectNewExpiredListings(options: {
  sinceIso: string
  serviceAreaCities: readonly string[]
  minListPrice: number
  limit: number
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const { data, error } = await sb
    .from('listings')
    .select(
      'ListingKey,ListNumber,StandardStatus,status_change_timestamp,StreetNumber,StreetName,City,PostalCode,ListPrice,OriginalListPrice,CumulativeDaysOnMarket,ListAgentName,list_agent_email,PropertyType,BedroomsTotal,BathroomsTotalDecimal,TotalLivingAreaSqFt,SubdivisionName',
    )
    .in('StandardStatus', ['Expired', 'Canceled', 'Withdrawn'])
    .gt('status_change_timestamp', options.sinceIso)
    .in('City', options.serviceAreaCities as readonly string[])
    .eq('PropertyType', 'A')
    .gt('ListPrice', options.minListPrice)
    .order('status_change_timestamp', { ascending: false })
    .limit(options.limit)
  if (error) {
    console.error('[selectNewExpiredListings] error:', error.message)
    return []
  }
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Get the set of listing_keys already present in expired_listings (dedup check). */
export async function getExistingExpiredListingKeys(keys: string[]): Promise<Set<string>> {
  const sb = client()
  if (!sb || keys.length === 0) return new Set()
  const { data } = await sb
    .from('expired_listings')
    .select('listing_key')
    .in('listing_key', keys.slice(0, 5000))
  return new Set(((data ?? []) as Array<{ listing_key: string }>).map((r) => r.listing_key))
}

/** Closed listings for CMA comp pool (city + optional subdivision + lot range). */
export async function selectClosedListingsForCma(options: {
  cityIlike: string
  subdivisionIlike?: string | null
  monthsBack: number
  maxCount: number
  lotAcresMin?: number | null
  lotAcresMax?: number | null
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - options.monthsBack)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  let query = sb
    .from('listings')
    .select(
      'ListingKey, ListNumber, StreetNumber, StreetName, City, ClosePrice, CloseDate, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType, property_sub_type, SubdivisionName, ListPrice, details, lot_size_acres, year_built'
    )
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', cutoffStr)
    .ilike('City', options.cityIlike)
    .or('PropertyType.eq.A,PropertyType.ilike.%Residential%')
  if (options.subdivisionIlike) {
    query = query.ilike('SubdivisionName', options.subdivisionIlike)
  }
  if (options.lotAcresMin != null) query = query.gte('lot_size_acres', options.lotAcresMin)
  if (options.lotAcresMax != null) query = query.lte('lot_size_acres', options.lotAcresMax)
  const { data } = await query.order('CloseDate', { ascending: false }).limit(options.maxCount)
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Read a wide listings row by key for CMA subject resolution. */
export async function getListingForCmaSubject(
  key: string
): Promise<Record<string, unknown> | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('listings')
    .select('ListingKey, ListNumber, StreetNumber, StreetName, City, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType')
    .or(`ListingKey.eq.${key},ListNumber.eq.${key}`)
    .maybeSingle()
  return (data ?? null) as Record<string, unknown> | null
}

/** Property lookup by postal + street number (CMA delivery resolver). */
export async function findPropertiesByPostalAndStreet(options: {
  postalCode?: string | null
  streetNumber?: string | null
  limit?: number
}): Promise<Array<{ id: string; unparsed_address?: string; street_number?: string; street_name?: string; city?: string; state?: string; postal_code?: string }>> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('properties')
    .select('id, unparsed_address, street_number, street_name, city, state, postal_code')
  if (options.postalCode?.trim()) q = q.eq('postal_code', options.postalCode.trim().slice(0, 20))
  if (options.streetNumber && /^\d+/.test(options.streetNumber)) {
    q = q.eq('street_number', options.streetNumber)
  }
  const { data } = await q.limit(Math.min(Math.max(options.limit ?? 50, 1), 200))
  return (data ?? []) as Array<{ id: string; unparsed_address?: string; street_number?: string; street_name?: string; city?: string; state?: string; postal_code?: string }>
}

/** CMA-specific listings lookup for subject (3-attempt retry with status/recency tiebreak). */
export async function selectCmaSubjectListings(options: {
  postalCode?: string | null
  streetNumber?: string | null
  cityIlike: string
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  for (let attempt = 0; attempt < 3; attempt++) {
    let q = sb
      .from('listings')
      .select(
        'ListingKey, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType, StandardStatus, lot_size_acres, year_built, ModificationTimestamp'
      )
    if (options.postalCode) q = q.eq('PostalCode', options.postalCode)
    if (options.streetNumber) q = q.eq('StreetNumber', options.streetNumber)
    q = q.ilike('City', options.cityIlike)
    const { data, error } = await q.limit(20)
    if (!error) return (data ?? []) as unknown as Array<Record<string, unknown>>
    await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 1500))
  }
  return []
}

/** Insert a valuation_requests row (home-valuation form). */
export async function insertValuationRequest(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('valuation_requests').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** List expired_listings rows for admin UI (paginated, optionally city-filtered). */
export async function listExpiredListingsForAdmin(options: {
  limit: number
  offset: number
  city?: string | null
}): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  const sb = client()
  if (!sb) return { rows: [], total: 0 }
  let q = sb
    .from('expired_listings')
    .select(
      'id, listing_key, full_address, city, state, postal_code, owner_name, list_agent_name, list_office_name, list_price, original_list_price, days_on_market, expired_at, standard_status, contact_phone, contact_email, contact_source, enrichment_notes, created_at, updated_at',
      { count: 'exact' },
    )
    .order('expired_at', { ascending: false })
  if (options.city?.trim()) q = q.ilike('city', options.city.trim())
  const { data, count } = await q.range(options.offset, options.offset + options.limit - 1)
  return { rows: (data ?? []) as Array<Record<string, unknown>>, total: count ?? data?.length ?? 0 }
}

/** Update an expired_listings row by primary id (admin enrichment). */
export async function updateExpiredListingById(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('expired_listings').update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
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

/** Read one cmas row by slug (CMA email + admin detail). */
export async function getCmaBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb.from('cmas').select('*').eq('slug', slug).maybeSingle()
  return (data ?? null) as Record<string, unknown> | null
}

/** Insert a cmas row (CMA producer / lib/cma-request). */
export async function insertCmaRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('cmas').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Upsert a cmas row by slug, return the new/updated id+slug. */
export async function upsertCmaRowBySlug(
  row: Record<string, unknown>
): Promise<{ id: string | null; slug: string | null; error?: string }> {
  const sb = client()
  if (!sb) return { id: null, slug: null, error: 'Supabase not configured' }
  const { data, error } = await sb
    .from('cmas')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug')
    .single()
  if (error) return { id: null, slug: null, error: error.message }
  return {
    id: (data as { id?: string } | null)?.id ?? null,
    slug: (data as { slug?: string } | null)?.slug ?? null,
  }
}

/** Paginated cmas list for admin detail. */
export async function listCmasForAdmin(options: {
  limit: number
  offset: number
}): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  const sb = client()
  if (!sb) return { rows: [], total: 0 }
  const { data, count } = await sb
    .from('cmas')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1)
  return { rows: (data ?? []) as Array<Record<string, unknown>>, total: count ?? data?.length ?? 0 }
}

/** Aggregate CMA count for analytics (delivered/final/sent in range). */
export async function countCmasInRange(options: {
  fromIso?: string
  toIso?: string
  statusIn?: string[]
}): Promise<number> {
  const sb = client()
  if (!sb) return 0
  let q = sb.from('cmas').select('id', { count: 'exact', head: true })
  if (options.statusIn && options.statusIn.length > 0) q = q.in('status', options.statusIn)
  if (options.fromIso) q = q.gte('created_at', options.fromIso)
  if (options.toIso) q = q.lte('created_at', options.toIso)
  const { count } = await q
  return count ?? 0
}

/** Boundaries row reader (cron/refresh-market-stats). */
export async function getBoundariesByGeoType(options: {
  geoType: string
  limit?: number
  columns?: string
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const columns = options.columns ?? 'slug, geo_type, geo_label, geo_name'
  const { data } = await sb
    .from('boundaries')
    .select(columns)
    .eq('geo_type', options.geoType)
    .limit(Math.min(Math.max(options.limit ?? 5000, 1), 50000))
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Upsert one video_tours_cache row. */
export async function upsertVideoToursCacheRow(row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('video_tours_cache').upsert(row, { onConflict: 'scope' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Read expired_listings rows for pipeline-digest (gte expired_at). */
export async function getExpiredListingsForDigest(options: {
  sinceIso: string
  limit?: number
}): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const { data } = await sb
    .from('expired_listings')
    .select('*')
    .gte('expired_at', options.sinceIso)
    .order('expired_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 200, 1), 5000))
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Generic listings select with flexible columns + filter — used by remaining admin/cron files. */
export async function selectListingsAdmin<T extends Record<string, unknown>>(options: {
  columns: string
  filter?: (q: unknown) => unknown
  limit?: number
}): Promise<T[]> {
  const sb = client()
  if (!sb) return []
  let q: unknown = sb.from('listings').select(options.columns)
  if (options.filter) q = options.filter(q)
  if (typeof options.limit === 'number') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q = (q as any).limit(options.limit)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (q as any)
  return (data ?? []) as T[]
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

/** Count listings matching a status OR (no history_finalized filter). */
export async function countListingsByStatusOr(statusOr: string): Promise<{ count: number; error: string | null }> {
  const sb = client()
  if (!sb) return { count: 0, error: 'Supabase not configured' }
  const { count, error } = await sb
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .or(statusOr)
  return { count: count ?? 0, error: error?.message ?? null }
}

/** Count listings with status OR + history_finalized = true. */
export async function countListingsByStatusOrAndFinalized(statusOr: string): Promise<{ count: number; error: string | null }> {
  const sb = client()
  if (!sb) return { count: 0, error: 'Supabase not configured' }
  const { count, error } = await sb
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .or(statusOr)
    .eq('history_finalized', true)
  return { count: count ?? 0, error: error?.message ?? null }
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
