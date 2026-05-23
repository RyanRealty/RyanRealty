/**
 * Admin listing edit + photo CRUD.
 *
 * Owns every read + write against `listings.details` (for admin overrides)
 * and the `listing_photos` table from the admin-listing-detail flow. Lives
 * behind the DAL boundary so app/actions/admin-listing-detail.ts becomes a
 * thin server-action wrapper.
 */

import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type ListingDetailsJson = {
  PublicRemarks?: string
  admin_overrides?: {
    admin_notes?: string | null
    marketing_headline?: string | null
    featured?: boolean
  }
  [k: string]: unknown
}

export type AdminEditableListingRow = {
  ListingKey: string | null
  ListNumber: string | null
  ListPrice: number | null
  StandardStatus: string | null
  details: ListingDetailsJson | null
}

/** Look up a listing row by ListingKey then ListNumber, returning the wide editable shape. */
export async function getAdminEditableListingRow(
  listingKeyOrNumber: string
): Promise<AdminEditableListingRow | null> {
  const sb = client()
  if (!sb) return null
  const key = String(listingKeyOrNumber ?? '').trim()
  if (!key) return null

  const byListingKey = await sb
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, StandardStatus, details')
    .eq('ListingKey', key)
    .maybeSingle()
  if (byListingKey.data) return byListingKey.data as AdminEditableListingRow

  const byListNumber = await sb
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, StandardStatus, details')
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
  const { error } = await sb
    .from('listings')
    .update({
      ListPrice: patch.ListPrice,
      StandardStatus: patch.StandardStatus?.trim() || null,
      details: patch.details,
      ModificationTimestamp: new Date().toISOString(),
    })
    .eq('ListingKey', listingKey)
  return error ? { ok: false, error: error.message } : { ok: true }
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
  const { data } = await sb
    .from('listing_photos')
    .select('id, listing_key, photo_url, cdn_url, sort_order, caption, is_hero')
    .eq('listing_key', listingKey)
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
  const { data: existing } = await sb
    .from('listing_photos')
    .select('sort_order')
    .eq('listing_key', input.listingKey)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = ((existing as { sort_order?: number } | null)?.sort_order ?? -1) + 1
  const { error } = await sb.from('listing_photos').insert({
    listing_key: input.listingKey,
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
  const { error } = await sb
    .from('listing_photos')
    .delete()
    .eq('listing_key', input.listingKey)
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
  const reset = await sb
    .from('listing_photos')
    .update({ is_hero: false })
    .eq('listing_key', input.listingKey)
  if (reset.error) return { ok: false, error: reset.error.message }
  const set = await sb
    .from('listing_photos')
    .update({ is_hero: true })
    .eq('listing_key', input.listingKey)
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
  for (let i = 0; i < input.orderedPhotoIds.length; i += 1) {
    const id = input.orderedPhotoIds[i]
    const { error } = await sb
      .from('listing_photos')
      .update({ sort_order: i })
      .eq('listing_key', input.listingKey)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}
