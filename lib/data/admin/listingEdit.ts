/**
 * Admin listing edit + photo CRUD.
 *
 * Owns every read + write against `listings.details` (for admin overrides)
 * and the `listing_photos` table from the admin-listing-detail flow. Lives
 * behind the DAL boundary so app/actions/admin-listing-detail.ts becomes a
 * thin server-action wrapper.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/**
 * Broker-owned fields that MUST survive a Spark re-sync. Written by the admin
 * editor; merged back onto the row by upsertListingRows (P12). Flat Spark
 * upserts rebuild `details` without these keys — that was the silent revert.
 */
export type AdminListingOverrides = {
  admin_notes?: string | null
  marketing_headline?: string | null
  featured?: boolean
  /** When true, ListPrice on the row is broker-owned and re-applied after sync. */
  list_price_set?: boolean
  list_price?: number | null
  /** When true, StandardStatus on the row is broker-owned. */
  standard_status_set?: boolean
  standard_status?: string | null
  /** When true, details.PublicRemarks is broker-owned. */
  public_remarks_set?: boolean
  public_remarks?: string | null
}

export type ListingDetailsJson = {
  PublicRemarks?: string
  admin_overrides?: AdminListingOverrides
  [k: string]: unknown
}

export type AdminEditableListingRow = {
  ListingKey: string | null
  ListNumber: string | null
  ListPrice: number | null
  StandardStatus: string | null
  details: ListingDetailsJson | null
  // P1-4: media suppression flag for the owner photo-removal mechanism
  media_suppressed: boolean | null
}

/** Look up a listing row by ListingKey then ListNumber, returning the wide editable shape. */
export async function getAdminEditableListingRow(
  listingKeyOrNumber: string
): Promise<AdminEditableListingRow | null> {
  const sb = client()
  if (!sb) return null
  const key = String(listingKeyOrNumber ?? '').trim()
  if (!key) return null

  // P1-4: include media_suppressed so the admin editor can display and toggle it.
  const byListingKey = await sb
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, StandardStatus, details, media_suppressed')
    .eq('ListingKey', key)
    .maybeSingle()
  if (byListingKey.data) return byListingKey.data as AdminEditableListingRow

  const byListNumber = await sb
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, StandardStatus, details, media_suppressed')
    .eq('ListNumber', key)
    .maybeSingle()
  if (byListNumber.data) return byListNumber.data as AdminEditableListingRow

  return null
}

