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
  rows: Array<Record<string, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true }
  const { error } = await sb.from('listings').upsert(rows, { onConflict: 'ListNumber' })
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
