/**
 * Slim listings lookup for /listing/by-key → pretty-URL redirect.
 *
 * Selects ONLY the columns listingDetailPath needs. Do not use
 * getListingRawRowByKey / getListingDetail here — those pull photos,
 * agents, remarks, and the rest of the wide row for a hop that never
 * renders them.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { resolveCanonicalListingKey } from './resolveCanonicalListingKey'

const PATH_SELECT = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  'boundary_city',
  'boundary_neighborhood',
  'boundary_subdivision',
  // Display permissions. Not path fields — read only to REFUSE. See
  // mayDisplayPublicly below.
  'permit_internet_yn',
  'permit_address_internet_yn',
  'idx_participant',
].join(', ')

/**
 * IDX compliance (ODS Rule B/G, NAR 7.58) — the same gate getListingDetail
 * applies, applied here too (2026-08-19).
 *
 * This lookup feeds /listing/by-key, whose generateMetadata publishes the
 * street address in the <title> and a self-canonical to the pretty URL. Without
 * this gate it did that for a listing whose seller opted out of internet
 * display: https://ryan-realty.com/homes-for-sale/listing/220215050 served
 * `<title>1801 Rosa Parks, Portland | …</title>` and a canonical to
 * /homes-for-sale/outside-boundaries/1801-rosa-parks-220215050 while the detail
 * page for that same row correctly refused. A hop that may not show the home
 * may not publish its address either.
 *
 * Coming Soon needs no check here: the `Public read listings excludes coming
 * soon` RLS policy on `listings` already hides those rows from the anon client
 * this module uses.
 */
function mayDisplayPublicly(row: Record<string, unknown>): boolean {
  return (
    row.permit_internet_yn !== false &&
    row.permit_address_internet_yn !== false &&
    row.idx_participant !== false
  )
}

export type ListingCanonicalPathFields = {
  ListingKey: string
  ListNumber: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function mapRow(row: Record<string, unknown>): ListingCanonicalPathFields | null {
  const listingKey = asNullableString(row.ListingKey)
  if (!listingKey) return null
  return {
    ListingKey: listingKey,
    ListNumber: asNullableString(row.ListNumber),
    StreetNumber: asNullableString(row.StreetNumber),
    StreetName: asNullableString(row.StreetName),
    City: asNullableString(row.City),
    State: asNullableString(row.State),
    PostalCode: asNullableString(row.PostalCode),
    SubdivisionName: asNullableString(row.SubdivisionName),
    boundary_city: asNullableString(row.boundary_city),
    boundary_neighborhood: asNullableString(row.boundary_neighborhood),
    boundary_subdivision: asNullableString(row.boundary_subdivision),
  }
}

async function fetchPathFields(listingKey: string): Promise<ListingCanonicalPathFields | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  // @canonical-key — listingKey is already resolveCanonicalListingKey output.
  const { data, error } = await sb.from('listings').select(PATH_SELECT).eq('ListingKey', listingKey).maybeSingle()
  if (error) throw error
  if (!data || typeof data !== 'object') return null // poison-null-ok — genuine miss
  const row = data as Record<string, unknown>
  // A listing we may not display is a MISS for this hop, exactly as it is for
  // getListingDetail — the caller then renders the refusal instead of a
  // redirect that names the address. poison-null-ok — a permission flag is
  // durable, not transient.
  if (!mayDisplayPublicly(row)) return null
  return mapRow(row)
}

/** Resolve ListNumber or ListingKey, then return path fields only. */
export async function getListingCanonicalPathFields(
  key: string
): Promise<ListingCanonicalPathFields | null> {
  const trimmed = String(key ?? '').trim()
  if (!trimmed) return null
  const listingKey = await resolveCanonicalListingKey(trimmed)
  if (!listingKey) return null
  return unstable_cache(
    () => fetchPathFields(listingKey),
    // v2 bump 2026-08-19 — evicts entries cached BEFORE the display-permission
    // gate above existed. unstable_cache survives a deploy (the Vercel Data
    // Cache is not per-build), so without the bump an already-cached
    // opted-out row keeps serving its street address in the by-key <title>
    // until the TTL expires. Reproduced locally: after adding the gate and
    // rebuilding, /homes-for-sale/listing/220221984 still served
    // "71 Graham, Portland" from the v1 entry while two uncached refused rows
    // correctly rendered the refusal.
    ['listing-canonical-path-fields-v2', listingKey],
    { revalidate: CACHE_WINDOWS.listingDetail, tags: [cacheTag.listings] }
  )()
}