/** Patch the editable subset of a listing row. */
export async function updateAdminEditableListingRow(
  listingKey: string,
  patch: { ListPrice: number | null; StandardStatus: string | null; details: ListingDetailsJson }
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }

  // Stamp sync-proof overrides so the next delta cannot silently wipe the edit
  // (P12 / data-atlas chain 10). PublicRemarks lives in details; price/status
  // are top-level columns — both are recorded under admin_overrides with *_set.
  const prev = (patch.details?.admin_overrides ?? {}) as AdminListingOverrides
  const publicRemarks =
    typeof patch.details?.PublicRemarks === 'string' ? patch.details.PublicRemarks : null
  const admin_overrides: AdminListingOverrides = {
    ...prev,
    list_price_set: true,
    list_price: patch.ListPrice,
    standard_status_set: true,
    standard_status: patch.StandardStatus?.trim() || null,
    public_remarks_set: true,
    public_remarks: publicRemarks,
  }
  const details: ListingDetailsJson = {
    ...(patch.details ?? {}),
    admin_overrides,
  }

  const { error } = await sb
    .from('listings')
    .update({
      ListPrice: patch.ListPrice,
      StandardStatus: patch.StandardStatus?.trim() || null,
      details,
      ModificationTimestamp: new Date().toISOString(),
    })
    .eq('ListingKey', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Re-apply broker-owned admin_overrides onto a Spark-built listing row.
 * Pure. Used by the sync upsert path so admin edits survive re-sync.
 */
export function applyAdminOverridesToListingRow(
  row: Record<string, unknown>,
  existingDetails: ListingDetailsJson | null | undefined,
): Record<string, unknown> {
  const overrides = existingDetails?.admin_overrides
  if (!overrides) return row

  const nextDetails: ListingDetailsJson = {
    ...((row.details as ListingDetailsJson | null | undefined) ?? {}),
    admin_overrides: {
      ...(((row.details as ListingDetailsJson | null | undefined)?.admin_overrides) ?? {}),
      ...overrides,
    },
  }
  if (overrides.public_remarks_set) {
    nextDetails.PublicRemarks = overrides.public_remarks ?? undefined
  }

  const out: Record<string, unknown> = { ...row, details: nextDetails }
  if (overrides.list_price_set) {
    out.ListPrice = overrides.list_price ?? null
  }
  if (overrides.standard_status_set) {
    out.StandardStatus = overrides.standard_status ?? null
  }
  return out
}

export type ListingPhotoRow = {
  id: string
  listing_key: string
  photo_url: string
  cdn_url?: string | null
  sort_order: number | null
  caption?: string | null
  is_hero?: boolean | null
}

/** All listing_photos rows for a listing, ordered by sort_order ASC. */
export async function getListingPhotosForKey(listingKey: string): Promise<ListingPhotoRow[]> {
  const sb = client()
  if (!sb) return []
  const canonicalKey = await resolveCanonicalListingKey(listingKey)
  const { data } = await sb
    .from('listing_photos')
    .select('id, listing_key, photo_url, cdn_url, sort_order, caption, is_hero')
    .eq('listing_key', canonicalKey)
    .order('sort_order', { ascending: true })
  return (data ?? []) as ListingPhotoRow[]
}

/** Append a photo at the end of the sort order. */
export async function appendListingPhoto(input: {
  listingKey: string
  photoUrl: string
  caption?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const canonicalKey = await resolveCanonicalListingKey(input.listingKey)
  const { data: existing } = await sb
    .from('listing_photos')
    .select('sort_order')
    .eq('listing_key', canonicalKey)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = ((existing as { sort_order?: number } | null)?.sort_order ?? -1) + 1
  const { error } = await sb.from('listing_photos').insert({
    listing_key: canonicalKey,
    photo_url: input.photoUrl,
    sort_order: nextSort,
    caption: input.caption?.trim() || null,
    is_hero: false,
    source: 'admin',
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Delete a single photo row by id (within a listing). */
export async function deleteListingPhoto(input: {
  listingKey: string
  photoId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const canonicalKey = await resolveCanonicalListingKey(input.listingKey)
  const { error } = await sb
    .from('listing_photos')
    .delete()
    .eq('listing_key', canonicalKey)
    .eq('id', input.photoId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Mark one photo as is_hero=true, all others false (per listing). */
export async function setListingHeroPhoto(input: {
  listingKey: string
  photoId: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const canonicalKey = await resolveCanonicalListingKey(input.listingKey)
  const reset = await sb
    .from('listing_photos')
    .update({ is_hero: false })
    .eq('listing_key', canonicalKey)
  if (reset.error) return { ok: false, error: reset.error.message }
  const set = await sb
    .from('listing_photos')
    .update({ is_hero: true })
    .eq('listing_key', canonicalKey)
    .eq('id', input.photoId)
  return set.error ? { ok: false, error: set.error.message } : { ok: true }
}

/** Apply a full ordering: each id gets sort_order = its index in orderedPhotoIds. */
export async function reorderListingPhotos(input: {
  listingKey: string
  orderedPhotoIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const canonicalKey = await resolveCanonicalListingKey(input.listingKey)
  for (let i = 0; i < input.orderedPhotoIds.length; i += 1) {
    const id = input.orderedPhotoIds[i]
    const { error } = await sb
      .from('listing_photos')
      .update({ sort_order: i })
      .eq('listing_key', canonicalKey)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}


/** Load existing admin_overrides for a batch of ListNumbers and merge onto Spark rows. */
export async function mergeListingRowsWithAdminOverrides(
  rows: Array<Record<string, unknown>>,
): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | { ok: false; error: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (rows.length === 0) return { ok: true, rows }
  const listNumbers = [
    ...new Set(
      rows
        .map((r) => (typeof r.ListNumber === 'string' ? r.ListNumber : null))
        .filter((n): n is string => Boolean(n)),
    ),
  ]
  if (listNumbers.length === 0) return { ok: true, rows }
  const existingByNumber = new Map<string, ListingDetailsJson | null>()
  const CHUNK = 200
  for (let i = 0; i < listNumbers.length; i += CHUNK) {
    const slice = listNumbers.slice(i, i + CHUNK)
    const { data, error: readErr } = await sb
      .from('listings')
      .select('ListNumber, details')
      .in('ListNumber', slice)
    if (readErr) return { ok: false, error: `admin_overrides merge read failed: ${readErr.message}` }
    for (const row of data ?? []) {
      const ln = (row as { ListNumber?: string }).ListNumber
      if (ln) existingByNumber.set(ln, ((row as { details?: ListingDetailsJson | null }).details) ?? null)
    }
  }
  return {
    ok: true,
    rows: rows.map((r) => {
      const ln = typeof r.ListNumber === 'string' ? r.ListNumber : null
      if (!ln) return r
      const existing = existingByNumber.get(ln)
      if (existing === undefined) return r
      return applyAdminOverridesToListingRow(r, existing)
    }),
  }
}
